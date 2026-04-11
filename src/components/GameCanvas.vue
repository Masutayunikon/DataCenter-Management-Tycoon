<template>
  <div class="canvas-wrapper" :class="{ 'placing': mode === 'place-rack', 'server-alert-flash': serverAlert }">

    <!-- Floor tab bar -->
    <div class="floor-tabs">
      <span class="floor-tabs-label">🏢 Étages</span>
      <button
        v-for="floor in gameState.floors"
        :key="floor.id"
        class="floor-btn"
        :class="{ active: gameState.currentFloor === floor.id }"
        @click="switchFloor(floor.id)"
      >
        {{ floor.name }}
      </button>
      <button
        class="floor-btn new-floor"
        :class="{ disabled: gameState.money < nextFloorCost }"
        :title="`Acheter ${nextFloorName} — $${nextFloorCost.toLocaleString()}`"
        @click="$emit('buy-floor')"
      >
        + ${{ nextFloorCost.toLocaleString() }}
      </button>
    </div>

    <canvas
      ref="canvasRef"
      @mousedown="onMouseDown"
      @mousemove="onMouseMove"
      @mouseup="onMouseUp"
      @mouseleave="onMouseLeave"
      @contextmenu.prevent
      @wheel.prevent="onWheel"
      @click="onClick"
    />
    <div class="status-bar">
      <span v-if="mode === 'place-rack'" class="mode-label">
        MODE: PLACE RACK — click an empty cell
        <button class="cancel-btn" @click.stop="$emit('cancel-mode')">Cancel [Esc]</button>
      </span>
      <span v-else class="hover-info">
        <span v-if="hoveredCell">
          {{ hoveredCell.locked ? '[verrouillé]' : hoveredCell.notation }}
        </span>
        <span v-else>—</span>
        <span style="margin-left: 16px">
          Sel: <strong>{{ selectedCell ? selectedCell.notation : '—' }}</strong>
        </span>
      </span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { COLUMNS, ROWS, SERVER_TYPES, FLOOR_COST_BASE } from '../game/GameState.js'
import { isAdjacentToUnlocked, getUnlockCost } from '../game/SimulationEngine.js'

const props = defineProps({
  gameState:   { type: Object,  required: true },
  mode:        { type: String,  default: 'default' },
  serverAlert: { type: Boolean, default: false },
})

const emit = defineEmits(['cell-selected', 'place-rack', 'cancel-mode', 'unlock-cell', 'buy-floor', 'set-floor', 'open-shop'])

const canvasRef   = ref(null)
const hoveredCell = ref(null)
const selectedCell = ref(null)

// Camera state
const cameraX = ref(0)
const cameraY = ref(0)
const zoom    = ref(1)

let isDragging = false
let dragStartX = 0
let dragStartY = 0
let camStartX  = 0
let camStartY  = 0
let didDragPan = false // To prevent trigger onClick after panning

// Layout
const TILE    = 58
const LABEL   = 30
const PADDING = 16

let ctx         = null
let animFrameId = null

// ─── Current floor grid ───────────────────────────────────────────────────────

const currentGrid = computed(() =>
  props.gameState.floors[props.gameState.currentFloor]?.grid ?? []
)

const currentFloorObj = computed(() =>
  props.gameState.floors[props.gameState.currentFloor]
)

const nextFloorCost = computed(() =>
  FLOOR_COST_BASE * props.gameState.floors.length
)

const nextFloorName = computed(() => {
  const n = props.gameState.floors.length
  return n === 1 ? 'Étage 1' : `Étage ${n}`
})

// Clear selection when floor changes
watch(() => props.gameState.currentFloor, () => {
  selectedCell.value = null
  hoveredCell.value  = null
})

function switchFloor(id) {
  props.gameState.currentFloor = id
  emit('set-floor', id)
}

// ─── Coordinate helpers ───────────────────────────────────────────────────────

function tileX(x) { return PADDING + LABEL + x * TILE }
function tileY(y) { return PADDING + LABEL + y * TILE }

function cellFromMouse(clientX, clientY) {
  const rect = canvasRef.value.getBoundingClientRect()
  const rawX = clientX - rect.left
  const rawY = clientY - rect.top

  const worldX = rawX / zoom.value - cameraX.value
  const worldY = rawY / zoom.value - cameraY.value

  const x = Math.floor((worldX - PADDING - LABEL) / TILE)
  const y = Math.floor((worldY - PADDING - LABEL) / TILE)
  if (x < 0 || x >= COLUMNS.length || y < 0 || y >= ROWS.length) return null
  return currentGrid.value[y]?.[x] ?? null
}

// ─── Draw ─────────────────────────────────────────────────────────────────────

function draw() {
  if (!ctx) return
  const canvas = canvasRef.value
  
  // Fill solid background (ignores camera transform)
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.fillStyle = '#0d1117'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  
  // Apply camera transform
  ctx.translate(cameraX.value * zoom.value, cameraY.value * zoom.value)
  ctx.scale(zoom.value, zoom.value)
  
  drawColumnLabels()
  drawRowLabels()
  drawCells()
}

function drawColumnLabels() {
  ctx.fillStyle = '#58a6ff'
  ctx.font = 'bold 13px monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (let x = 0; x < COLUMNS.length; x++) {
    ctx.fillText(COLUMNS[x], tileX(x) + TILE / 2, PADDING + LABEL / 2)
  }
}

function drawRowLabels() {
  ctx.fillStyle = '#58a6ff'
  ctx.font = 'bold 13px monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (let y = 0; y < ROWS.length; y++) {
    ctx.fillText(String(ROWS[y]), PADDING + LABEL / 2, tileY(y) + TILE / 2)
  }
}

function drawCells() {
  const grid = currentGrid.value
  for (let y = 0; y < ROWS.length; y++) {
    for (let x = 0; x < COLUMNS.length; x++) {
      const cell       = grid[y]?.[x]
      if (!cell) continue
      const isHovered  = hoveredCell.value?.x === cell.x && hoveredCell.value?.y === cell.y
      const isSelected = selectedCell.value?.x === cell.x && selectedCell.value?.y === cell.y

      if (cell.locked) {
        drawLockedCell(cell, isHovered)
      } else if (cell.rack) {
        drawRack(cell, isHovered, isSelected)
      } else {
        drawEmptyCell(cell, isHovered, isSelected)
      }
    }
  }
}

// ─── Locked cell ──────────────────────────────────────────────────────────────

function drawLockedCell(cell, isHovered) {
  const tx   = tileX(cell.x)
  const ty   = tileY(cell.y)
  const grid = currentGrid.value
  const purchasable = isAdjacentToUnlocked(grid, cell.x, cell.y)
  const cost = purchasable ? getUnlockCost(currentFloorObj.value) : 0

  // Background
  if (purchasable && isHovered) {
    ctx.fillStyle = '#1a1200'
  } else if (purchasable) {
    ctx.fillStyle = '#0d1117'
  } else {
    ctx.fillStyle = '#080c10'
  }
  ctx.fillRect(tx + 1, ty + 1, TILE - 2, TILE - 2)

  // Border
  ctx.strokeStyle = purchasable ? (isHovered ? '#d29922' : '#3d2b00') : '#131820'
  ctx.lineWidth   = purchasable ? (isHovered ? 2 : 1) : 1
  ctx.strokeRect(tx + 1, ty + 1, TILE - 2, TILE - 2)

  if (purchasable) {
    // Lock icon
    ctx.fillStyle    = isHovered ? '#d29922' : '#4a3a10'
    ctx.font         = '14px monospace'
    ctx.textAlign    = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('*', tx + TILE / 2, ty + TILE / 2 - 10)

    // Cost label
    ctx.font      = 'bold 9px monospace'
    ctx.fillStyle = isHovered ? '#d29922' : '#3d2b00'
    ctx.fillText(`$${cost}`, tx + TILE / 2, ty + TILE / 2 + 8)

    if (isHovered) {
      ctx.font      = '8px monospace'
      ctx.fillStyle = '#8b5e00'
      ctx.fillText('CLICK', tx + TILE / 2, ty + TILE / 2 + 19)
    }
  } else {
    // Dim lock marker
    ctx.fillStyle    = '#1a1f27'
    ctx.font         = '9px monospace'
    ctx.textAlign    = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('#', tx + TILE / 2, ty + TILE / 2)
  }
}

// ─── Empty cell ───────────────────────────────────────────────────────────────

function drawEmptyCell(cell, isHovered, isSelected) {
  const tx = tileX(cell.x)
  const ty = tileY(cell.y)

  const isPlaceable = props.mode === 'place-rack' && !cell.rack && !cell.locked

  if (isSelected) {
    ctx.fillStyle = '#1f4068'
  } else if (isHovered && isPlaceable) {
    ctx.fillStyle = '#0f2d0f'
  } else if (isHovered) {
    ctx.fillStyle = '#161b22'
  } else {
    ctx.fillStyle = '#0d1117'
  }
  ctx.fillRect(tx + 1, ty + 1, TILE - 2, TILE - 2)

  ctx.strokeStyle = isSelected
    ? '#58a6ff'
    : (isHovered && isPlaceable)
      ? '#3fb950'
      : isHovered
        ? '#30363d'
        : '#21262d'
  ctx.lineWidth = (isSelected || (isHovered && isPlaceable)) ? 2 : 1
  ctx.strokeRect(tx + 1, ty + 1, TILE - 2, TILE - 2)

  ctx.fillStyle = isSelected ? '#58a6ff' : '#21262d'
  ctx.beginPath()
  ctx.arc(tx + TILE / 2, ty + TILE / 2, 3, 0, Math.PI * 2)
  ctx.fill()

  if (isHovered && isPlaceable) {
    ctx.fillStyle = '#3fb95055'
    const barW = TILE * 0.5
    const midY = ty + TILE / 2
    const startX = tx + TILE / 2 - barW / 2
    ctx.fillRect(startX, midY - 7, barW, 3)
    ctx.fillRect(startX, midY - 1, barW, 3)
    ctx.fillRect(startX, midY + 5, barW, 3)
  }
}

// ─── Rack helpers ─────────────────────────────────────────────────────────────

function rackWorstStatus(rack) {
  const statuses = rack.servers.filter(Boolean).map(s => s.status)
  if (statuses.includes('failed'))    return 'failed'
  if (statuses.includes('repairing')) return 'repairing'
  if (statuses.includes('warning'))   return 'warning'
  return 'ok'
}

function rackAvgLoadRatio(rack) {
  const servers = rack.servers.filter(s => s && s.status !== 'failed')
  if (servers.length === 0) return 0
  const totalLoad = servers.reduce((s, srv) => s + srv.load, 0)
  const totalCap  = servers.reduce((s, srv) => s + srv.cpuCapacity, 0)
  return totalCap > 0 ? totalLoad / totalCap : 0
}

function rackAvgTemp(rack) {
  const servers = rack.servers.filter(Boolean)
  if (!servers.length) return 20
  return servers.reduce((s, srv) => s + srv.temperature, 0) / servers.length
}

function rackClientCount(floorId, x, y) {
  return props.gameState.clients.filter(c =>
    c.serverPos?.floorId === floorId &&
    c.serverPos?.x === x &&
    c.serverPos?.y === y
  ).length
}

function loadColor(ratio) {
  if (ratio > 0.9) return '#f85149'
  if (ratio > 0.7) return '#d29922'
  return '#3fb950'
}

function tempColor(temp) {
  if (temp > 75) return '#f85149'
  if (temp > 55) return '#d29922'
  return '#3fb950'
}

// ─── Draw rack ────────────────────────────────────────────────────────────────

function drawRack(cell, isHovered, isSelected) {
  const tx       = tileX(cell.x)
  const ty       = tileY(cell.y)
  const rack     = cell.rack
  const servers  = rack.servers.filter(s => s !== null)
  const worstStatus = rackWorstStatus(rack)
  const loadRatio   = rackAvgLoadRatio(rack)
  const avgTemp     = rackAvgTemp(rack)
  const clientCount = rackClientCount(cell.floorId, cell.x, cell.y)
  const pulse       = (Math.sin(performance.now() / 350) + 1) / 2

  const hasFailed   = worstStatus === 'failed'
  const hasWarning  = worstStatus === 'warning'
  const isRepairing = worstStatus === 'repairing'
  const overloaded  = rack.servers.some(s => s && s.load > s.cpuCapacity)

  // Background
  let bg = '#161b22'
  if (isSelected)      bg = hasFailed ? '#2d0a0a' : isRepairing ? '#0d1a2e' : '#1a3a5c'
  else if (isHovered)  bg = hasFailed ? '#220808' : '#1c2d3f'
  else if (hasFailed)  bg = '#1a0909'
  else if (hasWarning) bg = '#1a1200'
  ctx.fillStyle = bg
  ctx.fillRect(tx + 1, ty + 1, TILE - 2, TILE - 2)

  // Border
  let borderColor = '#30363d'
  if      (isSelected && hasFailed) borderColor = '#f85149'
  else if (isSelected)              borderColor = '#58a6ff'
  else if (isHovered && hasFailed)  borderColor = '#f85149'
  else if (isHovered)               borderColor = '#388bfd'
  else if (hasFailed)               borderColor = `rgba(248,81,73,${0.3 + pulse * 0.5})`
  else if (hasWarning)              borderColor = `rgba(210,153,34,${0.4 + pulse * 0.4})`
  else if (isRepairing)             borderColor = `rgba(88,166,255,${0.4 + pulse * 0.4})`
  else if (overloaded)              borderColor = '#f8514966'
  ctx.strokeStyle = borderColor
  ctx.lineWidth   = (isSelected || hasFailed || hasWarning || isRepairing) ? 2 : 1
  ctx.strokeRect(tx + 1, ty + 1, TILE - 2, TILE - 2)

  // Pulse glow
  if (hasFailed || hasWarning) {
    ctx.strokeStyle = hasFailed
      ? `rgba(248,81,73,${pulse * 0.25})`
      : `rgba(210,153,34,${pulse * 0.2})`
    ctx.lineWidth = 5
    ctx.strokeRect(tx + 1, ty + 1, TILE - 2, TILE - 2)
    ctx.lineWidth = 1
  }

  // Notation
  const notationColor = hasFailed ? '#f85149' : hasWarning ? '#d29922' : '#58a6ff'
  ctx.fillStyle    = notationColor
  ctx.font         = 'bold 9px monospace'
  ctx.textAlign    = 'left'
  ctx.textBaseline = 'top'
  ctx.fillText(cell.notation, tx + 4, ty + 4)

  // Status icon (top right)
  if (hasFailed) {
    ctx.fillStyle = `rgba(248,81,73,${0.6 + pulse * 0.4})`
    ctx.font      = 'bold 11px monospace'
    ctx.textAlign = 'right'
    ctx.fillText('X', tx + TILE - 4, ty + 3)
  } else if (isRepairing) {
    ctx.fillStyle = '#58a6ff'
    ctx.font      = '11px monospace'
    ctx.textAlign = 'right'
    ctx.fillText('~', tx + TILE - 4, ty + 3)
  } else if (hasWarning) {
    ctx.fillStyle = `rgba(210,153,34,${0.7 + pulse * 0.3})`
    ctx.font      = '10px monospace'
    ctx.textAlign = 'right'
    ctx.fillText('!', tx + TILE - 4, ty + 3)
  }

  // Server slot mini-bars
  if (!hasFailed) {
    drawServerSlots(tx, ty, rack)
  } else {
    ctx.strokeStyle = `rgba(248,81,73,${0.3 + pulse * 0.3})`
    ctx.lineWidth   = 1
    ctx.beginPath(); ctx.moveTo(tx + 14, ty + 18); ctx.lineTo(tx + TILE - 14, ty + TILE - 14); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(tx + TILE - 14, ty + 18); ctx.lineTo(tx + 14, ty + TILE - 14); ctx.stroke()
  }

  // Load bar (bottom)
  const barY    = ty + TILE - 10
  const barMaxW = TILE - 10
  ctx.fillStyle = '#21262d'
  ctx.fillRect(tx + 5, barY, barMaxW, 3)
  if (servers.length > 0) {
    ctx.fillStyle = loadColor(loadRatio)
    ctx.fillRect(tx + 5, barY, Math.round(barMaxW * Math.min(1, loadRatio)), 3)
  }

  // Temp dot (bottom right)
  if (servers.length > 0) {
    ctx.fillStyle = tempColor(avgTemp)
    ctx.beginPath()
    ctx.arc(tx + TILE - 6, ty + TILE - 8, 3, 0, Math.PI * 2)
    ctx.fill()
  }

  // Client count (bottom left)
  if (clientCount > 0) {
    ctx.fillStyle    = '#8b949e'
    ctx.font         = '8px monospace'
    ctx.textAlign    = 'left'
    ctx.textBaseline = 'bottom'
    ctx.fillText(`C:${clientCount}`, tx + 4, ty + TILE - 2)
  }
}

function drawServerSlots(tx, ty, rack) {
  const cols   = 2
  const barW   = 10
  const barH   = 5
  const gapX   = 4
  const gapY   = 3
  const totalW = cols * barW + (cols - 1) * gapX
  const startX = tx + TILE / 2 - totalW / 2
  const startY = ty + 16

  for (let i = 0; i < rack.servers.length; i++) {
    const col    = i % cols
    const row    = Math.floor(i / cols)
    const bx     = startX + col * (barW + gapX)
    const by     = startY + row * (barH + gapY)
    const server = rack.servers[i]

    if (!server) {
      ctx.fillStyle = '#1a1f27'
      ctx.fillRect(bx, by, barW, barH)
      continue
    }

    const baseColor = SERVER_TYPES[server.type]?.color ?? '#58a6ff'

    if      (server.status === 'failed')    ctx.fillStyle = '#2d0a0a'
    else if (server.status === 'repairing') ctx.fillStyle = '#0d1a2e'
    else if (server.status === 'warning')   ctx.fillStyle = '#3d2b00'
    else {
      const loadRatio = server.cpuCapacity > 0 ? server.load / server.cpuCapacity : 0
      ctx.fillStyle = loadRatio > 0.1 ? baseColor : '#21262d'
    }
    ctx.fillRect(bx, by, barW, barH)

    if (server.status === 'ok' || server.status === 'warning') {
      const loadRatio = server.cpuCapacity > 0 ? Math.min(1, server.load / server.cpuCapacity) : 0
      if (loadRatio > 0) {
        ctx.fillStyle = loadColor(loadRatio) + '66'
        ctx.fillRect(bx, by + barH - 2, Math.round(barW * loadRatio), 2)
      }
    }
  }
}

// ─── Mouse / click handlers ───────────────────────────────────────────────────

function onMouseDown(e) {
  // Left (0), Middle (1), or Right (2) click pans
  if (e.button === 0 || e.button === 1 || e.button === 2) {
    isDragging = true
    didDragPan = false
    dragStartX = e.clientX
    dragStartY = e.clientY
    camStartX  = cameraX.value
    camStartY  = cameraY.value
  }
}

function onMouseMove(e) {
  if (isDragging) {
    const dx = e.clientX - dragStartX
    const dy = e.clientY - dragStartY
    // Only register as a pan if moved more than 4 pixels (prevents jittery clicks)
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
      didDragPan = true
    }
    cameraX.value = camStartX + dx / zoom.value
    cameraY.value = camStartY + dy / zoom.value
  }
  hoveredCell.value = cellFromMouse(e.clientX, e.clientY)
}

function onMouseUp(e) {
  if (isDragging) {
    isDragging = false
  }
}

function onMouseLeave() {
  isDragging = false
  hoveredCell.value = null
}

function onWheel(e) {
  // Zoom logic
  const zoomTarget = e.deltaY < 0 ? zoom.value * 1.1 : zoom.value * 0.9
  const newZoom = Math.min(2.5, Math.max(0.4, zoomTarget))
  
  // Focus zoom point
  const rect = canvasRef.value.getBoundingClientRect()
  const rawX = e.clientX - rect.left
  const rawY = e.clientY - rect.top
  
  // Calculate cursor pos in world
  const worldX = rawX / zoom.value - cameraX.value
  const worldY = rawY / zoom.value - cameraY.value
  
  // Apply zoom
  zoom.value = newZoom
  
  // Shift camera so world pos under cursor remains same
  cameraX.value = rawX / zoom.value - worldX
  cameraY.value = rawY / zoom.value - worldY
}

function onClick(e) {
  if (didDragPan) {
    didDragPan = false
    return
  }
  const cell = cellFromMouse(e.clientX, e.clientY)
  if (!cell) return

  // Place-rack mode: only unlocked empty cells
  if (props.mode === 'place-rack') {
    if (!cell.locked && !cell.rack) emit('place-rack', cell)
    return
  }

  // Locked cell: unlock if purchasable
  if (cell.locked) {
    const grid = currentGrid.value
    if (isAdjacentToUnlocked(grid, cell.x, cell.y)) {
      emit('unlock-cell', { floorId: cell.floorId, x: cell.x, y: cell.y })
    }
    return
  }

  // Empty unlocked cell (no rack): open shop
  if (!cell.rack) {
    emit('open-shop')
    return
  }

  selectedCell.value = cell
  emit('cell-selected', cell)
}

// ─── Keyboard ─────────────────────────────────────────────────────────────────

function onKeyDown(e) {
  if (e.key === 'Escape') emit('cancel-mode')
}

// ─── Resize ───────────────────────────────────────────────────────────────────

function resize() {
  const canvas  = canvasRef.value
  const wrapper = canvas.parentElement
  canvas.width  = wrapper.clientWidth
  canvas.height = wrapper.clientHeight
}

// ─── Loop ─────────────────────────────────────────────────────────────────────

function loop() {
  draw()
  animFrameId = requestAnimationFrame(loop)
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────

onMounted(() => {
  ctx = canvasRef.value.getContext('2d')
  resize()
  window.addEventListener('resize', resize)
  window.addEventListener('keydown', onKeyDown)
  loop()
})

onUnmounted(() => {
  window.removeEventListener('resize', resize)
  window.removeEventListener('keydown', onKeyDown)
  cancelAnimationFrame(animFrameId)
})
</script>

<style scoped>
.canvas-wrapper {
  position: relative;
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.canvas-wrapper.placing {
  cursor: crosshair;
}

@keyframes serverAlertPulse {
  0%   { box-shadow: inset 0 0 0 0 rgba(248, 81, 73, 0); }
  20%  { box-shadow: inset 0 0 0 6px rgba(248, 81, 73, 0.85); }
  50%  { box-shadow: inset 0 0 0 4px rgba(248, 81, 73, 0.5); }
  80%  { box-shadow: inset 0 0 0 6px rgba(248, 81, 73, 0.85); }
  100% { box-shadow: inset 0 0 0 0 rgba(248, 81, 73, 0); }
}

.canvas-wrapper.server-alert-flash {
  animation: serverAlertPulse 1.5s ease-out forwards;
}

canvas {
  flex: 1;
  display: block;
}

.status-bar {
  height: 28px;
  background: #161b22;
  border-top: 1px solid #21262d;
  display: flex;
  align-items: center;
  padding: 0 12px;
  font-family: monospace;
  font-size: 12px;
  color: #8b949e;
  gap: 8px;
}

.status-bar strong { color: #e6edf3; }

.hover-info { flex: 1; }

.mode-label {
  flex: 1;
  color: #3fb950;
  font-weight: bold;
  display: flex;
  align-items: center;
  gap: 12px;
}

.cancel-btn {
  background: transparent;
  border: 1px solid #3fb950;
  color: #3fb950;
  font-family: monospace;
  font-size: 11px;
  padding: 2px 8px;
  cursor: pointer;
  border-radius: 3px;
}
.cancel-btn:hover { background: #3fb95022; }

/* Floor tab bar */
.floor-tabs {
  height: 32px;
  background: #0d1117;
  border-bottom: 1px solid #21262d;
  display: flex;
  align-items: center;
  padding: 0 10px;
  gap: 4px;
  flex-shrink: 0;
}

.floor-tabs-label {
  font-family: monospace;
  font-size: 10px;
  color: #484f58;
  margin-right: 4px;
  white-space: nowrap;
}

.floor-btn {
  background: #21262d;
  border: 1px solid #30363d;
  color: #8b949e;
  font-family: monospace;
  font-size: 10px;
  padding: 2px 8px;
  cursor: pointer;
  border-radius: 3px;
  transition: all 0.1s;
}

.floor-btn:hover:not(.disabled) { border-color: #58a6ff; color: #e6edf3; }

.floor-btn.active {
  background: #1f4068;
  border-color: #58a6ff;
  color: #58a6ff;
  font-weight: bold;
}

.floor-btn.new-floor {
  border-color: #3d2b00;
  color: #d29922;
}
.floor-btn.new-floor:hover:not(.disabled) {
  background: #1a1200;
  border-color: #d29922;
  color: #d29922;
}
.floor-btn.disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
</style>
