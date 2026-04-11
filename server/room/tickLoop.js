// tickLoop.js — Game tick loop and per-player simulation for a GameRoom

import { tickEvents, tryTriggerEvent }           from '../../src/game/EventSystem.js'
import { updateServerLoads, processServerFailures, computeHeat, computePower, updateServerUptime, processHacks } from '../../src/game/ServerEngine.js'
import { calculateRevenue, calculateElectricityCost, calculateMaintenanceCost, calculateEmployeeCost, generateTickets, autoResolveTickets } from '../../src/game/EconomyEngine.js'
import { updateSatisfaction, processDepartures, updateReputation, assignQueuedClients, MAX_QUEUE_DAYS } from '../../src/game/ClientEngine.js'
import { generateMissions, processMissionDeadlines } from '../../src/game/MissionEngine.js'
import { clamp } from '../../src/game/SimUtils.js'
import { generatePoolClients, distributeClients, detectSpecialists, getMarketWeights, nextPoolId } from '../ClientPool.js'
import { snapshot, computeDeltas, allMeta } from './stateSync.js'
import { processTenders } from './tenderSystem.js'
import { randomClientName } from './clientNames.js'
import { saveRoom } from './saveManager.js'

const DAY_DURATION_MS = 24_000

// ─── Private helpers ──────────────────────────────────────────────────────────

function _updateUptimeStreak(state) {
  const anyFailed = state.floors?.some(f =>
    f.grid?.some(row => row?.some(cell =>
      cell.rack?.servers?.some(s => s && s.status === 'failed')
    ))
  )
  if (anyFailed) {
    state.currentUptimeStreak = 0
  } else {
    state.currentUptimeStreak = (state.currentUptimeStreak ?? 0) + 1
    state.longestUptime = Math.max(state.longestUptime ?? 0, state.currentUptimeStreak)
  }
}

function _applyAutoScalingBonus(state) {
  if (!state.unlockedSkills?.includes('AUTO_SCALING')) return
  for (const client of state.clients)
    client.satisfaction = clamp(0, 100, (client.satisfaction ?? 50) + 0.1)
}

// ─── Assign pool client to a player's queue ─────────────────────────────────
// Handles both auto-mode and template-mode assignments from the pool.
// Returns null if the slot is no longer available (race between scoring&assignment).

function _buildQueueEntry(client, day, mode, playerState) {
  const base = {
    id:               `mp_${client._poolId}`,
    name:             randomClientName(),
    serviceId:        client.serviceId,
    cpuDemand:        client.cpuDemand,
    ramDemand:        client.ramDemand,
    diskDemand:       client.diskDemand,
    satisfaction:     50,
    daysUnhappy:      0,
    daysInQueue:      0,
    durationExpected: client.durationExpected,
    dayArrived:       day,
    serverPos:        null,
  }

  if (mode === 'templates' && client._assignedTemplateId) {
    const templates = playerState.serviceTemplates?.[client.serviceId] ?? []
    const tpl = templates.find(t => t.id === client._assignedTemplateId)
    if (!tpl) return null  // Template disappeared

    // Last-mile slot check: re-count usage at push time
    const currentUsage = [
      ...(playerState.clients    ?? []),
      ...(playerState.clientQueue ?? []),
    ].filter(c => c.serviceId === client.serviceId && c.templateId === tpl.id).length

    if (currentUsage >= tpl.slots) return null  // Slot filled between scoring and push

    base.templateId   = tpl.id
    base.templateName = tpl.name
    base.fixedPrice   = tpl.fixedPrice
    base.cpuDemand    = tpl.cpuDemand
    base.ramDemand    = tpl.ramDemand
    base.diskDemand   = tpl.diskDemand
  }

  return base
}

// ─── Tick control ─────────────────────────────────────────────────────────────

export function startTick(room) {
  if (room._tickTimer)      return
  if (!room.shared.speed)   return   // speed 0 = paused, don't tick
  if (!room.shared.started) return   // don't tick before game start
  room._tickMs    = DAY_DURATION_MS / room.shared.speed
  room._tickTimer = setInterval(() => executeTick(room), room._tickMs)
  console.log(`[Room ${room.id}] Tick started (${room._tickMs}ms/day)`)
}

export function stopTick(room) {
  if (room._tickTimer) {
    clearInterval(room._tickTimer)
    room._tickTimer = null
  }
}

export function setSpeed(room, speed, requesterId) {
  if (requesterId !== room.gameMasterId) return
  room.shared.speed = speed
  stopTick(room)
  startTick(room)
  room.io?.to(room.id).emit('speed_changed', { speed })
}

// ─── Main tick ────────────────────────────────────────────────────────────────

function _diagDupes(room, label) {
  for (const [, player] of room.players) {
    if (!player.connected) continue
    const qIds  = player.state.clientQueue.map(c => c.id)
    const qDups = [...new Set(qIds.filter((id, i) => qIds.indexOf(id) !== i))]
    if (qDups.length > 0)
      console.warn(`[Room ${room.id}] ⚠ ${label} | ${player.name} QUEUE dupes: ${qDups.join(', ')} (len=${qIds.length})`)

    const aIds  = player.state.clients.map(c => c.id)
    const aDups = [...new Set(aIds.filter((id, i) => aIds.indexOf(id) !== i))]
    if (aDups.length > 0)
      console.warn(`[Room ${room.id}] ⚠ ${label} | ${player.name} ACTIVE dupes: ${aDups.join(', ')} (len=${aIds.length})`)
  }
}

export function executeTick(room) {

  // ── 0. Diagnostic ─────────────────────────────────────────────────────────
  _diagDupes(room, 'TICK-START')

  // ── 1. Advance shared time ─────────────────────────────────────────────────
  room.shared.day++
  if (room.shared.day % 30 === 0) {
    room.shared.month++
    if (room.shared.month > 12) {
      room.shared.month = 1
      room.shared.year++
      room.shared.marketWeights = getMarketWeights(room.shared.year)
      room.io?.to(room.id).emit('market_updated', {
        year:          room.shared.year,
        marketWeights: room.shared.marketWeights,
      })
    }
  }

  // ── 2. Shared events ───────────────────────────────────────────────────────
  tickEvents(room.shared)
  const newEvent = tryTriggerEvent(room.shared)
  if (newEvent) {
    room.io?.to(room.id).emit('event_triggered', { event: newEvent })
  }

  // Sync shared events into each player's state
  for (const [, player] of room.players) {
    player.state.activeEvents = [...(room.shared.activeEvents ?? [])]
  }

  // ── 3. Tenders ─────────────────────────────────────────────────────────────
  processTenders(room)

  // ── 4. Re-pool expired queue clients ──────────────────────────────────────
  let rePooled = 0
  for (const [, player] of room.players) {
    if (!player.connected) continue
    const keep = []
    for (const c of player.state.clientQueue) {
      if (c.templateId != null) { keep.push(c); continue }  // template: stays
      if (c.isEnterprise)       { keep.push(c); continue }  // enterprise: manual
      if ((c.daysInQueue ?? 0) >= MAX_QUEUE_DAYS) {
        // Re-pool instead of penalising
        room._pendingPool.push({
          _poolId:           nextPoolId(),
          serviceId:         c.serviceId,
          cpuDemand:         c.cpuDemand,
          ramDemand:         c.ramDemand,
          diskDemand:        c.diskDemand,
          budget:            c.fixedPrice ?? 50,
          qualityPreference: 0.4,
          durationExpected:  c.durationExpected,
        })
        rePooled++
      } else {
        keep.push(c)
      }
    }
    player.state.clientQueue = keep
  }
  if (rePooled > 0)
    console.log(`[Room ${room.id}] Day ${room.shared.day}: re-pooled ${rePooled} expired queue clients`)

  // ── 5. Weekly pool refresh + daily distribution ────────────────────────────
  const specialists = detectSpecialists(room.players)

  if (room.shared.day % 7 === 1) {
    const newBatch = generatePoolClients(room.shared, room.players)
    room._pendingPool = newBatch
    room.shared.lastPoolCount = newBatch.length
    console.log(`[Room ${room.id}] Week ${Math.ceil(room.shared.day / 7)}: ${newBatch.length} pool clients generated`)
    for (const [, p] of room.players) {
      const modes = JSON.stringify(p.state.serviceModes ?? {})
      const tpls  = Object.fromEntries(Object.entries(p.state.serviceTemplates ?? {}).map(([k, v]) => [k, v.length]))
      const slots = JSON.stringify(p.state.serviceSlots ?? {})
      console.log(`[Room ${room.id}]   ${p.name}: modes=${modes} templates=${JSON.stringify(tpls)} slots=${slots}`)
    }
  }

  // Distribute ~1/7 of the pending pool today
  const dailyQuota   = room._pendingPool.length > 0 ? Math.ceil(room._pendingPool.length / 7) : 0
  const toDistribute = dailyQuota > 0 ? room._pendingPool.splice(0, dailyQuota) : []
  const assignments  = distributeClients(toDistribute, room.players, specialists)

  // Return unassigned clients to the pool so they aren't silently dropped
  if (assignments.length < toDistribute.length) {
    const assignedPoolIds = new Set(assignments.map(a => a.client._poolId))
    const unassigned = toDistribute.filter(c => !assignedPoolIds.has(c._poolId))
    room._pendingPool.push(...unassigned)
  }

  if (toDistribute.length > 0)
    console.log(`[Room ${room.id}] Day ${room.shared.day}: distributing ${toDistribute.length} clients → ${assignments.length} assigned, ${room._pendingPool.length} pending`)

  for (const { playerId, client } of assignments) {
    const player = room.players.get(playerId)
    if (!player) continue

    // Skip if client ID already present in queue OR active clients (dedup guard)
    const clientId = `mp_${client._poolId}`
    if (
      player.state.clientQueue.some(c => c.id === clientId) ||
      player.state.clients.some(c => c.id === clientId)
    ) continue

    const mode  = player.state.serviceModes?.[client.serviceId] ?? 'auto'
    const entry = _buildQueueEntry(client, room.shared.day, mode, player.state)
    if (entry) player.state.clientQueue.push(entry)
  }

  _diagDupes(room, 'PRE-DEDUP')

  // Defensive dedup: collapse any duplicate client IDs that may have accumulated
  // (guards against stale player-map entries or any other edge case)
  for (const [, player] of room.players) {
    if (!player.connected) continue
    const seen = new Set()
    player.state.clientQueue = player.state.clientQueue.filter(c => {
      if (seen.has(c.id)) return false
      seen.add(c.id)
      return true
    })
    const seenActive = new Set()
    player.state.clients = player.state.clients.filter(c => {
      if (seenActive.has(c.id)) return false
      seenActive.add(c.id)
      return true
    })
  }

  // ── 6. Per-player ticks ────────────────────────────────────────────────────
  for (const [socketId, player] of room.players) {
    player.state.day = room.shared.day

    if (!player.connected) {
      // Passive simulation only
      updateServerLoads(player.state)
      computeHeat(player.state)
      computePower(player.state)
      calculateRevenue(player.state)
      calculateElectricityCost(player.state)
      calculateMaintenanceCost(player.state)
      calculateEmployeeCost(player.state)
      updateReputation(player.state)
      updateServerUptime(player.state)
    } else {
      // Full tick — NOTE: generateTemplateClients removed; pool now handles templates
      const beforeQ = player.state.clientQueue.length
      const beforeA = player.state.clients.length
      assignQueuedClients(player.state)
      // Diagnostic: did assignQueuedClients introduce dupes?
      const aIds  = player.state.clients.map(c => c.id)
      const aDups = [...new Set(aIds.filter((id, i) => aIds.indexOf(id) !== i))]
      if (aDups.length > 0)
        console.warn(`[Room ${room.id}] ⚠ POST-ASSIGN | ${player.name} ACTIVE dupes after assignQueuedClients: ${aDups.join(', ')} (q: ${beforeQ}→${player.state.clientQueue.length}, a: ${beforeA}→${aIds.length})`)
      updateServerLoads(player.state)
      processServerFailures(player.state)
      processHacks(player.state)
      computeHeat(player.state)
      computePower(player.state)
      calculateRevenue(player.state)
      calculateElectricityCost(player.state)
      calculateMaintenanceCost(player.state)
      calculateEmployeeCost(player.state)
      updateSatisfaction(player.state)
      processDepartures(player.state)
      generateTickets(player.state)
      autoResolveTickets(player.state)
      updateReputation(player.state)
      updateServerUptime(player.state)
      generateMissions(player.state)
      processMissionDeadlines(player.state)
      _applyAutoScalingBonus(player.state)
      _updateUptimeStreak(player.state)
    }

    // Compute and send deltas to that player
    const prev   = room._snapshots.get(socketId) ?? '{}'
    const deltas = computeDeltas(player.state, prev)
    room._snapshots.set(socketId, snapshot(player.state))

    if (player.connected && player.socket && Object.keys(deltas).length > 0) {
      player.socket.emit('delta_state', {
        personal: deltas,
        shared:   room.shared,
      })
    }
  }

  // ── 7. Broadcast updated meta ──────────────────────────────────────────────
  room.io?.to(room.id).emit('meta_updated', {
    allMeta: allMeta(room),
    shared:  room.shared,
  })

  // ── 8. Periodic auto-save (every 10 days) ─────────────────────────────────
  if (room.shared.day % 10 === 0) saveRoom(room)
}
