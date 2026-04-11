<template>
  <div class="services-panel">

    <div
      v-for="(svc, key) in visibleServices"
      :key="key"
      class="service-card"
      :class="{ inactive: serviceMode(key) === 'templates' ? templates(key).length === 0 : slots(key) === 0 }"
    >
      <!-- Header row -->
      <div class="svc-header">
        <span class="svc-dot" :style="{ background: svc.color }"></span>
        <span class="svc-name">{{ svc.label }}</span>
        <span class="svc-clients" v-if="serviceMode(key) === 'templates' && templateTotalSlots(key) > 0">
          {{ clientCount(key) }} / {{ templateTotalSlots(key) }} <small style="opacity:.6">(tpl)</small>
        </span>
        <span class="svc-clients" v-else-if="slots(key) > 0">
          {{ clientCount(key) }} / {{ slots(key) }} clients
        </span>
        <span class="svc-off" v-else>OFF</span>
      </div>

      <!-- Description + compatible servers -->
      <div class="svc-desc">{{ svc.description }}</div>
      <div class="svc-compat">{{ svc.serverTypes.join(', ') }}</div>
      <div class="svc-caps">
        CPU ≤{{ svc.cpuMax }} &nbsp;·&nbsp; RAM ≤{{ svc.ramMax }}G &nbsp;·&nbsp; Disk ≤{{ svc.diskMax }}G
      </div>

      <!-- Slot count controls — grayed in templates mode -->
      <div class="svc-slots-row">
        <span class="svc-slots-label">Slots :</span>
        <template v-if="serviceMode(key) === 'templates'">
          <span class="slot-value-tpl">{{ templateTotalSlots(key) }} (templates)</span>
          <span class="slot-fill-info" v-if="templateTotalSlots(key) > 0">
            {{ clientCount(key) }} actifs
          </span>
        </template>
        <template v-else>
          <button class="slot-btn" @click="adjustSlots(key, -10)">−10</button>
          <button class="slot-btn" @click="adjustSlots(key, -1)">−1</button>
          <span class="slot-value" :style="{ color: slotColor(key) }">{{ slots(key) }}</span>
          <button class="slot-btn" @click="adjustSlots(key, 1)">+1</button>
          <button class="slot-btn" @click="adjustSlots(key, 10)">+10</button>
        </template>
      </div>

      <!-- Slot fill bar -->
      <div class="slot-bar" v-if="serviceMode(key) === 'templates' ? templateTotalSlots(key) > 0 : slots(key) > 0">
        <div
          class="slot-fill"
          :style="{ width: slotPctEffective(key) + '%', background: slotFillColor(key) }"
        ></div>
      </div>

      <!-- Price controls — grayed in templates mode -->
      <template v-if="serviceMode(key) === 'templates'">
        <div class="svc-price-row" v-if="templates(key).length > 0">
          <span class="svc-price-label">Prix moyen :</span>
          <span class="svc-price">${{ templateAvgPrice(key) }}/j</span>
          <span class="svc-revenue" v-if="clientCount(key) > 0">+${{ dailyRevenue(key) }}/j</span>
        </div>
      </template>
      <template v-else-if="slots(key) > 0">
        <div class="svc-price-row">
          <button class="adj-btn" @click="adjustPrice(key, -5)">-5</button>
          <button class="adj-btn" @click="adjustPrice(key, -1)">-1</button>
          <span class="svc-price">${{ gameState.servicePrices[key] }}/j</span>
          <button class="adj-btn" @click="adjustPrice(key, 1)">+1</button>
          <button class="adj-btn" @click="adjustPrice(key, 5)">+5</button>
        </div>

        <div class="svc-stats-row">
          <span class="attract-label">Attractivité :</span>
          <span :style="{ color: attractColor(key) }">{{ attractLabel(key) }}</span>
          <span class="svc-revenue" v-if="clientCount(key) > 0">
            +${{ dailyRevenue(key) }}/j
          </span>
        </div>
      </template>

      <!-- ── Mode toggle ── -->
      <div class="mode-row">
        <span class="mode-label">Mode arrivée :</span>
        <button
          class="mode-btn"
          :class="{ active: serviceMode(key) === 'auto' }"
          @click="setMode(key, 'auto')"
        >Auto</button>
        <button
          class="mode-btn"
          :class="{ active: serviceMode(key) === 'templates' }"
          @click="setMode(key, 'templates')"
        >Templates</button>
      </div>

      <!-- ── Template section (only in templates mode) ── -->
      <div v-if="serviceMode(key) === 'templates'" class="tpl-section">

        <!-- warning if no templates defined -->
        <div v-if="templates(key).length === 0" class="tpl-empty">
          Aucun template — les clients n'arriveront pas.<br>Ajoutez-en un ci-dessous.
        </div>

        <!-- template list -->
        <div
          v-for="tpl in templates(key)"
          :key="tpl.id"
          class="tpl-item"
          :class="{ editing: editingId === tpl.id && addingFor === key }"
        >
          <div class="tpl-item-left">
            <span class="tpl-name">{{ tpl.name }}</span>
            <span class="tpl-specs">{{ tpl.cpuDemand }}cpu · {{ tpl.ramDemand }}GB · {{ tpl.diskDemand }}GB disk</span>
          </div>
          <span class="tpl-slots-badge">{{ tplUsage(key, tpl.id) }}/{{ tpl.slots }}</span>
          <span class="tpl-price">${{ tpl.fixedPrice }}/j</span>
          <button class="tpl-edit" @click="startEdit(key, tpl)" title="Modifier">✎</button>
          <button class="tpl-del" @click="deleteTemplate(key, tpl.id)" title="Supprimer">✕</button>
        </div>

        <!-- add form -->
        <div class="tpl-form" v-if="addingFor === key">
          <div class="tpl-name-row">
            <input v-model="form.name" class="tpl-input" placeholder="Nom (ex: VPS Small)" maxlength="20" />
            <button class="tpl-rand-btn" @click="randomName(key)" title="Nom aléatoire">🎲</button>
          </div>
          <div class="tpl-form-row">
            <label class="tpl-lbl">CPU</label>
            <input v-model.number="form.cpu"   class="tpl-input num" type="number" :min="svc.cpuMin"  :max="svc.cpuMax"  />
          </div>
          <div class="tpl-form-row">
            <label class="tpl-lbl">RAM GB</label>
            <input v-model.number="form.ram"   class="tpl-input num" type="number" :min="svc.ramMin"  :max="svc.ramMax"  />
          </div>
          <div class="tpl-form-row">
            <label class="tpl-lbl">Disk GB</label>
            <input v-model.number="form.disk"  class="tpl-input num" type="number" :min="svc.diskMin" :max="svc.diskMax" />
          </div>
          <div class="tpl-form-row">
            <label class="tpl-lbl">Prix $/j</label>
            <input v-model.number="form.price" class="tpl-input num" type="number" min="1" max="9999" />
          </div>
          <div class="tpl-form-row">
            <label class="tpl-lbl">Slots</label>
            <input v-model.number="form.slotsCount" class="tpl-input num" type="number" min="1" max="500" />
          </div>
          <div class="tpl-form-actions">
            <button class="tpl-save-btn" @click="saveTemplate(key, svc)">{{ editingId !== null ? '✓ Modifier' : '✓ Ajouter' }}</button>
            <button class="tpl-cancel-btn" @click="cancelAdd">Annuler</button>
          </div>
        </div>

        <button v-else class="tpl-add-btn" @click="startAdd(key, svc)">+ Ajouter un template</button>
      </div>

    </div>
  </div>
</template>

<script setup>
import { computed, ref, reactive } from 'vue'
import { SERVICES } from '../game/GameState.js'
import { applyPriceChange } from '../game/SimulationEngine.js'

const props = defineProps({
  gameState:  { type: Object,   required: true },
  sendAction: { type: Function, default: null },
})

// Hide internal-only services (e.g. ENTERPRISE)
const visibleServices = computed(() =>
  Object.fromEntries(Object.entries(SERVICES).filter(([, svc]) => !svc.hidden))
)

function slots(serviceId) {
  return props.gameState.serviceSlots?.[serviceId] ?? 0
}

function clientCount(serviceId) {
  return props.gameState.clients.filter(c => c.serviceId === serviceId).length
}

function slotPct(serviceId) {
  const max = slots(serviceId)
  if (max === 0) return 0
  return Math.min(100, clientCount(serviceId) / max * 100)
}

function slotColor(serviceId) {
  return slots(serviceId) === 0 ? '#484f58' : '#e6edf3'
}

function slotFillColor(serviceId) {
  const p = slotPct(serviceId)
  if (p >= 95) return '#f85149'
  if (p >= 75) return '#d29922'
  return '#3fb950'
}

function adjustSlots(key, delta) {
  const current = props.gameState.serviceSlots?.[key] ?? 0
  const next = Math.max(0, current + delta)
  const active = clientCount(key)
  const finalVal = Math.max(active, next)
  props.gameState.serviceSlots[key] = finalVal
  // In MP: sync to server (server-side state drives client distribution)
  if (props.sendAction) props.sendAction('set_service_slots', { serviceId: key, value: finalVal })
}

function adjustPrice(key, delta) {
  const current = props.gameState.servicePrices[key] ?? SERVICES[key].basePrice
  const newPrice = Math.max(1, current + delta)
  applyPriceChange(props.gameState, key, current, newPrice)
  props.gameState.servicePrices[key] = newPrice
  // In MP: sync to server
  if (props.sendAction) props.sendAction('change_price', { serviceId: key, delta })
}

function dailyRevenue(key) {
  const base = props.gameState.servicePrices[key] ?? 0
  const clients = props.gameState.clients.filter(c => c.serviceId === key)
  let total = 0
  for (const c of clients) total += c.fixedPrice != null ? c.fixedPrice : base
  return Math.round(total)
}

function getAttractivity(key) {
  const base = SERVICES[key]?.basePrice ?? 10
  const cur  = props.gameState.servicePrices[key] ?? base
  return base / Math.max(1, cur)
}

function attractLabel(key) {
  const r = getAttractivity(key)
  if (r >= 1.5) return 'Très élevée'
  if (r >= 1.1) return 'Élevée'
  if (r >= 0.9) return 'Normale'
  if (r >= 0.7) return 'Faible'
  return 'Très faible'
}

function attractColor(key) {
  const r = getAttractivity(key)
  if (r >= 1.1) return '#3fb950'
  if (r >= 0.9) return '#e6edf3'
  if (r >= 0.7) return '#d29922'
  return '#f85149'
}

// ── Template helpers ──────────────────────────────────────────────────────────

function serviceMode(key) {
  return props.gameState.serviceModes?.[key] ?? 'auto'
}

function templates(key) {
  return props.gameState.serviceTemplates?.[key] ?? []
}

function setMode(key, mode) {
  if (!props.gameState.serviceModes) props.gameState.serviceModes = {}
  if (!props.gameState._savedSlots)  props.gameState._savedSlots  = {}

  let slotsValue = props.gameState.serviceSlots[key] ?? 0
  if (mode === 'templates') {
    props.gameState._savedSlots[key] = slotsValue
    slotsValue = 0
    props.gameState.serviceSlots[key] = 0
  } else if (mode === 'auto') {
    slotsValue = props.gameState._savedSlots[key] ?? 0
    props.gameState.serviceSlots[key] = slotsValue
  }
  props.gameState.serviceModes[key] = mode

  if (props.sendAction) props.sendAction('set_service_mode', { serviceId: key, mode, slotsValue })
}

function deleteTemplate(key, id) {
  if (!props.gameState.serviceTemplates?.[key]) return
  props.gameState.serviceTemplates[key] = props.gameState.serviceTemplates[key].filter(t => t.id !== id)
  if (props.sendAction) props.sendAction('set_service_templates', {
    serviceId: key, templates: props.gameState.serviceTemplates[key],
  })
}

function templateTotalSlots(key) {
  return templates(key).reduce((s, t) => s + (t.slots ?? 0), 0)
}

function templateAvgPrice(key) {
  const tpls = templates(key)
  if (!tpls.length) return 0
  const total = tpls.reduce((s, t) => s + (t.fixedPrice ?? 0), 0)
  return Math.round(total / tpls.length)
}

function tplUsage(key, tplId) {
  return props.gameState.clients.filter(c => c.serviceId === key && c.templateId === tplId).length
    + props.gameState.clientQueue.filter(c => c.serviceId === key && c.templateId === tplId).length
}

function slotPctEffective(key) {
  if (serviceMode(key) === 'templates') {
    const total = templateTotalSlots(key)
    if (total === 0) return 0
    return Math.min(100, clientCount(key) / total * 100)
  }
  return slotPct(key)
}

// ── Add / Edit form state ──────────────────────────────────────────────────────

const addingFor  = ref(null)   // serviceId being added/edited, or null
const editingId  = ref(null)   // template id being edited, or null
const form = reactive({ name: '', cpu: 0, ram: 0, disk: 0, price: 10, slotsCount: 10 })

function startAdd(key, svc) {
  addingFor.value = key
  editingId.value = null
  form.name       = ''
  form.cpu        = svc.cpuMin
  form.ram        = svc.ramMin
  form.disk       = svc.diskMin
  form.price      = SERVICES[key]?.basePrice ?? 10
  form.slotsCount = 10
}

function startEdit(key, tpl) {
  addingFor.value = key
  editingId.value = tpl.id
  form.name       = tpl.name
  form.cpu        = tpl.cpuDemand
  form.ram        = tpl.ramDemand
  form.disk       = tpl.diskDemand
  form.price      = tpl.fixedPrice
  form.slotsCount = tpl.slots
}

function cancelAdd() {
  addingFor.value = null
  editingId.value = null
}

// ── Random name generation ───────────────────────────────────────────────────

const NAME_PARTS = {
  adj: {
    VPS:        ['Micro', 'Nano', 'Swift', 'Lite', 'Eco', 'Budget', 'Starter', 'Basic', 'Dev', 'Flexible'],
    DEDICATED:  ['Iron', 'Titan', 'Power', 'Force', 'Prime', 'Turbo', 'Elite', 'Ultra', 'Core', 'Dedicated'],
    STORAGE:    ['Vault', 'Archive', 'Deep', 'Bulk', 'Cold', 'Safe', 'Compact', 'Dense', 'Secure', 'Backup'],
    GAMING:     ['Nitro', 'Blaze', 'Apex', 'Laser', 'Thunder', 'Hyper', 'Turbo', 'Rush', 'Arena', 'Epic'],
    STREAMING:  ['Live', 'Stream', 'Flux', 'Wave', 'Pulse', 'Flow', 'Rapid', 'Clear', 'Smooth', 'HD'],
    AI_CLOUD:   ['Neural', 'Synapse', 'Deep', 'Quantum', 'Sigma', 'Alpha', 'Infer', 'Vector', 'Tensor', 'Cortex'],
  },
  noun: {
    VPS:        ['Node', 'Instance', 'Pod', 'Slice', 'VM', 'Server', 'Host', 'Droplet', 'Shell', 'Box'],
    DEDICATED:  ['Server', 'Blade', 'Machine', 'Metal', 'Node', 'Host', 'Box', 'Rig', 'Frame', 'Unit'],
    STORAGE:    ['Drive', 'Vault', 'Cluster', 'Array', 'Pool', 'Block', 'Share', 'Disk', 'Store', 'Bay'],
    GAMING:     ['Server', 'Node', 'Host', 'Rig', 'Beast', 'Box', 'Arena', 'Zone', 'Engine', 'Core'],
    STREAMING:  ['Edge', 'Node', 'Relay', 'Hub', 'Mirror', 'CDN', 'Proxy', 'Cache', 'Pod', 'Stream'],
    AI_CLOUD:   ['Core', 'Engine', 'GPU', 'Cluster', 'Lab', 'Node', 'Model', 'Brain', 'Unit', 'Pod'],
  },
  size: ['XS', 'S', 'M', 'L', 'XL', ''],
}

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)] }

function randomName(serviceId) {
  const adjs  = NAME_PARTS.adj[serviceId]  ?? NAME_PARTS.adj.VPS
  const nouns = NAME_PARTS.noun[serviceId] ?? NAME_PARTS.noun.VPS
  const size  = pick(NAME_PARTS.size)
  const label = SERVICES[serviceId]?.label ?? serviceId
  const name  = `${pick(adjs)} ${label} ${pick(nouns)}${size ? ' ' + size : ''}`
  form.name   = name.trim()
}

function saveTemplate(key, svc) {
  const name = form.name.trim()
  if (!name) return

  if (!props.gameState.serviceTemplates) props.gameState.serviceTemplates = {}
  if (!props.gameState.serviceTemplates[key]) props.gameState.serviceTemplates[key] = []
  if (props.gameState.nextTemplateId === undefined) props.gameState.nextTemplateId = 1

  const cpu   = Math.max(svc.cpuMin,  Math.min(svc.cpuMax,  Math.round(form.cpu)))
  const ram   = Math.max(svc.ramMin,  Math.min(svc.ramMax,  Math.round(form.ram)))
  const disk  = Math.max(svc.diskMin, Math.min(svc.diskMax, Math.round(form.disk)))
  const price = Math.max(1, Math.round(form.price))
  const slots = Math.max(1, Math.round(form.slotsCount))

  if (editingId.value !== null) {
    // ── Update existing template in-place ──────────────────────────────────
    const list = props.gameState.serviceTemplates[key]
    const idx  = list.findIndex(t => t.id === editingId.value)
    if (idx !== -1) {
      list[idx] = {
        ...list[idx],
        name,
        cpuDemand:  cpu,
        ramDemand:  ram,
        diskDemand: disk,
        fixedPrice: price,
        slots,
      }
    }
  } else {
    // ── Add new template ───────────────────────────────────────────────────
    props.gameState.serviceTemplates[key].push({
      id:         props.gameState.nextTemplateId++,
      name,
      cpuDemand:  cpu,
      ramDemand:  ram,
      diskDemand: disk,
      fixedPrice: price,
      slots,
    })
  }

  addingFor.value = null
  editingId.value = null

  if (props.sendAction) props.sendAction('set_service_templates', {
    serviceId: key, templates: props.gameState.serviceTemplates[key] ?? [],
  })
}
</script>

<style scoped>
.services-panel {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.service-card {
  background: #0d1117;
  border: 1px solid #21262d;
  border-radius: 4px;
  padding: 7px 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  transition: border-color 0.1s;
}

.service-card.inactive {
  opacity: 0.5;
}

.svc-header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: monospace;
  font-size: 11px;
}

.svc-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.svc-name {
  flex: 1;
  color: #e6edf3;
  font-weight: bold;
}

.svc-clients {
  font-size: 10px;
  color: #8b949e;
  background: #21262d;
  padding: 1px 5px;
  border-radius: 8px;
}

.svc-off {
  font-size: 9px;
  color: #484f58;
  font-weight: bold;
  letter-spacing: 1px;
}

.svc-desc {
  font-family: monospace;
  font-size: 9px;
  color: #8b949e;
}

.svc-compat {
  font-family: monospace;
  font-size: 9px;
  color: #30363d;
}

.svc-caps {
  font-family: monospace;
  font-size: 9px;
  color: #484f58;
}

/* ── Slot controls ── */
.svc-slots-row {
  display: flex;
  align-items: center;
  gap: 3px;
  margin-top: 2px;
}

.svc-slots-label {
  font-family: monospace;
  font-size: 9px;
  color: #8b949e;
  margin-right: 2px;
}

.slot-btn {
  background: #161b22;
  border: 1px solid #30363d;
  color: #8b949e;
  font-family: monospace;
  font-size: 9px;
  padding: 2px 5px;
  cursor: pointer;
  border-radius: 2px;
  transition: all 0.1s;
}
.slot-btn:hover { border-color: #58a6ff; color: #58a6ff; }

.slot-value {
  flex: 1;
  text-align: center;
  font-family: monospace;
  font-size: 13px;
  font-weight: bold;
}

/* Slot fill bar */
.slot-bar {
  height: 3px;
  background: #21262d;
  border-radius: 2px;
  overflow: hidden;
  margin: 1px 0;
}
.slot-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.4s, background 0.4s;
}

/* ── Price controls ── */
.svc-price-row {
  display: flex;
  align-items: center;
  gap: 3px;
  margin-top: 2px;
}

.adj-btn {
  background: #21262d;
  border: 1px solid #30363d;
  color: #8b949e;
  font-family: monospace;
  font-size: 9px;
  padding: 2px 5px;
  cursor: pointer;
  border-radius: 2px;
}
.adj-btn:hover { border-color: #58a6ff; color: #58a6ff; }

.svc-price {
  flex: 1;
  text-align: center;
  font-family: monospace;
  font-size: 12px;
  font-weight: bold;
  color: #e6edf3;
}

.svc-stats-row {
  display: flex;
  align-items: center;
  gap: 5px;
  font-family: monospace;
  font-size: 9px;
}

.attract-label { color: #8b949e; }

.svc-revenue {
  margin-left: auto;
  color: #3fb950;
  font-weight: bold;
}

/* ── Mode toggle ── */
.mode-row {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 3px;
  border-top: 1px solid #21262d;
  padding-top: 4px;
}

.mode-label {
  font-family: monospace;
  font-size: 9px;
  color: #8b949e;
  flex: 1;
}

.mode-btn {
  background: transparent;
  border: 1px solid #30363d;
  color: #8b949e;
  font-family: monospace;
  font-size: 9px;
  padding: 2px 7px;
  cursor: pointer;
  border-radius: 10px;
  transition: all 0.15s;
}
.mode-btn:hover { border-color: #58a6ff; color: #58a6ff; }
.mode-btn.active {
  background: #0f1e2e;
  border-color: #58a6ff;
  color: #58a6ff;
  font-weight: bold;
}

/* ── Template section ── */
.tpl-section {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding-top: 2px;
}

.tpl-empty {
  font-family: monospace;
  font-size: 9px;
  color: #484f58;
  line-height: 1.5;
  text-align: center;
  padding: 4px 2px;
}

.tpl-item {
  display: flex;
  align-items: center;
  gap: 5px;
  background: #161b22;
  border: 1px solid #21262d;
  border-radius: 3px;
  padding: 4px 6px;
}

.tpl-item-left {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.tpl-name {
  font-family: monospace;
  font-size: 9px;
  font-weight: bold;
  color: #e6edf3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tpl-specs {
  font-family: monospace;
  font-size: 8px;
  color: #484f58;
  white-space: nowrap;
}

.tpl-slots-badge {
  font-family: monospace;
  font-size: 9px;
  color: #8b949e;
  background: #21262d;
  padding: 1px 5px;
  border-radius: 8px;
  white-space: nowrap;
}

.tpl-price {
  font-family: monospace;
  font-size: 9px;
  font-weight: bold;
  color: #3fb950;
  white-space: nowrap;
}

/* dimmed slot/price rows in templates mode */
.dimmed {
  opacity: 0.45;
  pointer-events: none;
}

.slot-value-tpl {
  font-family: monospace;
  font-size: 10px;
  color: #8b949e;
  font-style: italic;
}

.slot-fill-info {
  font-family: monospace;
  font-size: 9px;
  color: #8b949e;
  margin-left: auto;
}

.svc-price-label {
  font-family: monospace;
  font-size: 9px;
  color: #8b949e;
  flex: 1;
}


.tpl-del {
  background: transparent;
  border: none;
  color: #484f58;
  font-size: 9px;
  cursor: pointer;
  padding: 0 2px;
  flex-shrink: 0;
  line-height: 1;
  transition: color 0.1s;
}
.tpl-del:hover { color: #f85149; }

.tpl-edit {
  background: transparent;
  border: none;
  color: #484f58;
  font-size: 10px;
  cursor: pointer;
  padding: 0 2px;
  flex-shrink: 0;
  line-height: 1;
  transition: color 0.1s;
}
.tpl-edit:hover { color: #58a6ff; }

.tpl-item.editing {
  border-color: #58a6ff;
  border-left: 2px solid #58a6ff;
  background: #0c1c2e;
}

/* ── Add form ── */
.tpl-form {
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: 3px;
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.tpl-name-row {
  display: flex;
  align-items: center;
  gap: 4px;
}

.tpl-rand-btn {
  background: transparent;
  border: 1px dashed #30363d;
  border-radius: 2px;
  color: #8b949e;
  font-size: 11px;
  cursor: pointer;
  padding: 1px 4px;
  transition: all 0.1s;
}
.tpl-rand-btn:hover {
  border-color: #58a6ff;
  color: #58a6ff;
  background: #0f1e2e;
}

.tpl-form-row {
  display: flex;
  align-items: center;
  gap: 5px;
}

.tpl-lbl {
  font-family: monospace;
  font-size: 9px;
  color: #8b949e;
  width: 38px;
  flex-shrink: 0;
}

.tpl-input {
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 2px;
  color: #e6edf3;
  font-family: monospace;
  font-size: 10px;
  padding: 2px 5px;
  width: 100%;
  transition: border-color 0.1s;
}
.tpl-input:focus { outline: none; border-color: #58a6ff; }
.tpl-input.num { width: 70px; text-align: right; }

.tpl-form-actions {
  display: flex;
  gap: 4px;
  justify-content: flex-end;
  margin-top: 2px;
}

.tpl-save-btn {
  background: #0f1e2e;
  border: 1px solid #58a6ff;
  color: #58a6ff;
  font-family: monospace;
  font-size: 9px;
  padding: 3px 10px;
  cursor: pointer;
  border-radius: 3px;
}
.tpl-save-btn:hover { background: #1a3050; }

.tpl-cancel-btn {
  background: transparent;
  border: 1px solid #30363d;
  color: #8b949e;
  font-family: monospace;
  font-size: 9px;
  padding: 3px 8px;
  cursor: pointer;
  border-radius: 3px;
}
.tpl-cancel-btn:hover { border-color: #f85149; color: #f85149; }

.tpl-add-btn {
  background: transparent;
  border: 1px dashed #30363d;
  color: #8b949e;
  font-family: monospace;
  font-size: 9px;
  padding: 4px;
  cursor: pointer;
  border-radius: 3px;
  width: 100%;
  text-align: center;
  transition: all 0.1s;
}
.tpl-add-btn:hover { border-color: #58a6ff; color: #58a6ff; }
</style>
