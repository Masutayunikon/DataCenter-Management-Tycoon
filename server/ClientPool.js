// ClientPool.js — Shared client pool generation and distribution for multiplayer
//
// Flow : generatePoolClients → distributeClients → GameRoom._tick pushes to queue
// Template clients now come from this pool (no longer generated separately).

import { SERVICES } from '../src/game/data/services.js'

// ─── Market demand weights (changes annually) ─────────────────────────────────

const BASE_WEIGHTS = {
  VPS:       1.0,
  DEDICATED: 0.6,
  STORAGE:   0.5,
  GAMING:    0.4,
}

/**
 * Compute this year's market demand weights.
 * Each year, one service surges (+50%) and one dips (−30%).
 * The cycle is seeded by the year so it's deterministic.
 */
export function getMarketWeights(year) {
  const services  = Object.keys(BASE_WEIGHTS)
  const surgeIdx  = year % services.length
  const dipIdx    = (year + 2) % services.length
  const weights   = { ...BASE_WEIGHTS }
  weights[services[surgeIdx]] *= 1.5
  weights[services[dipIdx]]   *= 0.7
  const total = Object.values(weights).reduce((s, w) => s + w, 0)
  for (const k of services) weights[k] /= total
  return weights
}

// ─── Specialist detection ─────────────────────────────────────────────────────

/**
 * Returns a Map<serviceId, playerId[]> of specialist players.
 * A specialist offers only one service type (all other slots = 0).
 */
export function detectSpecialists(players) {
  const specialists = new Map()
  for (const [, player] of players) {
    if (!player.connected || !player.state) continue
    const activeServices = Object.entries(player.state.serviceSlots ?? {})
      .filter(([, v]) => v > 0).map(([k]) => k)
    if (activeServices.length === 1) {
      const svc = activeServices[0]
      if (!specialists.has(svc)) specialists.set(svc, [])
      specialists.get(svc).push(player.id)
    }
  }
  return specialists
}

// ─── Template helpers ─────────────────────────────────────────────────────────

/**
 * Count active + queued clients per template for a given player and service.
 * @returns {Object.<string, number>} templateId → count
 */
function computeTemplateUsage(playerState, serviceId) {
  const usage = {}
  for (const c of [...(playerState.clients ?? []), ...(playerState.clientQueue ?? [])]) {
    if (c.serviceId === serviceId && c.templateId != null)
      usage[c.templateId] = (usage[c.templateId] ?? 0) + 1
  }
  return usage
}

/**
 * Among templates with free slots that the client can afford,
 * pick the one whose price is closest to ~70% of the client's budget
 * (realistic: clients don't always pick the cheapest).
 *
 * @returns {Object|null} template or null
 */
function pickBestTemplate(affordable, client) {
  const target = client.budget * 0.7
  return affordable.reduce((best, t) =>
    Math.abs(t.fixedPrice - target) < Math.abs(best.fixedPrice - target) ? t : best
  )
}

// ─── Client scoring ───────────────────────────────────────────────────────────

/**
 * Score how attractive a player is for a given pool client.
 * Returns -1 if ineligible, otherwise a positive float (higher = more attractive).
 *
 * Scoring factors:
 *  - Price fit (relative to budget)   — weighted by budget sensitivity
 *  - Reputation + uptime              — weighted by quality preference
 *  - Specialist bonus
 *
 * Template mode: checks affordable templates with free slots rather than
 *                rejecting the client outright (as the old code did).
 *                Stores the chosen template ID in client._assignedTemplateId.
 */
/**
 * @param {Map<string,number>} [tentative]  in-batch tentative usage counters
 *   key: `${playerId}/${svc}/${templateId}`, value: already-assigned count
 */
export function scorePlayer(client, player, specialists, tentative = null) {
  if (!player.connected || !player.state) return -1

  const svc  = client.serviceId
  const mode = player.state.serviceModes?.[svc] ?? 'auto'

  // ── Template mode ──────────────────────────────────────────────────────────
  if (mode === 'templates') {
    const templates = player.state.serviceTemplates?.[svc] ?? []
    if (templates.length === 0) return -1

    const usage      = computeTemplateUsage(player.state, svc)
    const affordable = templates.filter(t => {
      const tentKey  = `${player.id}/${svc}/${t.id}`
      const tentUsed = tentative?.get(tentKey) ?? 0
      return t.fixedPrice <= client.budget && (usage[t.id] ?? 0) + tentUsed < t.slots
    })
    if (affordable.length === 0) return -1

    const tpl = pickBestTemplate(affordable, client)

    // Attach the chosen template so distributeClients can forward it
    client._assignedTemplateId = tpl.id

    const priceScore   = 1 - (tpl.fixedPrice / client.budget)
    const repScore     = (player.state.reputation ?? 0) / 100
    const uptimeScore  = player.uptime30d ?? 1.0
    const qualScore    = repScore * 0.7 + uptimeScore * 0.3
    const specPlayers  = specialists.get(svc) ?? []
    const specBonus    = specPlayers.includes(player.id) ? 0.15 : 0
    const q            = client.qualityPreference
    return priceScore * (1 - q * 0.5) + qualScore * (q * 0.5) + specBonus + 0.1
  }

  // ── Auto mode ──────────────────────────────────────────────────────────────
  const slots = player.state.serviceSlots?.[svc] ?? 0
  if (slots <= 0) return -1

  const activeCount  = (player.state.clients    ?? []).filter(c => c.serviceId === svc).length
  const queueCount   = (player.state.clientQueue ?? []).filter(c => c.serviceId === svc).length
  const tentativeKey = `${player.id}/${svc}`
  const tentUsed     = tentative?.get(tentativeKey) ?? 0
  if (activeCount + queueCount + tentUsed >= slots) return -1

  const playerPrice = player.state.servicePrices?.[svc] ?? 0
  if (playerPrice > client.budget) return -1

  const priceScore  = 1 - (playerPrice / client.budget)
  const repScore    = (player.state.reputation ?? 0) / 100
  const uptimeScore = player.uptime30d ?? 1.0
  const qualScore   = repScore * 0.7 + uptimeScore * 0.3

  const specPlayers = specialists.get(svc) ?? []
  const isSpec      = specPlayers.includes(player.id)
  const nSpec       = specPlayers.length
  let specBonus = 0
  if (isSpec) {
    if (nSpec === 1)      specBonus = 0.60
    else if (nSpec === 2) specBonus = 0.30
    else                  specBonus = 0.40 / nSpec
  }

  const q = client.qualityPreference
  return priceScore * (1 - q * 0.5) + qualScore * (q * 0.5) + specBonus
}

// ─── Weighted random selection ────────────────────────────────────────────────

function weightedRandom(weights) {
  const total = Object.values(weights).reduce((s, w) => s + w, 0)
  let r = Math.random() * total
  for (const [key, w] of Object.entries(weights)) {
    r -= w
    if (r <= 0) return key
  }
  return Object.keys(weights).at(-1)
}

// ─── Pool client generation ───────────────────────────────────────────────────

let _nextPoolClientId = 1
export function nextPoolId() { return _nextPoolClientId++ }

/**
 * Generate a weekly batch of pool clients.
 * Counts free slots from BOTH auto-mode and templates-mode players so that
 * template datacenters also receive their share of market demand.
 */
export function generatePoolClients(shared, players) {
  const weights = shared.marketWeights ?? getMarketWeights(shared.year ?? 1)

  // Count total free slots across all connected players (auto + templates).
  // We union serviceSlots keys and serviceTemplates keys so that templates-mode
  // services are counted even if serviceSlots[svc] is 0 or absent.
  let totalFreeSlots = 0
  for (const [, player] of players) {
    if (!player.connected || !player.state) continue

    const allSvcIds = new Set([
      ...Object.keys(player.state.serviceSlots    ?? {}),
      ...Object.keys(player.state.serviceTemplates ?? {}),
    ])

    for (const svc of allSvcIds) {
      const mode = player.state.serviceModes?.[svc] ?? 'auto'

      if (mode === 'auto') {
        const maxSlots = player.state.serviceSlots?.[svc] ?? 0
        if (maxSlots <= 0) continue
        const active = (player.state.clients    ?? []).filter(c => c.serviceId === svc).length
        const queued = (player.state.clientQueue ?? []).filter(c => c.serviceId === svc).length
        totalFreeSlots += Math.max(0, maxSlots - active - queued)
      } else if (mode === 'templates') {
        // Sum free slots across all templates
        const templates = player.state.serviceTemplates?.[svc] ?? []
        const usage     = computeTemplateUsage(player.state, svc)
        for (const t of templates) {
          totalFreeSlots += Math.max(0, t.slots - (usage[t.id] ?? 0))
        }
      }
    }
  }
  if (totalFreeSlots <= 0) return []

  // Weekly batch: fill free slots + ~15% margin
  const activity = shared.marketActivity ?? 1.0
  const count    = Math.ceil(totalFreeSlots * 1.15 * activity)

  const clients = []
  for (let i = 0; i < count; i++) {
    const serviceId = weightedRandom(weights)
    const def       = SERVICES[serviceId]
    if (!def) continue

    const cpu  = randInt(def.cpuMin  ?? 1,  def.cpuMax  ?? 4)
    const ram  = randInt(def.ramMin  ?? 1,  def.ramMax  ?? 8)
    const disk = randInt(def.diskMin ?? 10, def.diskMax ?? 50)

    const budgetBase = def.basePrice ?? 100
    const budgetMult = 0.6 + Math.random() * 0.8 + (Math.random() > 0.8 ? Math.random() * 1.2 : 0)
    const budget     = Math.round(budgetBase * budgetMult)

    const qualityPreference = clamp01(gaussRandom(0.4, 0.2))

    clients.push({
      _poolId:              _nextPoolClientId++,
      _assignedTemplateId:  null,   // filled by scorePlayer when mode = templates
      serviceId,
      cpuDemand:            cpu,
      ramDemand:            ram,
      diskDemand:           disk,
      budget,
      qualityPreference,
      durationExpected:     randInt(30, 180),
    })
  }

  return clients
}

// ─── Distribution ─────────────────────────────────────────────────────────────

/**
 * Distribute pool clients to players via soft-max weighted random selection.
 * For template-mode players the scoring mutates client._assignedTemplateId;
 * the tick loop reads that field when building the queue entry.
 *
 * Returns [{ playerId, client }]
 */
export function distributeClients(poolClients, players, specialists) {
  const assignments = []

  // Tentative usage tracker prevents in-batch over-booking of template slots.
  // Key: `${playerId}/${serviceId}/${templateId}`, value: count already assigned this batch.
  const tentative = new Map()

  for (const client of poolClients) {
    // Reset template assignment from any previous iteration
    client._assignedTemplateId = null

    const scored = []
    for (const [, player] of players) {
      // scorePlayer may set client._assignedTemplateId (template mode)
      const score = scorePlayer(client, player, specialists, tentative)
      if (score >= 0) {
        scored.push({ player, score, assignedTemplateId: client._assignedTemplateId })
        client._assignedTemplateId = null  // reset for next player's scoring
      }
    }
    if (scored.length === 0) continue

    // Soft-max: higher score → proportionally higher probability
    const minScore = Math.min(...scored.map(s => s.score))
    const adjusted = scored.map(s => ({ ...s, w: Math.exp((s.score - minScore) * 2) }))
    const totalW   = adjusted.reduce((s, a) => s + a.w, 0)

    let r      = Math.random() * totalW
    let chosen = adjusted[0]
    for (const entry of adjusted) {
      r -= entry.w
      if (r <= 0) { chosen = entry; break }
    }

    // Restore the winning player's template assignment onto the client
    client._assignedTemplateId = chosen.assignedTemplateId

    // Record tentative usage so the next client in this batch sees accurate slot counts
    if (chosen.assignedTemplateId) {
      const tentKey = `${chosen.player.id}/${client.serviceId}/${chosen.assignedTemplateId}`
      tentative.set(tentKey, (tentative.get(tentKey) ?? 0) + 1)
    } else {
      // Auto mode: track per-player/service to avoid overbooking within a batch
      const tentKey = `${chosen.player.id}/${client.serviceId}`
      tentative.set(tentKey, (tentative.get(tentKey) ?? 0) + 1)
    }

    assignments.push({ playerId: chosen.player.id, client })
  }

  return assignments
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function clamp01(v) {
  return Math.max(0, Math.min(1, v))
}

function gaussRandom(mean, std) {
  // Box–Muller transform
  const u = 1 - Math.random()
  const v = Math.random()
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
  return mean + z * std
}
