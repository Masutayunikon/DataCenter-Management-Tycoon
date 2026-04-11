// stateSync.js — Snapshot, delta computation, and broadcast helpers

// ─── Tracked keys for delta calculation ──────────────────────────────────────

export const TRACKED_KEYS = [
  'money', 'day', 'reputation', 'power', 'heat', 'skillPoints',
  'revenue', 'electricityCost', 'maintenanceCost', 'employeeCost',
  'clients', 'clientQueue', 'tickets', 'notifications', 'activeEvents',
  'floors', 'employees', 'serviceSlots', 'servicePrices',
  'unlockedSkills', 'missions',
  'serviceModes', 'serviceTemplates',
]

// ─── Snapshot ─────────────────────────────────────────────────────────────────

export function snapshot(state) {
  const snap = {}
  for (const k of TRACKED_KEYS) snap[k] = state[k]
  return JSON.stringify(snap)
}

// ─── Delta computation ────────────────────────────────────────────────────────

export function computeDeltas(state, prevSnapStr) {
  let prev = {}
  try { prev = JSON.parse(prevSnapStr) } catch (_) {}
  const deltas = {}
  for (const k of TRACKED_KEYS) {
    const curr = JSON.stringify(state[k])
    const old  = JSON.stringify(prev[k])
    if (curr !== old) deltas[k] = state[k]
  }
  return deltas
}

// ─── Meta helpers ─────────────────────────────────────────────────────────────

export function playerMeta(player) {
  const state = player.state
  const activeServices = Object.entries(state.serviceSlots ?? {})
    .filter(([, v]) => v > 0).map(([k]) => k)
  const isSpecialist = activeServices.length === 1 ? activeServices[0] : null

  return {
    id:               player.id,
    name:             player.name,
    connected:        player.connected,
    reputation:       Math.round(state.reputation ?? 0),
    money:            Math.round(state.money ?? 0),
    clientCount:      (state.clients ?? []).length,
    revenue:          Math.round(state.revenue ?? 0),
    uptime30d:        Math.round((player.uptime30d ?? 1) * 100),
    servicePrices:    state.servicePrices ?? {},
    serviceSlots:     state.serviceSlots ?? {},
    serviceModes:     state.serviceModes ?? {},
    serviceTemplates: state.serviceTemplates ?? {},
    isSpecialist,
  }
}

export function allMeta(room) {
  return [...room.players.values()].map(playerMeta)
}

// ─── Broadcast helpers ────────────────────────────────────────────────────────

export function broadcastFullState(room) {
  for (const [, player] of room.players) {
    if (!player.connected || !player.socket) continue
    player.socket.emit('full_state', {
      shared:      room.shared,
      playerState: player.state,
      allMeta:     allMeta(room),
      room: {
        id:           room.id,
        name:         room.name,
        inviteCode:   room.inviteCode,
        gameMasterId: room.gameMasterId,
        maxPlayers:   room.maxPlayers,
      },
    })
  }
}

export function pushPlayerDelta(room, socketId) {
  const player = room.players.get(socketId)
  if (!player?.connected || !player.socket) return
  const prev   = room._snapshots.get(socketId) ?? '{}'
  const deltas = computeDeltas(player.state, prev)
  room._snapshots.set(socketId, snapshot(player.state))
  if (Object.keys(deltas).length > 0) {
    player.socket.emit('delta_state', { personal: deltas, shared: room.shared })
  }
}

// ─── State export / import ────────────────────────────────────────────────────

export function exportState(room) {
  const players = []
  for (const [id, player] of room.players) {
    players.push({ id, name: player.name, state: player.state, reconnectToken: player.reconnectToken ?? null })
  }
  return { shared: room.shared, players, exportedAt: Date.now() }
}

export function importState(room, savedState) {
  if (savedState.shared) Object.assign(room.shared, savedState.shared)
  for (const saved of savedState.players ?? []) {
    const player = room.getPlayerByName(saved.name)
    if (player) {
      player.state = saved.state
      room._snapshots.set(player.id, snapshot(player.state))
    }
  }
}
