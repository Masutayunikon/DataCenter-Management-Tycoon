<template>
  <div class="price-panel">

    <div class="section-label">TARIFICATION</div>

    <!-- Price control -->
    <div class="price-control">
      <div class="price-label">Prix / client / jour</div>
      <div class="price-row">
        <button class="adj-btn" @click="adjust(-1)" :disabled="gameState.price <= 1">−</button>
        <div class="price-display">${{ gameState.price }}</div>
        <button class="adj-btn" @click="adjust(+1)">+</button>
      </div>
      <div class="price-row">
        <button class="adj-btn small" @click="adjust(-5)" :disabled="gameState.price <= 5">−5</button>
        <button class="adj-btn small" @click="adjust(+5)">+5</button>
      </div>
    </div>

    <!-- Value score -->
    <div class="metric">
      <span class="metric-label">Attractivité</span>
      <span class="metric-value" :style="{ color: attractColor }">{{ attractLabel }}</span>
    </div>

    <div class="divider"></div>

    <!-- Stats -->
    <div class="section-label">ÉCONOMIE (dernier jour)</div>

    <div class="metric">
      <span class="metric-label">Clients actifs</span>
      <span class="metric-value">{{ gameState.clients.length }}</span>
    </div>
    <div class="metric">
      <span class="metric-label">Revenu</span>
      <span class="metric-value green">+${{ gameState.revenue }}</span>
    </div>
    <div class="metric">
      <span class="metric-label">Électricité</span>
      <span class="metric-value red">-${{ gameState.electricityCost }}</span>
    </div>
    <div class="metric">
      <span class="metric-label">Maintenance</span>
      <span class="metric-value red">-${{ gameState.maintenanceCost }}</span>
    </div>
    <div class="divider"></div>
    <div class="metric profit">
      <span class="metric-label">Profit net</span>
      <span class="metric-value" :style="{ color: profitColor }">
        {{ profit >= 0 ? '+' : '' }}${{ profit }}
      </span>
    </div>

    <div class="divider"></div>

    <!-- Reputation -->
    <div class="section-label">RÉPUTATION</div>
    <div class="rep-bar-container">
      <div class="rep-bar">
        <div class="rep-fill" :style="{ width: gameState.reputation + '%', background: repColor }"></div>
      </div>
      <span class="rep-value" :style="{ color: repColor }">{{ Math.round(gameState.reputation) }}/100</span>
    </div>
    <div class="rep-label">{{ repLabel }}</div>

  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  gameState: { type: Object, required: true },
})

const emit = defineEmits(['set-price'])

function adjust(delta) {
  const newPrice = Math.max(1, props.gameState.price + delta)
  emit('set-price', newPrice)
}

const profit = computed(() =>
  props.gameState.revenue
  - props.gameState.electricityCost
  - props.gameState.maintenanceCost
  - (props.gameState.employeeCost ?? 0)
)

const profitColor = computed(() => profit.value >= 0 ? '#3fb950' : '#f85149')

// Attractivity based on price (relative to $10 baseline)
const attractScore = computed(() => {
  const p = props.gameState.price
  if (p <= 5)  return 'Très élevée'
  if (p <= 9)  return 'Élevée'
  if (p <= 12) return 'Normale'
  if (p <= 18) return 'Faible'
  return 'Très faible'
})

const attractLabel = computed(() => attractScore.value)

const attractColor = computed(() => {
  const p = props.gameState.price
  if (p <= 9)  return '#3fb950'
  if (p <= 12) return '#d29922'
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
</script>

<style scoped>
.price-panel {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.section-label {
  font-family: monospace;
  font-size: 10px;
  font-weight: bold;
  color: #58a6ff;
  letter-spacing: 1px;
  margin-top: 4px;
}

.price-control {
  background: #0d1117;
  border: 1px solid #21262d;
  border-radius: 4px;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: center;
}

.price-label {
  font-family: monospace;
  font-size: 10px;
  color: #8b949e;
}

.price-display {
  font-family: monospace;
  font-size: 22px;
  font-weight: bold;
  color: #3fb950;
  min-width: 60px;
  text-align: center;
}

.price-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.adj-btn {
  background: #21262d;
  border: 1px solid #30363d;
  color: #e6edf3;
  font-family: monospace;
  font-size: 14px;
  width: 28px;
  height: 28px;
  cursor: pointer;
  border-radius: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.1s;
}

.adj-btn.small {
  font-size: 11px;
  width: 36px;
  height: 22px;
}

.adj-btn:hover:not(:disabled) { background: #30363d; }
.adj-btn:disabled { opacity: 0.3; cursor: not-allowed; }

.metric {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-family: monospace;
  font-size: 11px;
}

.metric-label { color: #8b949e; }
.metric-value { color: #e6edf3; font-weight: bold; }
.metric-value.green { color: #3fb950; }
.metric-value.red   { color: #f85149; }
.metric.profit .metric-label { color: #e6edf3; font-weight: bold; }

.divider {
  height: 1px;
  background: #21262d;
  margin: 2px 0;
}

.rep-bar-container {
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

.rep-value {
  font-family: monospace;
  font-size: 10px;
  font-weight: bold;
  min-width: 50px;
  text-align: right;
}

.rep-label {
  font-family: monospace;
  font-size: 10px;
  color: #8b949e;
  font-style: italic;
}
</style>
