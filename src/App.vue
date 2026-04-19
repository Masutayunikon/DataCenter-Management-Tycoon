<template>
  <div class="app" :class="{ 'blur-bg': !gameStarted }">

    <!-- ─── Loading / Start Overlay ─────────────────────────────────────────── -->
    <div v-if="!gameStarted" class="start-overlay">
      <div class="start-modal">
        <h2>DATACENTER TYCOON</h2>
        <div class="loader-wrap">
          <div class="loader-bar" :style="{ width: audioLoaded ? '100%' : '60%' }"></div>
        </div>
        <p class="loader-text">{{ audioLoaded ? 'Audio prêt.' : 'Génération de l\'audio procédural…' }}</p>

        <!-- Mode selection (shown after audio is ready) -->
        <div v-if="audioLoaded" class="mode-select">
          <button class="mode-btn solo-btn" @click="startSolo">
            🖥️ SOLO
          </button>
          <button class="mode-btn multi-btn" @click="startMultiplayer">
            🌐 MULTIJOUEUR
          </button>
        </div>
      </div>
    </div>

    <!-- ─── Lobby overlay (MP mode, not yet in room) ─────────────────────────── -->
    <LobbyScreen
      v-if="gameStarted && appMode === 'mp' && !mp.inRoom.value"
      :mp="mp"
      @back="exitMultiplayer"
      @joined="onMpJoined"
    />

    <!-- ─── Main game UI ──────────────────────────────────────────────────────── -->
    <TopBar
      ref="topBarRef"
      :gameState="gameState"
      :saveMsg="saveMsg"
      :isMultiplayer="appMode === 'mp'"
      :canControlSpeed="canControlSpeed"
      :currentSpeed="appMode === 'mp' ? (mp.shared.value?.speed ?? 1) : null"
      @set-speed="setSpeed"
      @go-clients="onGoClients"
      @open-shop="showShop = true"
      @open-skills="showSkills = true"
      @open-mp-panel="showMpPanel = true"
      @save="onSave"
      @load="onLoad"
      @reset="onReset"
    />
    <div class="main-area">
      <div class="canvas-area">
        <GameCanvas
          :gameState="gameState"
          :mode="mode"
          :serverAlert="serverAlertFlash"
          @cell-selected="onCellSelected"
          @place-rack="onPlaceRack"
          @cancel-mode="cancelMode"
          @unlock-cell="onUnlockCell"
          @buy-floor="onBuyFloor"
          @set-floor="gameState.currentFloor = $event"
          @open-shop="showShop = true"
        />
      </div>
      <RightPanel
        :gameState="gameState"
        :mode="mode"
        :selectedRackCell="selectedRackCell"
        :forceTab="rightPanelTab"
        :sendAction="appMode === 'mp' ? mp.sendAction : null"
        @tab-changed="rightPanelTab = null"
        @close-rack="selectedRackCell = null"
        @install-server="onInstallServer"
        @move-client="onMoveClient"
        @open-terminal="onOpenTerminal"
        @repair-server="onRepairServer"
        @restart-server="onRestartServer"
        @renew-server="onRenewServer"
        @connect-mission="onConnectMission"
      />
    </div>

    <!-- ─── Shop drawer ───────────────────────────────────────────────────────── -->
    <Transition name="drawer">
      <div v-if="showShop" class="drawer-overlay" @click.self="showShop = false">
        <div class="drawer-panel">
          <div class="drawer-header">
            <span class="drawer-title">🛒 SHOP</span>
            <button class="drawer-close" @click="showShop = false">✕</button>
          </div>
          <div class="drawer-body">
            <ShopPanel
              :gameState="gameState"
              :mode="mode"
              :isMultiplayer="appMode === 'mp'"
              :sendAction="appMode === 'mp' ? mp.sendAction : null"
              @start-place-rack="startPlaceRack"
              @buy-floor="onBuyFloor"
            />
          </div>
        </div>
      </div>
    </Transition>

    <!-- ─── Skills drawer ─────────────────────────────────────────────────────── -->
    <Transition name="drawer">
      <div v-if="showSkills" class="drawer-overlay" @click.self="showSkills = false">
        <div class="drawer-panel">
          <div class="drawer-header">
            <span class="drawer-title">⭐ COMPÉTENCES</span>
            <button class="drawer-close" @click="showSkills = false">✕</button>
          </div>
          <div class="drawer-body">
            <SkillTreePanel :gameState="gameState" :isMultiplayer="appMode === 'mp'" :sendAction="appMode === 'mp' ? mp.sendAction : null" @apply-skill="onApplySkill" />
          </div>
        </div>
      </div>
    </Transition>

    <!-- ─── Multiplayer panel drawer ──────────────────────────────────────────── -->
    <Transition name="drawer">
      <div v-if="showMpPanel && appMode === 'mp'" class="drawer-overlay" @click.self="showMpPanel = false">
        <div class="drawer-panel">
          <div class="drawer-header">
            <span class="drawer-title">🌐 MULTIJOUEUR</span>
            <button class="drawer-close" @click="showMpPanel = false">✕</button>
          </div>
          <div class="drawer-body">
            <MultiplayerPanel
              :mp="mp"
              :mySocketId="mp.socket.value?.id ?? ''"
              @leave="leaveRoom"
            />
          </div>
        </div>
      </div>
    </Transition>

    <!-- ─── Waiting room overlay (MP joined but not yet started) ─────────────────────────── -->
    <div v-if="appMode === 'mp' && mp.inRoom.value && mp.shared.value && !mp.shared.value.started" class="waiting-overlay">
      <div class="waiting-modal">
        <div class="waiting-title">⏳ SALLE D'ATTENTE</div>
        <div class="waiting-room-name">{{ mp.roomInfo.value?.name }}</div>
        <div class="waiting-invite">🔑 {{ mp.roomInfo.value?.inviteCode }}</div>

        <div class="waiting-players">
          <div v-for="p in mp.players.value" :key="p.id" class="waiting-player">
            <span class="w-dot" :class="p.connected ? 'online' : 'offline'"></span>
            <span class="w-name">{{ p.name }}</span>
            <span v-if="p.id === mp.roomInfo.value?.gameMasterId" class="w-gm">GM</span>
          </div>
        </div>

        <div v-if="mp.isGameMaster.value" class="waiting-gm">
          <button class="btn-start-game" @click="startMpGame">▶ DÉMARRER LA PARTIE</button>
          <p class="waiting-hint">Attendez que tous les joueurs aient rejoint, puis démarrez.</p>
        </div>
        <p v-else class="waiting-hint">En attente du Game Master…</p>

        <button class="btn-leave-wait" @click="leaveRoom">← Quitter la room</button>
      </div>
    </div>

    <TerminalModal
      v-if="terminalPos"
      :serverPos="terminalPos"
      :gameState="gameState"
      :sendAction="appMode === 'mp' ? mp.sendAction : null"
      @close="terminalPos = null"
    />

    <!-- ─── Incubateur offer modal ───────────────────────────────────────────── -->
    <Transition name="drawer">
      <div
        v-if="gameState.pendingIncubatorOffer && appMode === 'solo'"
        class="incubator-overlay"
      >
        <div class="incubator-modal">
          <div class="inc-title">🏢 OFFRE INCUBATEUR</div>
          <div class="inc-body">
            <p class="inc-desc">Une startup cherche un hébergeur fiable pour 12 mois.</p>
            <div class="inc-detail">
              <span class="inc-label">Service</span>
              <span class="inc-val">{{ gameState.pendingIncubatorOffer.serviceId }}</span>
            </div>
            <div class="inc-detail">
              <span class="inc-label">Clients</span>
              <span class="inc-val">{{ gameState.pendingIncubatorOffer.slots }}</span>
            </div>
            <div class="inc-detail">
              <span class="inc-label">Prix fixe</span>
              <span class="inc-val" style="color:#3fb950">${{ gameState.pendingIncubatorOffer.fixedPrice }}/j par client</span>
            </div>
            <div class="inc-detail">
              <span class="inc-label">Revenu total</span>
              <span class="inc-val" style="color:#3fb950">
                ~${{ gameState.pendingIncubatorOffer.fixedPrice * gameState.pendingIncubatorOffer.slots * gameState.pendingIncubatorOffer.durationDays }}
              </span>
            </div>
            <div class="inc-detail">
              <span class="inc-label">Durée</span>
              <span class="inc-val">{{ gameState.pendingIncubatorOffer.durationDays }} jours</span>
            </div>
            <div class="inc-detail">
              <span class="inc-label">Expire dans</span>
              <span class="inc-val" style="color:#d29922">{{ gameState.pendingIncubatorOffer.expiresDay - gameState.day }} j</span>
            </div>
            <p class="inc-note">⚠️ Les slots seront bloqués — les clients resteront 12 mois.</p>
          </div>
          <div class="inc-actions">
            <button class="inc-btn inc-accept" @click="onAcceptIncubator">✅ Accepter</button>
            <button class="inc-btn inc-decline" @click="onDeclineIncubator">❌ Décliner</button>
          </div>
        </div>
      </div>
    </Transition>

    <EventNotification :event="latestEvent" />
  </div>
</template>

<script setup>
import { reactive, ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { createGameState, createRack, createServer, RACK_COST } from './game/GameState.js'
import { DAY_DURATION_MS, processDayTick, moveClient, repairServer, restartServer, renewServer, unlockCell, buyFloor, acceptIncubatorOffer, declineIncubatorOffer } from './game/SimulationEngine.js'
import { applySkill } from './game/SkillEngine.js'
import { saveGame, loadGame, hasSave } from './game/SaveSystem.js'
import { useMultiplayer } from './game/useMultiplayer.js'
import TopBar            from './components/TopBar.vue'
import GameCanvas        from './components/GameCanvas.vue'
import RightPanel        from './components/RightPanel.vue'
import ShopPanel         from './components/ShopPanel.vue'
import SkillTreePanel    from './components/SkillTreePanel.vue'
import TerminalModal     from './components/TerminalModal.vue'
import EventNotification from './components/EventNotification.vue'
import LobbyScreen       from './components/LobbyScreen.vue'
import MultiplayerPanel  from './components/MultiplayerPanel.vue'
import { preloadAudio, resumeAudio, startBackgroundDrone, updateVolumes, playSFX } from './game/AudioEngine.js'

// ─── App state ────────────────────────────────────────────────────────────────

const gameStarted      = ref(false)
const audioLoaded      = ref(false)
const appMode          = ref('solo')   // 'solo' | 'mp'

const gameState        = reactive(createGameState())
const mode             = ref('default')
const selectedRackCell = ref(null)
const terminalPos      = ref(null)
const latestEvent      = ref(null)
const rightPanelTab    = ref(null)
const showShop         = ref(false)
const showSkills       = ref(false)
const showMpPanel      = ref(false)
const saveMsg          = ref(null)
const topBarRef        = ref(null)
let   saveMsgTimer     = null
const serverAlertFlash = ref(false)
let   serverAlertTimer = null

// ─── Multiplayer composable ───────────────────────────────────────────────────

const mp = useMultiplayer()

mp.setCallbacks({
  fullState: (state) => {
    if (!state) return
    // Replace gameState completely with server-sent state
    for (const key of Object.keys(gameState)) delete gameState[key]
    Object.assign(gameState, state)
    // Re-anchor selectedRackCell after full state replacement
    if (selectedRackCell.value) {
      const { x, y, floorId } = selectedRackCell.value
      const floor = gameState.floors.find(f => f.id === floorId)
      const fresh = floor?.grid[y]?.[x]
      if (fresh?.rack) selectedRackCell.value = fresh
      else             selectedRackCell.value = null
    }
  },
  deltaState: (deltas) => {
    if (!deltas) return
    // Sound triggers: detect new queue/mission entries before merging
    const prevQueueLen    = gameState.clientQueue?.length ?? 0
    const prevMissionsLen = gameState.missions?.length    ?? 0
    // Collect pre-merge failed server IDs
    const prevFailedIds = new Set()
    if (gameState.floors) {
      for (const floor of gameState.floors) {
        for (const row of floor.grid ?? []) {
          for (const cell of row) {
            if (cell.rack?.servers) {
              for (const srv of cell.rack.servers) {
                if (srv && (srv.status === 'failed' || srv.status === 'needs_restart')) prevFailedIds.add(srv.id)
              }
            }
          }
        }
      }
    }
    // Merge deltas into gameState
    for (const [key, val] of Object.entries(deltas)) {
      gameState[key] = val
    }
    // Play sounds if new items arrived
    if ((gameState.clientQueue?.length ?? 0) > prevQueueLen)    playSFX('notification')
    if ((gameState.missions?.length    ?? 0) > prevMissionsLen) playSFX('alert')
    // Detect new server failures
    if (deltas.floors) {
      let newFailure = false
      for (const floor of gameState.floors) {
        for (const row of floor.grid ?? []) {
          for (const cell of row) {
            if (cell.rack?.servers) {
              for (const srv of cell.rack.servers) {
                if (srv && (srv.status === 'failed' || srv.status === 'needs_restart') && !prevFailedIds.has(srv.id)) {
                  newFailure = true
                }
              }
            }
          }
        }
      }
      if (newFailure) {
        playSFX('failure')
        serverAlertFlash.value = true
        clearTimeout(serverAlertTimer)
        serverAlertTimer = setTimeout(() => { serverAlertFlash.value = false }, 1500)
      }
    }
    // If floors changed, re-anchor selectedRackCell to the new cell object
    // (the old reference would point to a stale object after floors replacement)
    if (deltas.floors && selectedRackCell.value) {
      const { x, y, floorId } = selectedRackCell.value
      const floor = gameState.floors.find(f => f.id === floorId)
      const fresh = floor?.grid[y]?.[x]
      if (fresh?.rack) selectedRackCell.value = fresh
      else             selectedRackCell.value = null
    }
  },
})

const canControlSpeed = computed(() =>
  appMode.value === 'solo' || mp.isGameMaster.value
)

// ─── Game loop ────────────────────────────────────────────────────────────────

let lastTimestamp = null
let accumulated   = 0
let rafId         = null

function gameLoop(timestamp) {
  if (lastTimestamp !== null) {
    const isMP    = appMode.value === 'mp'
    const speed   = isMP ? (mp.shared.value?.speed ?? 1) : gameState.speed
    if (speed > 0) {
      const delta = timestamp - lastTimestamp
      accumulated += delta * speed
      gameState.hour = Math.floor(accumulated / DAY_DURATION_MS * 24)
      if (accumulated >= DAY_DURATION_MS) {
        accumulated -= DAY_DURATION_MS
        gameState.hour = 0
        if (!isMP) {
          // Solo only — server drives the tick in MP
          const newEvent = processDayTick(gameState)
          if (newEvent) latestEvent.value = { ...newEvent, _ts: Date.now() }
          if (gameState.day % 5 === 0) saveGame(gameState)
        }
      }
    }
  }
  lastTimestamp = timestamp
  rafId = requestAnimationFrame(gameLoop)
}

// ─── Start / Mode selection ───────────────────────────────────────────────────

onMounted(() => {
  if (hasSave()) {
    const r = loadGame(gameState)
    if (!r.success) console.warn('[Save] Load failed:', r.message)
  }

  window.addEventListener('keydown', onKeyDown)

  // Load persisted audio settings from localStorage (survives page reload)
  const savedAudio = localStorage.getItem('dcg-audio-settings')
  if (savedAudio) {
    try {
      const parsed = JSON.parse(savedAudio)
      if (!gameState.settings) gameState.settings = {}
      Object.assign(gameState.settings, parsed)
    } catch (_) {}
  }
  if (!gameState.settings) {
    gameState.settings = { masterVolume: 50, musicVolume: 50, sfxVolume: 80 }
  }

  preloadAudio(gameState.settings).then(() => {
    audioLoaded.value = true
  })

  watch(() => gameState.settings, (s) => {
    if (s) {
      updateVolumes(s)
      localStorage.setItem('dcg-audio-settings', JSON.stringify(s))
    }
  }, { deep: true })
})

function startSolo() {
  if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null }
  appMode.value    = 'solo'
  gameStarted.value = true
  resumeAudio()
  startBackgroundDrone()
  lastTimestamp = null
  rafId = requestAnimationFrame(gameLoop)
}

function startMultiplayer() {
  if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null }
  appMode.value    = 'mp'
  gameStarted.value = true
  resumeAudio()
  startBackgroundDrone()
  lastTimestamp = null
  rafId = requestAnimationFrame(gameLoop)
}

function exitMultiplayer() {
  if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null }
  mp.disconnect()
  // Reset gameState to fresh
  const fresh = createGameState()
  for (const key of Object.keys(gameState)) delete gameState[key]
  Object.assign(gameState, fresh)
  appMode.value = 'solo'
  gameStarted.value = false   // go back to start screen
}

function onMpJoined() {
  showMpPanel.value = false
}

async function startMpGame() {
  await mp.sendAction('start_game', {})
}

async function leaveRoom() {
  showMpPanel.value = false
  await mp.leaveRoom()
  // Reset to fresh state
  const fresh = createGameState()
  for (const key of Object.keys(gameState)) delete gameState[key]
  Object.assign(gameState, fresh)
}

onUnmounted(() => {
  cancelAnimationFrame(rafId)
  window.removeEventListener('keydown', onKeyDown)
  mp.disconnect()
})

function onKeyDown(e) {
  const tag = e.target?.tagName?.toLowerCase()
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return
  if (e.code === 'Space') {
    e.preventDefault()
    if (canControlSpeed.value) topBarRef.value?.externalTogglePause()
  }
}

// ─── Speed ────────────────────────────────────────────────────────────────────

function onGoClients() {
  selectedRackCell.value = null
  rightPanelTab.value = 'clients'
}

async function setSpeed(value) {
  if (appMode.value === 'mp') {
    const res = await mp.sendAction('set_speed', { speed: value })
    if (!res.ok) return
    // Optimistic local update for clock smoothness
    accumulated = 0
  } else {
    gameState.speed = value
    if (value === 0) accumulated = 0
  }
}

// ─── Canvas events ────────────────────────────────────────────────────────────

function onCellSelected(cell) {
  selectedRackCell.value = cell.rack ? cell : null
}

async function onPlaceRack(cell) {
  if (appMode.value === 'mp') {
    const floorId = gameState.floors[gameState.currentFloor]?.id
    const res = await mp.sendAction('place_rack', { floorId, x: cell.x, y: cell.y })
    if (res.ok) { mode.value = 'default'; showShop.value = false; playSFX('click') }
    else playSFX('error')
    return
  }
  if (gameState.money < RACK_COST) { playSFX('error'); return }
  cell.rack = createRack()
  gameState.money -= RACK_COST
  mode.value = 'default'
  showShop.value = false
  playSFX('click')
}

function cancelMode() {
  mode.value = 'default'
}

function startPlaceRack() {
  mode.value = 'place-rack'
  showShop.value = false
}

async function onUnlockCell({ floorId, x, y }) {
  if (appMode.value === 'mp') {
    const res = await mp.sendAction('buy_rack', { floorId, x, y })
    if (res.ok) playSFX('click')
    else playSFX('error')
    return
  }
  const r = unlockCell(gameState, floorId, x, y)
  if (r.success) playSFX('click')
  else playSFX('error')
}

async function onBuyFloor() {
  if (appMode.value === 'mp') {
    const res = await mp.sendAction('buy_floor', {})
    if (res.ok) playSFX('click')
    else playSFX('error')
    return
  }
  const r = buyFloor(gameState)
  if (r.success) playSFX('click')
  else playSFX('error')
}

// ─── Rack panel ───────────────────────────────────────────────────────────────

async function onInstallServer({ cell, slot, type, cost }) {
  if (appMode.value === 'mp') {
    const floorId = gameState.floors[gameState.currentFloor]?.id
    const res = await mp.sendAction('install_server', {
      floorId, x: cell.x, y: cell.y, slot, serverType: type,
    })
    if (res.ok) playSFX('click')
    else playSFX('error')
    return
  }
  if (gameState.money < cost) { playSFX('error'); return }
  cell.rack.servers[slot] = createServer(type, Math.floor(gameState.day / 365))
  gameState.money -= cost
  playSFX('click')
}

async function onMoveClient({ clientId, targetPos }) {
  if (appMode.value === 'mp') {
    await mp.sendAction('move_client', { clientId, targetPos })
    return
  }
  moveClient(gameState, clientId, targetPos)
}

function onOpenTerminal(serverPos) {
  terminalPos.value = serverPos
}

function onConnectMission({ clientId }) {
  const client = gameState.clients.find(c => c.id === clientId)
  if (!client) return
  const pos = client.serverPos ?? client.serverPositions?.[0]
  if (!pos) return
  terminalPos.value = pos
}

async function onRepairServer({ floorId, x, y, slot }) {
  if (appMode.value === 'mp') {
    await mp.sendAction('repair_server', { floorId, x, y, slot })
    playSFX('repair')
    return
  }
  repairServer(gameState, floorId, x, y, slot, false)
  playSFX('repair')
}

async function onRestartServer({ floorId, x, y, slot }) {
  if (appMode.value === 'mp') {
    await mp.sendAction('restart_server', { floorId, x, y, slot })
    playSFX('click')
    return
  }
  restartServer(gameState, floorId, x, y, slot)
  playSFX('click')
}

async function onRenewServer({ floorId, x, y, slot }) {
  if (appMode.value === 'mp') {
    await mp.sendAction('renew_server', { floorId, x, y, slot })
    playSFX('click')
    return
  }
  renewServer(gameState, floorId, x, y, slot)
  playSFX('click')
}

// ─── Skill tree (multiplayer) ─────────────────────────────────────────────────

async function onApplySkill(skillId) {
  if (appMode.value === 'mp') {
    const res = await mp.sendAction('apply_skill', { skillId })
    if (!res.ok) playSFX('error')
    else playSFX('click')
  }
  // In solo mode, SkillTreePanel calls applySkill directly on gameState
}

function onAcceptIncubator() {
  const result = acceptIncubatorOffer(gameState)
  if (result.success) {
    rightPanelTab.value = 'clients'
  }
}

function onDeclineIncubator() {
  declineIncubatorOffer(gameState)
}

// ─── Save / Load (solo only) ──────────────────────────────────────────────────

function showSaveMsg(text, ok) {
  saveMsg.value = { text, ok }
  clearTimeout(saveMsgTimer)
  saveMsgTimer = setTimeout(() => { saveMsg.value = null }, 2500)
}

function onSave() {
  if (appMode.value === 'mp') return
  const r = saveGame(gameState)
  showSaveMsg(r.success ? '💾 Sauvegardé !' : `❌ ${r.message}`, r.success)
}

function onLoad() {
  if (appMode.value === 'mp') return
  const r = loadGame(gameState)
  if (r.success) showSaveMsg(`📂 Chargé — ${gameState.day} jours`, true)
  else showSaveMsg(`❌ ${r.message}`, false)
}

function onReset() {
  if (appMode.value === 'mp') return
  const fresh = createGameState()
  for (const key of Object.keys(gameState)) delete gameState[key]
  Object.assign(gameState, fresh)
  showSaveMsg('🔄 Nouvelle partie', true)
}
</script>

<style>
* { margin: 0; padding: 0; box-sizing: border-box; }

.blur-bg > *:not(.start-overlay) {
  filter: blur(4px);
  pointer-events: none;
}

.start-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(13, 17, 23, 0.85);
  z-index: 9999;
}

.start-modal {
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 8px;
  padding: 40px;
  width: 420px;
  text-align: center;
  box-shadow: 0 10px 40px rgba(0,0,0,0.8);
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.start-modal h2 {
  font-family: monospace;
  color: #58a6ff;
  letter-spacing: 2px;
  margin-bottom: 10px;
}

.loader-wrap {
  height: 6px;
  background: #21262d;
  border-radius: 3px;
  overflow: hidden;
}

.loader-bar {
  height: 100%;
  background: #3fb950;
  transition: width 0.5s ease-out;
}

.loader-text {
  font-family: monospace;
  font-size: 11px;
  color: #8b949e;
}

.mode-select {
  display: flex;
  gap: 12px;
  margin-top: 4px;
}

.mode-btn {
  flex: 1;
  border: none;
  padding: 14px 16px;
  border-radius: 6px;
  font-family: monospace;
  font-weight: bold;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
  letter-spacing: 1px;
}

.solo-btn {
  background: #238636;
  color: #fff;
  border: 1px solid #2ea043;
}
.solo-btn:hover { background: #2ea043; }

.multi-btn {
  background: #1f4068;
  color: #58a6ff;
  border: 1px solid #58a6ff;
}
.multi-btn:hover { background: #2a5a8a; color: #fff; }

.app {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: #0d1117;
  color: #e6edf3;
  font-family: monospace;
}

.main-area {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.canvas-area {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ─── Drawer modal ────────────────────────────────────────────────────────── */
.drawer-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  z-index: 300;
  display: flex;
  justify-content: flex-end;
}

.drawer-panel {
  width: clamp(300px, 28vw, 420px);
  height: 100%;
  background: #161b22;
  border-left: 1px solid #30363d;
  display: flex;
  flex-direction: column;
  box-shadow: -8px 0 32px rgba(0,0,0,0.5);
}

.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-bottom: 1px solid #21262d;
  flex-shrink: 0;
  background: #0d1117;
}

.drawer-title {
  font-family: monospace;
  font-size: 13px;
  font-weight: bold;
  color: #e6edf3;
  letter-spacing: 1px;
}

.drawer-close {
  background: transparent;
  border: 1px solid #30363d;
  color: #8b949e;
  font-family: monospace;
  font-size: 13px;
  width: 26px;
  height: 26px;
  cursor: pointer;
  border-radius: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.1s;
}
.drawer-close:hover { background: #21262d; color: #f85149; border-color: #f85149; }

.drawer-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.drawer-enter-active, .drawer-leave-active {
  transition: opacity 0.18s ease;
}
.drawer-enter-active .drawer-panel,
.drawer-leave-active .drawer-panel {
  transition: transform 0.18s ease;
}
.drawer-enter-from .drawer-panel,
.drawer-leave-to .drawer-panel {
  transform: translateX(100%);
}
.drawer-enter-from, .drawer-leave-to {
  opacity: 0;
}

/* ─── Waiting room overlay ───────────────────────────────────────────────── */
.waiting-overlay {
  position: fixed;
  inset: 0;
  background: rgba(13, 17, 23, 0.92);
  z-index: 500;
  display: flex;
  align-items: center;
  justify-content: center;
}

.waiting-modal {
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 8px;
  padding: 32px 40px;
  width: 380px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  box-shadow: 0 12px 48px rgba(0,0,0,0.8);
  text-align: center;
}

.waiting-title {
  font-family: monospace;
  font-size: 16px;
  font-weight: bold;
  color: #58a6ff;
  letter-spacing: 2px;
}

.waiting-room-name {
  font-family: monospace;
  font-size: 13px;
  color: #e6edf3;
  font-weight: bold;
}

.waiting-invite {
  font-family: monospace;
  font-size: 11px;
  color: #58a6ff;
  letter-spacing: 3px;
  background: #0d1a2e;
  border: 1px solid #1f4068;
  padding: 3px 12px;
  border-radius: 10px;
}

.waiting-players {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 5px;
  background: #0d1117;
  border: 1px solid #21262d;
  border-radius: 5px;
  padding: 10px 12px;
  max-height: 180px;
  overflow-y: auto;
}

.waiting-player {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: monospace;
  font-size: 11px;
}

.w-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}
.w-dot.online  { background: #3fb950; }
.w-dot.offline { background: #484f58; }

.w-name { color: #e6edf3; flex: 1; text-align: left; }
.w-gm {
  font-size: 9px;
  background: #3d2b00;
  color: #d29922;
  border: 1px solid #d29922;
  padding: 0 4px;
  border-radius: 3px;
}

.waiting-gm {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.btn-start-game {
  width: 100%;
  background: #238636;
  border: 1px solid #2ea043;
  color: #fff;
  font-family: monospace;
  font-size: 14px;
  font-weight: bold;
  padding: 12px;
  border-radius: 5px;
  cursor: pointer;
  letter-spacing: 1px;
  transition: all 0.15s;
}
.btn-start-game:hover { background: #2ea043; }

.waiting-hint {
  font-family: monospace;
  font-size: 10px;
  color: #484f58;
  line-height: 1.5;
}

.btn-leave-wait {
  background: transparent;
  border: 1px solid #30363d;
  color: #8b949e;
  font-family: monospace;
  font-size: 10px;
  padding: 4px 14px;
  cursor: pointer;
  border-radius: 3px;
  transition: all 0.1s;
  margin-top: 4px;
}
.btn-leave-wait:hover { border-color: #f85149; color: #f85149; }

/* ── Incubateur modal ── */
.incubator-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 400;
}

.incubator-modal {
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 6px;
  padding: 20px;
  width: 340px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  font-family: monospace;
}

.inc-title {
  font-size: 14px;
  font-weight: bold;
  color: #58a6ff;
  letter-spacing: 1px;
  text-align: center;
}

.inc-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.inc-desc {
  font-size: 11px;
  color: #8b949e;
  margin: 0;
}

.inc-detail {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
}

.inc-label { color: #8b949e; }
.inc-val   { color: #e6edf3; font-weight: bold; }

.inc-note {
  font-size: 10px;
  color: #d29922;
  margin: 4px 0 0;
}

.inc-actions {
  display: flex;
  gap: 8px;
}

.inc-btn {
  flex: 1;
  font-family: monospace;
  font-size: 11px;
  padding: 6px;
  cursor: pointer;
  border-radius: 3px;
  border: 1px solid;
}

.inc-accept {
  background: #0f2d0f;
  border-color: #3fb950;
  color: #3fb950;
}
.inc-accept:hover { background: #1a4d1a; }

.inc-decline {
  background: #1a0909;
  border-color: #3d1010;
  color: #f85149;
}
.inc-decline:hover { background: #2d0a0a; }
</style>
