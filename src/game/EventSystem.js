// EventSystem.js — random event definitions and trigger logic

const MAX_ACTIVE_EVENTS = 3

// ─── Event definitions ────────────────────────────────────────────────────────

const EVENT_DEFS = [
  {
    id:          'ENERGY_CRISIS',
    name:        '⚡ Crise Énergétique',
    description: 'Les prix de l\'électricité ont explosé. Coût ×2.5 pendant la crise.',
    duration:    { min: 30, max: 50 },
    probability: 0.004,
    severity:    'critical',
    condition:   null,
    effects:     { electricityMultiplier: 2.5 },
  },
  {
    id:          'ENERGY_SUBSIDY',
    name:        '🚀 Subvention Énergétique',
    description: 'L\'État subventionne l\'électricité. Coût gratuit pendant 5 jours.',
    duration:    { min: 30, max: 45 },
    probability: 0.002,
    severity:    'info',
    condition:   null,
    effects:     { electricityMultiplier: 0 },
  },
  {
    id:          'HEATWAVE',
    name:        '🌡 Canicule',
    description: 'Températures extrêmes. +20°C sur tous les serveurs.',
    duration:    { min: 30, max: 50 },
    probability: 0.003,
    severity:    'warning',
    condition:   null,
    effects:     { heatBonus: 20 },
  },
  {
    id:          'TECH_BOOM',
    name:        '💥 Boom Technologique',
    description: 'Le marché explose ! Afflux de clients ×3.',
    duration:    { min: 30, max: 60 },
    probability: 0.003,
    severity:    'info',
    condition:   (state) => state.reputation >= 60,
    effects:     { arrivalMultiplier: 3 },
  },
  {
    id:          'RECESSION',
    name:        '📉 Récession Économique',
    description: 'Les entreprises réduisent leurs dépenses. Moins de clients, satisfaction plus fragile.',
    duration:    { min: 30, max: 60 },
    probability: 0.003,
    severity:    'warning',
    condition:   null,
    effects:     { arrivalMultiplier: 0.3, satisfactionPenalty: 10 },
  },
  {
    id:          'DATA_BREACH',
    name:        '🔒 Fuite de Données',
    description: 'Une faille de sécurité a été détectée. Réputation -25, clients paniqués.',
    duration:    { min: 30, max: 45 },
    probability: 0.002,
    severity:    'critical',
    condition:   (state) => state.clients.length > 0,
    effects:     { satisfactionPenalty: 30 },
    onTrigger:   (state) => {
      state.reputation = Math.max(0, state.reputation - 25)
    },
  },
  {
    id:          'NETWORK_OUTAGE',
    name:        '🏗 Panne Réseau',
    description: 'Panne réseau générale. Tous les clients sont temporairement déconnectés.',
    duration:    { min: 2, max: 3 },
    probability: 0.002,
    severity:    'critical',
    condition:   (state) => state.clients.length > 0,
    effects:     { arrivalMultiplier: 0 },
    onTrigger:   (state) => {
      // Move all clients to queue
      for (const c of state.clients) {
        c.serverPos    = null
        c.daysInQueue  = 0
        state.clientQueue.push(c)
      }
      state.clients = []
    },
  },
  {
    id:          'INVESTOR_BONUS',
    name:        '💰 Investisseur Intéressé',
    description: 'Un investisseur est impressionné par vos performances. +$8,000 !',
    duration:    { min: 1, max: 1 },
    probability: 0.002,
    severity:    'info',
    condition:   (state) => state.reputation >= 75 && state.money < 30000,
    effects:     {},
    onTrigger:   (state) => {
      state.money += 8000
    },
  },
  {
    id:          'HARDWARE_SHORTAGE',
    name:        '🛠 Pénurie de Composants',
    description: 'Les pièces de rechange sont rares. Coût des réparations ×2.',
    duration:    { min: 30, max: 50 },
    probability: 0.003,
    severity:    'warning',
    condition:   null,
    effects:     { repairCostMultiplier: 2 },
  },
  {
    id:          'COMPETITION',
    name:        '👥 Nouveau Concurrent',
    description: 'Un concurrent agressif entre sur le marché. Attractivité réduite de 50%.',
    duration:    { min: 30, max: 60 },
    probability: 0.003,
    severity:    'warning',
    condition:   (state) => state.day >= 30,
    effects:     { arrivalMultiplier: 0.5 },
  },
  {
    id:          'DDOS_ATTACK',
    name:        '💣 Attaque DDoS',
    description: 'Votre datacenter est ciblé par une attaque DDoS massive. Satisfaction de tous les clients -20, réputation -10.',
    duration:    { min: 30, max: 45 },
    probability: 0.003,
    severity:    'critical',
    condition:   (state) => state.clients.length > 0,
    effects:     { satisfactionPenalty: 20, arrivalMultiplier: 0.2 },
    onTrigger:   (state) => {
      state.reputation = Math.max(0, state.reputation - 10)
      // Drain money — attack mitigation costs
      const fine = 500 + Math.floor(Math.random() * 1500)
      state.money -= fine
      state.totalLost = (state.totalLost ?? 0) + fine
    },
  },
  {
    id:          'RANSOMWARE',
    name:        '☠️ Ransomware',
    description: 'Un ransomware a chiffré plusieurs serveurs. Réparation d\'urgence requise — coût $3,000 prélevé.',
    duration:    { min: 1, max: 2 },
    probability: 0.002,
    severity:    'critical',
    condition:   (state) => {
      // Requires at least some servers and relatively weak security
      const hasServers = state.floors?.some(f => f.grid?.some(row => row.some(c => c.rack?.servers?.some(s => s))))
      const weakSec    = !state.unlockedSkills?.includes('SECURITY_LVL3')
      return hasServers && weakSec
    },
    effects:     { repairCostMultiplier: 3 },
    onTrigger:   (state) => {
      // Randomly fail up to 3 servers
      let hit = 0
      outer:
      for (const floor of state.floors ?? []) {
        for (const row of floor.grid ?? []) {
          for (const cell of row) {
            if (!cell.rack) continue
            for (let slot = 0; slot < cell.rack.servers.length; slot++) {
              const srv = cell.rack.servers[slot]
              if (srv && srv.status === 'ok' && hit < 3) {
                srv.status     = 'failed'
                srv.failedDays = 0
                srv.health     = Math.max(10, srv.health - 40)
                hit++
              }
            }
          }
        }
      }
      const ransom = 3000
      state.money  -= ransom
      state.totalLost = (state.totalLost ?? 0) + ransom
      state.reputation = Math.max(0, state.reputation - 15)
    },
  },
  {
    id:          'REGULATORY_FINE',
    name:        '⚖️ Amende Réglementaire',
    description: 'Audit surprise — non-conformité détectée. Amende de $2,500 et réputation -8.',
    duration:    { min: 1, max: 1 },
    probability: 0.0025,
    severity:    'critical',
    condition:   (state) => state.day >= 50 && state.reputation >= 30,
    effects:     {},
    onTrigger:   (state) => {
      const fine = 1500 + Math.floor(Math.random() * 2000)
      state.money -= fine
      state.totalLost = (state.totalLost ?? 0) + fine
      state.reputation = Math.max(0, state.reputation - 8)
    },
  },
  {
    id:          'VIRAL_CONTENT',
    name:        '📱 Contenu Viral',
    description: 'Une vidéo est devenue virale ! Afflux massif de clients Streaming ×5 pendant 5 jours.',
    duration:    { min: 30, max: 45 },
    probability: 0.003,
    severity:    'info',
    condition:   (state) => (state.serviceSlots?.STREAMING ?? 0) > 0,
    effects:     { arrivalMultiplier: 5 },
  },
  {
    id:          'CLOUD_PARTNERSHIP',
    name:        '🤝 Partenariat Cloud',
    description: 'Un partenariat stratégique est signé. +$5,000 immédiats et réputation +5.',
    duration:    { min: 1, max: 1 },
    probability: 0.002,
    severity:    'info',
    condition:   (state) => state.reputation >= 50 && state.day >= 60,
    effects:     {},
    onTrigger:   (state) => {
      state.money += 5000
      state.reputation = Math.min(100, state.reputation + 5)
    },
  },
]

// ─── Trigger logic ────────────────────────────────────────────────────────────

/**
 * Called each day tick. Returns a newly triggered event or null.
 */
function tryTriggerEvent(state) {
  if (state.activeEvents.length >= MAX_ACTIVE_EVENTS) return null

  // Build pool of eligible events (not already active, condition met)
  const activeIds = new Set(state.activeEvents.map(e => e.id))

  const eligible = EVENT_DEFS.filter(def => {
    if (activeIds.has(def.id)) return false
    if (def.condition && !def.condition(state)) return false
    return true
  })

  // Roll each eligible event independently
  for (const def of eligible) {
    if (Math.random() < def.probability) {
      return spawnEvent(state, def)
    }
  }

  return null
}

function spawnEvent(state, def) {
  const duration = def.duration.min + Math.floor(Math.random() * (def.duration.max - def.duration.min + 1))

  const event = {
    id:          def.id,
    name:        def.name,
    description: def.description,
    severity:    def.severity,
    effects:     { ...def.effects },
    daysLeft:    duration,
    duration,
    dayStarted:  state.day,
  }

  state.activeEvents.push(event)

  // One-shot effects on trigger
  if (def.onTrigger) def.onTrigger(state)

  // Add to history
  state.eventHistory.push({ id: def.id, name: def.name, day: state.day, duration })
  if (state.eventHistory.length > 20) state.eventHistory.shift()

  return event
}

/**
 * Tick all active events — decrement daysLeft, remove expired ones.
 */
function tickEvents(state) {
  state.activeEvents = state.activeEvents.filter(e => {
    e.daysLeft--
    return e.daysLeft > 0
  })
}

// ─── Effect helpers (used by SimulationEngine) ────────────────────────────────

function getEventMultiplier(state, key, defaultVal = 1) {
  let val = defaultVal
  for (const e of state.activeEvents) {
    if (e.effects[key] !== undefined) val *= e.effects[key]
  }
  return val
}

function getEventBonus(state, key, defaultVal = 0) {
  let val = defaultVal
  for (const e of state.activeEvents) {
    if (e.effects[key] !== undefined) val += e.effects[key]
  }
  return val
}

export { tryTriggerEvent, tickEvents, getEventMultiplier, getEventBonus, MAX_ACTIVE_EVENTS }
