<template>
  <div class="mp-panel">

    <!-- Room info bar -->
    <div class="room-bar">
      <div class="room-info">
        <span class="room-name">{{ mp.roomInfo.value?.name ?? 'Room' }}</span>
        <span class="room-day">J{{ mp.shared.value?.day ?? '—' }}</span>
        <span class="room-speed">× {{ mp.shared.value?.speed ?? 1 }}</span>
      </div>
      <div class="invite-code" :title="'Code invitation : ' + mp.roomInfo.value?.inviteCode">
        🔑 {{ mp.roomInfo.value?.inviteCode ?? '——' }}
      </div>
    </div>

    <!-- Tabs -->
    <div class="tab-row">
      <button class="tab-btn" :class="{ active: tab === 'players' }" @click="tab = 'players'">
        👥 Joueurs
      </button>
      <button class="tab-btn" :class="{ active: tab === 'market' }" @click="tab = 'market'">
        📈 Marché
      </button>
      <button class="tab-btn" :class="{ active: tab === 'tenders' }" @click="tab = 'tenders'; seenTenderIds.value = new Set(openTenders.map(t => t.id))">
        📋 Contrats{{ newTenderCount > 0 ? ` (${newTenderCount})` : '' }}
      </button>
      <button class="tab-btn" :class="{ active: tab === 'chat' }" @click="tab = 'chat'; unread = 0">
        💬 Chat{{ unread > 0 ? ` (${unread})` : '' }}
      </button>
    </div>

    <!-- ── Players tab ──────────────────────────────────────────────────────── -->
    <div v-if="tab === 'players'" class="tab-body">
      <div class="player-list">
        <div
          v-for="p in sortedPlayers"
          :key="p.id"
          class="player-row"
          :class="{ disconnected: !p.connected, gm: p.id === mp.roomInfo.value?.gameMasterId }"
        >
          <div class="p-status-dot" :class="p.connected ? 'online' : 'offline'"></div>
          <div class="p-info">
            <div class="p-name-row">
              <span class="p-name">{{ p.name }}</span>
              <span v-if="p.id === mp.roomInfo.value?.gameMasterId" class="gm-badge">GM</span>
              <span v-if="p.isSpecialist" class="spec-badge" :title="`Spécialiste ${p.isSpecialist}`">
                {{ serviceIcon(p.isSpecialist) }} Spécialiste
              </span>
              <span
                v-else-if="p.specializationProgress > 0"
                class="spec-progress"
                :title="`En cours de spécialisation : ${p.specializationProgress}/365 jours`"
              >{{ serviceIcon(allPlayerServices(p)[0]) }} {{ p.specializationProgress }}/365j</span>
            </div>
            <div class="p-stats">
              <span class="p-stat green">${{ p.money?.toLocaleString() }}</span>
              <span class="p-stat">+${{ p.revenue }}/j</span>
              <span class="p-stat blue">⭐{{ p.reputation }}</span>
              <span class="p-stat muted">{{ p.clientCount }} clients</span>
              <span class="p-stat muted">uptime {{ p.uptime30d }}%</span>
            </div>
            <!-- Services: auto + template summary -->
            <div class="p-services" v-if="p.serviceSlots || p.serviceTemplates">
              <template v-for="svc in allPlayerServices(p)" :key="svc">
                <template v-if="(p.serviceModes?.[svc] ?? 'auto') === 'templates'">
                  <span class="svc-tag svc-tpl" @click="togglePlayerExpand(p.id, svc)">
                    {{ svc }} 📋 ×{{ totalTemplateSlots(p, svc) }}
                    <span class="expand-arrow">{{ isExpanded(p.id, svc) ? '▲' : '▼' }}</span>
                  </span>
                  <!-- Template details expanded -->
                  <div v-if="isExpanded(p.id, svc)" class="tpl-details">
                    <div v-for="tpl in (p.serviceTemplates?.[svc] ?? [])" :key="tpl.id" class="tpl-row">
                      <span class="tpl-name">{{ tpl.name }}</span>
                      <span class="tpl-price green">${{ tpl.fixedPrice }}</span>
                      <span class="tpl-slots muted">×{{ tpl.slots }}</span>
                      <button
                        v-if="p.id !== mySocketId"
                        class="copy-tpl-btn"
                        @click="copyTemplate(svc, tpl)"
                        title="Copier ce template"
                      >⧉</button>
                    </div>
                  </div>
                </template>
                <template v-else>
                  <span v-if="(p.serviceSlots?.[svc] ?? 0) > 0" class="svc-tag">
                    {{ svc }} ×{{ p.serviceSlots[svc] }} — ${{ p.servicePrices?.[svc] ?? '?' }}
                  </span>
                </template>
              </template>
            </div>
          </div>
          <!-- GM actions -->
          <div v-if="mp.isGameMaster.value && p.id !== mySocketId" class="p-actions">
            <button class="kick-btn" @click="kickPlayer(p.id)" title="Expulser">✕</button>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Market tab ───────────────────────────────────────────────────────── -->
    <div v-if="tab === 'market'" class="tab-body">
      <div class="market-info">
        <div class="market-year">Année {{ mp.shared.value?.year ?? 1 }}</div>
        <div class="market-subtitle">Demande actuelle du marché</div>
      </div>
      <div class="market-bars">
        <div v-for="(weight, svc) in marketWeights" :key="svc" class="market-row">
          <span class="market-svc">{{ serviceIcon(svc) }} {{ svc }}</span>
          <div class="market-bar-wrap">
            <div
              class="market-bar-fill"
              :style="{ width: (weight * 100).toFixed(1) + '%', background: svcColor(svc) }"
            ></div>
          </div>
          <span class="market-pct" :style="{ color: svcColor(svc) }">
            ~{{ Math.round((mp.shared.value?.lastPoolCount ?? 0) * weight) }} cl
          </span>
        </div>
      </div>
      <div class="market-note">
        Le marché évolue chaque année — spécialisez-vous pour des bonus.
      </div>
    </div>

    <!-- ── Contrats (Tenders) tab ────────────────────────────────────────────── -->
    <div v-if="tab === 'tenders'" class="tab-body">
      <div v-if="openTenders.length === 0 && closedTenders.length === 0" class="tender-empty">
        Aucun contrat disponible.<br>
        <span class="tender-hint">Les appels d'offres apparaissent tous les ~20 jours.</span>
      </div>

      <!-- Open tenders -->
      <div v-if="openTenders.length > 0" class="tender-section-label">Appels d'offres ouverts</div>
      <div
        v-for="t in openTenders"
        :key="t.id"
        class="tender-card"
        :class="{ 'new-tender': !seenTenderIds.has(t.id) }"
      >
        <div class="tender-header">
          <span class="tender-type-badge" :class="t.type">{{ tenderTypeLabel(t.type) }}</span>
          <span class="tender-service">{{ serviceIcon(t.serviceId) }} {{ t.serviceId }}</span>
          <span class="tender-expires">expire J{{ t.expiresDay }}</span>
        </div>
        <div class="tender-label">{{ t.label }}</div>
        <div class="tender-stats">
          <span class="tender-stat green">${{ t.dailyRevenue }}/j</span>
          <span class="tender-stat">{{ t.duration }}j</span>
          <span class="tender-stat blue">×{{ t.requiredServers }} serveurs</span>
          <span class="tender-stat muted">{{ t.applicantCount }} candidat{{ t.applicantCount !== 1 ? 's' : '' }}</span>
        </div>
        <div class="tender-reqs">
          <span class="tender-req" :class="repOk(t) ? 'req-ok' : 'req-fail'">
            ⭐ min {{ t.minReputation }} rep
          </span>
          <span class="tender-req" :class="slotsOk(t) ? 'req-ok' : 'req-fail'">
            🔲 min {{ t.minSlots }} slots {{ t.serviceId }}
          </span>
          <span v-if="t.type === 'specialist'" class="tender-req" :class="specialistOk(t) ? 'req-ok' : 'req-fail'">
            🎯 spécialiste {{ t.serviceId }}
          </span>
        </div>
        <div class="tender-footer">
          <button
            v-if="!hasApplied(t)"
            class="apply-btn"
            :disabled="!isEligible(t)"
            @click="applyTender(t)"
          >
            {{ isEligible(t) ? 'Candidater' : 'Non éligible' }}
          </button>
          <span v-else class="applied-badge">✓ Candidature envoyée</span>
        </div>
      </div>

      <!-- Closed tenders -->
      <div v-if="closedTenders.length > 0" class="tender-section-label muted-label">Historique récent</div>
      <div
        v-for="t in closedTenders"
        :key="t.id"
        class="tender-card closed"
      >
        <div class="tender-header">
          <span class="tender-type-badge" :class="t.type">{{ tenderTypeLabel(t.type) }}</span>
          <span class="tender-service">{{ serviceIcon(t.serviceId) }} {{ t.serviceId }}</span>
          <span class="tender-status" :class="t.status">
            {{ t.status === 'awarded' ? `→ ${t.winnerName}` : 'Expiré' }}
          </span>
        </div>
        <div class="tender-label muted">{{ t.label }}</div>
        <div class="tender-stats">
          <span class="tender-stat green">${{ t.dailyRevenue }}/j</span>
          <span class="tender-stat">{{ t.duration }}j</span>
        </div>
      </div>
    </div>

    <!-- ── Chat tab ─────────────────────────────────────────────────────────── -->
    <div v-if="tab === 'chat'" class="tab-body chat-body">
      <div class="chat-log" ref="chatLogRef">
        <div v-if="mp.chat.value.length === 0" class="chat-empty">Aucun message.</div>
        <div
          v-for="(msg, i) in mp.chat.value"
          :key="i"
          class="chat-msg"
        >
          <span class="chat-day">J{{ msg.day }}</span>
          <span class="chat-from">{{ msg.from }}</span>
          <span class="chat-text">{{ msg.text }}</span>
        </div>
      </div>
      <div class="chat-input-row">
        <input
          v-model="chatInput"
          class="chat-input"
          placeholder="Message…"
          maxlength="200"
          @keydown.enter="sendChat"
        />
        <button class="chat-send" @click="sendChat">↵</button>
      </div>
    </div>

    <!-- Footer: token + save + leave -->
    <div class="panel-footer">
      <div class="footer-tools">
        <!-- Reconnect token copy -->
        <button class="footer-btn" @click="copyToken" :title="'Copier le token de reconnexion'">
          🔐 Token
        </button>
        <!-- Export save (GM only) -->
        <button v-if="mp.isGameMaster.value" class="footer-btn" @click="doExport">
          ⬇ Export
        </button>
        <!-- Import save (GM only) -->
        <label v-if="mp.isGameMaster.value" class="footer-btn footer-btn-label" title="Importer une sauvegarde (GM)">
          ⬆ Import
          <input type="file" accept=".json" class="hidden-file" @change="doImport" />
        </label>
      </div>
      <button class="btn-leave" @click="$emit('leave')">← Quitter la room</button>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'

const props = defineProps({
  mp:           { type: Object, required: true },
  mySocketId:   { type: String, default: '' },
})
const emit = defineEmits(['leave'])

const tab        = ref('players')
const chatInput  = ref('')
const unread     = ref(0)
const chatLogRef = ref(null)

// ── Template expand state ─────────────────────────────────────────────────────
// Key: `${playerId}/${svc}`
const expandedKeys = ref(new Set())
function togglePlayerExpand(playerId, svc) {
  const key = `${playerId}/${svc}`
  const next = new Set(expandedKeys.value)
  next.has(key) ? next.delete(key) : next.add(key)
  expandedKeys.value = next
}
function isExpanded(playerId, svc) {
  return expandedKeys.value.has(`${playerId}/${svc}`)
}

function allPlayerServices(p) {
  const svcs = new Set([
    ...Object.keys(p.serviceSlots ?? {}),
    ...Object.keys(p.serviceTemplates ?? {}),
  ])
  return [...svcs]
}

function totalTemplateSlots(p, svc) {
  return (p.serviceTemplates?.[svc] ?? []).reduce((s, t) => s + (t.slots ?? 0), 0)
}

async function copyTemplate(svc, tpl) {
  await props.mp.sendAction('set_service_templates', {
    serviceId: svc,
    templates: [tpl],
  })
}

// ── Token copy ────────────────────────────────────────────────────────────────
async function copyToken() {
  const token = props.mp.reconnectToken?.value
  if (!token) return
  try {
    await navigator.clipboard.writeText(token)
  } catch (_) {
    // fallback: show prompt
    window.prompt('Token de reconnexion :', token)
  }
}

// ── Save export / import ──────────────────────────────────────────────────────
async function doExport() {
  const res = await props.mp.exportState()
  if (!res?.ok || !res.data) return
  const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `datacenter-save-j${props.mp.shared.value?.day ?? 0}.json`
  a.click()
  URL.revokeObjectURL(url)
}

async function doImport(evt) {
  const file = evt.target.files?.[0]
  if (!file) return
  try {
    const text  = await file.text()
    const saved = JSON.parse(text)
    await props.mp.importState(saved)
  } catch (_) {}
  evt.target.value = ''
}

// ── Tender state ──────────────────────────────────────────────────────────────
const seenTenderIds = ref(new Set())

const openTenders = computed(() =>
  (props.mp.shared.value?.tenders ?? []).filter(t => t.status === 'open')
)
const closedTenders = computed(() =>
  (props.mp.shared.value?.tenders ?? [])
    .filter(t => t.status !== 'open')
    .sort((a, b) => b.openedDay - a.openedDay)
    .slice(0, 5)
)

const newTenderCount = computed(() =>
  openTenders.value.filter(t => !seenTenderIds.value.has(t.id)).length
)

// Track new tenders when not on tenders tab
watch(openTenders, () => {
  if (tab.value !== 'tenders') return  // badge will update via newTenderCount
}, { deep: true })

const myMeta = computed(() =>
  props.mp.players.value.find(p => p.id === props.mySocketId)
)

function repOk(t)   { return (myMeta.value?.reputation ?? 0) >= t.minReputation }
function slotsOk(t) { return (myMeta.value?.serviceSlots?.[t.serviceId] ?? 0) >= t.minSlots }
function specialistOk(t) {
  const active = Object.entries(myMeta.value?.serviceSlots ?? {}).filter(([, v]) => v > 0)
  return active.length === 1 && active[0][0] === t.serviceId
}
function isEligible(t) {
  if (!repOk(t) || !slotsOk(t)) return false
  if (t.type === 'specialist' && !specialistOk(t)) return false
  return true
}
function hasApplied(t) { return t.applicants?.includes(props.mySocketId) }
async function applyTender(t) { await props.mp.sendAction('apply_tender', { tenderId: t.id }) }

function tenderTypeLabel(type) {
  return { budget: '💰 Budget', premium: '⭐ Premium', specialist: '🎯 Spécialiste' }[type] ?? type
}

// Track unread chat when not on chat tab
watch(() => props.mp.chat.value.length, () => {
  if (tab.value !== 'chat') unread.value++
})

// Auto-scroll chat
watch(() => props.mp.chat.value, async () => {
  if (tab.value !== 'chat') return
  await nextTick()
  if (chatLogRef.value) chatLogRef.value.scrollTop = chatLogRef.value.scrollHeight
}, { deep: true })

watch(tab, async (v) => {
  if (v === 'chat') {
    unread.value = 0
    await nextTick()
    if (chatLogRef.value) chatLogRef.value.scrollTop = chatLogRef.value.scrollHeight
  }
})

function sendChat() {
  if (!chatInput.value.trim()) return
  props.mp.sendChat(chatInput.value.trim())
  chatInput.value = ''
}

async function kickPlayer(playerId) {
  await props.mp.sendAction('kick_player', { playerId })
}

const sortedPlayers = computed(() =>
  [...(props.mp.players.value ?? [])].sort((a, b) => (b.revenue ?? 0) - (a.revenue ?? 0))
)

const marketWeights = computed(() => {
  return props.mp.shared.value?.marketWeights ?? { VPS: 0.4, DEDICATED: 0.2, STORAGE: 0.2, GAMING: 0.2 }
})

function serviceIcon(svc) {
  return { VPS: '💻', DEDICATED: '🖥️', STORAGE: '💾', GAMING: '🎮', ENTERPRISE: '🏢' }[svc] ?? '📦'
}

function svcColor(svc) {
  return { VPS: '#58a6ff', DEDICATED: '#d29922', STORAGE: '#3fb950', GAMING: '#f85149' }[svc] ?? '#8b949e'
}
</script>

<style scoped>
.mp-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  font-family: monospace;
}

/* Room bar */
.room-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: #0d1117;
  border-bottom: 1px solid #21262d;
  flex-shrink: 0;
}
.room-info { display: flex; align-items: center; gap: 8px; }
.room-name { font-size: 12px; font-weight: bold; color: #e6edf3; }
.room-day  { font-size: 10px; color: #8b949e; }
.room-speed { font-size: 10px; color: #58a6ff; font-weight: bold; }
.invite-code {
  font-size: 10px;
  color: #58a6ff;
  letter-spacing: 2px;
  background: #0d1a2e;
  border: 1px solid #1f4068;
  padding: 2px 8px;
  border-radius: 10px;
  cursor: default;
}

/* Tabs */
.tab-row {
  display: flex;
  background: #0d1117;
  border-bottom: 1px solid #21262d;
  flex-shrink: 0;
}
.tab-btn {
  flex: 1;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  color: #8b949e;
  font-family: monospace;
  font-size: 10px;
  padding: 7px 4px;
  cursor: pointer;
  transition: all 0.1s;
}
.tab-btn:hover  { color: #e6edf3; }
.tab-btn.active { color: #58a6ff; border-bottom-color: #58a6ff; }

.tab-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 10px;
}

/* Players */
.player-list { display: flex; flex-direction: column; gap: 6px; }

.player-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  background: #0d1117;
  border: 1px solid #21262d;
  border-radius: 4px;
  padding: 7px 8px;
  transition: border-color 0.1s;
}
.player-row:hover { border-color: #30363d; }
.player-row.disconnected { opacity: 0.5; }
.player-row.gm { border-color: #d29922; background: #14100a; }

.p-status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  margin-top: 4px;
  flex-shrink: 0;
}
.p-status-dot.online  { background: #3fb950; }
.p-status-dot.offline { background: #484f58; }

.p-info { flex: 1; display: flex; flex-direction: column; gap: 3px; }

.p-name-row { display: flex; align-items: center; gap: 5px; }
.p-name { font-size: 11px; font-weight: bold; color: #e6edf3; }

.gm-badge {
  font-size: 9px;
  background: #3d2b00;
  color: #d29922;
  border: 1px solid #d29922;
  padding: 0 4px;
  border-radius: 3px;
}
.spec-badge { font-size: 11px; color: #3fb950; font-weight: bold; }
.spec-progress { font-size: 10px; color: #d29922; }

.p-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  font-size: 9px;
}
.p-stat       { color: #8b949e; }
.p-stat.green { color: #3fb950; }
.p-stat.blue  { color: #58a6ff; }
.p-stat.muted { color: #484f58; }

.p-services {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 2px;
}
.svc-tag {
  font-size: 9px;
  background: #161b22;
  border: 1px solid #21262d;
  color: #8b949e;
  padding: 1px 5px;
  border-radius: 3px;
}
.svc-tag.svc-tpl {
  cursor: pointer;
  border-color: #30363d;
  color: #c9d1d9;
}
.svc-tag.svc-tpl:hover { border-color: #58a6ff; }
.expand-arrow { font-size: 7px; margin-left: 2px; }
.tpl-details {
  width: 100%;
  background: #0d1117;
  border: 1px solid #21262d;
  border-radius: 3px;
  padding: 4px 6px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: 1px;
}
.tpl-row {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 9px;
}
.tpl-name  { flex: 1; color: #e6edf3; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tpl-price { flex-shrink: 0; }
.tpl-slots { flex-shrink: 0; }
.copy-tpl-btn {
  background: #21262d;
  border: 1px solid #30363d;
  color: #8b949e;
  font-size: 9px;
  padding: 1px 4px;
  cursor: pointer;
  border-radius: 2px;
}
.copy-tpl-btn:hover { border-color: #58a6ff; color: #58a6ff; }

.p-actions { display: flex; flex-direction: column; gap: 4px; flex-shrink: 0; }
.kick-btn {
  background: transparent;
  border: 1px solid #6e2020;
  color: #f85149;
  font-size: 10px;
  width: 20px;
  height: 20px;
  cursor: pointer;
  border-radius: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.kick-btn:hover { background: #2e0a0a; }

/* Market */
.market-info {
  margin-bottom: 10px;
}
.market-year {
  font-size: 14px;
  font-weight: bold;
  color: #e6edf3;
}
.market-subtitle {
  font-size: 10px;
  color: #8b949e;
  margin-top: 2px;
}

.market-bars { display: flex; flex-direction: column; gap: 8px; }

.market-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.market-svc {
  font-size: 10px;
  color: #8b949e;
  width: 80px;
  flex-shrink: 0;
}
.market-bar-wrap {
  flex: 1;
  height: 8px;
  background: #21262d;
  border-radius: 4px;
  overflow: hidden;
}
.market-bar-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.4s;
}
.market-pct {
  font-size: 10px;
  font-weight: bold;
  width: 44px;
  text-align: right;
  flex-shrink: 0;
}
.market-note {
  margin-top: 12px;
  font-size: 9px;
  color: #484f58;
  font-style: italic;
  text-align: center;
}

/* Chat */
.chat-body {
  display: flex !important;
  flex-direction: column;
  padding: 0 !important;
}
.chat-log {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.chat-empty {
  font-size: 11px;
  color: #484f58;
  text-align: center;
  padding: 20px 0;
}
.chat-msg {
  display: flex;
  gap: 6px;
  align-items: baseline;
  font-size: 10px;
  line-height: 1.4;
}
.chat-day  { color: #484f58; flex-shrink: 0; }
.chat-from { color: #58a6ff; font-weight: bold; flex-shrink: 0; }
.chat-text { color: #e6edf3; word-break: break-word; }

.chat-input-row {
  display: flex;
  gap: 4px;
  padding: 8px;
  border-top: 1px solid #21262d;
  flex-shrink: 0;
}
.chat-input {
  flex: 1;
  background: #0d1117;
  border: 1px solid #30363d;
  color: #e6edf3;
  font-family: monospace;
  font-size: 11px;
  padding: 4px 8px;
  border-radius: 3px;
  outline: none;
}
.chat-input:focus { border-color: #58a6ff; }
.chat-send {
  background: #1f4068;
  border: 1px solid #58a6ff;
  color: #58a6ff;
  font-family: monospace;
  font-size: 12px;
  padding: 4px 10px;
  cursor: pointer;
  border-radius: 3px;
}
.chat-send:hover { background: #2a5a8a; }

/* Footer */
.panel-footer {
  padding: 6px 10px;
  border-top: 1px solid #21262d;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.footer-tools {
  display: flex;
  gap: 4px;
}
.footer-btn {
  flex: 1;
  background: #0d1117;
  border: 1px solid #21262d;
  color: #8b949e;
  font-family: monospace;
  font-size: 9px;
  padding: 3px 6px;
  cursor: pointer;
  border-radius: 3px;
  transition: all 0.1s;
  text-align: center;
}
.footer-btn:hover { border-color: #58a6ff; color: #58a6ff; }
.footer-btn-label {
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.hidden-file { display: none; }
.btn-leave {
  width: 100%;
  background: transparent;
  border: 1px solid #30363d;
  color: #8b949e;
  font-family: monospace;
  font-size: 10px;
  padding: 5px;
  cursor: pointer;
  border-radius: 3px;
  transition: all 0.1s;
}
.btn-leave:hover { border-color: #f85149; color: #f85149; background: #140808; }

/* Tenders */
.tender-empty {
  font-size: 11px;
  color: #484f58;
  text-align: center;
  padding: 24px 10px;
  line-height: 1.6;
}
.tender-hint { font-size: 9px; color: #30363d; }

.tender-section-label {
  font-size: 9px;
  color: #58a6ff;
  letter-spacing: 1px;
  text-transform: uppercase;
  margin: 6px 0 4px;
  font-weight: bold;
}
.tender-section-label.muted-label { color: #484f58; }

.tender-card {
  background: #0d1117;
  border: 1px solid #21262d;
  border-radius: 4px;
  padding: 7px 9px;
  margin-bottom: 5px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  transition: border-color 0.15s;
}
.tender-card:hover { border-color: #30363d; }
.tender-card.closed { opacity: 0.55; }
.tender-card.new-tender { border-color: #d29922; }

.tender-header {
  display: flex;
  align-items: center;
  gap: 6px;
}

.tender-type-badge {
  font-size: 9px;
  padding: 1px 5px;
  border-radius: 3px;
  font-weight: bold;
  flex-shrink: 0;
}
.tender-type-badge.budget     { background: #1a1400; color: #d29922; border: 1px solid #d29922; }
.tender-type-badge.premium    { background: #0d1a2e; color: #58a6ff; border: 1px solid #58a6ff; }
.tender-type-badge.specialist { background: #0a1e0a; color: #3fb950; border: 1px solid #3fb950; }

.tender-service {
  font-size: 10px;
  color: #e6edf3;
  font-weight: bold;
  flex: 1;
}
.tender-expires {
  font-size: 9px;
  color: #f85149;
  flex-shrink: 0;
}

.tender-label {
  font-size: 10px;
  color: #c9d1d9;
  font-style: italic;
}
.tender-label.muted { color: #484f58; }

.tender-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  font-size: 9px;
}
.tender-stat       { color: #8b949e; }
.tender-stat.green { color: #3fb950; font-weight: bold; }
.tender-stat.blue  { color: #58a6ff; }
.tender-stat.muted { color: #484f58; }

.tender-reqs {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}
.tender-req {
  font-size: 9px;
  padding: 1px 5px;
  border-radius: 3px;
}
.tender-req.req-ok   { background: #0a1e0a; color: #3fb950; border: 1px solid #238636; }
.tender-req.req-fail { background: #1e0a0a; color: #f85149; border: 1px solid #6e2020; }

.tender-footer { display: flex; align-items: center; margin-top: 2px; }

.apply-btn {
  background: #21262d;
  border: 1px solid #3fb950;
  color: #3fb950;
  font-family: monospace;
  font-size: 9px;
  padding: 3px 10px;
  cursor: pointer;
  border-radius: 2px;
  transition: all 0.1s;
}
.apply-btn:hover:not(:disabled) { background: #0f2d0f; }
.apply-btn:disabled { opacity: 0.4; cursor: not-allowed; border-color: #30363d; color: #8b949e; }

.applied-badge {
  font-size: 9px;
  color: #3fb950;
  font-weight: bold;
}

.tender-status {
  font-size: 9px;
  font-weight: bold;
  flex-shrink: 0;
}
.tender-status.awarded { color: #3fb950; }
.tender-status.expired { color: #484f58; }
</style>
