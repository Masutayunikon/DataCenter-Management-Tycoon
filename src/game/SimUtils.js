// SimUtils.js — shared helpers (no side effects)

import { COLUMNS, SERVICES, SERVER_TYPES } from './GameState.js'

const MAX_SERVER_LOGS = 10

// ─── Date helpers ─────────────────────────────────────────────────────────────

const GAME_START_DATE = new Date(2025, 0, 1) // 1 Jan 2025

function formatGameDate(day) {
  const d = new Date(GAME_START_DATE.getTime())
  d.setDate(d.getDate() + day)
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit' })
}

function clamp(min, max, val) {
  return Math.min(max, Math.max(min, val))
}

function allGridCells(state) {
  const cells = []
  for (const floor of state.floors)
    for (const row of floor.grid)
      for (const cell of row) cells.push(cell)
  return cells
}

function getFloor(state, floorId) {
  return state.floors.find(f => f.id === floorId)
}

function getServerAt(state, floorId, x, y, slot) {
  const floor = getFloor(state, floorId)
  return floor?.grid[y]?.[x]?.rack?.servers?.[slot] ?? null
}

function getClientServer(state, client) {
  if (!client.serverPos) return null
  const { floorId, x, y, slot } = client.serverPos
  return getServerAt(state, floorId, x, y, slot)
}

function getTotalServerCapacity(state) {
  let total = 0
  for (const cell of allGridCells(state)) {
    if (!cell.rack) continue
    for (const server of cell.rack.servers)
      if (server && server.status !== 'failed') total += server.cpuCapacity
  }
  return total
}

function addServerLog(server, day, type, message) {
  server.logs.push({ day, type, message })
  if (server.logs.length > MAX_SERVER_LOGS) server.logs.shift()
}

function serverLabel(cell, slot) {
  return `${COLUMNS[cell.x]}${cell.y}-F${cell.floorId}:${slot}`
}

function getServerLoad(state, floorId, x, y, slot) {
  return state.clients
    .filter(c => c.serverPos?.floorId === floorId && c.serverPos?.x === x &&
                 c.serverPos?.y === y && c.serverPos?.slot === slot)
    .reduce((sum, c) => sum + (c.cpuDemand ?? 0), 0)
}

function serverFits(server, state, floorId, x, y, slot, client) {
  const clients  = state.clients.filter(c =>
    c.serverPos?.floorId === floorId && c.serverPos?.x === x &&
    c.serverPos?.y === y && c.serverPos?.slot === slot
  )
  const usedCpu  = clients.reduce((s, c) => s + (c.cpuDemand  ?? 0), 0)
  const usedRam  = clients.reduce((s, c) => s + (c.ramDemand  ?? 0), 0)
  const usedDisk = clients.reduce((s, c) => s + (c.diskDemand ?? 0), 0)
  return (
    usedCpu  + (client.cpuDemand  ?? 0) <= server.cpuCapacity &&
    usedRam  + (client.ramDemand  ?? 0)                 <= server.ramCapacity  &&
    usedDisk + (client.diskDemand ?? 0)                 <= server.diskCapacity
  )
}

function findBestServer(state, demand, serviceId = null, client = null) {
  const compatibleTypes = serviceId ? (SERVICES[serviceId]?.serverTypes ?? null) : null
  const c = client ?? { cpuDemand: demand, ramDemand: 0, diskDemand: 0 }
  let best = null, bestLoad = Infinity

  for (const cell of allGridCells(state)) {
    if (!cell.rack || cell.locked) continue
    for (let slot = 0; slot < cell.rack.servers.length; slot++) {
      const server = cell.rack.servers[slot]
      if (!server || server.status === 'failed' || server.status === 'repairing') continue
      if (compatibleTypes && !compatibleTypes.includes(server.type)) continue
      if (!serverFits(server, state, cell.floorId, cell.x, cell.y, slot, c)) continue
      const load = getServerLoad(state, cell.floorId, cell.x, cell.y, slot)
      if (load < bestLoad) {
        bestLoad = load
        best = { floorId: cell.floorId, x: cell.x, y: cell.y, slot }
      }
    }
  }
  return best
}

function getCompatibleServers(state, clientId) {
  const client = state.clients.find(c => c.id === clientId)
  if (!client) return []
  const compatibleTypes = SERVICES[client.serviceId]?.serverTypes ?? null
  const result = []

  for (const cell of allGridCells(state)) {
    if (!cell.rack) continue
    for (let slot = 0; slot < cell.rack.servers.length; slot++) {
      const server = cell.rack.servers[slot]
      if (!server || server.status === 'failed' || server.status === 'repairing') continue
      if (compatibleTypes && !compatibleTypes.includes(server.type)) continue
      if (client.serverPos?.floorId === cell.floorId && client.serverPos?.x === cell.x &&
          client.serverPos?.y === cell.y && client.serverPos?.slot === slot) continue
      const origPos    = client.serverPos
      client.serverPos = null
      const fits = serverFits(server, state, cell.floorId, cell.x, cell.y, slot, client)
      client.serverPos = origPos
      if (!fits) continue
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
  clamp, allGridCells, getFloor, getServerAt, getClientServer, getTotalServerCapacity,
  addServerLog, serverLabel, getServerLoad, serverFits, findBestServer, getCompatibleServers,
  MAX_SERVER_LOGS, formatGameDate,
}
// Thu Apr 16 19:11:21     2026
