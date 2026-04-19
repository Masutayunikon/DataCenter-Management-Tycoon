<template>
  <aside class="shop-panel">
    <div class="panel-title">SHOP</div>

    <!-- Rack -->
    <div class="shop-item" :class="{ disabled: gameState.money < RACK_COST }">
      <div class="item-icon">▣</div>
      <div class="item-info">
        <div class="item-name">Rack</div>
        <div class="item-desc">10 emplacements serveur</div>
        <div class="item-cost">${{ RACK_COST }}</div>
      </div>
      <button
        class="buy-btn"
        :class="{ active: mode === 'place-rack' }"
        :disabled="gameState.money < RACK_COST"
        @click="onBuyRack"
      >
        {{ mode === 'place-rack' ? 'Placement…' : 'Acheter' }}
      </button>
    </div>

    <!-- Grid info -->
    <div class="section-label">ESPACE</div>
    <div class="grid-info">
      <div class="grid-stat">
        <span class="gi-key">Étage actuel</span>
        <span class="gi-val">{{ currentFloor?.name }}</span>
      </div>
      <div class="grid-stat">
        <span class="gi-key">Cases libres</span>
        <span class="gi-val">{{ unlockedCount }} / 100</span>
      </div>
      <div class="grid-stat">
        <span class="gi-key">Prochain déblocage</span>
        <span class="gi-val" :style="{ color: gameState.money >= unlockCost ? '#3fb950' : '#f85149' }">
          ${{ unlockCost.toLocaleString() }}
        </span>
      </div>
    </div>
    <div class="unlock-hint">
      Cliquez sur une case adjacente verrouillée pour l'acheter.
    </div>

    <!-- Next floor -->
    <div class="section-label" style="margin-top: 8px;">ÉTAGES</div>
    <div class="shop-item" :class="{ disabled: gameState.money < nextFloorCost }">
      <div class="item-icon">⬆</div>
      <div class="item-info">
        <div class="item-name">{{ nextFloorName }}</div>
        <div class="item-desc">Nouveau palier 2×2</div>
        <div class="item-cost">${{ nextFloorCost.toLocaleString() }}</div>
      </div>
      <button
        class="buy-btn"
        :disabled="gameState.money < nextFloorCost"
        @click="$emit('buy-floor')"
      >
        Acheter
      </button>
    </div>

    <!-- Employés -->
    <div class="section-label" style="margin-top: 8px;">EMPLOYÉS</div>

    <!-- Affectation -->
    <div class="employee-card">
      <div class="emp-header">
        <span class="emp-icon">👤</span>
        <div class="emp-info">
          <div class="emp-name">Tech. Affectation</div>
          <div class="emp-desc">Place jusqu'à {{ EMPLOYEE_ASSIGN_CAPACITY }} clients/j automatiquement</div>
          <div class="emp-cost-row">
            <span class="emp-hire-cost">Embauche ${{ EMPLOYEE_HIRE_COST }}</span>
            <span class="emp-daily">-${{ EMPLOYEE_ASSIGN_DAILY }}/j</span>
          </div>
        </div>
      </div>
      <div class="emp-controls">
        <button class="emp-fire-btn" :disabled="gameState.employees.assignment <= 0" @click="fireEmployee('assignment')">−</button>
        <div class="emp-count">
          <span class="emp-num">{{ gameState.employees.assignment }}</span>
          <span class="emp-label">emp.</span>
        </div>
        <button class="emp-hire-btn" :disabled="gameState.money < EMPLOYEE_HIRE_COST" @click="hireEmployee('assignment')">+ Embaucher</button>
      </div>
      <div class="emp-stats" v-if="gameState.employees.assignment > 0">
        <span>Cap. : {{ gameState.employees.assignment * EMPLOYEE_ASSIGN_CAPACITY }} clients/j</span>
        <span>Coût : -${{ gameState.employees.assignment * EMPLOYEE_ASSIGN_DAILY }}/j</span>
      </div>
    </div>

    <!-- Support (nécessite compétence) -->
    <div class="employee-card" :class="{ 'emp-locked': !supportUnlocked }">
      <div class="emp-header">
        <span class="emp-icon">🛠️</span>
        <div class="emp-info">
          <div class="emp-name">Tech. Support</div>
          <div class="emp-desc">Boost satisfaction des clients insatisfaits chaque jour</div>
          <div class="emp-cost-row">
            <span v-if="supportUnlocked" class="emp-hire-cost">Embauche ${{ EMPLOYEE_HIRE_COST }}</span>
            <span v-else class="emp-lock-badge">🔒 Compétence requise</span>
            <span v-if="supportUnlocked" class="emp-daily">-${{ EMPLOYEE_SUPPORT_DAILY }}/j</span>
          </div>
        </div>
      </div>
      <template v-if="supportUnlocked">
        <div class="emp-controls">
          <button class="emp-fire-btn" :disabled="gameState.employees.support <= 0" @click="fireEmployee('support')">−</button>
          <div class="emp-count">
            <span class="emp-num">{{ gameState.employees.support }}</span>
            <span class="emp-label">emp.</span>
          </div>
          <button class="emp-hire-btn" :disabled="gameState.money < EMPLOYEE_HIRE_COST" @click="hireEmployee('support')">+ Embaucher</button>
        </div>
        <div class="emp-stats" v-if="gameState.employees.support > 0">
          <span>Boost : +{{ gameState.employees.support * 3 }} sat/j aux <60%</span>
          <span>Coût : -${{ gameState.employees.support * EMPLOYEE_SUPPORT_DAILY }}/j</span>
        </div>
      </template>
    </div>

    <!-- Sécurité (nécessite compétence) -->
    <div class="employee-card" :class="{ 'emp-locked': !securityUnlocked }">
      <div class="emp-header">
        <span class="emp-icon">🛡️</span>
        <div class="emp-info">
          <div class="emp-name">Tech. Sécurité</div>
          <div class="emp-desc">Réduit l'impact des événements négatifs et attaques</div>
          <div class="emp-cost-row">
            <span v-if="securityUnlocked" class="emp-hire-cost">Embauche ${{ EMPLOYEE_HIRE_COST }}</span>
            <span v-else class="emp-lock-badge">🔒 Compétence requise</span>
            <span v-if="securityUnlocked" class="emp-daily">-${{ EMPLOYEE_SECURITY_DAILY }}/j</span>
          </div>
        </div>
      </div>
      <template v-if="securityUnlocked">
        <div class="emp-controls">
          <button class="emp-fire-btn" :disabled="gameState.employees.security <= 0" @click="fireEmployee('security')">−</button>
          <div class="emp-count">
            <span class="emp-num">{{ gameState.employees.security }}</span>
            <span class="emp-label">emp.</span>
          </div>
          <button class="emp-hire-btn" :disabled="gameState.money < EMPLOYEE_HIRE_COST" @click="hireEmployee('security')">+ Embaucher</button>
        </div>
        <div class="emp-stats" v-if="gameState.employees.security > 0">
          <span>Protection active</span>
          <span>Coût : -${{ gameState.employees.security * EMPLOYEE_SECURITY_DAILY }}/j</span>
        </div>
      </template>
    </div>

    <!-- Banque -->
    <div class="section-label" style="margin-top: 8px;">BANQUE</div>
    <div class="bank-info">
      <span class="bank-debt-label">Dette totale</span>
      <span class="bank-debt-val" :style="{ color: getTotalDebt(gameState) > 0 ? '#f85149' : '#3fb950' }">
        ${{ getTotalDebt(gameState).toLocaleString() }}
      </span>
    </div>
    <div
      v-for="(tier, idx) in LOAN_TIERS"
      :key="idx"
      class="loan-row"
      :class="{ 'loan-active': hasActiveLoan(idx) }"
    >
      <div class="loan-info">
        <span class="loan-amount">${{ tier.amount.toLocaleString() }}</span>
        <span class="loan-rate">{{ (tier.rate * 100).toFixed(2) }}%/j</span>
        <span v-if="hasActiveLoan(idx)" class="loan-remaining">reste ${{ activeLoanRemaining(idx).toLocaleString() }}</span>
      </div>
      <div style="display:flex; gap:4px;">
        <button
          v-if="!hasActiveLoan(idx)"
          class="loan-btn take-btn"
          :disabled="gameState.loans?.some(l => !l.paid)"
          @click="onTakeLoan(idx)"
        >Emprunter ~${{ projectedRepayment(tier).toLocaleString() }}</button>
        <button
          v-else
          class="loan-btn repay-btn"
          :disabled="gameState.money <= 0"
          @click="onRepayLoan(idx)"
        >Rembourser</button>
      </div>
    </div>

    <!-- Réseau -->
    <div class="section-label" style="margin-top: 8px;">RÉSEAU</div>
    <div
      v-for="floor in gameState.floors"
      :key="floor.id"
      class="shop-item"
      :class="{ disabled: gameState.money < getSwitchUpgradeCost(floor) }"
    >
      <div class="item-icon">🔀</div>
      <div class="item-info">
        <div class="item-name">Switch — {{ floor.name }}</div>
        <div class="item-desc">
          {{ floor.switchBandwidth ?? 1 }} Gbps
          <span :style="{ color: floor.bandwidthSaturated ? '#f85149' : '#3fb950' }">
            ({{ Math.round((floor.bandwidthUsed ?? 0) / 10) / 100 }} / {{ floor.switchBandwidth ?? 1 }} Gbps)
          </span>
          → +{{ SWITCH_BANDWIDTH_INCREMENT }} Gbps
        </div>
        <div class="item-cost">${{ getSwitchUpgradeCost(floor) }}</div>
      </div>
      <button
        class="buy-btn"
        :disabled="gameState.money < getSwitchUpgradeCost(floor)"
        @click="onUpgradeSwitch(floor.id)"
      >
        Upgrader
      </button>
    </div>

  </aside>
</template>

<script setup>
import { computed } from 'vue'
import { RACK_COST, FLOOR_COST_BASE } from '../game/GameState.js'
import { getUnlockCost, EMPLOYEE_ASSIGN_CAPACITY, EMPLOYEE_ASSIGN_DAILY, upgradeSwitch, getSwitchUpgradeCost, SWITCH_BANDWIDTH_INCREMENT, takeLoan, repayLoan, getTotalDebt, LOAN_TIERS } from '../game/SimulationEngine.js'
import { EMPLOYEE_SUPPORT_DAILY, EMPLOYEE_SECURITY_DAILY } from '../game/EconomyEngine.js'

const EMPLOYEE_HIRE_COST = 3000

const props = defineProps({
  gameState:      { type: Object,   required: true },
  mode:           { type: String,   default: 'default' },
  isMultiplayer:  { type: Boolean,  default: false },
  sendAction:     { type: Function, default: null },
})

const emit = defineEmits(['start-place-rack', 'buy-floor', 'upgrade-switch'])

const currentFloor = computed(() =>
  props.gameState.floors[props.gameState.currentFloor]
)

const unlockedCount = computed(() => {
  if (!currentFloor.value) return 0
  return currentFloor.value.grid.flat().filter(c => !c.locked).length
})

const unlockCost = computed(() => {
  if (!currentFloor.value) return 0
  return getUnlockCost(currentFloor.value)
})

const nextFloorCost = computed(() =>
  FLOOR_COST_BASE * props.gameState.floors.length
)

const nextFloorName = computed(() => {
  const n = props.gameState.floors.length
  return n === 1 ? 'Étage 1' : `Étage ${n}`
})

const supportUnlocked  = computed(() =>
  (props.gameState.unlockedSkills ?? []).includes('EMPLOYEE_SUPPORT_UNLOCK')
)
const securityUnlocked = computed(() =>
  (props.gameState.unlockedSkills ?? []).includes('EMPLOYEE_SECURITY_UNLOCK')
)

function onBuyRack() {
  if (props.mode === 'place-rack') return
  emit('start-place-rack')
}

function hireEmployee(type) {
  if (props.gameState.money < EMPLOYEE_HIRE_COST) return
  props.gameState.money -= EMPLOYEE_HIRE_COST
  props.gameState.employees[type]++
}

function fireEmployee(type) {
  if (props.gameState.employees[type] <= 0) return
  props.gameState.employees[type]--
}

async function onUpgradeSwitch(floorId) {
  if (props.isMultiplayer && props.sendAction) {
    await props.sendAction('upgrade_switch', { floorId })
  } else {
    upgradeSwitch(props.gameState, floorId)
  }
}

// Estimate total repayment using minimum repayment schedule simulation
function projectedRepayment(tier) {
  let remaining = tier.amount
  let totalPaid = 0
  const maxDays = 2000 // safety cap
  for (let d = 0; d < maxDays && remaining > 0; d++) {
    remaining += Math.ceil(remaining * tier.rate)
    const payment = Math.min(Math.max(1, Math.ceil(tier.amount * 0.01)), remaining)
    totalPaid += payment
    remaining -= payment
  }
  return Math.round(totalPaid / 100) * 100 // round to nearest $100
}

function hasActiveLoan(tierIdx) {
  return props.gameState.loans?.some(l => !l.paid && l.tierIndex === tierIdx) ?? false
}

function activeLoanRemaining(tierIdx) {
  const loan = props.gameState.loans?.find(l => !l.paid && l.tierIndex === tierIdx)
  return loan ? Math.round(loan.remaining) : 0
}

function onTakeLoan(tierIdx) {
  takeLoan(props.gameState, tierIdx)
}

function onRepayLoan(tierIdx) {
  const loan = props.gameState.loans?.find(l => !l.paid && l.tierIndex === tierIdx)
  if (loan) repayLoan(props.gameState, loan.id)
}
</script>

<style scoped>
.shop-panel {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  background: #161b22;
  display: flex;
  flex-direction: column;
  padding: 8px;
  gap: 6px;
}

.panel-title {
  font-family: monospace;
  font-size: 11px;
  font-weight: bold;
  color: #58a6ff;
  letter-spacing: 1px;
  padding-bottom: 6px;
  border-bottom: 1px solid #21262d;
}

.section-label {
  font-family: monospace;
  font-size: 9px;
  color: #8b949e;
  letter-spacing: 1px;
  margin-top: 4px;
}

.shop-item {
  background: #0d1117;
  border: 1px solid #21262d;
  border-radius: 4px;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.shop-item.disabled { opacity: 0.4; }

.item-icon { font-size: 18px; color: #58a6ff; text-align: center; }

.item-name { font-family: monospace; font-size: 12px; font-weight: bold; color: #e6edf3; }
.item-desc { font-family: monospace; font-size: 10px; color: #8b949e; }
.item-cost { font-family: monospace; font-size: 11px; color: #3fb950; font-weight: bold; }

.buy-btn {
  background: #21262d;
  border: 1px solid #30363d;
  color: #e6edf3;
  font-family: monospace;
  font-size: 11px;
  padding: 4px;
  cursor: pointer;
  border-radius: 3px;
  width: 100%;
}
.buy-btn:hover:not(:disabled) { background: #30363d; }
.buy-btn.active { background: #0f2d0f; border-color: #3fb950; color: #3fb950; }
.buy-btn:disabled { cursor: not-allowed; opacity: 0.5; }

.grid-info {
  background: #0d1117;
  border: 1px solid #21262d;
  border-radius: 4px;
  padding: 6px 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.grid-stat {
  display: flex;
  justify-content: space-between;
  font-family: monospace;
  font-size: 10px;
}
.gi-key { color: #8b949e; }
.gi-val { color: #e6edf3; font-weight: bold; }

.unlock-hint {
  font-family: monospace;
  font-size: 9px;
  color: #3d2b00;
  line-height: 1.4;
  padding: 0 2px;
}

/* ── Employés ── */
.employee-card {
  background: #0d1117;
  border: 1px solid #21262d;
  border-radius: 4px;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.emp-header {
  display: flex;
  gap: 8px;
  align-items: flex-start;
}

.emp-icon {
  font-size: 18px;
  flex-shrink: 0;
}

.emp-info { display: flex; flex-direction: column; gap: 2px; }

.emp-name {
  font-family: monospace;
  font-size: 11px;
  font-weight: bold;
  color: #e6edf3;
}

.emp-desc {
  font-family: monospace;
  font-size: 9px;
  color: #8b949e;
}

.emp-cost-row {
  display: flex;
  gap: 8px;
  font-family: monospace;
  font-size: 9px;
  flex-wrap: wrap;
}

.emp-hire-cost { color: #3fb950; }
.emp-daily     { color: #f85149; }

.emp-controls {
  display: flex;
  align-items: center;
  gap: 6px;
}

.emp-fire-btn, .emp-hire-btn {
  font-family: monospace;
  font-size: 10px;
  padding: 3px 8px;
  cursor: pointer;
  border-radius: 3px;
  border: 1px solid;
}

.emp-fire-btn {
  background: #1a0909;
  border-color: #3d1010;
  color: #f85149;
}
.emp-fire-btn:hover:not(:disabled) { background: #2d0a0a; }
.emp-fire-btn:disabled { opacity: 0.3; cursor: not-allowed; }

.emp-hire-btn {
  flex: 1;
  background: #0f2d0f;
  border-color: #3fb950;
  color: #3fb950;
}
.emp-hire-btn:hover:not(:disabled) { background: #1a4d1a; }
.emp-hire-btn:disabled { opacity: 0.3; cursor: not-allowed; }

.emp-count {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 36px;
}
.emp-num   { font-family: monospace; font-size: 16px; font-weight: bold; color: #e6edf3; }
.emp-label { font-family: monospace; font-size: 8px; color: #8b949e; }

.emp-stats {
  display: flex;
  justify-content: space-between;
  font-family: monospace;
  font-size: 9px;
  color: #8b949e;
  padding: 4px 6px;
  background: #161b22;
  border-radius: 3px;
}

.employee-card.emp-locked { opacity: 0.55; }

.emp-lock-badge {
  font-family: monospace;
  font-size: 9px;
  color: #8b949e;
}

/* ── Banque ── */
.bank-info {
  display: flex;
  justify-content: space-between;
  font-family: monospace;
  font-size: 10px;
  padding: 4px 6px;
  background: #0d1117;
  border: 1px solid #21262d;
  border-radius: 4px;
}
.bank-debt-label { color: #8b949e; }
.bank-debt-val   { font-weight: bold; }

.loan-row {
  background: #0d1117;
  border: 1px solid #21262d;
  border-radius: 4px;
  padding: 6px 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 6px;
}
.loan-row.loan-active { border-color: #d29922; }

.loan-info {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}
.loan-amount    { font-family: monospace; font-size: 11px; font-weight: bold; color: #e6edf3; }
.loan-rate      { font-family: monospace; font-size: 9px; color: #8b949e; }
.loan-remaining { font-family: monospace; font-size: 9px; color: #d29922; }

.loan-btn {
  font-family: monospace;
  font-size: 10px;
  padding: 3px 8px;
  cursor: pointer;
  border-radius: 3px;
  border: 1px solid;
}
.take-btn  { background: #0f2d0f; border-color: #3fb950; color: #3fb950; }
.take-btn:hover:not(:disabled)  { background: #1a4d1a; }
.repay-btn { background: #2d0a0a; border-color: #f85149; color: #f85149; }
.repay-btn:hover:not(:disabled) { background: #3d1010; }
.loan-btn:disabled { opacity: 0.35; cursor: not-allowed; }
</style>
