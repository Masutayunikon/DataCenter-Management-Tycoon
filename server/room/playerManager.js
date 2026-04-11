// playerManager.js — Player slot management for a GameRoom

import { createGameState } from '../../src/game/GameState.js'
import { snapshot, allMeta, playerMeta } from './stateSync.js'
import { saveRoom } from './saveManager.js'
import { nanoid } from 'nanoid'

// ─── Add player ───────────────────────────────────────────────────────────────

/** @returns {{ ok: boolean, error?: string }} */
export function addPlayer(room, socket, playerName, roomPassword) {
  if (room.password && roomPassword !== room.password)
    return { ok: false, error: 'Mot de passe incorrect' }
  if (room.players.size >= room.maxPlayers)
    return { ok: false, error: 'Room pleine' }
  if ([...room.players.values()].some(p => p.name === playerName))
    return { ok: false, error: 'Nom déjà pris' }

  // Restore individual state from a pending save if one exists for this room
  let savedPlayerState = null
  let savedToken        = null
  if (room._pendingSave) {
    const found = room._pendingSave.players?.find(p => p.name === playerName)
    if (found) {
      savedPlayerState = found.state
      savedToken       = found.reconnectToken ?? null
      console.log(`[Room ${room.id}] Restoring saved state for "${playerName}"`)
    }
  }

  /** @type {PlayerSlot} */
  const player = {
    id:             socket.id,
    name:           playerName,
    connected:      true,
    socket,
    state:          savedPlayerState ?? createGameState(),
    uptime30d:      1.0,
    reconnectToken: savedToken ?? nanoid(24),
  }

  // First player becomes game master
  if (room.players.size === 0) room.gameMasterId = socket.id

  room.players.set(socket.id, player)
  room._snapshots.set(socket.id, snapshot(player.state))

  // Send full state to the new player
  socket.join(room.id)
  socket.emit('full_state', {
    shared:         room.shared,
    playerState:    player.state,
    allMeta:        allMeta(room),
    reconnectToken: player.reconnectToken,
    room: {
      id:           room.id,
      name:         room.name,
      inviteCode:   room.inviteCode,
      gameMasterId: room.gameMasterId,
      maxPlayers:   room.maxPlayers,
    },
  })

  // Notify others
  socket.to(room.id).emit('player_joined', { player: playerMeta(player) })

  console.log(`[Room ${room.id}] "${playerName}" joined (${room.players.size}/${room.maxPlayers})`)
  return { ok: true }
}

// ─── Remove player ────────────────────────────────────────────────────────────

export function removePlayer(room, socketId, disconnect = false) {
  const player = room.players.get(socketId)
  if (!player) return

  if (disconnect) {
    player.connected = false
    player.socket    = null
    const anyConnected = [...room.players.values()].some(p => p.connected)
    if (!anyConnected) {
      room.stopTick()
      console.log(`[Room ${room.id}] All players disconnected — tick paused`)
    }
    room.io?.to(room.id).emit('player_disconnected', { playerId: socketId })
    console.log(`[Room ${room.id}] "${player.name}" disconnected`)
  } else {
    room.players.delete(socketId)
    room._snapshots.delete(socketId)
    room.io?.to(room.id).emit('player_left', { playerId: socketId })
    console.log(`[Room ${room.id}] "${player.name}" left`)

    // Reassign game master if needed
    if (room.gameMasterId === socketId) {
      const next = [...room.players.values()].find(p => p.connected)
      room.gameMasterId = next?.id ?? null
      if (room.gameMasterId)
        room.io?.to(room.id).emit('game_master_changed', { gameMasterId: room.gameMasterId })
    }

    if (room.players.size === 0) {
      room.stopTick()
      saveRoom(room)  // Persist state before room goes empty
    }
  }
}

// ─── Reconnect player ─────────────────────────────────────────────────────────

export function reconnectPlayer(room, socket, playerName, reconnectToken = null) {
  const player = [...room.players.values()].find(p => p.name === playerName && !p.connected)
  if (!player) return false

  // Token validation: if player has a token and client sent one, they must match
  if (player.reconnectToken && reconnectToken && player.reconnectToken !== reconnectToken) {
    console.log(`[Room ${room.id}] Token mismatch for "${playerName}" — reconnect denied`)
    return false
  }

  const oldId = player.id   // socket ID under which this player is currently stored

  player.connected = true
  player.socket    = socket
  player.id        = socket.id

  // Fix GM: if the disconnected player was game master, update to new socket ID
  if (room.gameMasterId === oldId) {
    room.gameMasterId = socket.id
  }

  // Remove the stale entry so the same player doesn't appear twice in the map
  room.players.delete(oldId)
  room.players.set(socket.id, player)

  // Migrate the snapshot so the delta system stays consistent
  const existingSnap = room._snapshots.get(oldId)
  if (existingSnap) {
    room._snapshots.set(socket.id, existingSnap)
    room._snapshots.delete(oldId)
  }

  socket.join(room.id)
  socket.emit('full_state', {
    shared:         room.shared,
    playerState:    player.state,
    allMeta:        allMeta(room),
    reconnectToken: player.reconnectToken,
    room: {
      id:           room.id,
      name:         room.name,
      inviteCode:   room.inviteCode,
      gameMasterId: room.gameMasterId,
      maxPlayers:   room.maxPlayers,
    },
  })

  // Restart tick if the room was paused while everyone was away
  if (!room._tickTimer && room.shared.started && room.shared.speed > 0) {
    room.startTick()
    console.log(`[Room ${room.id}] Tick resumed on reconnect`)
  }

  room.io?.to(room.id).emit('player_reconnected', { player: playerMeta(player) })
  console.log(`[Room ${room.id}] "${playerName}" reconnected`)
  return true
}

// ─── Lookup helper ────────────────────────────────────────────────────────────

export function getPlayerByName(room, name) {
  return [...room.players.values()].find(p => p.name === name)
}
