// ServerEngine.js — server load, failures, heat/power, repair, move, remove

import { SERVER_TYPES, createServer } from './GameState.js'
import { allGridCells, getFloor, getServerAt, addServerLog, serverLabel, clamp, findBestServer, serverFits } from './SimUtils.js'
import { addTicket, addTicketRaw, addNotification } from './TicketEngine.js'
import { getEventBonus, getEventMultiplier } from './EventSystem.js'

const AUTO_REPAIR_DAYS = 7
const AUTO_REPAIR_COST = 800

// ─── Step 3: Update server loads ──────────────────────────────────────────────

function updateServerLoads(state) {
  for (const cell of allGridCells(state)) {
    if (!cell.rack) continue
    for (const server of cell.rack.servers)
      if (server) { server.cpuLoad = 0; server.ramLoad = 0; server.diskLoad = 0 }
  }
  for (const client of state.clients) {
    if (client.isEnterprise && client.serverPositions?.length > 0) {
      const count = client.serverPositions.length
      for (const pos of client.serverPositions) {
        const server = getServerAt(state, pos.floorId, pos.x, pos.y, pos.slot)
        if (server) {
          server.cpuLoad  += Math.ceil(client.cpuDemand  / count)
          server.ramLoad  += Math.ceil(client.ramDemand  / count)
          server.diskLoad += Math.ceil(client.diskDemand / count)
        }
      }
    } else {
      if (!client.serverPos) continue
      const { floorId, x, y, slot } = client.serverPos
      const server = getServerAt(state, floorId, x, y, slot)
      if (server) {
        server.cpuLoad  += client.cpuDemand  ?? client.demand ?? 0
        server.ramLoad  += client.ramDemand  ?? 0
        server.diskLoad += client.diskDemand ?? 0
      }
    }
  }
}

// ─── Step 4: Server failures ──────────────────────────────────────────────────

function processServerFailures(state) {
  for (const cell of allGridCells(state)) {
    if (!cell.rack) continue
    for (let slot = 0; slot < cell.rack.servers.length; slot++) {
      const server = cell.rack.servers[slot]
      if (!server) continue

      if (server.status === 'repairing') {
        server.repairDaysLeft--
        if (server.repairDaysLeft <= 0) {
          server.status = 'ok'; server.health = 100
          server.failedDays = 0; server.restartAttempts = 0
          addServerLog(server, state.day, 'repair', 'Réparation terminée')
        }
        continue
      }

      if (server.status === 'failed') {
        server.failedDays++

        // Day 1: automatic restart attempt before waiting for expensive repair
        if (server.failedDays === 1) {
          server.restartAttempts = 0
          const lifetimeRestarts = server.lifetimeRestarts ?? 0
          const chance = Math.max(0.05, 0.80 - lifetimeRestarts * 0.15)
          server.restartAttempts++
          server.lifetimeRestarts = lifetimeRestarts + 1

          if (Math.random() < chance) {
            server.status        = 'ok'
            server.health        = Math.max(60, server.health)
            server.failedDays    = 0
            server.restartAttempts = 0
            addServerLog(server, state.day, 'repair', `Redémarrage auto réussi (${Math.round(chance * 100)}%)`)
            addNotification(state, `♻️ Redémarrage auto ${serverLabel(cell, slot)} réussi`, 'info')
          } else {
            addServerLog(server, state.day, 'warning', `Redémarrage auto échoué — réparation dans ${AUTO_REPAIR_DAYS - 1}j`)
            addTicket(state, 'incident',
              `⚠️ Redémarrage auto ${serverLabel(cell, slot)} échoué — réparation auto dans ${AUTO_REPAIR_DAYS - 1}j`,
              'warning', cell, slot)
          }
          continue
        }

        if (server.failedDays >= AUTO_REPAIR_DAYS) {
          // Insurance gives 50% rebate on auto-repair
          const insuranceDiscount = state.hasInsurance ? 0.5 : 1.0
          const autoRepairCost = Math.round(AUTO_REPAIR_COST * insuranceDiscount)
          state.money          -= autoRepairCost
          state.totalLost       = (state.totalLost ?? 0) + autoRepairCost
          server.status         = 'repairing'
          server.repairDaysLeft = 1
          server.restartAttempts = 0
          addServerLog(server, state.day, 'repair', `Réparation auto (-$${autoRepairCost}${state.hasInsurance ? ' avec assurance' : ''})`)
          addTicket(state, 'incident',
            `Réparation auto ${serverLabel(cell, slot)} (-$${autoRepairCost}${state.hasInsurance ? ' 🏦' : ''})`,
            'critical', cell, slot)
          // Suggest replacement after repeated failures
          if ((server.lifetimeRestarts ?? 0) >= 3) {
            addNotification(state,
              `🔧 ${serverLabel(cell, slot)} : pannes répétées (${server.lifetimeRestarts}×) — envisagez un remplacement`,
              'warning')
          }
        }
        continue
      }

      const cpuRatio   = server.cpuCapacity > 0 ? server.cpuLoad / server.cpuCapacity : 0
      const ramRatio   = server.ramCapacity > 0 ? server.ramLoad / server.ramCapacity : 0
      const diskRatio  = server.diskCapacity > 0 ? server.diskLoad / server.diskCapacity : 0
      const heatFactor = server.temperature > 70 ? (server.temperature - 70) / 150 : 0

      // Small extra failure chance when any resource is at ≥95% capacity (not punitive, just realistic)
      const highLoadResources = [cpuRatio, ramRatio, diskRatio].filter(r => r >= 0.95).length
      const highLoadBonus = highLoadResources * 0.015

      server.health = clamp(0, 100, server.health - heatFactor * 5)

      const warnThreshold = state.unlockedSkills?.includes('MONITORING') ? 70 : 60
      if (server.status === 'ok' && server.health < warnThreshold) {
        server.status = 'warning'
        addServerLog(server, state.day, 'warning', `Santé dégradée: ${Math.round(server.health)}%`)
        addTicket(state, 'temperature',
          `Avertissement ${serverLabel(cell, slot)}: santé ${Math.round(server.health)}%`,
          'warning', cell, slot)
      }

      const failureChance = (1 - server.reliability) * (1 + heatFactor * 2) * 0.5 + highLoadBonus
      if (Math.random() < failureChance) {
        if (server.status === 'warning') {
          server.status = 'failed'; server.failedDays = 0
          addServerLog(server, state.day, 'failure', 'Serveur tombé en panne')
          const kicked = evictClientsFromServer(state, cell.floorId, cell.x, cell.y, slot)
          addTicket(state, 'incident',
            `Panne ${serverLabel(cell, slot)} — ${kicked} client(s) déplacé(s)`,
            'critical', cell, slot)
        } else if (server.status === 'ok') {
          server.status = 'warning'; server.health = Math.min(server.health, 55)
          addServerLog(server, state.day, 'warning', 'Instabilité détectée')
        }
      }
    }
  }
}

function evictClientsFromServer(state, floorId, x, y, slot) {
  let count = 0
  const remaining = []
  for (const client of state.clients) {
    if (client.isEnterprise) {
      const onServer = client.serverPositions?.some(
        p => p.floorId === floorId && p.x === x && p.y === y && p.slot === slot
      )
      if (onServer) {
        client.serverPositions  = []
        client.pendingPositions = []
        client.daysInQueue      = 0
        state.clientQueue.push(client)
        count++
      } else {
        remaining.push(client)
      }
    } else {
      if (client.serverPos?.floorId === floorId && client.serverPos?.x === x &&
          client.serverPos?.y === y && client.serverPos?.slot === slot) {
        client.serverPos   = null
        client.daysInQueue = 0
        state.clientQueue.push(client)
        count++
      } else {
        remaining.push(client)
      }
    }
  }
  state.clients = remaining
  return count
}

// ─── Step 5: Heat ─────────────────────────────────────────────────────────────

function computeHeat(state) {
  let totalHeat = 0, rackCount = 0
  for (const cell of allGridCells(state)) {
    if (!cell.rack) continue
    const rack        = cell.rack
    const serverCount = rack.servers.filter(s => s !== null).length
    if (serverCount === 0) continue
    const densityMultiplier = 1 + serverCount * 0.05
    for (const server of rack.servers) {
      if (!server) continue
      const loadRatio    = server.cpuCapacity > 0 ? server.cpuLoad / server.cpuCapacity : 0
      const heatBonus    = getEventBonus(state, 'heatBonus')
      const coolAdv      = state.unlockedSkills?.includes('COOLING_ADV') ? 0.85 : 1.0
      server.temperature = Math.round((20 + 60 * loadRatio * densityMultiplier + heatBonus) * coolAdv)
    }
    const rackHeat = rack.servers.filter(s => s).reduce((sum, s) => sum + s.temperature, 0) / serverCount
    totalHeat += rackHeat; rackCount++
  }
  state.heat = rackCount > 0 ? Math.round(totalHeat / rackCount) : 0
}

// ─── Step 6: Power ────────────────────────────────────────────────────────────

function computePower(state) {
  let total = 0
  for (const cell of allGridCells(state)) {
    if (!cell.rack) continue
    for (const server of cell.rack.servers) {
      if (!server || server.status === 'failed') continue
      const basePower   = SERVER_TYPES[server.type]?.powerBase ?? 80
      const loadRatio   = server.cpuCapacity > 0 ? server.cpuLoad / server.cpuCapacity : 0
      const heatFactor  = server.temperature > 60 ? (server.temperature - 60) / 200 : 0
      server.powerUsage = Math.round(basePower * (0.3 + 0.7 * loadRatio) * (1 + heatFactor))
      total += server.powerUsage
    }
  }
  state.power = total
}

// ─── Uptime ───────────────────────────────────────────────────────────────────

function updateServerUptime(state) {
  for (const cell of allGridCells(state)) {
    if (!cell.rack) continue
    for (const server of cell.rack.servers)
      if (server && server.status === 'ok') server.uptime++
  }
}

// ─── Repair (paid) ────────────────────────────────────────────────────────────

function repairServer(state, floorId, x, y, slot, fast = false) {
  const server = getServerAt(state, floorId, x, y, slot)
  if (!server) return { success: false, message: 'Serveur introuvable' }
  if (server.status === 'ok') return { success: false, message: 'Déjà opérationnel' }
  if (server.status === 'repairing') return { success: false, message: 'Réparation déjà en cours' }
  const costMultiplier = getEventMultiplier(state, 'repairCostMultiplier')
  const cost = Math.round((fast ? 400 : 200) * costMultiplier)
  const days = fast ? 1 : 3
  if (state.money < cost) return { success: false, message: `Fonds insuffisants ($${cost} requis)` }
  state.money -= cost; server.status = 'repairing'
  server.repairDaysLeft = days; server.restartAttempts = 0
  addServerLog(server, state.day, 'repair', `Réparation lancée (${days}j, -$${cost})`)
  return { success: true, message: `Réparation lancée — ${days} jour(s), -$${cost}` }
}

// ─── Restart (free, 1 attempt per failure, chance degrades with lifetimeRestarts) ─

function restartServer(state, floorId, x, y, slot) {
  const server = getServerAt(state, floorId, x, y, slot)
  if (!server) return { success: false, message: 'Serveur introuvable' }
  if (server.status === 'ok') return { success: false, message: 'Déjà opérationnel' }
  if (server.status === 'repairing') return { success: false, message: 'Réparation déjà en cours' }
  if (server.restartAttempts >= 1)
    return { success: false, message: 'Redémarrage déjà tenté — réparation payante requise' }

  // Chance degrades with lifetime restart history (5% floor)
  const lifetimeRestarts = server.lifetimeRestarts ?? 0
  const chance = Math.max(0.05, 0.80 - lifetimeRestarts * 0.15)
  server.restartAttempts++
  server.lifetimeRestarts = lifetimeRestarts + 1

  if (Math.random() < chance) {
    server.status = 'ok'; server.health = Math.max(60, server.health)
    server.failedDays = 0; server.restartAttempts = 0
    addServerLog(server, state.day, 'repair', `Redémarrage réussi (${Math.round(chance * 100)}%)`)
    return { success: true, message: `Redémarrage réussi ! (${Math.round(chance * 100)}% de chance)` }
  } else {
    addServerLog(server, state.day, 'warning', `Redémarrage échoué — réparation payante requise`)
    const nextChance = Math.max(0.05, 0.80 - server.lifetimeRestarts * 0.15)
    return {
      success: false,
      message: `Échec (${Math.round(chance * 100)}%) — prochain redémarrage: ${Math.round(nextChance * 100)}% — réparation: $200 / $400 urgent`,
    }
  }
}

// ─── Move client ──────────────────────────────────────────────────────────────

function moveClient(state, clientId, targetPos) {
  const client = state.clients.find(c => c.id === clientId)
  if (!client) return false
  const targetServer = getServerAt(state, targetPos.floorId, targetPos.x, targetPos.y, targetPos.slot)
  if (!targetServer) return false
  if (targetServer.status === 'failed' || targetServer.status === 'repairing') return false
  const originalPos = client.serverPos
  client.serverPos  = null
  const fits = serverFits(targetServer, state, targetPos.floorId, targetPos.x, targetPos.y, targetPos.slot, client)
  client.serverPos  = originalPos
  if (!fits) return false
  client.serverPos = { floorId: targetPos.floorId, x: targetPos.x, y: targetPos.y, slot: targetPos.slot }
  updateServerLoads(state)
  return true
}

// ─── Move all clients from a slot ─────────────────────────────────────────────

function moveAllClients(state, floorId, x, y, slot) {
  const onServer = state.clients.filter(c =>
    c.serverPos?.floorId === floorId && c.serverPos?.x === x &&
    c.serverPos?.y === y && c.serverPos?.slot === slot
  )
  if (onServer.length === 0) return { moved: 0, queued: 0 }
  let moved = 0, queued = 0
  for (const client of onServer) {
    client.serverPos = null
    const best = findBestServer(state, client.cpuDemand, client.serviceId)
    if (best) {
      client.serverPos = { floorId: best.floorId, x: best.x, y: best.y, slot: best.slot }
      moved++
    } else {
      client.daysInQueue = 0
      state.clients = state.clients.filter(c => c.id !== client.id)
      state.clientQueue.push(client)
      queued++
    }
  }
  updateServerLoads(state)
  return { moved, queued }
}

// ─── Remove server ────────────────────────────────────────────────────────────

function removeServer(state, floorId, x, y, slot) {
  const floor = getFloor(state, floorId)
  const cell  = floor?.grid[y]?.[x]
  if (!cell?.rack) return { success: false, message: 'Rack introuvable' }
  const server = cell.rack.servers[slot]
  if (!server)   return { success: false, message: 'Slot déjà vide' }

  const onServer = state.clients.filter(c =>
    c.serverPos?.floorId === floorId && c.serverPos?.x === x &&
    c.serverPos?.y === y && c.serverPos?.slot === slot
  )
  for (const client of onServer) {
    client.serverPos   = null
    client.daysInQueue = 0
    state.clientQueue.push(client)
  }
  state.clients = state.clients.filter(c =>
    !(c.serverPos?.floorId === floorId && c.serverPos?.x === x &&
      c.serverPos?.y === y && c.serverPos?.slot === slot)
  )

  const refund = Math.round((SERVER_TYPES[server.type]?.cost ?? 0) * 0.3)
  state.money += refund
  cell.rack.servers[slot] = null
  return { success: true, message: `Serveur retiré — remboursement $${refund}`, evicted: onServer.length }
}

// ─── Step 4b: Hack attempts ───────────────────────────────────────────────────

const BASE_HACK_CHANCE = 0.005  // 0.5% per server per day before protection

function getHackProtection(state) {
  // Skill-based protection (stacking levels, max 80%)
  let skillProtection = 0
  if      (state.unlockedSkills?.includes('SECURITY_LVL4')) skillProtection = 0.80
  else if (state.unlockedSkills?.includes('SECURITY_LVL3')) skillProtection = 0.60
  else if (state.unlockedSkills?.includes('SECURITY_LVL2')) skillProtection = 0.40
  else if (state.unlockedSkills?.includes('SECURITY_LVL1')) skillProtection = 0.20
  // Employee-based bonus (+5% each, max +15%)
  const empProtection = Math.min(0.15, (state.employees?.security ?? 0) * 0.05)
  return Math.min(0.95, skillProtection + empProtection)
}

function processHacks(state) {
  const protection = getHackProtection(state)
  const hackChance = BASE_HACK_CHANCE * (1 - protection)
  if (hackChance <= 0) return

  for (const cell of allGridCells(state)) {
    if (!cell.rack) continue
    for (let slot = 0; slot < cell.rack.servers.length; slot++) {
      const server = cell.rack.servers[slot]
      if (!server || server.status !== 'ok') continue
      if (Math.random() > hackChance) continue

      // Hack! Server goes down
      server.status    = 'failed'
      server.failedDays = 0
      server.health    = Math.max(20, server.health - 30)
      addServerLog(server, state.day, 'failure', '🔴 Serveur compromis par un hack !')

      // Clients on this server lose satisfaction
      for (const client of state.clients) {
        const positions = client.isEnterprise
          ? (client.serverPositions ?? [])
          : (client.serverPos ? [client.serverPos] : [])
        const affected = positions.some(
          p => p.floorId === cell.floorId && p.x === cell.x && p.y === cell.y && p.slot === slot
        )
        if (affected) client.satisfaction = clamp(0, 100, client.satisfaction - 25)
      }

      const label = serverLabel(cell, slot)
      addTicket(state, 'incident',
        `🔴 Hack détecté — ${label} compromis ! Réparez immédiatement.`,
        'critical', cell, slot)
      addNotification(state,
        `🔴 Hack sur ${label} — serveur hors ligne, clients impactés`,
        'critical')

      // Evict clients (they go back to queue)
      evictClientsFromServer(state, cell.floorId, cell.x, cell.y, slot)
    }
  }
}

// ─── Hardware aging ───────────────────────────────────────────────────────────

function updateServerAge(state) {
  for (const cell of allGridCells(state)) {
    if (!cell.rack) continue
    for (let slot = 0; slot < cell.rack.servers.length; slot++) {
      const server = cell.rack.servers[slot]
      if (!server) continue
      server.age = (server.age ?? 0) + 1

      // After 300 days: gradual reliability degradation
      if (server.age > 300) {
        const degradation = Math.min(0.005 * Math.floor((server.age - 300) / 30), 0.15)
        const baseDef     = SERVER_TYPES[server.type]
        const baseRel     = baseDef?.reliability ?? 0.98
        server.reliability = Math.max(0.5, baseRel - degradation)
      }

      // After 600 days: mark for maintenance surcharge
      server.maintenanceSurcharge = server.age > 600
    }
  }
}

// ─── Hardware generation notifications ───────────────────────────────────────
// Fires once per in-game year to remind player that new-gen hardware is available

function emitGenerationNotification(state) {
  if (!state.day || state.day % 365 !== 0) return
  const currentYear = Math.floor(state.day / 365)
  const displayYear = 2025 + currentYear
  addNotification(state,
    `📦 Génération ${displayYear} disponible — renouvelez vos serveurs (Gen${displayYear} ~${currentYear * 10}% plus performants)`,
    'info')
}

// ─── Renew server ─────────────────────────────────────────────────────────────

function renewServer(state, floorId, x, y, slot) {
  const floor = getFloor(state, floorId)
  const cell  = floor?.grid[y]?.[x]
  if (!cell?.rack) return { success: false, message: 'Rack introuvable' }
  const server = cell.rack.servers[slot]
  if (!server)    return { success: false, message: 'Slot vide' }

  const currentYear = Math.floor(state.day / 365)
  if ((server.generation ?? 0) >= currentYear)
    return { success: false, message: 'Serveur déjà à jour' }
  if (server.status === 'repairing')
    return { success: false, message: 'Réparation en cours' }

  const def = SERVER_TYPES[server.type]
  if (!def) return { success: false, message: 'Type inconnu' }
  if (state.money < def.cost) return { success: false, message: `Fonds insuffisants ($${def.cost} requis)` }

  state.money -= def.cost

  const displayYear = 2025 + currentYear
  const hasLiveMigration = state.unlockedSkills?.includes('LIVE_MIGRATION')

  if (hasLiveMigration) {
    // Swap à chaud : les clients gardent leur serverPos (même slot), les loads
    // sont recalculés automatiquement chaque tick par updateServerLoads
    cell.rack.servers[slot] = createServer(server.type, currentYear)
    addNotification(state,
      `🔄 Serveur renouvelé → Gen${displayYear} — migration à chaud réussie, aucune interruption`,
      'info')
  } else {
    // Sans skill : les clients partent en file d'attente
    const evictedIds = new Set()
    const onServer   = state.clients.filter(c =>
      c.serverPos?.floorId === floorId && c.serverPos?.x === x &&
      c.serverPos?.y === y && c.serverPos?.slot === slot
    )
    for (const client of onServer) {
      client.serverPos   = null
      client.daysInQueue = 0
      evictedIds.add(client.id)
      state.clientQueue.push(client)
    }
    state.clients = state.clients.filter(c => !evictedIds.has(c.id))

    cell.rack.servers[slot] = createServer(server.type, currentYear)
    const evicted = onServer.length
    addNotification(state,
      evicted > 0
        ? `🔄 Serveur renouvelé → Gen${displayYear} — ${evicted} client(s) remis en file d'attente`
        : `🔄 Serveur renouvelé → Gen${displayYear}`,
      'info')
  }

  return { success: true }
}

// ─── Sell server ──────────────────────────────────────────────────────────────

function sellServer(state, floorId, x, y, slot) {
  const floor = getFloor(state, floorId)
  if (!floor) return { success: false, message: 'Floor introuvable' }
  const cell  = floor.grid?.[y]?.[x]
  if (!cell?.rack) return { success: false, message: 'Pas de rack ici' }
  const server = cell.rack.servers[slot]
  if (!server) return { success: false, message: 'Slot vide' }

  // Check no clients hosted on this server
  const hasClients = state.clients.some(c => {
    if (c.isEnterprise) return c.serverPositions?.some(p => p.floorId === floorId && p.x === x && p.y === y && p.slot === slot)
    return c.serverPos && c.serverPos.floorId === floorId && c.serverPos.x === x && c.serverPos.y === y && c.serverPos.slot === slot
  })
  if (hasClients) return { success: false, message: 'Des clients utilisent ce serveur' }

  const baseDef  = SERVER_TYPES[server.type]
  const baseCost = baseDef?.cost ?? 500
  const age      = server.age ?? 0
  const ageFactor = age < 100 ? 0.5 : age < 300 ? 0.4 : 0.3
  const sellPrice = Math.round(baseCost * ageFactor)

  cell.rack.servers[slot] = null
  state.money += sellPrice

  const label = serverLabel(cell, slot)
  addNotification(state, `💰 Serveur ${label} vendu pour $${sellPrice}`, 'info')
  return { success: true, sellPrice }
}

export {
  updateServerLoads, processServerFailures, evictClientsFromServer,
  computeHeat, computePower, updateServerUptime,
  repairServer, restartServer, moveClient, moveAllClients, removeServer,
  processHacks, getHackProtection, BASE_HACK_CHANCE,
  AUTO_REPAIR_DAYS, AUTO_REPAIR_COST,
  updateServerAge, sellServer,
  emitGenerationNotification, renewServer,
}
