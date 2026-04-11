<template>
  <header class="top-bar">
    <div class="title">DataCenter Tycoon RTS</div>

    <!-- Stats cliquables -->
    <div class="stats" @mouseenter="showPanel = true" @mouseleave="showPanel = false">
      <div class="stat" :class="profitClass">
        <span class="stat-icon">$</span>
        <span class="stat-value">${{ gameState.money.toLocaleString() }}</span>
      </div>
      <div class="stat" :class="profitClass">
        <span class="stat-icon">📈</span>
        <span class="stat-value" :class="profitClass">
          {{ profit >= 0 ? '+' : '' }}${{ profit }}/j
        </span>
      </div>
      <div class="stat">
        <span class="stat-icon">⭐</span>
        <span class="stat-value" :style="{ color: repColor }">{{ Math.round(gameState.reputation) }}</span>
      </div>
      <div class="stat">
        <span class="stat-icon">📅</span>
        <span class="stat-value">{{ formatGameDate(gameState.day, gameState.hour) }}</span>
      </div>

      <!-- Popup panel -->
      <Transition name="fade">
        <div class="stats-panel" v-if="showPanel" @mouseenter="showPanel = true" @mouseleave="showPanel = false">

          <!-- Finance -->
          <div class="panel-section">
            <div class="section-title">💰 FINANCE</div>
            <div class="row">
              <span class="row-label">Revenu clients</span>
              <span class="row-value green">+${{ gameState.revenue }}</span>
            </div>
            <div class="row">
              <span class="row-label">Électricité</span>
              <span class="row-value red">-${{ gameState.electricityCost }}</span>
            </div>
            <div class="row">
              <span class="row-label">Maintenance serveurs</span>
              <span class="row-value red">-${{ gameState.maintenanceCost }}</span>
            </div>
            <div class="row" v-if="gameState.employeeCost > 0">
              <span class="row-label">Salaires employés</span>
              <span class="row-value red">-${{ gameState.employeeCost }}</span>
            </div>
            <div class="row sub" v-if="serverCounts.BASIC > 0">
              <span class="row-label muted">Basic ×{{ serverCounts.BASIC }}</span>
              <span class="row-value muted">-${{ serverCounts.BASIC * 8 }}/j</span>
            </div>
            <div class="row sub" v-if="serverCounts.BALANCED > 0">
              <span class="row-label muted">Balanced ×{{ serverCounts.BALANCED }}</span>
              <span class="row-value muted">-${{ serverCounts.BALANCED * 18 }}/j</span>
            </div>
            <div class="row sub" v-if="serverCounts.PERFORMANCE > 0">
              <span class="row-label muted">Performance ×{{ serverCounts.PERFORMANCE }}</span>
              <span class="row-value muted">-${{ serverCounts.PERFORMANCE * 35 }}/j</span>
            </div>
            <div class="divider"></div>
            <div class="row total">
              <span class="row-label">Profit net / jour</span>
              <span class="row-value" :class="profitClass">{{ profit >= 0 ? '+' : '' }}${{ profit }}</span>
            </div>
            <div class="row total">
              <span class="row-label">Trésorerie</span>
              <span class="row-value" :class="gameState.money < 500 ? 'red' : 'green'">${{ gameState.money.toLocaleString() }}</span>
            </div>
          </div>

          <!-- Infrastructure -->
          <div class="panel-section">
            <div class="section-title">🖥 INFRASTRUCTURE</div>
            <div class="row">
              <span class="row-label">Serveurs installés</span>
              <span class="row-value">{{ totalServers }}</span>
            </div>
            <div class="row sub" v-if="serverCounts.BASIC > 0">
              <span class="row-label muted">Basic</span>
              <span class="row-value muted">×{{ serverCounts.BASIC }}</span>
            </div>
            <div class="row sub" v-if="serverCounts.BALANCED > 0">
              <span class="row-label muted">Balanced</span>
              <span class="row-value muted">×{{ serverCounts.BALANCED }}</span>
            </div>
            <div class="row sub" v-if="serverCounts.PERFORMANCE > 0">
              <span class="row-label muted">Performance</span>
              <span class="row-value muted">×{{ serverCounts.PERFORMANCE }}</span>
            </div>
            <div class="row">
              <span class="row-label">Capacité CPU</span>
              <span class="row-value">{{ usedCapacity }} / {{ totalCapacity }}</span>
            </div>
            <div class="capacity-bar">
              <div class="capacity-fill" :style="{ width: capacityPct + '%', background: capacityColor }"></div>
            </div>
            <div class="row">
              <span class="row-label">Puissance</span>
              <span class="row-value" :style="{ color: powerColor }">{{ gameState.power }}W</span>
            </div>
            <div class="row">
              <span class="row-label">Électricité</span>
              <span class="row-value red">-${{ gameState.electricityCost }}/j</span>
            </div>
            <div class="row">
              <span class="row-label">Température moy.</span>
              <span class="row-value" :style="{ color: heatColor }">{{ gameState.heat }}°C</span>
            </div>
            <div class="row">
              <span class="row-label">Protection hack</span>
              <span class="row-value" :style="{ color: hackProtection > 0.5 ? '#3fb950' : hackProtection > 0 ? '#d29922' : '#f85149' }">{{ Math.round(hackProtection * 100) }}%</span>
            </div>
          </div>

          <!-- Réputation -->
          <div class="panel-section">
            <div class="section-title">⭐ RÉPUTATION</div>
            <div class="rep-bar-wrap">
              <div class="rep-bar">
                <div class="rep-fill" :style="{ width: gameState.reputation + '%', background: repColor }"></div>
              </div>
              <span class="rep-val" :style="{ color: repColor }">{{ Math.round(gameState.reputation) }}/100</span>
            </div>
            <div class="rep-label">{{ repLabel }}</div>
            <div class="row" style="margin-top:6px">
              <span class="row-label">Clients actifs</span>
              <span class="row-value">{{ gameState.clients.length }}</span>
            </div>
            <div class="row" v-if="gameState.clientQueue.length > 0">
              <span class="row-label">En attente</span>
              <span class="row-value orange">{{ gameState.clientQueue.length }}</span>
            </div>
          </div>

          <!-- Événements actifs -->
          <div class="panel-section" v-if="gameState.activeEvents.length > 0">
            <div class="section-title">⚡ ÉVÉNEMENTS ACTIFS</div>
            <div class="event-row" v-for="ev in gameState.activeEvents" :key="ev.id" :class="ev.severity">
              <div class="ev-name">{{ ev.name }}</div>
              <div class="ev-desc">{{ ev.description }}</div>
              <div class="ev-days">{{ ev.daysLeft }} jour(s) restant(s)</div>
            </div>
          </div>

        </div>
      </Transition>
    </div>

    <!-- Queue badge -->
    <div
      v-if="gameState.clientQueue.length > 0"
      class="queue-badge"
      @click="$emit('go-clients')"
      :title="`${gameState.clientQueue.length} client(s) en attente — cliquez pour gérer`"
    >
      <span class="queue-icon">👥</span>
      <span class="queue-count">{{ gameState.clientQueue.length }}</span>
      <span class="queue-label">en attente</span>
    </div>

    <!-- Active events pills (topbar) -->
    <div class="active-events" v-if="gameState.activeEvents.length > 0">
      <div
        v-for="ev in gameState.activeEvents"
        :key="ev.id"
        class="event-pill"
        :class="ev.severity"
      >
        {{ ev.name }} ({{ ev.daysLeft }}j)
      </div>
    </div>

    <!-- Save toast -->
    <Transition name="fade">
      <span v-if="saveMsg" class="save-toast" :class="saveMsg.ok ? 'ok' : 'err'">
        {{ saveMsg.text }}
      </span>
    </Transition>

    <!-- Notification bell -->
    <div class="notif-wrap" ref="notifWrapRef">
      <button
        class="nav-btn notif-btn"
        :class="{ 'has-alert': unreadNotifCount > 0 }"
        @click="showNotifPanel = !showNotifPanel"
        title="Journal des événements"
      >
        🔔
        <span v-if="unreadNotifCount > 0" class="notif-badge">{{ unreadNotifCount }}</span>
      </button>
      <Transition name="fade">
        <div v-if="showNotifPanel" class="notif-dropdown">
          <div class="notif-header">
            <span class="notif-title">JOURNAL</span>
            <span class="notif-total">{{ allNotifications.length }} entrée(s)</span>
            <button class="mark-notif-btn" v-if="unreadNotifCount > 0" @click="markAllNotifRead">Tout lire</button>
          </div>
          <div class="notif-list">
            <div v-if="allNotifications.length === 0" class="notif-empty">Aucun événement</div>
            <div
              v-for="n in allNotifications"
              :key="n.uid"
              class="notif-item"
              :class="[n.severity, { unread: !n.read }]"
              @click="n.read = true"
            >
              <span class="notif-dot" :class="n.severity"></span>
              <div class="notif-body">
                <span class="notif-type" v-if="n.isTicket">{{ typeLabel(n.type) }}</span>
                <span class="notif-msg">{{ n.message }}</span>
                <span class="notif-server" v-if="n.serverPos">Serveur: {{ serverLabel(n.serverPos) }}</span>
                <span class="notif-day">J{{ n.day }}</span>
              </div>
            </div>
          </div>
        </div>
      </Transition>
      <div v-if="showNotifPanel" class="notif-backdrop" @click="showNotifPanel = false"></div>
    </div>

    <!-- Save menu (solo only) -->
    <div class="save-menu-wrap" v-if="!isMultiplayer">
      <button class="nav-btn save-btn" @click="showSaveMenu = !showSaveMenu" title="Sauvegarder / Charger">💾 ▾</button>
      <Transition name="fade">
        <div v-if="showSaveMenu" class="save-dropdown">
          <button class="dropdown-item" @click="doSave">💾 Sauvegarder</button>
          <button class="dropdown-item" @click="doLoad">📂 Charger</button>
          <div class="dropdown-sep"></div>
          <button class="dropdown-item danger" @click="doReset">🔄 Nouvelle partie</button>
        </div>
      </Transition>
      <div v-if="showSaveMenu" class="save-menu-backdrop" @click="showSaveMenu = false"></div>
    </div>

    <!-- Nav buttons -->
    <button class="nav-btn" @click="openShop">🛒 Shop</button>
    <button class="nav-btn skills" @click="openSkills">🔷 Skills</button>

    <!-- Multiplayer panel button -->
    <button v-if="isMultiplayer" class="nav-btn mp-btn" @click="emit('open-mp-panel')" title="Panel Multijoueur">🌐 Marché</button>

    <!-- Settings button -->
    <div class="save-menu-wrap">
      <button class="nav-btn" @click="toggleSettings" title="Paramètres">⚙️</button>
      <Transition name="fade">
        <div v-if="showSettingsPanel" class="save-dropdown settings-dropdown">
          <div class="notif-header">
            <span class="notif-title">PARAMÈTRES</span>
          </div>
          <div class="settings-body">
            <div class="setting-row">
              <label>Master</label>
              <input type="range" min="0" max="100" v-model.number="gameState.settings.masterVolume" />
            </div>
            <div class="setting-row">
              <label>Musique</label>
              <input type="range" min="0" max="100" v-model.number="gameState.settings.musicVolume" />
            </div>
            <div class="setting-row">
              <label>Effets (SFX)</label>
              <input type="range" min="0" max="100" v-model.number="gameState.settings.sfxVolume" />
            </div>
          </div>
        </div>
      </Transition>
      <div v-if="showSettingsPanel" class="save-menu-backdrop" @click="showSettingsPanel = false"></div>
    </div>

    <!-- Achievements button -->
    <div class="achieve-wrap" ref="achieveWrapRef">
      <button
        class="nav-btn achieve-btn"
        :class="{ 'has-new': hasNewMilestone }"
        @click="showAchievePanel = !showAchievePanel"
        title="Succès & Achievements"
      >
        🏆
        <span v-if="hasNewMilestone" class="achieve-badge">{{ newMilestoneCount }}</span>
      </button>
      <Transition name="fade">
        <div v-if="showAchievePanel" class="achieve-dropdown">
          <div class="notif-header">
            <span class="notif-title">🏆 SUCCÈS</span>
            <span class="notif-total">{{ unlockedMilestoneCount }} / {{ allMilestones.length }}</span>
            <button class="mark-notif-btn" v-if="hasNewMilestone" @click="markMilestonesRead">Tout marquer</button>
          </div>
          <div class="achieve-list">
            <div
              v-for="ms in allMilestones"
              :key="ms.id"
              class="achieve-item"
              :class="{ unlocked: isMilestoneUnlocked(ms.id), locked: !isMilestoneUnlocked(ms.id) }"
            >
              <span class="achieve-icon">{{ isMilestoneUnlocked(ms.id) ? '✅' : '🔒' }}</span>
              <div class="achieve-body">
                <span class="achieve-label">{{ ms.label }}</span>
                <span class="achieve-desc">{{ ms.desc }}</span>
              </div>
            </div>
          </div>
        </div>
      </Transition>
      <div v-if="showAchievePanel" class="notif-backdrop" @click="showAchievePanel = false"></div>
    </div>

    <div class="speed-controls">
      <button
        class="speed-btn"
        :class="{ active: paused, disabled: !canControlSpeed }"
        :disabled="!canControlSpeed"
        @click="canControlSpeed && togglePause()"
        title="Pause (Espace)"
      >
        {{ paused ? '▶' : '⏸' }}
      </button>
      <button
        class="speed-btn active"
        :class="{ disabled: !canControlSpeed }"
        :disabled="!canControlSpeed"
        @click="canControlSpeed && decreaseSpeed()"
        @click.right.prevent="canControlSpeed && increaseSpeed()"
        :title="canControlSpeed ? `Vitesse: ${SPEED_CYCLE[speedIdx]}x — Clic gauche: réduire, Clic droit: augmenter` : 'Seul le GM peut modifier la vitesse'"
      >{{ SPEED_CYCLE[speedIdx] }}x</button>
    </div>
  </header>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { getHackProtection } from '../game/SimulationEngine.js'
import { MILESTONES, COLUMNS } from '../game/GameState.js'
import { playSFX } from '../game/AudioEngine.js'

const GAME_START = new Date(2025, 0, 1)
function formatGameDate(day, hour = 0) {
  const d = new Date(GAME_START.getTime())
  d.setDate(d.getDate() + day)
  const dateStr = d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit' })
  return `${dateStr} 🕐${String(hour).padStart(2, '0')}h`
}

const props = defineProps({
  gameState:       { type: Object,  required: true },
  saveMsg:         { type: Object,  default: null },   // { text, ok }
  isMultiplayer:   { type: Boolean, default: false },
  canControlSpeed: { type: Boolean, default: true },
  currentSpeed:    { type: Number,  default: null },   // external speed (MP sync)
})

const emit = defineEmits(['set-speed', 'go-clients', 'open-shop', 'open-skills', 'open-mp-panel', 'save', 'load', 'reset', 'toggle-pause'])

const showPanel        = ref(false)
const showSaveMenu     = ref(false)
const showNotifPanel   = ref(false)
const showAchievePanel = ref(false)
const showSettingsPanel = ref(false)

// ── Notifications & Tickets ───────────────────────────────────────────────────
const allNotifications = computed(() => {
  const notifs = (props.gameState.notifications ?? []).map(n => ({ ...n, uid: `n_${n.id}` }))
  const tickets = (props.gameState.tickets ?? []).map(t => ({ ...t, uid: `t_${t.id}`, isTicket: true }))
  
  // Combine both sources, sort by day/id descending
  return [...notifs, ...tickets].sort((a, b) => {
    if (a.day !== b.day) return b.day - a.day
    return b.id - a.id
  })
})

const unreadNotifCount = computed(() =>
  allNotifications.value.filter(n => !n.read).length
)

function markAllNotifRead() {
  for (const n of (props.gameState.notifications ?? [])) n.read = true
  for (const t of (props.gameState.tickets ?? [])) t.read = true
  
  // Also reflect changes immediately on the mapped list for immediate visual update
  for (const x of allNotifications.value) x.read = true
}

function typeLabel(t) {
  return {
    performance: 'Performance',
    incident:    'Incident',
    capacity:    'Capacité',
    temperature: 'Température',
  }[t] ?? t
}

function serverLabel(pos) {
  return `F${pos.floorId ?? 0} ${COLUMNS[pos.x]}${pos.y}:${pos.slot}`
}

// ── Achievements (milestones) ─────────────────────────────────────────────────
const allMilestones = MILESTONES
const seenMilestones = ref(new Set([...(props.gameState.milestones ?? [])]))

const unlockedMilestoneCount = computed(() => (props.gameState.milestones ?? []).length)
function isMilestoneUnlocked(id) { return (props.gameState.milestones ?? []).includes(id) }

// Detect newly unlocked milestones (unlocked but not yet "seen" in this session)
const newMilestoneCount = computed(() => {
  const unlocked = props.gameState.milestones ?? []
  return unlocked.filter(id => !seenMilestones.value.has(id)).length
})
const hasNewMilestone = computed(() => newMilestoneCount.value > 0)

function markMilestonesRead() {
  const unlocked = props.gameState.milestones ?? []
  for (const id of unlocked) seenMilestones.value.add(id)
}

function doSave()  { showSaveMenu.value = false; playSFX('click'); emit('save')  }
function doLoad()  { showSaveMenu.value = false; playSFX('click'); emit('load')  }
function doReset() { showSaveMenu.value = false; playSFX('click'); emit('reset') }

function openShop() { playSFX('click'); emit('open-shop') }
function openSkills() { playSFX('click'); emit('open-skills') }

function toggleSettings() {
  playSFX('click')
  showSettingsPanel.value = !showSettingsPanel.value
}

const SPEED_CYCLE = [1, 2, 4, 8, 16, 32]
const speedIdx    = ref(0)
const paused      = ref(false)

// Sync speedIdx when an external speed change arrives (MP: GM changed speed)
watch(() => props.currentSpeed, (spd) => {
  if (spd == null) return
  if (spd === 0) {
    paused.value = true
    return
  }
  paused.value = false
  const idx = SPEED_CYCLE.indexOf(spd)
  if (idx !== -1) speedIdx.value = idx
}, { immediate: true })

function togglePause() {
  paused.value = !paused.value
  emit('set-speed', paused.value ? 0 : SPEED_CYCLE[speedIdx.value])
}

// Left-click = slower, right-click = faster
function decreaseSpeed() {
  if (speedIdx.value > 0) speedIdx.value--
  if (!paused.value) emit('set-speed', SPEED_CYCLE[speedIdx.value])
}
function increaseSpeed() {
  if (speedIdx.value < SPEED_CYCLE.length - 1) speedIdx.value++
  if (!paused.value) emit('set-speed', SPEED_CYCLE[speedIdx.value])
}

// Allow App.vue to trigger pause from Space key
function externalTogglePause() { togglePause() }
defineExpose({ externalTogglePause })

const profit = computed(() =>
  props.gameState.revenue
  - props.gameState.electricityCost
  - (props.gameState.maintenanceCost ?? 0)
  - (props.gameState.employeeCost ?? 0)
)

const profitClass = computed(() => profit.value >= 0 ? 'green' : 'red')

// Server counts by type
const serverCounts = computed(() => {
  const counts = { BASIC: 0, BALANCED: 0, PERFORMANCE: 0 }
  for (const floor of props.gameState.floors) {
    for (const row of floor.grid) {
      for (const cell of row) {
        if (!cell.rack) continue
        for (const s of cell.rack.servers) {
          if (s) counts[s.type] = (counts[s.type] ?? 0) + 1
        }
      }
    }
  }
  return counts
})

const totalServers = computed(() =>
  Object.values(serverCounts.value).reduce((a, b) => a + b, 0)
)

const totalCapacity = computed(() => {
  const caps = { BASIC: 100, BALANCED: 200, PERFORMANCE: 400 }
  return Object.entries(serverCounts.value).reduce((s, [k, v]) => s + (caps[k] ?? 0) * v, 0)
})

const usedCapacity = computed(() =>
  props.gameState.clients.reduce((s, c) => s + (c.cpuDemand ?? 0), 0)
)

const capacityPct = computed(() =>
  totalCapacity.value > 0 ? Math.min(100, usedCapacity.value / totalCapacity.value * 100) : 0
)

const capacityColor = computed(() => {
  const p = capacityPct.value
  if (p < 60)  return '#3fb950'
  if (p < 85)  return '#d29922'
  return '#f85149'
})

const repColor = computed(() => {
  const r = props.gameState.reputation
  if (r >= 70) return '#3fb950'
  if (r >= 40) return '#d29922'
  return '#f85149'
})

const repLabel = computed(() => {
  const r = props.gameState.reputation
  if (r >= 80) return 'Excellente réputation'
  if (r >= 60) return 'Bonne réputation'
  if (r >= 40) return 'Réputation correcte'
  if (r >= 20) return 'Mauvaise réputation'
  return 'Réputation désastreuse'
})

const powerColor = computed(() => {
  const p = props.gameState.power
  const cap = props.gameState.powerCap ?? 3000
  if (p < cap * 0.75) return '#e6edf3'
  if (p < cap)        return '#d29922'
  return '#f85149'
})

const heatColor = computed(() => {
  const h = props.gameState.heat
  if (h < 50) return '#3fb950'
  if (h < 70) return '#d29922'
  return '#f85149'
})

const hackProtection = computed(() => getHackProtection(props.gameState))
</script>

<style scoped>
.top-bar {
  height: 44px;
  min-height: 44px;
  max-height: 44px;
  background: #161b22;
  border-bottom: 1px solid #21262d;
  display: flex;
  align-items: center;
  padding: 0 12px;
  gap: 10px;
  flex-shrink: 0;
  overflow: visible;
  position: relative;
  z-index: 100;
}

.title {
  font-family: monospace;
  font-size: 13px;
  font-weight: bold;
  color: #58a6ff;
  white-space: nowrap;
}

/* ── Stats zone ── */
.stats {
  display: flex;
  gap: 10px;
  margin-left: auto;
  flex-shrink: 1;
  position: relative;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: background 0.15s;
}
.stats:hover { background: #21262d; }

.stat {
  display: flex;
  align-items: center;
  gap: 4px;
  font-family: monospace;
  font-size: 12px;
}

.stat-icon  { color: #8b949e; font-size: 11px; }
.stat-value { color: #e6edf3; font-weight: bold; }

/* ── Popup panel ── */
.stats-panel {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  width: 340px;
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 6px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.6);
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  z-index: 200;
}

.panel-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.section-title {
  font-family: monospace;
  font-size: 10px;
  font-weight: bold;
  color: #58a6ff;
  letter-spacing: 1px;
  padding-bottom: 4px;
  border-bottom: 1px solid #21262d;
  margin-bottom: 2px;
}

.row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-family: monospace;
  font-size: 11px;
}

.row.sub   { padding-left: 10px; }
.row.total { margin-top: 2px; }

.row-label       { color: #8b949e; }
.row-label.muted { color: #484f58; }
.row-value       { color: #e6edf3; font-weight: bold; }
.row-value.muted { color: #484f58; }
.row-value.green  { color: #3fb950; }
.row-value.red    { color: #f85149; }
.row-value.orange { color: #d29922; }

.divider {
  height: 1px;
  background: #21262d;
  margin: 3px 0;
}

/* Capacity bar */
.capacity-bar {
  height: 4px;
  background: #21262d;
  border-radius: 2px;
  overflow: hidden;
  margin: 2px 0 4px;
}
.capacity-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.4s;
}

/* Reputation bar */
.rep-bar-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
}
.rep-bar {
  flex: 1;
  height: 6px;
  background: #21262d;
  border-radius: 3px;
  overflow: hidden;
}
.rep-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.5s;
}
.rep-val {
  font-family: monospace;
  font-size: 10px;
  font-weight: bold;
  min-width: 45px;
  text-align: right;
}
.rep-label {
  font-family: monospace;
  font-size: 10px;
  color: #8b949e;
  font-style: italic;
}

/* Event rows */
.event-row {
  padding: 5px 7px;
  border-radius: 3px;
  border-left: 3px solid;
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-bottom: 2px;
}
.event-row.info     { background: #0d1a2e; border-left-color: #58a6ff; }
.event-row.warning  { background: #1a1200; border-left-color: #d29922; }
.event-row.critical { background: #1a0909; border-left-color: #f85149; }

.ev-name  { font-family: monospace; font-size: 11px; font-weight: bold; color: #e6edf3; }
.ev-desc  { font-family: monospace; font-size: 10px; color: #8b949e; }
.ev-days  { font-family: monospace; font-size: 9px; color: #484f58; }

/* Color helpers */
.green { color: #3fb950; }
.red   { color: #f85149; }

/* Queue badge */
.queue-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  background: #3d2b00;
  border: 1px solid #d29922;
  border-radius: 10px;
  padding: 2px 9px;
  cursor: pointer;
  font-family: monospace;
  font-size: 10px;
  white-space: nowrap;
  transition: background 0.1s;
  flex-shrink: 0;
}
.queue-badge:hover { background: #5a3f00; }
.queue-icon  { font-size: 11px; }
.queue-count { color: #d29922; font-weight: bold; font-size: 11px; }
.queue-label { color: #d29922; }

/* Nav buttons */
.nav-btn {
  background: #21262d;
  border: 1px solid #30363d;
  color: #8b949e;
  font-family: monospace;
  font-size: 11px;
  padding: 3px 10px;
  cursor: pointer;
  border-radius: 3px;
  white-space: nowrap;
  flex-shrink: 0;
  transition: all 0.1s;
}
.nav-btn:hover        { border-color: #58a6ff; color: #e6edf3; background: #1f2d3d; }
.nav-btn.skills:hover { border-color: #d29922; color: #e6edf3; background: #2d2000; }
.nav-btn.mp-btn       { border-color: #3fb950; color: #3fb950; }
.nav-btn.mp-btn:hover { border-color: #3fb950; color: #e6edf3; background: #0a2e0a; }

/* Speed + events */
.speed-controls {
  display: flex;
  gap: 4px;
}

.speed-btn {
  background: #21262d;
  border: 1px solid #30363d;
  color: #8b949e;
  font-family: monospace;
  font-size: 12px;
  padding: 3px 9px;
  cursor: pointer;
  border-radius: 3px;
  transition: all 0.1s;
}
.speed-btn:hover  { border-color: #58a6ff; color: #e6edf3; }
.speed-btn.active { background: #1f4068; border-color: #58a6ff; color: #58a6ff; font-weight: bold; }
.speed-btn.disabled, .speed-btn:disabled { opacity: 0.35; cursor: not-allowed; }
.speed-btn.disabled:hover, .speed-btn:disabled:hover { border-color: #30363d; color: #8b949e; background: #21262d; }

.active-events {
  display: flex;
  gap: 6px;
  overflow: hidden;
}

.event-pill {
  font-family: monospace;
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 10px;
  white-space: nowrap;
  border: 1px solid;
}
.event-pill.info     { background: #0d1a2e; color: #58a6ff; border-color: #1f4068; }
.event-pill.warning  { background: #1a1200; color: #d29922; border-color: #3d2b00; }
.event-pill.critical { background: #1a0909; color: #f85149; border-color: #3d1010; }

/* Save toast */
.save-toast {
  font-family: monospace;
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 10px;
  white-space: nowrap;
  border: 1px solid;
  flex-shrink: 0;
}
.save-toast.ok  { background: #0a2e0a; color: #3fb950; border-color: #238636; }
.save-toast.err { background: #2e0a0a; color: #f85149; border-color: #6e2020; }

.save-menu-wrap {
  position: relative;
  flex-shrink: 0;
}

.save-btn { font-size: 11px; padding: 3px 8px; }

.save-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 5px;
  box-shadow: 0 6px 20px rgba(0,0,0,0.6);
  display: flex;
  flex-direction: column;
  min-width: 160px;
  z-index: 500;
  overflow: hidden;
}

.dropdown-item {
  background: transparent;
  border: none;
  color: #e6edf3;
  font-family: monospace;
  font-size: 11px;
  padding: 7px 12px;
  text-align: left;
  cursor: pointer;
  transition: background 0.1s;
}
.dropdown-item:hover { background: #21262d; }
.dropdown-item.danger { color: #f85149; }
.dropdown-item.danger:hover { background: #2e0a0a; }

.dropdown-sep {
  height: 1px;
  background: #21262d;
  margin: 2px 0;
}

.save-menu-backdrop {
  position: fixed;
  inset: 0;
  z-index: 499;
}

/* ── Settings specific ── */
.settings-dropdown {
  width: 220px;
}
.settings-body {
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.setting-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.setting-row label {
  font-family: monospace;
  font-size: 10px;
  color: #8b949e;
}
.setting-row input[type="range"] {
  width: 100%;
}

/* ── Notification bell ── */
.notif-wrap {
  position: relative;
  flex-shrink: 0;
}

.notif-btn {
  position: relative;
  padding: 3px 9px;
  font-size: 13px;
}
.notif-btn.has-alert {
  border-color: #f85149;
  color: #f85149;
  background: #1a0909;
}

.notif-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  background: #f85149;
  color: #fff;
  font-size: 8px;
  font-weight: bold;
  min-width: 14px;
  height: 14px;
  border-radius: 7px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 2px;
  pointer-events: none;
}

.notif-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  width: 320px;
  max-height: 420px;
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 6px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.6);
  display: flex;
  flex-direction: column;
  z-index: 500;
  overflow: hidden;
}

.notif-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 10px;
  border-bottom: 1px solid #21262d;
  flex-shrink: 0;
}

.notif-title {
  font-family: monospace;
  font-size: 10px;
  font-weight: bold;
  color: #58a6ff;
  letter-spacing: 1px;
}

.notif-total {
  font-family: monospace;
  font-size: 10px;
  color: #484f58;
  margin-left: 2px;
}

.mark-notif-btn {
  margin-left: auto;
  background: transparent;
  border: 1px solid #30363d;
  color: #8b949e;
  font-family: monospace;
  font-size: 9px;
  padding: 2px 7px;
  cursor: pointer;
  border-radius: 3px;
}
.mark-notif-btn:hover { border-color: #58a6ff; color: #58a6ff; }

.notif-list {
  overflow-y: auto;
  flex: 1;
  padding: 4px 0;
}

.notif-empty {
  font-family: monospace;
  font-size: 11px;
  color: #484f58;
  text-align: center;
  padding: 20px;
}

.notif-item {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  padding: 5px 10px;
  cursor: pointer;
  transition: background 0.1s;
  border-left: 2px solid transparent;
}
.notif-item:hover { background: #1c2128; }
.notif-item.unread { background: #0d1a2e; }
.notif-item.info.unread     { border-left-color: #58a6ff; }
.notif-item.warning.unread  { background: #14100a; border-left-color: #d29922; }
.notif-item.critical.unread { background: #140808; border-left-color: #f85149; }

.notif-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
  margin-top: 3px;
}
.notif-dot.info     { background: #58a6ff; }
.notif-dot.warning  { background: #d29922; }
.notif-dot.critical { background: #f85149; }

.notif-body {
  flex: 1;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 6px;
  position: relative;
  padding-right: 25px;
}

.notif-msg {
  font-family: monospace;
  font-size: 10px;
  color: #8b949e;
  line-height: 1.4;
  flex: 1;
  word-break: break-word;
}
.notif-item.unread .notif-msg { color: #e6edf3; }

.notif-day {
  font-family: monospace;
  font-size: 9px;
  color: #484f58;
  position: absolute;
  top: 0;
  right: 0;
}
.notif-type {
  display: block;
  font-weight: bold;
  font-size: 10px;
  color: #e6edf3;
  margin-bottom: 2px;
}
.notif-server {
  display: block;
  font-size: 9px;
  color: #58a6ff;
  margin-top: 3px;
}

.notif-backdrop {
  position: fixed;
  inset: 0;
  z-index: 499;
}

.fade-enter-active, .fade-leave-active { transition: opacity 0.12s, transform 0.12s; }
.fade-enter-from, .fade-leave-to       { opacity: 0; transform: translateY(-4px); }

/* ── Achievements ── */
.achieve-wrap {
  position: relative;
  flex-shrink: 0;
}

.achieve-btn {
  position: relative;
  font-size: 13px;
  padding: 3px 9px;
}
.achieve-btn.has-new {
  border-color: #d29922;
  color: #d29922;
  background: #1a1200;
  animation: pulse-gold 1.5s ease-in-out infinite;
}
@keyframes pulse-gold {
  0%, 100% { box-shadow: 0 0 0 0 rgba(210,153,34,0); }
  50%       { box-shadow: 0 0 0 4px rgba(210,153,34,0.25); }
}

.achieve-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  background: #d29922;
  color: #0d1117;
  font-size: 8px;
  font-weight: bold;
  min-width: 14px;
  height: 14px;
  border-radius: 7px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 2px;
  pointer-events: none;
}

.achieve-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  width: 340px;
  max-height: 480px;
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 6px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.6);
  display: flex;
  flex-direction: column;
  z-index: 500;
  overflow: hidden;
}

.achieve-list {
  overflow-y: auto;
  flex: 1;
  padding: 4px 0;
}

.achieve-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border-left: 2px solid transparent;
  transition: background 0.1s;
}
.achieve-item.unlocked {
  border-left-color: #3fb950;
  background: #0a1f0a;
}
.achieve-item.unlocked:hover { background: #0d2b0d; }
.achieve-item.locked {
  opacity: 0.4;
}

.achieve-icon {
  font-size: 14px;
  flex-shrink: 0;
  width: 18px;
  text-align: center;
}

.achieve-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.achieve-label {
  font-family: monospace;
  font-size: 10px;
  font-weight: bold;
  color: #e6edf3;
}
.achieve-item.locked .achieve-label { color: #8b949e; }

.achieve-desc {
  font-family: monospace;
  font-size: 9px;
  color: #484f58;
  line-height: 1.3;
}
.achieve-item.unlocked .achieve-desc { color: #6e7f6e; }
</style>
