<template>
  <div class="skill-panel">

    <!-- Category tabs -->
    <div class="cat-tabs">
      <button
        v-for="cat in categories"
        :key="cat.id"
        class="cat-btn"
        :class="{ active: activeCat === cat.id }"
        @click="activeCat = cat.id"
      >
        {{ cat.icon }} {{ cat.label }}
      </button>
    </div>

    <!-- Skill points display -->
    <div class="rep-row">
      <span class="rep-label">Points de compétence</span>
      <span class="rep-value" :style="{ color: spColor }">{{ gameState.skillPoints ?? 0 }} SP</span>
      <span class="rep-hint">Gagnés à la fin des contrats</span>
    </div>

    <!-- Skills list -->
    <div class="skills-list">
      <div
        v-for="skill in filteredSkills"
        :key="skill.id"
        class="skill-node"
        :class="nodeClass(skill)"
      >
        <!-- Chain line if has requires -->
        <div v-if="skill.requires.length > 0" class="skill-chain">
          ↳ après {{ skill.requires.map(r => SKILLS[r]?.label ?? r).join(', ') }}
        </div>

        <div class="skill-header">
          <span class="skill-icon">{{ skill.icon }}</span>
          <span class="skill-name">{{ skill.label }}</span>
          <span class="skill-status">{{ statusLabel(skill) }}</span>
        </div>

        <div class="skill-desc">{{ skill.desc }}</div>

        <div class="skill-footer">
          <span class="skill-rep" :style="{ color: spMet(skill) ? '#3fb950' : '#f85149' }">
            🔷 {{ skill.spReq }} SP
          </span>
          <span v-if="skill.repReq" class="skill-rep" :style="{ color: repMet(skill) ? '#3fb950' : '#d29922' }">
            ⭐ Rep {{ skill.repReq }}
          </span>
          <span class="skill-cost">${{ skill.cost.toLocaleString() }}</span>
          <button
            v-if="!isOwned(skill)"
            class="buy-btn"
            :disabled="!canBuy(skill)"
            @click="buy(skill)"
          >
            {{ buyLabel(skill) }}
          </button>
          <span v-else class="owned-badge">✓ Acquis</span>
        </div>

        <div v-if="lastMsg && lastMsg.id === skill.id" class="skill-msg" :class="lastMsg.ok ? 'ok' : 'err'">
          {{ lastMsg.text }}
        </div>
      </div>

      <div v-if="filteredSkills.length === 0" class="empty-cat">
        Aucune compétence dans cette catégorie
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { SKILLS } from '../game/GameState.js'
import { applySkill } from '../game/SimulationEngine.js'

const props = defineProps({
  gameState:     { type: Object,   required: true },
  isMultiplayer: { type: Boolean,  default: false },
  sendAction:    { type: Function, default: null },
})
const emit = defineEmits(['apply-skill'])

const activeCat = ref('servers')
const lastMsg   = ref(null)

const categories = [
  { id: 'servers',   label: 'Serveurs',  icon: '🖥️' },
  { id: 'upgrades',  label: 'Upgrades',  icon: '⬆️' },
  { id: 'employees', label: 'Employés',  icon: '👥' },
  { id: 'infra',     label: 'Infra',     icon: '🏗️' },
  { id: 'business',  label: 'Business',  icon: '💼' },
]

const filteredSkills = computed(() => {
  const owned    = new Set(props.gameState.unlockedSkills ?? [])
  const allInCat = Object.values(SKILLS).filter(s => s.category === activeCat.value)

  // Build chain maps for skills within this category:
  // chainParent[id] = parentId  (only if parent is also in this category)
  // chainChild[id]  = childId
  const chainParent = {}
  const chainChild  = {}
  for (const s of allInCat) {
    if (s.requires.length === 1) {
      const parent = SKILLS[s.requires[0]]
      if (parent && parent.category === s.category) {
        chainParent[s.id]       = s.requires[0]
        chainChild[s.requires[0]] = s.id
      }
    }
  }

  const visible = allInCat.filter(s => {
    // Owned skill with a chain child → hide it (child takes its place)
    if (owned.has(s.id) && chainChild[s.id]) return false
    // Chain skill whose direct chain-parent is NOT owned yet → hide it (too early)
    if (chainParent[s.id] && !owned.has(chainParent[s.id])) return false
    return true
  })

  // Sort: non-owned first, owned maxed-chain skills pushed to bottom
  return visible.sort((a, b) => {
    const aOwned = owned.has(a.id)
    const bOwned = owned.has(b.id)
    if (aOwned === bOwned) return 0
    return aOwned ? 1 : -1
  })
})

const spColor = computed(() => {
  const sp = props.gameState.skillPoints ?? 0
  if (sp >= 20) return '#3fb950'
  if (sp >= 5)  return '#d29922'
  return '#f85149'
})

function isOwned(skill) {
  return (props.gameState.unlockedSkills ?? []).includes(skill.id)
}

function spMet(skill) {
  return (props.gameState.skillPoints ?? 0) >= skill.spReq
}

function repMet(skill) {
  if (!skill.repReq) return true
  return (props.gameState.reputation ?? 0) >= skill.repReq
}

function requiresMet(skill) {
  return skill.requires.every(r => (props.gameState.unlockedSkills ?? []).includes(r))
}

function canBuy(skill) {
  return !isOwned(skill) && spMet(skill) && repMet(skill) && requiresMet(skill) && props.gameState.money >= skill.cost
}

function statusLabel(skill) {
  if (isOwned(skill)) return '✓'
  if (!requiresMet(skill)) return '🔗'
  if (!spMet(skill)) return '🔒'
  if (!repMet(skill)) return '⭐'
  if (props.gameState.money < skill.cost) return '💸'
  return '◯'
}

function buyLabel(skill) {
  if (!requiresMet(skill)) return 'Prérequis'
  if (!spMet(skill)) return `${skill.spReq} SP`
  if (!repMet(skill)) return `Rep ${skill.repReq}`
  if (props.gameState.money < skill.cost) return 'Fonds'
  return 'Acheter'
}

function nodeClass(skill) {
  if (isOwned(skill)) return 'owned'
  if (!requiresMet(skill)) return 'locked-req'
  if (!spMet(skill)) return 'locked-rep'
  if (!repMet(skill)) return 'locked-rep'
  if (props.gameState.money < skill.cost) return 'no-funds'
  return 'available'
}

async function buy(skill) {
  if (props.sendAction) {
    lastMsg.value = { id: skill.id, text: '…', ok: true }
    const res = await props.sendAction('apply_skill', { skillId: skill.id })
    lastMsg.value = { id: skill.id, text: res?.ok ? 'Compétence débloquée !' : (res?.error ?? 'Erreur'), ok: !!res?.ok }
    setTimeout(() => { if (lastMsg.value?.id === skill.id) lastMsg.value = null }, 3000)
    return
  }
  const result = applySkill(props.gameState, skill.id)
  lastMsg.value = { id: skill.id, text: result.message, ok: result.success }
  setTimeout(() => { if (lastMsg.value?.id === skill.id) lastMsg.value = null }, 3000)
}
</script>

<style scoped>
.skill-panel {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 6px;
}

.cat-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  margin-bottom: 2px;
}

.cat-btn {
  flex: 1;
  min-width: 0;
  background: #21262d;
  border: 1px solid #30363d;
  color: #8b949e;
  font-family: monospace;
  font-size: 8px;
  padding: 3px 2px;
  cursor: pointer;
  border-radius: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: all 0.1s;
}
.cat-btn:hover  { color: #e6edf3; }
.cat-btn.active { background: #1f4068; border-color: #58a6ff; color: #58a6ff; }

.rep-row {
  display: flex;
  align-items: center;
  gap: 5px;
  font-family: monospace;
  font-size: 10px;
  background: #0d1117;
  border: 1px solid #21262d;
  border-radius: 3px;
  padding: 4px 7px;
}
.rep-label { color: #8b949e; flex: 1; }
.rep-value  { font-weight: bold; }
.rep-hint   { font-size: 8px; color: #555d69; }

.skills-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.skill-node {
  background: #0d1117;
  border: 1px solid #21262d;
  border-radius: 4px;
  padding: 6px 8px;
  display: flex;
  flex-direction: column;
  gap: 3px;
  transition: border-color 0.15s;
}

.skill-node.owned        { border-color: #238636; background: #0a1e0a; }
.skill-node.available    { border-color: #3fb950; }
.skill-node.no-funds     { border-color: #856019; }
.skill-node.locked-rep   { opacity: 0.6; }
.skill-node.locked-req   { opacity: 0.45; }

.skill-chain {
  font-family: monospace;
  font-size: 8px;
  color: #555d69;
  font-style: italic;
}

.skill-header {
  display: flex;
  align-items: center;
  gap: 5px;
}
.skill-icon   { font-size: 12px; }
.skill-name   { font-family: monospace; font-size: 10px; font-weight: bold; color: #e6edf3; flex: 1; }
.skill-status { font-size: 12px; }

.skill-desc {
  font-family: monospace;
  font-size: 9px;
  color: #8b949e;
  line-height: 1.4;
}

.skill-footer {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-top: 1px;
}
.skill-rep  { font-family: monospace; font-size: 9px; font-weight: bold; }
.skill-cost { font-family: monospace; font-size: 9px; color: #d29922; font-weight: bold; flex: 1; }

.buy-btn {
  background: #21262d;
  border: 1px solid #3fb950;
  color: #3fb950;
  font-family: monospace;
  font-size: 9px;
  padding: 2px 7px;
  cursor: pointer;
  border-radius: 2px;
  transition: all 0.1s;
}
.buy-btn:hover:not(:disabled) { background: #0f2d0f; }
.buy-btn:disabled { opacity: 0.4; cursor: not-allowed; border-color: #30363d; color: #8b949e; }

.owned-badge {
  font-family: monospace;
  font-size: 9px;
  color: #3fb950;
  font-weight: bold;
}

.skill-msg {
  font-family: monospace;
  font-size: 9px;
  padding: 2px 4px;
  border-radius: 2px;
  margin-top: 1px;
}
.skill-msg.ok  { background: #0a2e0a; color: #3fb950; border: 1px solid #238636; }
.skill-msg.err { background: #2e0a0a; color: #f85149; border: 1px solid #6e2020; }

.empty-cat {
  font-family: monospace;
  font-size: 10px;
  color: #30363d;
  text-align: center;
  padding: 20px;
}
</style>
