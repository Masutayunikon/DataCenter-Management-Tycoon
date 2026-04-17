// ClientEngine.js — client generation, assignment, satisfaction, departures

import { createClient, SERVICES, COLUMNS } from './GameState.js'
import { rollClientSLA } from './SLAEngine.js'
import { clamp, allGridCells, getServerAt, getClientServer, getTotalServerCapacity, serverFits, findBestServer, getServerLoad } from './SimUtils.js'
import { addTicketRaw, hasRecentTicket, addNotification } from './TicketEngine.js'
import { getEventMultiplier, getEventBonus } from './EventSystem.js'
import { playSFX } from './AudioEngine.js'

const MAX_QUEUE_DAYS          = 4
const MIN_SATISFACTION        = 15
const CHURN_SAT_THRESHOLD     = 40
const CHURN_DAYS              = 3
const EMPLOYEE_ASSIGN_CAPACITY = 5
const EMPLOYEE_ASSIGN_DAILY   = 80

// ─── Demand scaling over time ─────────────────────────────────────────────────
// Demands grow by up to 2× over 300 days — incentivises server upgrades

function getDemandScale(day) {
  return Math.min(2.0, 1 + (day ?? 0) / 300)
}

function applyDemandScale(client, scale) {
  if (scale <= 1) return
  client.cpuDemand  = Math.round(client.cpuDemand  * scale)
  client.ramDemand  = Math.round(client.ramDemand  * scale)
  client.diskDemand = Math.round(client.diskDemand * scale)
}

// ─── Step 1a: Generate regular clients ────────────────────────────────────────

function generateClients(state) {
  const scale = getDemandScale(state.day)
  // Daily intake cap: 1 client the first year, +1 per year elapsed.
  // Avoids overwhelming a solo player with simultaneous arrivals.
  const yearPassed    = Math.floor((state.day ?? 1) / 365)
  const dailyLimit    = Math.max(1, yearPassed)
  let   addedThisTick = 0

  for (const serviceId of Object.keys(state.serviceSlots ?? {})) {
    if (SERVICES[serviceId]?.hidden) continue

    const mode      = state.serviceModes?.[serviceId] ?? 'auto'
    const templates = state.serviceTemplates?.[serviceId] ?? []

    // ── Templates mode ──────────────────────────────────────────────────────
    if (mode === 'templates') {
      if (templates.length === 0) continue

      // Count usage per template (active + queued)
      const usage = {}
      for (const c of [...state.clients, ...state.clientQueue]) {
        if (c.serviceId === serviceId && c.templateId != null)
          usage[c.templateId] = (usage[c.templateId] ?? 0) + 1
      }

      // Templates with free slots
      const available = templates.filter(t => (usage[t.id] ?? 0) < t.slots)
      if (available.length === 0) continue

      const totalFree = available.reduce((s, t) => s + t.slots - (usage[t.id] ?? 0), 0)

      // Flat rep-based rate — server capacity doesn't gate template arrivals
      const repFactor   = Math.min(1.0, 0.4 + ((state.reputation ?? 0) / 50) * 0.6)
      const expandBonus = state.unlockedSkills?.includes('SERVICE_EXPAND') ? 1.25 : 1.0
      const rate        = 0.8 * repFactor * expandBonus
      if (rate <= 0) continue
      let count = Math.floor(rate)
      if (Math.random() < (rate - count)) count++
      count = Math.min(count, totalFree)

      let templateAdded = false
      for (let i = 0; i < count; i++) {
        // Re-filter available after each addition
        const avail = templates.filter(t => (usage[t.id] ?? 0) < t.slots)
        if (avail.length === 0) break
        const tpl    = avail[Math.floor(Math.random() * avail.length)]
        const client = createClient(state.nextClientId++, state.day, serviceId)
        client.cpuDemand    = tpl.cpuDemand
        client.ramDemand    = tpl.ramDemand
        client.diskDemand   = tpl.diskDemand
        client.fixedPrice   = tpl.fixedPrice
        client.templateName = tpl.name
        client.templateId   = tpl.id
        client.slaLevel = rollClientSLA(state.serviceSLA?.[serviceId] ?? 'BRONZE')
        if (client.slaLevel === 'SILVER') client.durationExpected = Math.round(client.durationExpected * 1.3)
        if (client.slaLevel === 'GOLD')   client.durationExpected = Math.round(client.durationExpected * 1.8)
        // Ne pas scaler les demandes des templates — valeurs définies explicitement
        state.clientQueue.push(client)
        usage[tpl.id] = (usage[tpl.id] ?? 0) + 1
        templateAdded = true
      }
      if (templateAdded) playSFX('notification')
      continue
    }

    let clientAdded = false

    // ── Auto mode (original behaviour) ─────────────────────────────────────
    const maxSlots = state.serviceSlots[serviceId] ?? 0
    if (maxSlots <= 0) continue

    // AI_CLOUD requires minimum reputation
    const svcDef = SERVICES[serviceId]
    if (svcDef?.unlockRep && (state.reputation ?? 0) < svcDef.unlockRep) continue

    const activeCount = state.clients.filter(c => c.serviceId === serviceId).length
    // Only count "fresh" queue entries (≤1 day) toward the slot cap — stuck clients
    // that have been waiting >1 day without assignment don't block new arrivals
    const queueCount  = state.clientQueue.filter(c => c.serviceId === serviceId && (c.daysInQueue ?? 0) <= 1).length
    const freeSlots   = maxSlots - activeCount - queueCount
    if (freeSlots <= 0) continue

    // Don't generate if no server can actually accept even the smallest client
    // of this service type — prevents unassignable clients from piling up
    const probeClient = {
      cpuDemand:  svcDef.cpuMin ?? 1,
      ramDemand:  svcDef.ramMin ?? 1,
      diskDemand: svcDef.diskMin ?? 1,
      serviceId,
    }
    if (!findBestServer(state, probeClient.cpuDemand, serviceId, probeClient)) continue

    // Stop if the daily cap is already reached
    if (addedThisTick >= dailyLimit) continue

    const rate = getArrivalRateForService(state, serviceId)
    if (rate <= 0) continue
    let count = Math.floor(rate)
    if (Math.random() < (rate - count)) count++
    count = Math.min(count, freeSlots, dailyLimit - addedThisTick)

    for (let i = 0; i < count; i++) {
      const client = createClient(state.nextClientId++, state.day, serviceId)
      applyDemandScale(client, scale)
      client.slaLevel = rollClientSLA(state.serviceSLA?.[serviceId] ?? 'BRONZE')
      if (client.slaLevel === 'SILVER') client.durationExpected = Math.round(client.durationExpected * 1.3)
      if (client.slaLevel === 'GOLD')   client.durationExpected = Math.round(client.durationExpected * 1.8)
      state.clientQueue.push(client)
      clientAdded = true
    }
    addedThisTick += count

    if (clientAdded) playSFX('notification')
  }
}

// ─── Step 1a-tpl: Generate template clients only (used by MP per-player tick) ─

function generateTemplateClients(state) {
  for (const serviceId of Object.keys(state.serviceSlots ?? {})) {
    if (SERVICES[serviceId]?.hidden) continue
    const mode      = state.serviceModes?.[serviceId] ?? 'auto'
    if (mode !== 'templates') continue
    const templates = state.serviceTemplates?.[serviceId] ?? []
    if (templates.length === 0) continue

    const usage = {}
    for (const c of [...state.clients, ...state.clientQueue]) {
      if (c.serviceId === serviceId && c.templateId != null)
        usage[c.templateId] = (usage[c.templateId] ?? 0) + 1
    }

    const available = templates.filter(t => (usage[t.id] ?? 0) < t.slots)
    if (available.length === 0) continue

    const totalFree = available.reduce((s, t) => s + t.slots - (usage[t.id] ?? 0), 0)

    // For templates mode, use a flat reputation-based rate — server capacity
    // doesn't gate template arrivals (clients queue up and get assigned manually)
    const repFactor   = Math.min(1.0, 0.4 + ((state.reputation ?? 0) / 50) * 0.6)
    const expandBonus = state.unlockedSkills?.includes('SERVICE_EXPAND') ? 1.25 : 1.0
    const rate        = 0.8 * repFactor * expandBonus
    if (rate <= 0) continue
    let count = Math.floor(rate)
    if (Math.random() < (rate - count)) count++
    count = Math.min(count, totalFree)

    let added = false
    for (let i = 0; i < count; i++) {
      const avail = templates.filter(t => (usage[t.id] ?? 0) < t.slots)
      if (avail.length === 0) break
      const tpl    = avail[Math.floor(Math.random() * avail.length)]
      const client = createClient(state.nextClientId++, state.day, serviceId)
      client.cpuDemand    = tpl.cpuDemand
      client.ramDemand    = tpl.ramDemand
      client.diskDemand   = tpl.diskDemand
      client.fixedPrice   = tpl.fixedPrice
      client.templateName = tpl.name
      client.templateId   = tpl.id
      state.clientQueue.push(client)
      usage[tpl.id] = (usage[tpl.id] ?? 0) + 1
      added = true
    }
    if (added) playSFX('notification')
  }
}

// ─── Step 1b: Generate enterprise clients ─────────────────────────────────────

function generateEnterpriseClients(state) {
  if ((state.reputation ?? 0) < 20) return
  // Rate: 0 at rep=20, ~0.08 at rep=80+; BULK_DEAL gives +20% extra rate
  const bulkBonus = state.unlockedSkills?.includes('BULK_DEAL') ? 1.2 : 1.0
  const rate = Math.min(0.12, ((state.reputation - 20) / 60) * 0.08 * bulkBonus)
  if (Math.random() > rate) return

  const client = createClient(state.nextClientId++, state.day, 'ENTERPRISE')
  // Daily rate replaces servicePrices for enterprise (150–500 $/j)
  // BULK_DEAL skill: enterprise clients pay 15% more (applied in EconomyEngine)
  client.dailyRate        = 150 + Math.floor(Math.random() * 351)
  // Long contracts: 180–365 days
  client.durationExpected = 180 + Math.floor(Math.random() * 186)
  applyDemandScale(client, getDemandScale(state.day))
  state.clientQueue.push(client)
  playSFX('notification')
}

// ─── Arrival rate per service ─────────────────────────────────────────────────

function getArrivalRateForService(state, serviceId) {
  const totalCapacity = getTotalServerCapacity(state)
  if (totalCapacity === 0) return 0
  const usedCapacity = state.clients.reduce((s, c) => s + c.cpuDemand, 0)
  if (totalCapacity - usedCapacity <= 0) return 0

  // rep=0 → 0.4, rep=50 → 1.0
  const reputationFactor = Math.min(1.0, 0.4 + (state.reputation / 50) * 0.6)

  const base        = SERVICES[serviceId]?.basePrice ?? 10
  const actual      = state.servicePrices[serviceId] ?? base
  const priceFactor = Math.max(0.2, Math.min(2.0, base / Math.max(1, actual) * 1.2))

  const capacityFactor  = Math.min(1, (totalCapacity - usedCapacity) / Math.max(1, totalCapacity))
  const eventMultiplier = getEventMultiplier(state, 'arrivalMultiplier')
  // SERVICE_EXPAND skill gives +25% arrival rate (passive)
  const expandBonus     = state.unlockedSkills?.includes('SERVICE_EXPAND') ? 1.25 : 1.0

  return 0.8 * reputationFactor * priceFactor * capacityFactor * eventMultiplier * expandBonus
}

// Legacy export — computes average rate across a set of service IDs
function getArrivalRate(state, enabledServices) {
  if (!enabledServices?.length) return 0
  return enabledServices.reduce((s, id) => s + getArrivalRateForService(state, id), 0) / enabledServices.length
}

// ─── Step 2: Assign queued clients ────────────────────────────────────────────

function assignQueuedClients(state) {
  const remaining      = []
  let   autoAssignLeft = (state.employees?.assignment ?? 0) * EMPLOYEE_ASSIGN_CAPACITY

  for (const client of state.clientQueue) {
    client.daysInQueue++

    if (client.daysInQueue > MAX_QUEUE_DAYS) {
      state.reputation = clamp(0, 100, state.reputation - 2)
      addTicketRaw(state, 'capacity',
        `${client.name} a quitté la file d'attente (délai dépassé)`,
        'warning', null, client.id)
      continue
    }

    // Enterprise clients always require manual assignment
    if (client.isEnterprise) {
      remaining.push(client)
      continue
    }

    // Auto-assign via assignment technicians
    if (autoAssignLeft > 0) {
      const server = findBestServer(state, client.cpuDemand, client.serviceId, client)
      if (server) {
        client.serverPos   = { floorId: server.floorId, x: server.x, y: server.y, slot: server.slot }
        client.daysInQueue = 0
        state.clients.push(client)
        state.totalClientsServed = (state.totalClientsServed ?? 0) + 1
        autoAssignLeft--
        continue
      }
    }

    remaining.push(client)
  }
  state.clientQueue = remaining
}

// ─── Step 9: Satisfaction ─────────────────────────────────────────────────────

function updateSatisfaction(state) {
  for (const client of state.clients) {
    const slaBonus = state.unlockedSkills?.includes('PREMIUM_SLA') ? 8 : 0
    let target = 70 + slaBonus

    const positions = (client.isEnterprise && client.serverPositions?.length > 0)
      ? client.serverPositions
      : (client.serverPos ? [client.serverPos] : [])

    if (positions.length === 0) continue

    // For enterprise: worst-case satisfaction across all servers
    let worstTarget = Infinity
    for (const pos of positions) {
      const server = getServerAt(state, pos.floorId, pos.x, pos.y, pos.slot)
      if (!server) continue
      const cpuRatio  = server.cpuCapacity  > 0 ? server.cpuLoad  / server.cpuCapacity  : 0
      const ramRatio  = server.ramCapacity  > 0 ? server.ramLoad  / server.ramCapacity  : 0
      const diskRatio = server.diskCapacity > 0 ? server.diskLoad / server.diskCapacity : 0
      const loadRatio = Math.max(cpuRatio, ramRatio)

      let t = target
      if      (loadRatio < 0.5)  t += 20
      else if (loadRatio < 0.75) t += 5
      else if (loadRatio < 0.9)  t -= 10
      else if (loadRatio < 1.0)  t -= 25
      else                       t -= 45

      if      (diskRatio > 0.9)  t -= 15
      else if (diskRatio > 0.75) t -= 5

      if (server.status === 'warning') t -= 15
      worstTarget = Math.min(worstTarget, t)
    }
    if (!isFinite(worstTarget)) continue

    // Price impact
    const svc       = SERVICES[client.serviceId]
    const basePrice = svc?.basePrice ?? 10
    const curPrice  = state.servicePrices[client.serviceId] ?? basePrice
    if (curPrice > basePrice * 1.5) worstTarget -= Math.round(curPrice - basePrice * 1.5)
    if (curPrice <= basePrice * 0.8) worstTarget += 8

    worstTarget -= getEventBonus(state, 'satisfactionPenalty')

    // Network saturation penalty (-2 target if client's floor is saturated)
    const clientFloors = new Set(positions.map(p => p.floorId))
    const netSaturated = [...clientFloors].some(fid => {
      const fl = (state.floors ?? []).find(f => f.id === fid)
      return fl?.bandwidthSaturated
    })
    if (netSaturated) worstTarget -= 2

    // Hardware generation gap penalty: -3 per avg generation behind (max -12)
    const currentYear = Math.floor(state.day / 365)
    if (currentYear > 0) {
      let totalGenGap = 0, genServerCount = 0
      for (const pos of positions) {
        const srv = getServerAt(state, pos.floorId, pos.x, pos.y, pos.slot)
        if (srv) {
          totalGenGap += Math.max(0, currentYear - (srv.generation ?? 0))
          genServerCount++
        }
      }
      if (genServerCount > 0) {
        const avgGenGap = totalGenGap / genServerCount
        worstTarget -= Math.min(12, Math.round(avgGenGap * 3))
      }
    }

    const delta = (worstTarget - client.satisfaction) * 0.1
    client.satisfaction = clamp(0, 100, client.satisfaction + delta)

    if (client.satisfaction < CHURN_SAT_THRESHOLD) {
      client.daysUnhappy = (client.daysUnhappy ?? 0) + 1
    } else {
      client.daysUnhappy = 0
    }
  }

  // Support techs: +3 sat/tech to clients below 60 satisfaction
  const supportBoost = (state.employees?.support ?? 0) * 3
  if (supportBoost > 0) {
    for (const client of state.clients) {
      if (client.satisfaction < 60)
        client.satisfaction = clamp(0, 100, client.satisfaction + supportBoost * 0.1)
    }
  }
}

// ─── Step 10: Departures & contract renewal ───────────────────────────────────

function processDepartures(state) {
  const remaining = []
  for (const client of state.clients) {
    const age          = state.day - client.dayArrived
    const emergencyLeave = client.satisfaction < MIN_SATISFACTION
    const churnLeave   = (client.daysUnhappy ?? 0) >= CHURN_DAYS
    const retention    = state.unlockedSkills?.includes('CLIENT_RETENTION') ? 1.3 : 1.0
    const expired      = age >= Math.round(client.durationExpected * retention)

    // For enterprise: server missing if ANY position is gone
    let serverMissing
    if (client.isEnterprise) {
      serverMissing = client.serverPositions?.length === 0 ||
        client.serverPositions?.some(pos => !getServerAt(state, pos.floorId, pos.x, pos.y, pos.slot))
    } else {
      serverMissing = !getClientServer(state, client)
    }

    // Incubator clients: cannot churn-leave, only emergency (sat < 15) or server missing
    const isIncubator = !!client.isIncubator
    if (emergencyLeave || (!isIncubator && churnLeave) || expired || serverMissing) {
      if (emergencyLeave && !hasRecentTicket(state, 'incident', null, client.id, 2)) {
        state.reputation = clamp(0, 100, state.reputation - 2)
        addTicketRaw(state, 'incident',
          `🚨 ${client.name} a abandonné le service (satisfaction critique: ${Math.round(client.satisfaction)}%)`,
          'critical', null, client.id)
      } else if (churnLeave && !hasRecentTicket(state, 'incident', null, client.id, 2)) {
        state.reputation = clamp(0, 100, state.reputation - 3)
        addTicketRaw(state, 'incident',
          `😠 ${client.name} a résilié — insatisfait depuis ${client.daysUnhappy} jours`,
          'critical', null, client.id)
      } else if (serverMissing && !emergencyLeave && !churnLeave) {
        state.reputation = clamp(0, 100, state.reputation - 1)
        addTicketRaw(state, 'incident',
          `⚡ ${client.name} est parti — serveur devenu indisponible`,
          'warning', null, client.id)
      } else if (expired && !emergencyLeave && !churnLeave) {
        // ── Template reassignment check ──────────────────────────────────────
        // If client was on a template, verify it still exists and is affordable
        if (client.templateId != null) {
          const templates   = state.serviceTemplates?.[client.serviceId] ?? []
          const currTpl     = templates.find(t => t.id === client.templateId)
          const clientPrice = client.fixedPrice ?? 0
          // Template missing or price changed beyond ±40% → find a new one
          const tplChanged  = !currTpl || Math.abs((currTpl.fixedPrice - clientPrice) / Math.max(1, clientPrice)) > 0.4

          if (tplChanged) {
            // Look for best available template within ±50% of client's original price
            const compatible = templates.filter(t => {
              const ratio = t.fixedPrice / Math.max(1, clientPrice)
              return ratio >= 0.5 && ratio <= 1.5
            })
            if (compatible.length > 0) {
              // Pick the closest price
              const newTpl = compatible.reduce((best, t) =>
                Math.abs(t.fixedPrice - clientPrice) < Math.abs(best.fixedPrice - clientPrice) ? t : best
              )
              client.templateId   = newTpl.id
              client.templateName = newTpl.name
              client.cpuDemand    = newTpl.cpuDemand
              client.ramDemand    = newTpl.ramDemand
              client.diskDemand   = newTpl.diskDemand
              client.fixedPrice   = newTpl.fixedPrice
              client.dayArrived   = state.day
              client.durationExpected = 20 + Math.floor(Math.random() * 71)
              client.daysUnhappy  = 0
              addNotification(state, `🔀 ${client.name} a migré vers le template "${newTpl.name}"`, 'info')
              remaining.push(client)
              continue
            } else {
              // No compatible template — client leaves unhappy
              state.reputation = clamp(0, 100, state.reputation - 3)
              addTicketRaw(state, 'incident',
                `📋 ${client.name} a résilié — template supprimé/modifié, aucune offre compatible`,
                'warning', null, client.id)
              continue
            }
          }
        }

        // Contract renewal chance based on satisfaction
        const renewChance = client.satisfaction >= 75 ? 0.5
          : client.satisfaction >= 55 ? 0.25 : 0
        if (renewChance > 0 && Math.random() < renewChance) {
          client.dayArrived      = state.day
          client.durationExpected = (client.isEnterprise ? 180 : 20)
            + Math.floor(Math.random() * (client.isEnterprise ? 186 : 71))
          client.daysUnhappy     = 0
          state.reputation       = clamp(0, 100, state.reputation + 1)
          addNotification(state, `🔄 ${client.name} a renouvelé son contrat !`, 'info')
          remaining.push(client)
          continue
        }
        // Normal expiry — bonus SP for enterprise and incubator contracts
        const sp = client.isEnterprise ? 1 : (client.isIncubator ? 1 : 0)
        if (sp > 0) state.skillPoints = (state.skillPoints ?? 0) + sp
        state.reputation = clamp(0, 100, state.reputation + 0.5)
        addNotification(state,
          `✅ ${client.name} — fin de contrat (${age}j)` + (sp > 0 ? ` +${sp} SP` : ''),
          'info')
      }
      continue
    }
    remaining.push(client)
  }
  state.clients = remaining
}

// ─── Reputation ───────────────────────────────────────────────────────────────

function updateReputation(state) {
  if (state.clients.length === 0) {
    state.reputation = clamp(0, 100, state.reputation - 0.15)
    return
  }
  const avgSat  = state.clients.reduce((s, c) => s + c.satisfaction, 0) / state.clients.length
  const diminish = Math.max(0.02, 1.0 - (state.reputation / 100) * 0.98)
  const delta   = avgSat > 50
    ? (avgSat - 50) * 0.0006 * diminish
    : (avgSat - 50) * 0.012
  state.reputation = clamp(0, 100, state.reputation + delta)
}

// ─── Manual assignment ────────────────────────────────────────────────────────

function assignClientToServer(state, clientId, floorId, x, y, slot, manual = false) {
  const queueIdx = state.clientQueue.findIndex(c => c.id === clientId)
  if (queueIdx === -1) return { success: false, message: 'Client introuvable dans la file' }

  const client = state.clientQueue[queueIdx]
  const server = getServerAt(state, floorId, x, y, slot)

  if (!server) return { success: false, message: 'Serveur introuvable' }
  if (server.status === 'failed' || server.status === 'repairing')
    return { success: false, message: 'Serveur indisponible' }

  const svc = SERVICES[client.serviceId]
  if (svc?.serverTypes && !svc.serverTypes.includes(server.type))
    return { success: false, message: `Incompatible — ${client.serviceId} requiert : ${svc.serverTypes.join(' / ')}` }

  if (client.isEnterprise) {
    // Already pending on this slot?
    if (client.pendingPositions?.some(p => p.floorId === floorId && p.x === x && p.y === y && p.slot === slot))
      return { success: false, message: 'Slot déjà assigné à ce client' }

    // Check slot fits per-slot demand
    const n = client.requiredServers
    const slotClient = {
      cpuDemand:  Math.ceil(client.cpuDemand  / n),
      ramDemand:  Math.ceil(client.ramDemand  / n),
      diskDemand: Math.ceil(client.diskDemand / n),
      demand:     Math.ceil(client.cpuDemand  / n),
    }
    if (!serverFits(server, state, floorId, x, y, slot, slotClient))
      return { success: false, message: 'Capacité insuffisante pour ce slot entreprise' }

    client.pendingPositions = client.pendingPositions ?? []
    client.pendingPositions.push({ floorId, x, y, slot })

    if (manual) addNotification(state,
      `🏢 ${client.name} — serveur ${client.pendingPositions.length}/${n} assigné`, 'info')

    if (client.pendingPositions.length >= n) {
      // All slots filled — activate
      client.serverPositions  = [...client.pendingPositions]
      client.pendingPositions = []
      client.daysInQueue      = 0
      state.clientQueue.splice(queueIdx, 1)
      state.clients.push(client)
      return { success: true, activated: true, message: `${client.name} activé (${n} serveurs assignés)` }
    }
    const remaining = n - client.pendingPositions.length
    return { success: true, activated: false, message: `Slot ${client.pendingPositions.length}/${n} assigné — encore ${remaining} serveur(s) requis` }
  }

  // Standard single-server assignment
  if (!serverFits(server, state, floorId, x, y, slot, client)) {
    const usedCpu  = getServerLoad(state, floorId, x, y, slot)
    const usedRam  = state.clients.filter(c => c.serverPos?.floorId === floorId && c.serverPos?.x === x && c.serverPos?.y === y && c.serverPos?.slot === slot)
      .reduce((s, c) => s + (c.ramDemand ?? 0), 0)
    const usedDisk = state.clients.filter(c => c.serverPos?.floorId === floorId && c.serverPos?.x === x && c.serverPos?.y === y && c.serverPos?.slot === slot)
      .reduce((s, c) => s + (c.diskDemand ?? 0), 0)
    const issues = []
    if (usedCpu  + (client.cpuDemand  ?? 0) > server.cpuCapacity)  issues.push(`CPU: ${usedCpu + client.cpuDemand}/${server.cpuCapacity}`)
    if (usedRam  + (client.ramDemand  ?? 0) > server.ramCapacity)  issues.push(`RAM: ${usedRam + client.ramDemand}/${server.ramCapacity}GB`)
    if (usedDisk + (client.diskDemand ?? 0) > server.diskCapacity) issues.push(`Disk: ${usedDisk + client.diskDemand}/${server.diskCapacity}GB`)
    return { success: false, message: `Capacité insuffisante — ${issues.join(', ')}` }
  }

  client.serverPos   = { floorId, x, y, slot }
  client.daysInQueue = 0
  if (manual) {
    client.satisfaction = Math.min(100, (client.satisfaction ?? 70) + 15)
    const srv = getServerAt(state, floorId, x, y, slot)
    if (srv) srv.logs?.push({ day: state.day, type: 'repair', message: `Client ${client.name} affecté manuellement` })
  }
  state.clientQueue.splice(queueIdx, 1)
  state.clients.push(client)
  state.totalClientsServed = (state.totalClientsServed ?? 0) + 1
  return {
    success: true,
    activated: true,
    message: manual
      ? `${client.name} affecté avec succès (+15 satisfaction)`
      : `${client.name} affecté`,
  }
}

// ─── Compatible servers for queue client ──────────────────────────────────────

function getServersForQueueClient(state, clientId) {
  const client = state.clientQueue.find(c => c.id === clientId)
  if (!client) return []

  const svc            = SERVICES[client.serviceId]
  const compatibleTypes = svc?.serverTypes ?? null
  const result         = []

  // For enterprise: use per-slot demand, exclude already-pending slots
  const isEnterprise = client.isEnterprise
  const n   = client.requiredServers ?? 1
  const slotClient = isEnterprise ? {
    cpuDemand:  Math.ceil(client.cpuDemand  / n),
    ramDemand:  Math.ceil(client.ramDemand  / n),
    diskDemand: Math.ceil(client.diskDemand / n),
    demand:     Math.ceil(client.cpuDemand  / n),
  } : client

  for (const cell of allGridCells(state)) {
    if (!cell.rack || cell.locked) continue
    for (let slot = 0; slot < cell.rack.servers.length; slot++) {
      const server = cell.rack.servers[slot]
      if (!server || server.status === 'failed' || server.status === 'repairing') continue
      if (compatibleTypes && !compatibleTypes.includes(server.type)) continue

      // Skip already-pending slots for enterprise
      if (isEnterprise && client.pendingPositions?.some(
        p => p.floorId === cell.floorId && p.x === cell.x && p.y === cell.y && p.slot === slot
      )) continue

      if (!serverFits(server, state, cell.floorId, cell.x, cell.y, slot, slotClient)) continue

      const usedCpu = getServerLoad(state, cell.floorId, cell.x, cell.y, slot)
      result.push({
        floorId:      cell.floorId,
        x:            cell.x,
        y:            cell.y,
        slot,
        label:        `F${cell.floorId} ${COLUMNS[cell.x]}${cell.y}:${slot}`,
        freeCapacity: server.cpuCapacity - usedCpu,
        serverType:   server.type,
      })
    }
  }
  return result
}

export {
  generateClients, generateTemplateClients, generateEnterpriseClients, getArrivalRate, getArrivalRateForService, assignQueuedClients,
  updateSatisfaction, processDepartures, updateReputation,
  assignClientToServer, getServersForQueueClient,
  MAX_QUEUE_DAYS, MIN_SATISFACTION, CHURN_SAT_THRESHOLD, CHURN_DAYS,
  EMPLOYEE_ASSIGN_CAPACITY, EMPLOYEE_ASSIGN_DAILY,
}
