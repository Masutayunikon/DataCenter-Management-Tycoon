<template>
  <div class="tickets-panel">

    <!-- ── MISSIONS ──────────────────────────────────────────────────────── -->
    <div v-if="pendingMissions.length > 0" class="section missions-section">
      <div class="section-header">
        <span class="section-title">MISSIONS</span>
        <span class="section-count">{{ pendingMissions.length }}</span>
        <span class="sp-hint">résoudre → +SP</span>
      </div>

      <div class="mission-list">
        <div
          v-for="m in pendingMissions"
          :key="m.id"
          class="mission-card"
          :class="m.urgency"
        >
          <div class="mission-top">
            <span class="mission-label">{{ m.label }}</span>
            <span class="mission-urgency-icon">{{ urgencyIcon(m.urgency) }}</span>
          </div>
          <div class="mission-client">{{ m.clientName }}{{ m.isEnterprise ? ' 🏢' : '' }}</div>
          <div class="mission-desc">{{ m.clientMessage }}</div>
          <div class="mission-footer">
            <span class="mission-deadline" :class="{ urgent: m.daysLeft <= 2 }">
              ⏱ {{ m.daysLeft }}j restant{{ m.daysLeft > 1 ? 's' : '' }}
            </span>
            <span class="mission-rewards">
              <span class="reward-sat">+{{ m.satReward }} sat</span>
              <span class="reward-sp">+{{ m.sp }} SP</span>
            </span>
            <button
              class="connect-btn"
              :class="{ offline: !clientHasServer(m.clientId) }"
              :disabled="!clientHasServer(m.clientId)"
              @click.stop="connect(m)"
              :title="clientHasServer(m.clientId) ? `$ ${m.command}` : 'Client pas encore assigné à un serveur'"
            >
              {{ clientHasServer(m.clientId) ? '⌨ Connecter' : '⏳ En queue' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="pendingMissions.length === 0" class="empty-state">
      <div>Aucune mission</div>
      <div>En attente de clients...</div>
    </div>

  </div>
</template>

<script setup>
import { computed } from 'vue'
import { COLUMNS } from '../game/GameState.js'
import { formatGameDate } from '../game/SimUtils.js'

const props = defineProps({
  gameState: { type: Object, required: true },
})

const emit = defineEmits(['connect-mission'])

// ── Missions ────────────────────────────────────────────────────────────────

const pendingMissions = computed(() =>
  [...(props.gameState.missions ?? [])].sort((a, b) => a.daysLeft - b.daysLeft)
)

function clientHasServer(clientId) {
  const client = props.gameState.clients.find(c => c.id === clientId)
  if (!client) return false
  return !!(client.serverPos ?? client.serverPositions?.[0])
}

function connect(mission) {
  if (!clientHasServer(mission.clientId)) return
  emit('connect-mission', { clientId: mission.clientId })
}

function urgencyIcon(u) {
  return { info: 'ℹ', warning: '⚠', critical: '🔴' }[u] ?? 'ℹ'
}
</script>

<style scoped>
.tickets-panel {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

/* ── Sections ── */
.section {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 2px 2px 4px;
  border-bottom: 1px solid #21262d;
  margin-bottom: 2px;
}

.section-title {
  font-family: monospace;
  font-size: 9px;
  font-weight: bold;
  color: #8b949e;
  letter-spacing: 0.08em;
}

.section-count {
  font-family: monospace;
  font-size: 9px;
  color: #d29922;
  font-weight: bold;
}

.sp-hint {
  margin-left: auto;
  font-family: monospace;
  font-size: 9px;
  color: #3fb950;
}

/* ── Missions ── */
.mission-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.mission-card {
  background: #0d1117;
  border: 1px solid #21262d;
  border-left: 3px solid #21262d;
  border-radius: 3px;
  padding: 6px 8px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.mission-card.info     { border-left-color: #58a6ff; }
.mission-card.warning  { border-left-color: #d29922; }
.mission-card.critical { border-left-color: #f85149; }

.mission-top {
  display: flex;
  align-items: center;
  gap: 4px;
}

.mission-label {
  flex: 1;
  font-family: monospace;
  font-size: 10px;
  font-weight: bold;
  color: #e6edf3;
}

.mission-urgency-icon { font-size: 10px; }

.mission-client {
  font-family: monospace;
  font-size: 9px;
  color: #58a6ff;
}

.mission-desc {
  font-family: monospace;
  font-size: 9px;
  color: #8b949e;
  line-height: 1.4;
}

.mission-footer {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-top: 2px;
  flex-wrap: wrap;
}

.mission-deadline {
  font-family: monospace;
  font-size: 9px;
  color: #8b949e;
}
.mission-deadline.urgent { color: #f85149; font-weight: bold; }

.mission-rewards {
  display: flex;
  gap: 4px;
  margin-left: auto;
}

.reward-sat {
  font-family: monospace;
  font-size: 9px;
  color: #3fb950;
}

.reward-sp {
  font-family: monospace;
  font-size: 9px;
  color: #d29922;
  font-weight: bold;
}

.connect-btn {
  background: #0f1e2e;
  border: 1px solid #58a6ff;
  color: #58a6ff;
  font-family: monospace;
  font-size: 9px;
  padding: 2px 7px;
  cursor: pointer;
  border-radius: 3px;
  transition: background 0.1s;
  white-space: nowrap;
}
.connect-btn:hover:not(.offline) { background: #1a3050; }
.connect-btn.offline {
  border-color: #30363d;
  color: #8b949e;
  cursor: default;
  background: transparent;
}

</style>
