<template>
  <div class="clients-panel">

    <!-- Summary -->
    <div class="summary">
      <span class="badge active">{{ gameState.clients.length }} actifs</span>
      <span class="badge queue" v-if="gameState.clientQueue.length > 0">
        {{ gameState.clientQueue.length }} en attente
      </span>
      <span class="badge empty" v-if="gameState.clients.length === 0 && gameState.clientQueue.length === 0">
        Aucun client
      </span>
    </div>

    <!-- Queue (en premier pour ne pas scroller) -->
    <template v-if="gameState.clientQueue.length > 0">
      <div class="section-label queue-label">EN ATTENTE</div>
      <div class="client-list">
        <div
          v-for="client in gameState.clientQueue"
          :key="client.id"
          class="client-row queued"
          :class="{ assigning: assigningId === client.id }"
        >
          <div class="client-name">
            <span v-if="client.isEnterprise" class="enterprise-badge">🏢</span>
            {{ client.name }}
          </div>
          <div class="client-meta">
            <span class="demand">CPU {{ client.cpuDemand }}</span>
            <span class="demand">RAM {{ client.ramDemand }}G</span>
            <span class="demand">DSK {{ client.diskDemand }}G</span>
            <span class="svc-tag" :style="{ color: svcColor(client.serviceId) }">{{ client.serviceId }}</span>
            <span class="tpl-tag" v-if="client.templateName">{{ client.templateName }}</span>
            <span class="wait-days">{{ client.daysInQueue }}j / 4j</span>
          </div>
          <div class="wait-bar">
            <div class="wait-fill" :style="{ width: (client.daysInQueue / 4 * 100) + '%' }"></div>
          </div>

          <!-- Enterprise progress -->
          <div v-if="client.isEnterprise && (client.pendingPositions?.length ?? 0) > 0" class="enterprise-progress">
            Slots assignés : {{ client.pendingPositions.length }}/{{ client.requiredServers }}
            <span v-for="(pos, i) in client.pendingPositions" :key="i" class="pending-slot">
              F{{ pos.floorId }} {{ posLabel(pos) }}
            </span>
          </div>

          <!-- Assign button -->
          <button
            class="assign-btn"
            :class="{ active: assigningId === client.id }"
            @click="toggleAssign(client.id)"
          >
            <template v-if="assigningId === client.id">✕ Annuler</template>
            <template v-else-if="client.isEnterprise">
              ⬆ Assigner serveur {{ (client.pendingPositions?.length ?? 0) + 1 }}/{{ client.requiredServers }}
            </template>
            <template v-else>⬆ Assigner</template>
          </button>

          <!-- Server list -->
          <div v-if="assigningId === client.id" class="server-list">
            <div v-if="compatibleServers.length === 0" class="no-servers">
              Aucun serveur compatible disponible
            </div>
            <button
              v-for="srv in compatibleServers"
              :key="`${srv.floorId}-${srv.x}-${srv.y}-${srv.slot}`"
              class="server-btn"
              @click="doAssign(client.id, srv)"
            >
              <span class="srv-label">{{ srv.label }}</span>
              <span class="srv-type" :style="{ color: typeColor(srv.serverType) }">{{ srv.serverType }}</span>
              <span class="srv-free">+{{ srv.freeCapacity }} libre</span>
            </button>
          </div>
        </div>
      </div>
    </template>

    <!-- Active clients -->
    <div v-if="gameState.clients.length > 0" class="section-label">ACTIFS</div>
    <div class="client-list">
      <div
        v-for="client in gameState.clients"
        :key="client.id"
        class="client-row"
      >
        <div class="client-name-row">
          <span class="client-name">
            <span v-if="client.isEnterprise" class="enterprise-badge">🏢</span>
            {{ client.name }}
          </span>
          <div class="mood-wrap">
            <span class="mood-emoji" :title="moodTooltip(client)">{{ moodEmoji(client) }}</span>
            <div class="mood-popup">
              <div class="mood-title">{{ client.name }}</div>
              <div class="mood-line">
                <span class="mood-key">Service</span>
                <span class="mood-val" :style="{ color: svcColor(client.serviceId) }">{{ client.serviceId }}</span>
              </div>
              <div class="mood-line">
                <span class="mood-key">Satisfaction</span>
                <span class="mood-val" :style="{ color: satColor(client.satisfaction) }">{{ Math.round(client.satisfaction) }}%</span>
              </div>
              <div class="mood-line" v-if="!client.isEnterprise">
                <span class="mood-key">Serveur</span>
                <span class="mood-val">{{ client.serverPos ? `F${client.serverPos.floorId} ${serverLabel(client.serverPos)}` : '—' }}</span>
              </div>
              <div class="mood-line" v-if="client.isEnterprise">
                <span class="mood-key">Serveurs</span>
                <span class="mood-val">{{ client.serverPositions?.length ?? 0 }}/{{ client.requiredServers }}</span>
              </div>
              <div class="mood-problems" v-if="clientProblems(client).length > 0">
                <div class="mood-prob-title">Problèmes :</div>
                <div v-for="p in clientProblems(client)" :key="p" class="mood-prob">• {{ p }}</div>
              </div>
              <div class="mood-ok" v-else>Aucun problème détecté</div>
            </div>
          </div>
        </div>
        <div class="client-meta">
          <span class="demand">CPU {{ client.cpuDemand }}</span>
          <span class="demand">RAM {{ client.ramDemand }}G</span>
          <span class="demand">DSK {{ client.diskDemand }}G</span>
          <span class="svc-tag" :style="{ color: svcColor(client.serviceId) }">{{ client.serviceId }}</span>
          <span class="tpl-tag" v-if="client.templateName">{{ client.templateName }}</span>
          <span class="server-tag" v-if="client.serverPos && !client.isEnterprise">
            F{{ client.serverPos.floorId }} {{ serverLabel(client.serverPos) }}
          </span>
          <span class="server-tag enterprise-slots" v-if="client.isEnterprise">
            {{ client.serverPositions?.length ?? 0 }}/{{ client.requiredServers }} srv
          </span>
        </div>
        <div class="satisfaction-bar">
          <div class="satisfaction-fill" :style="{ width: client.satisfaction + '%', background: satColor(client.satisfaction) }"></div>
        </div>
        <div class="sat-value" :style="{ color: satColor(client.satisfaction) }">
          {{ Math.round(client.satisfaction) }}%
        </div>
        <div class="contract-row">
          <span class="contract-days" :class="contractUrgency(client)">
            📋 {{ contractDaysLeft(client) }}j restants
          </span>
          <span v-if="client.isEnterprise" class="daily-rate">
            ${{ client.dailyRate ?? '?' }}/j
          </span>
        </div>
        <div class="churn-warning" v-if="client.daysUnhappy >= 1">
          ⚠ part dans {{ 3 - client.daysUnhappy }}j
        </div>
      </div>
    </div>

    <!-- Empty state -->
    <div v-if="gameState.clients.length === 0 && gameState.clientQueue.length === 0" class="empty-state">
      <div>Installez des serveurs</div>
      <div>pour recevoir des clients</div>
    </div>

  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { COLUMNS, SERVICES, SERVER_TYPES } from '../game/GameState.js'
import { getServersForQueueClient, assignClientToServer } from '../game/SimulationEngine.js'

const props = defineProps({
  gameState:  { type: Object,   required: true },
  sendAction: { type: Function, default: null },
})

const assigningId = ref(null)

const compatibleServers = computed(() => {
  if (!assigningId.value) return []
  return getServersForQueueClient(props.gameState, assigningId.value)
})

function toggleAssign(clientId) {
  assigningId.value = assigningId.value === clientId ? null : clientId
}

async function doAssign(clientId, srv) {
  let activated = false
  if (props.sendAction) {
    // Multiplayer: delegate to server so state stays authoritative
    const result = await props.sendAction('assign_client', {
      clientId,
      floorId: srv.floorId,
      x:       srv.x,
      y:       srv.y,
      slot:    srv.slot,
    })
    if (!result?.ok) return
    activated = result.activated
  } else {
    // Solo: modify local state directly
    const result = assignClientToServer(props.gameState, clientId, srv.floorId, srv.x, srv.y, srv.slot, true)
    if (!result?.success) return
    activated = result.activated
  }
  // For enterprise: keep panel open until all slots filled
  if (activated) assigningId.value = null
}

function serverLabel(pos) {
  return `${COLUMNS[pos.x]}${pos.y}:${pos.slot}`
}

function posLabel(pos) {
  return `${COLUMNS[pos.x]}${pos.y}:${pos.slot}`
}

function svcColor(sid)  { return SERVICES[sid]?.color ?? '#8b949e' }
function typeColor(key) { return SERVER_TYPES[key]?.color ?? '#8b949e' }

function satColor(sat) {
  if (sat >= 70) return '#3fb950'
  if (sat >= 45) return '#d29922'
  return '#f85149'
}

function moodEmoji(client) {
  const s = client.satisfaction
  if (s >= 85) return '😄'
  if (s >= 70) return '🙂'
  if (s >= 50) return '😐'
  if (s >= 35) return '😟'
  if (s >= 20) return '😠'
  return '🤬'
}

function moodTooltip(client) {
  return `Satisfaction: ${Math.round(client.satisfaction)}%`
}

function contractDaysLeft(client) {
  const age       = (props.gameState.day ?? 0) - (client.dayArrived ?? 0)
  const retention = (props.gameState.unlockedSkills ?? []).includes('CLIENT_RETENTION') ? 1.3 : 1.0
  const total     = Math.round((client.durationExpected ?? 30) * retention)
  return Math.max(0, total - age)
}

function contractUrgency(client) {
  const left = contractDaysLeft(client)
  if (left <= 5)  return 'urgent'
  if (left <= 15) return 'soon'
  return 'normal'
}

function clientProblems(client) {
  const problems = []
  const s = client.satisfaction
  if (client.daysUnhappy >= 1) problems.push(`Insatisfait depuis ${client.daysUnhappy} jour(s)`)
  if (s < 40) problems.push('Satisfaction critique')
  if (s < 60) problems.push('Serveur surchargé ou dégradé')
  if (client.isEnterprise) {
    const assigned = client.serverPositions?.length ?? 0
    if (assigned < client.requiredServers) problems.push(`${assigned}/${client.requiredServers} serveurs assignés`)
  } else {
    if (!client.serverPos) problems.push('Pas de serveur assigné')
  }
  return problems
}
</script>

<style scoped>
.clients-panel {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.summary {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 4px;
}

.badge {
  font-family: monospace;
  font-size: 10px;
  padding: 2px 7px;
  border-radius: 10px;
  font-weight: bold;
}
.badge.active { background: #1f4068; color: #58a6ff; }
.badge.queue  { background: #3d2b00; color: #d29922; }
.badge.empty  { background: #21262d; color: #8b949e; }

.section-label {
  font-family: monospace;
  font-size: 10px;
  font-weight: bold;
  color: #58a6ff;
  letter-spacing: 1px;
  margin-top: 4px;
}
.queue-label { color: #d29922; }

.client-list {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.client-row {
  background: #0d1117;
  border: 1px solid #21262d;
  border-radius: 3px;
  padding: 5px 7px;
  display: grid;
  grid-template-columns: 1fr auto;
  grid-template-rows: auto auto;
  gap: 2px 4px;
}
.client-row.queued    { border-color: #3d2b00; }
.client-row.assigning { border-color: #58a6ff; background: #0d1a2e; }

.client-name-row {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
}

.client-name {
  font-family: monospace;
  font-size: 10px;
  color: #e6edf3;
  font-weight: bold;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Mood emoji + popup */
.mood-wrap {
  position: relative;
  flex-shrink: 0;
}

.mood-emoji {
  font-size: 13px;
  cursor: default;
  line-height: 1;
}

.mood-popup {
  display: none;
  position: absolute;
  right: 0;
  top: calc(100% + 4px);
  width: 170px;
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 5px;
  padding: 7px 9px;
  z-index: 50;
  box-shadow: 0 4px 16px rgba(0,0,0,0.5);
  flex-direction: column;
  gap: 3px;
}

.mood-wrap:hover .mood-popup { display: flex; }

.mood-title {
  font-family: monospace;
  font-size: 10px;
  font-weight: bold;
  color: #e6edf3;
  padding-bottom: 4px;
  border-bottom: 1px solid #21262d;
  margin-bottom: 2px;
}

.mood-line {
  display: flex;
  justify-content: space-between;
  font-family: monospace;
  font-size: 9px;
}
.mood-key { color: #8b949e; }
.mood-val { color: #e6edf3; font-weight: bold; }

.mood-problems { margin-top: 4px; display: flex; flex-direction: column; gap: 2px; }
.mood-prob-title { font-family: monospace; font-size: 9px; color: #f85149; font-weight: bold; }
.mood-prob       { font-family: monospace; font-size: 9px; color: #d29922; }
.mood-ok         { font-family: monospace; font-size: 9px; color: #3fb950; margin-top: 4px; }

.client-meta {
  display: flex;
  gap: 5px;
  align-items: center;
  font-family: monospace;
  font-size: 9px;
}

.demand     { color: #8b949e; }
.svc-tag    { font-size: 8px; font-weight: bold; }
.tpl-tag    { font-size: 8px; color: #3fb950; background: #0f2d0f; border: 1px solid #1f4a1f; border-radius: 8px; padding: 0 4px; white-space: nowrap; }
.server-tag { color: #58a6ff; }
.wait-days  { color: #d29922; }

.sat-value {
  font-family: monospace;
  font-size: 10px;
  font-weight: bold;
  text-align: right;
}

.contract-row {
  grid-column: 1 / -1;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-family: monospace;
  font-size: 9px;
}

.contract-days { color: #484f58; }
.contract-days.soon   { color: #d29922; }
.contract-days.urgent { color: #f85149; font-weight: bold; }

.daily-rate {
  color: #a371f7;
  font-weight: bold;
}

.churn-warning {
  grid-column: 1 / -1;
  font-family: monospace;
  font-size: 9px;
  color: #f85149;
  font-weight: bold;
  animation: blink 1s step-end infinite;
}
@keyframes blink {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.4; }
}

.satisfaction-bar, .wait-bar {
  grid-column: 1 / -1;
  height: 3px;
  background: #21262d;
  border-radius: 2px;
  overflow: hidden;
}
.satisfaction-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.3s;
}
.wait-fill {
  height: 100%;
  background: #d29922;
  border-radius: 2px;
  transition: width 0.3s;
}

/* Assign button */
.assign-btn {
  grid-column: 1 / -1;
  background: #21262d;
  border: 1px solid #3d2b00;
  color: #d29922;
  font-family: monospace;
  font-size: 9px;
  padding: 3px 6px;
  cursor: pointer;
  border-radius: 2px;
  text-align: center;
  transition: all 0.1s;
}
.assign-btn:hover  { background: #3d2b00; }
.assign-btn.active { background: #1a0a0a; border-color: #f85149; color: #f85149; }

/* Server list dropdown */
.server-list {
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  border: 1px solid #1f4068;
  border-radius: 3px;
  padding: 4px;
  background: #0d1a2e;
  margin-top: 1px;
}

.no-servers {
  font-family: monospace;
  font-size: 9px;
  color: #8b949e;
  font-style: italic;
  text-align: center;
  padding: 4px;
}

.server-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  background: #161b22;
  border: 1px solid #21262d;
  color: #e6edf3;
  font-family: monospace;
  font-size: 9px;
  padding: 3px 6px;
  cursor: pointer;
  border-radius: 2px;
  text-align: left;
}
.server-btn:hover { border-color: #3fb950; background: #0f2d0f; }

.srv-label { font-weight: bold; min-width: 60px; }
.srv-type  { flex: 1; }
.srv-free  { color: #3fb950; }

.enterprise-badge {
  font-size: 10px;
  margin-right: 2px;
}

.enterprise-slots {
  color: #a371f7;
}

.enterprise-progress {
  grid-column: 1 / -1;
  font-family: monospace;
  font-size: 9px;
  color: #a371f7;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
}

.pending-slot {
  background: #1a1040;
  border: 1px solid #a371f7;
  border-radius: 2px;
  padding: 1px 4px;
  color: #a371f7;
}

.empty-state {
  margin-top: 24px;
  text-align: center;
  font-family: monospace;
  font-size: 11px;
  color: #30363d;
  line-height: 1.8;
}
</style>
