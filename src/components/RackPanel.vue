<template>
  <aside class="rack-panel">

    <!-- Header -->
    <div class="panel-header">
      <button class="back-btn" @click="$emit('close')">← Back</button>
      <div class="panel-title">RACK {{ cell.notation }}</div>
    </div>

    <div class="rack-meta">
      <span>Cooling <strong>Lv.{{ rack.coolingLevel }}</strong></span>
      <span>{{ serverCount }}/{{ rack.servers.length }} serveurs</span>
    </div>

    <!-- Slot list -->
    <div class="slots">
      <div
        v-for="(server, i) in rack.servers"
        :key="i"
        class="slot"
        :class="{
          occupied:    server !== null,
          'high-load': server && isHighLoad(server),
          failed:      server && server.status === 'failed',
          warning:     server && server.status === 'warning',
          repairing:   server && server.status === 'repairing',
          installable: server === null && canAfford,
          selected:    selectedSlot === i && server === null,
        }"
        @click="onSlotClick(i, server)"
      >
        <!-- Empty slot -->
        <template v-if="!server">
          <span class="slot-index">{{ i }}</span>
          <span class="slot-empty">— vide —</span>
        </template>

        <!-- Occupied slot -->
        <template v-else>
          <div class="server-header">
            <span class="slot-index">{{ i }}</span>
            <span class="server-type" :style="{ color: typeColor(server.type) }">
              {{ server.label }}
            </span>
            <span class="status-badge" :class="server.status">{{ statusIcon(server.status) }}</span>
            <span class="load-badge" :class="loadClass(server)" v-if="server.status !== 'failed'">
              {{ server.cpuLoad }}/{{ server.cpuCapacity }}
            </span>
          </div>
          <div class="server-badges">
            <span class="age-badge" :style="{ color: serverAgeBadgeColor(server), borderColor: serverAgeBadgeColor(server) }">{{ server.age ?? 0 }}j</span>
            <span class="gen-badge" :style="{ color: serverGenBadgeColor(server), borderColor: serverGenBadgeColor(server) }" :title="`Génération ${2025 + (server.generation ?? 0)} — année d'achat`">Gen{{ 2025 + (server.generation ?? 0) }}</span>
          </div>

          <!-- Restart row (free, probabilistic) -->
          <div v-if="server.status === 'failed' || server.status === 'warning'" class="restart-row">
            <button
              class="restart-btn"
              :disabled="server.restartAttempts >= 1"
              @click.stop="onRestart(i)"
              :title="restartTitle(server)"
            >
              {{ restartLabel(server) }}
            </button>
            <button
              class="repair-btn"
              @click.stop="onRepair(i)"
              :disabled="gameState.money < 200"
              title="Réparation garantie ($200, 3j)"
            >
              $200
            </button>
          </div>

          <!-- Repair progress -->
          <div v-if="server.status === 'repairing'" class="repair-progress">
            Réparation : {{ server.repairDaysLeft }} jour(s)
          </div>

          <!-- Terminal + health -->
          <div class="action-row">
            <button class="terminal-btn" @click.stop="onOpenTerminal(i)">
              &gt;_ Terminal
            </button>
            <span class="health-val" :class="healthClass(server.health)">
              {{ Math.round(server.health) }}%
            </span>
          </div>

          <!-- Move all + Sell -->
          <div class="action-row">
            <button
              class="moveall-btn"
              :disabled="clientsOnServer(i).length === 0"
              @click.stop="onMoveAll(i)"
              title="Déplacer tous les clients vers d'autres serveurs"
            >
              ⬆ Tout déplacer
            </button>
            <button
              class="sell-btn"
              @click.stop="onSellServer(i)"
              :title="`Vendre le serveur (~${estimateSellPrice(server)}$)`"
            >
              💰 {{ estimateSellPrice(server) }}$
            </button>
          </div>

          <!-- Resource bars -->
          <div class="res-bars">
            <div class="res-bar-row">
              <span class="res-label">CPU</span>
              <div class="res-bar">
                <div class="res-alloc" :style="{ width: resPct(server.cpuLoad, server.cpuCapacity) + '%' }"></div>
                <div class="res-fill cpu" :style="{ width: liveLoad(server.cpuLoad, server.cpuCapacity, i, 0) + '%' }"></div>
              </div>
              <span class="res-val">{{ server.cpuLoad }}/{{ server.cpuCapacity }}</span>
            </div>
            <div class="res-bar-row">
              <span class="res-label">RAM</span>
              <div class="res-bar">
                <div class="res-alloc" :style="{ width: resPct(server.ramLoad, server.ramCapacity) + '%' }"></div>
                <div class="res-fill ram" :style="{ width: liveLoad(server.ramLoad, server.ramCapacity, i, 1) + '%' }"></div>
              </div>
              <span class="res-val">{{ server.ramLoad }}/{{ server.ramCapacity }}G</span>
            </div>
            <div class="res-bar-row">
              <span class="res-label">DSK</span>
              <div class="res-bar">
                <div class="res-alloc" :style="{ width: resPct(server.diskLoad, server.diskCapacity) + '%' }"></div>
                <div class="res-fill disk" :style="{ width: liveLoad(server.diskLoad, server.diskCapacity, i, 2) + '%' }"></div>
              </div>
              <span class="res-val">{{ server.diskLoad }}/{{ server.diskCapacity }}G</span>
            </div>
          </div>

          <!-- Clients on this server -->
          <div class="client-list" v-if="clientsOnServer(i).length > 0">
            <div
              v-for="client in clientsOnServer(i)"
              :key="client.id"
              class="client-entry"
              :class="{ moving: movingClientId === client.id }"
            >
              <span class="client-name">{{ client.name }}</span>
              <span class="client-svc" :style="{ color: svcColor(client.serviceId) }">
                {{ client.serviceId }}
              </span>
              <span class="client-sat" :style="{ color: satColor(client.satisfaction) }">
                {{ Math.round(client.satisfaction) }}%
              </span>
              <button
                class="move-btn"
                :class="{ active: movingClientId === client.id }"
                @click.stop="onMoveClick(client)"
              >
                {{ movingClientId === client.id ? 'X' : '>' }}
              </button>
            </div>
          </div>

          <!-- Renew server (outdated generation) -->
          <div v-if="isOutdated(server)" class="action-row">
            <button
              class="renew-btn"
              :disabled="gameState.money < (SERVER_TYPES[server.type]?.cost ?? 0) || server.status === 'repairing'"
              :title="`Renouveler vers Gen${2025 + currentYear} — $${SERVER_TYPES[server.type]?.cost ?? 0}${gameState.unlockedSkills?.includes('LIVE_MIGRATION') ? ' (migration à chaud)' : ' (clients en file)'}`"
              @click.stop="onRenew(i)"
            >
              🔄 Renouveler → Gen{{ 2025 + currentYear }}
              <span class="renew-cost">${{ SERVER_TYPES[server.type]?.cost ?? 0 }}</span>
            </button>
          </div>

          <!-- Move target selector -->
          <div v-if="movingClientId !== null && hasClientOnSlot(i)" class="move-targets">
            <div class="move-label">Déplacer vers :</div>
            <div v-if="compatibleServers.length === 0" class="no-targets">
              Aucun serveur compatible
            </div>
            <button
              v-for="target in compatibleServers"
              :key="`${target.floorId}-${target.x}-${target.y}-${target.slot}`"
              class="target-btn"
              @click.stop="onSelectTarget(target)"
            >
              <span class="target-label">{{ target.label }}</span>
              <span class="target-type" :style="{ color: typeColorByKey(target.serverType) }">
                {{ target.serverType }}
              </span>
              <span class="target-free">+{{ target.freeCapacity }}</span>
            </button>
          </div>
        </template>
      </div>
    </div>

    <!-- Install server section -->
    <div class="buy-section" v-if="selectedSlot !== null && rack.servers[selectedSlot] === null">
      <div class="section-label">INSTALLER</div>
      <div
        v-for="(def, key) in SERVER_TYPES"
        :key="key"
        class="server-option"
        :class="{
          selected:  selectedType === key && isUnlocked(def),
          disabled:  !canAffordType(def.cost) && isUnlocked(def),
          locked:    !isUnlocked(def),
        }"
        @click="isUnlocked(def) ? selectedType = key : null"
      >
        <span class="type-dot" :style="{ background: isUnlocked(def) ? def.color : '#30363d' }"></span>
        <span class="type-name">{{ def.label }}</span>
        <span v-if="isUnlocked(def)" class="type-cost">${{ def.cost }}</span>
        <span v-else class="type-locked">🔒 skill requis</span>
      </div>
      <button
        class="install-btn"
        :disabled="!canAffordType(SERVER_TYPES[selectedType].cost)"
        @click="onInstall"
      >
        Installer slot {{ selectedSlot }}
      </button>
    </div>

  </aside>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { SERVER_TYPES, SERVICES } from '../game/GameState.js'
import { getCompatibleServers, moveAllClients, removeServer, sellServer, renewServer } from '../game/SimulationEngine.js'

const props = defineProps({
  cell:      { type: Object, required: true },
  gameState: { type: Object, required: true },
})

const emit = defineEmits(['close', 'install-server', 'move-client', 'open-terminal', 'repair-server', 'restart-server', 'renew-server'])

const rack        = computed(() => props.cell.rack)
const serverCount = computed(() => rack.value.servers.filter(s => s !== null).length)
const currentYear = computed(() => Math.floor((props.gameState.day ?? 0) / 365))

const selectedSlot   = ref(null)
const selectedType   = ref('BASIC')
const movingClientId = ref(null)

const canAfford = computed(() => props.gameState.money >= SERVER_TYPES[selectedType.value].cost)

const compatibleServers = computed(() => {
  if (movingClientId.value === null) return []
  return getCompatibleServers(props.gameState, movingClientId.value)
})

// ─── Helpers ─────────────────────────────────────────────────────────────────

function clientsOnServer(slot) {
  return props.gameState.clients.filter(c =>
    c.serverPos?.floorId === props.cell.floorId &&
    c.serverPos?.x === props.cell.x &&
    c.serverPos?.y === props.cell.y &&
    c.serverPos?.slot === slot
  )
}

function hasClientOnSlot(slot) {
  return movingClientId.value !== null &&
    clientsOnServer(slot).some(c => c.id === movingClientId.value)
}

function isHighLoad(server) {
  const cpu  = server.cpuCapacity  > 0 ? server.cpuLoad  / server.cpuCapacity  : 0
  const ram  = server.ramCapacity  > 0 ? server.ramLoad  / server.ramCapacity  : 0
  const disk = server.diskCapacity > 0 ? server.diskLoad / server.diskCapacity : 0
  return cpu >= 0.95 || ram >= 0.95 || disk >= 0.95
}

function loadClass(server) {
  const ratio = server.cpuCapacity > 0 ? server.cpuLoad / server.cpuCapacity : 0
  if (ratio >= 0.95) return 'high-load'
  if (ratio > 0.85)  return 'high'
  if (ratio > 0.5)   return 'medium'
  return 'low'
}

function resPct(used, cap) {
  return cap > 0 ? Math.min(100, Math.round(used / cap * 100)) : 0
}

// ── Tick réel 3 s — indépendant du temps in-game ─────────────────────────────
const realTick = ref(0)
let _tickTimer = null
onMounted(()  => { _tickTimer = setInterval(() => realTick.value++, 3000) })
onUnmounted(() => { clearInterval(_tickTimer) })

// Offsets différents par ressource pour désynchroniser CPU / RAM / Disk
const RES_OFFSET = [0, 5, 11]

function liveLoad(load, cap, serverIdx, resourceIdx) {
  if (cap <= 0 || load <= 0) return 0
  const basePct = load / cap
  const t       = realTick.value + RES_OFFSET[resourceIdx]
  const seed    = Math.sin(serverIdx * 97 + resourceIdx * 31 + t) * 0.5 + 0.5
  // Fluctuation vers le bas seulement — jamais au-dessus du load réel alloué
  const fluctuated = Math.max(0, Math.min(basePct, basePct + basePct * (seed - 0.5) * 0.3))
  return Math.round(fluctuated * 100)
}

function typeColor(type)     { return SERVER_TYPES[type]?.color ?? '#58a6ff' }
function typeColorByKey(k)   { return SERVER_TYPES[k]?.color ?? '#58a6ff' }
function svcColor(sid)       { return SERVICES[sid]?.color ?? '#8b949e' }
function canAffordType(cost) { return props.gameState.money >= cost }
function isUnlocked(def) {
  const type = Object.keys(SERVER_TYPES).find(k => SERVER_TYPES[k] === def)
  if (!type || type === 'BASIC') return true
  return (props.gameState.unlockedSkills ?? []).includes(`${type}_UNLOCK`)
}

function statusIcon(status) {
  return { ok: '●', warning: '!', failed: 'X', repairing: '~' }[status] ?? '●'
}

function healthClass(h) {
  if (h >= 70) return 'good'
  if (h >= 40) return 'mid'
  return 'bad'
}

function satColor(sat) {
  if (sat >= 70) return '#3fb950'
  if (sat >= 45) return '#d29922'
  return '#f85149'
}

function restartLabel(server) {
  if (server.restartAttempts >= 1) return 'Déjà tenté'
  const pct = Math.round(Math.max(5, 80 - (server.lifetimeRestarts ?? 0) * 15))
  return `Restart ${pct}% (gratuit)`
}

function restartTitle(server) {
  if (server.restartAttempts >= 1) return 'Déjà tenté cette panne — réparation payante requise'
  const lifetime = server.lifetimeRestarts ?? 0
  const pct = Math.round(Math.max(5, 80 - lifetime * 15))
  return `Tentative unique — ${pct}% de succès (${lifetime} redémarrage(s) au total)`
}

// ─── Interactions ─────────────────────────────────────────────────────────────

function onSlotClick(index, server) {
  if (server === null) {
    selectedSlot.value   = index
    movingClientId.value = null
  }
}

function onMoveClick(client) {
  if (movingClientId.value === client.id) {
    movingClientId.value = null
  } else {
    movingClientId.value = client.id
    selectedSlot.value   = null
  }
}

function onSelectTarget(target) {
  emit('move-client', { clientId: movingClientId.value, targetPos: target })
  movingClientId.value = null
}

function onOpenTerminal(slot) {
  emit('open-terminal', { floorId: props.cell.floorId, x: props.cell.x, y: props.cell.y, slot })
}

function onMoveAll(slot) {
  moveAllClients(props.gameState, props.cell.floorId, props.cell.x, props.cell.y, slot)
}

function onRemove(slot) {
  removeServer(props.gameState, props.cell.floorId, props.cell.x, props.cell.y, slot)
}

function serverAgeBadgeColor(server) {
  const age = server.age ?? 0
  if (age >= 300) return '#f85149'
  if (age >= 100) return '#d29922'
  return '#3fb950'
}

function serverAgeDot(server) {
  const age = server.age ?? 0
  if (age >= 300) return '●'
  if (age >= 100) return '●'
  return '●'
}

function isOutdated(server) {
  return currentYear.value > (server.generation ?? 0)
}

function serverGenBadgeColor(server) {
  const gap = currentYear.value - (server.generation ?? 0)
  if (gap >= 2) return '#f85149'   // 2+ générations de retard → rouge
  if (gap >= 1) return '#d29922'   // 1 génération de retard → orange
  return '#3fb950'                  // génération actuelle → vert
}

function estimateSellPrice(server) {
  const baseDef  = SERVER_TYPES[server.type]
  const baseCost = baseDef?.cost ?? 500
  const age      = server.age ?? 0
  const ageFactor = age < 100 ? 0.5 : age < 300 ? 0.4 : 0.3
  return Math.round(baseCost * ageFactor)
}

function onSellServer(slot) {
  sellServer(props.gameState, props.cell.floorId, props.cell.x, props.cell.y, slot)
}

function onRenew(slot) {
  emit('renew-server', { floorId: props.cell.floorId, x: props.cell.x, y: props.cell.y, slot })
}

function onRepair(slot) {
  emit('repair-server', { floorId: props.cell.floorId, x: props.cell.x, y: props.cell.y, slot })
}

function onRestart(slot) {
  emit('restart-server', { floorId: props.cell.floorId, x: props.cell.x, y: props.cell.y, slot })
}

function onInstall() {
  if (selectedSlot.value === null) return
  const cost = SERVER_TYPES[selectedType.value].cost
  if (props.gameState.money < cost) return
  emit('install-server', {
    cell: props.cell,
    slot: selectedSlot.value,
    type: selectedType.value,
    cost,
  })
  selectedSlot.value = null
}
</script>

<style scoped>
.rack-panel {
  flex: 1;
  min-height: 0;
  background: #161b22;
  border-left: 1px solid #21262d;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border-bottom: 1px solid #21262d;
  flex-shrink: 0;
}

.back-btn {
  background: transparent;
  border: none;
  color: #58a6ff;
  font-family: monospace;
  font-size: 11px;
  cursor: pointer;
  padding: 2px 4px;
}
.back-btn:hover { text-decoration: underline; }

.panel-title {
  font-family: monospace;
  font-size: 12px;
  font-weight: bold;
  color: #e6edf3;
}

.rack-meta {
  display: flex;
  justify-content: space-between;
  padding: 6px 8px;
  font-family: monospace;
  font-size: 10px;
  color: #8b949e;
  border-bottom: 1px solid #21262d;
  flex-shrink: 0;
}
.rack-meta strong { color: #e6edf3; }

.slots {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 4px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.slot {
  border: 1px solid #21262d;
  border-radius: 3px;
  background: #0d1117;
  font-family: monospace;
  font-size: 10px;
  padding: 4px 6px;
  cursor: pointer;
  transition: border-color 0.1s;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.slot.occupied        { cursor: default; }
.slot.high-load       { border-color: #f0883e !important; background: #1a1200; }
.slot.failed          { border-color: #f85149 !important; background: #1a0606; }
.slot.warning         { border-color: #d29922 !important; background: #1a1200; }
.slot.repairing       { border-color: #58a6ff !important; background: #0d1a2e; }
.slot.installable:hover { border-color: #3fb950; background: #0f2d0f; }
.slot.selected        { border-color: #58a6ff; background: #1f4068; }

.slot-index  { color: #8b949e; min-width: 12px; }
.slot-empty  { color: #30363d; font-style: italic; }

.server-header {
  display: flex;
  align-items: center;
  gap: 5px;
}

.server-type { flex: 1; font-weight: bold; }

.load-badge { font-size: 9px; padding: 1px 4px; border-radius: 3px; }
.load-badge.low       { color: #3fb950; }
.load-badge.medium    { color: #d29922; }
.load-badge.high      { color: #f0883e; }
.load-badge.high-load  { color: #f85149; font-weight: bold; }

.status-badge { font-size: 9px; font-weight: bold; padding: 1px 4px; border-radius: 2px; }
.status-badge.ok        { color: #3fb950; }
.status-badge.warning   { color: #d29922; }
.status-badge.failed    { color: #f85149; }
.status-badge.repairing { color: #58a6ff; }

/* Restart/Repair row */
.restart-row {
  display: flex;
  gap: 4px;
  margin-top: 2px;
}

.restart-btn {
  flex: 1;
  background: #1a1200;
  border: 1px solid #d29922;
  color: #d29922;
  font-family: monospace;
  font-size: 9px;
  padding: 3px 4px;
  cursor: pointer;
  border-radius: 2px;
}
.restart-btn:hover:not(:disabled) { background: #3d2b00; }
.restart-btn:disabled { opacity: 0.35; cursor: not-allowed; border-color: #30363d; color: #8b949e; }

.repair-btn {
  background: #2d0a0a;
  border: 1px solid #f85149;
  color: #f85149;
  font-family: monospace;
  font-size: 9px;
  padding: 3px 6px;
  cursor: pointer;
  border-radius: 2px;
  white-space: nowrap;
}
.repair-btn:hover:not(:disabled) { background: #3d1010; }
.repair-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.repair-progress {
  font-family: monospace;
  font-size: 9px;
  color: #58a6ff;
  font-style: italic;
}

.action-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.terminal-btn {
  background: #0d1a2e;
  border: 1px solid #1f4068;
  color: #58a6ff;
  font-family: monospace;
  font-size: 9px;
  padding: 2px 7px;
  cursor: pointer;
  border-radius: 2px;
  flex: 1;
}
.terminal-btn:hover { background: #1f4068; }

.moveall-btn {
  flex: 1;
  background: #0f2d0f;
  border: 1px solid #3fb950;
  color: #3fb950;
  font-family: monospace;
  font-size: 9px;
  padding: 2px 6px;
  cursor: pointer;
  border-radius: 2px;
}
.moveall-btn:hover:not(:disabled) { background: #1a4d1a; }
.moveall-btn:disabled { opacity: 0.3; cursor: not-allowed; }

.renew-btn {
  flex: 1;
  background: #1a1a2e;
  border: 1px solid #58a6ff;
  color: #58a6ff;
  font-family: monospace;
  font-size: 9px;
  padding: 3px 6px;
  cursor: pointer;
  border-radius: 2px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
}
.renew-btn:hover:not(:disabled) { background: #1f3a5f; }
.renew-btn:disabled { opacity: 0.35; cursor: not-allowed; }
.renew-cost {
  color: #d29922;
  font-weight: bold;
}

.server-badges {
  display: flex;
  gap: 4px;
  margin: 3px 0 2px;
}

.age-badge, .gen-badge {
  font-family: monospace;
  font-size: 9px;
  font-weight: bold;
  padding: 1px 5px;
  border-radius: 3px;
  border: 1px solid;
  background: rgba(0, 0, 0, 0.35);
  letter-spacing: 0.02em;
}

.sell-btn {
  font-family: monospace;
  font-size: 9px;
  padding: 2px 6px;
  cursor: pointer;
  border-radius: 2px;
  border: 1px solid #d29922;
  background: #1a1400;
  color: #d29922;
}
.sell-btn:hover { background: #2d2200; border-color: #e8aa30; }

.health-val { font-family: monospace; font-size: 9px; font-weight: bold; }
.health-val.good { color: #3fb950; }
.health-val.mid  { color: #d29922; }
.health-val.bad  { color: #f85149; }

.res-bars { display: flex; flex-direction: column; gap: 2px; }

.res-bar-row {
  display: flex;
  align-items: center;
  gap: 3px;
}
.res-label {
  font-family: monospace;
  font-size: 8px;
  color: #484f58;
  width: 22px;
  flex-shrink: 0;
}
.res-bar {
  flex: 1;
  height: 4px;
  background: #21262d;
  border-radius: 2px;
  overflow: hidden;
  position: relative;
}
.res-alloc {
  position: absolute;
  height: 100%;
  border-radius: 2px;
  background: #8b949e;
  opacity: 0.3;
}
.res-fill {
  position: absolute;
  height: 100%;
  border-radius: 2px;
  transition: width 0.9s ease;
}
.res-fill.cpu  { background: #388bfd; }
.res-fill.ram  { background: #3fb950; }
.res-fill.disk { background: #d29922; }
.res-val {
  font-family: monospace;
  font-size: 8px;
  color: #484f58;
  min-width: 40px;
  text-align: right;
}

.client-list { display: flex; flex-direction: column; gap: 2px; margin-top: 2px; }

.client-entry {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 4px;
  background: #161b22;
  border-radius: 2px;
  border: 1px solid transparent;
}
.client-entry.moving { border-color: #58a6ff; background: #1f4068; }

.client-name   { flex: 1; color: #e6edf3; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 9px; }
.client-svc    { font-size: 8px; font-weight: bold; }
.client-sat    { font-size: 9px; font-weight: bold; }

.move-btn {
  background: transparent;
  border: 1px solid #30363d;
  color: #8b949e;
  font-size: 9px;
  padding: 1px 4px;
  cursor: pointer;
  border-radius: 2px;
  flex-shrink: 0;
}
.move-btn:hover { border-color: #58a6ff; color: #58a6ff; }
.move-btn.active { border-color: #f85149; color: #f85149; }

.move-targets {
  margin-top: 3px;
  border: 1px solid #1f4068;
  border-radius: 3px;
  padding: 4px;
  background: #0d1a2e;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.move-label { font-size: 9px; color: #58a6ff; font-weight: bold; margin-bottom: 2px; }
.no-targets { font-size: 9px; color: #8b949e; font-style: italic; }

.target-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  background: #161b22;
  border: 1px solid #21262d;
  color: #e6edf3;
  font-family: monospace;
  font-size: 9px;
  padding: 3px 5px;
  cursor: pointer;
  border-radius: 2px;
}
.target-btn:hover { border-color: #3fb950; background: #0f2d0f; }
.target-label { font-weight: bold; min-width: 52px; }
.target-type  { flex: 1; }
.target-free  { color: #3fb950; }

/* Install section */
.buy-section {
  border-top: 1px solid #21262d;
  padding: 6px 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex-shrink: 0;
}

.section-label {
  font-family: monospace;
  font-size: 10px;
  font-weight: bold;
  color: #58a6ff;
  letter-spacing: 1px;
}

.server-option {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 6px;
  border: 1px solid #21262d;
  border-radius: 3px;
  cursor: pointer;
  font-family: monospace;
  font-size: 10px;
}
.server-option:hover:not(.disabled):not(.locked) { border-color: #30363d; }
.server-option.selected { border-color: #58a6ff; background: #1f4068; }
.server-option.disabled { opacity: 0.4; cursor: not-allowed; }
.server-option.locked   { opacity: 0.35; cursor: not-allowed; border-style: dashed; }

.type-dot    { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.type-name   { flex: 1; color: #e6edf3; }
.type-cost   { color: #3fb950; }
.type-locked { color: #484f58; font-size: 9px; }

.install-btn {
  background: #21262d;
  border: 1px solid #30363d;
  color: #e6edf3;
  font-family: monospace;
  font-size: 10px;
  padding: 5px;
  cursor: pointer;
  border-radius: 3px;
  width: 100%;
}
.install-btn:hover:not(:disabled) { background: #30363d; }
.install-btn:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
