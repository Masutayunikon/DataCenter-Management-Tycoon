// GameRoom.js — Multiplayer game room: thin façade, delegates to room/* modules

import { nanoid }        from 'nanoid'
import { getMarketWeights } from './ClientPool.js'

import { addPlayer, removePlayer, reconnectPlayer, getPlayerByName } from './room/playerManager.js'
import { startTick, stopTick, setSpeed, executeTick }                from './room/tickLoop.js'
import { processAction }                                              from './room/actionHandler.js'
import {
  snapshot, allMeta,
  broadcastFullState, pushPlayerDelta,
  exportState, importState,
} from './room/stateSync.js'

// ─── GameRoom class ───────────────────────────────────────────────────────────

export class GameRoom {
  constructor({ name, password, maxPlayers, gameMasterId }) {
    this.id           = nanoid(8)
    this.inviteCode   = nanoid(6).toUpperCase()
    this.name         = name
    this.password     = password || null
    this.maxPlayers   = Math.min(maxPlayers || 4, 16)
    this.gameMasterId = gameMasterId
    this.createdAt    = Date.now()

    /** @type {Map<string, PlayerSlot>} socketId → player */
    this.players  = new Map()

    // Shared room state (time, events, market, tenders)
    this.shared = {
      day:            1,
      month:          1,
      year:           1,
      speed:          1,
      started:        false,
      activeEvents:   [],
      eventHistory:   [],
      marketWeights:  getMarketWeights(1),
      marketActivity: 1.0,
      lastPoolCount:  0,
      tenders:        [],
      // Stub fields required by EventSystem callbacks
      clients:        [],
      clientQueue:    [],
      reputation:     60,
      money:          100_000,
      floors:         [],
      unlockedSkills: [],
      serviceSlots:   {},
    }

    // Internal
    this._tickTimer    = null
    this._tickMs       = 0
    this._snapshots    = new Map()   // socketId → snapshot string
    this._pendingPool  = []          // pool clients waiting for distribution
    this._nextTenderDay = 20

    // Set from index.js after creation
    this.io = null
  }

  // ─── Lobby metadata ─────────────────────────────────────────────────────────

  toLobbyMeta() {
    return {
      id:          this.id,
      name:        this.name,
      playerCount: this.players.size,
      maxPlayers:  this.maxPlayers,
      day:         this.shared.day,
      hasPassword: !!this.password,
      inviteCode:  this.inviteCode,
    }
  }

  get isEmpty() {
    return [...this.players.values()].every(p => !p.connected)
  }

  // ─── Player management ──────────────────────────────────────────────────────

  addPlayer(socket, playerName, roomPassword) {
    return addPlayer(this, socket, playerName, roomPassword)
  }

  removePlayer(socketId, disconnect = false) {
    return removePlayer(this, socketId, disconnect)
  }

  reconnectPlayer(socket, playerName, reconnectToken = null) {
    return reconnectPlayer(this, socket, playerName, reconnectToken)
  }

  getPlayerByName(name) {
    return getPlayerByName(this, name)
  }

  // ─── Tick control ────────────────────────────────────────────────────────────

  startTick()             { startTick(this) }
  stopTick()              { stopTick(this) }
  setSpeed(speed, reqId)  { setSpeed(this, speed, reqId) }
  _tick()                 { executeTick(this) }

  // ─── Player actions ──────────────────────────────────────────────────────────

  async processAction(socketId, type, payload) {
    return processAction(this, socketId, type, payload)
  }

  // ─── State sync helpers ──────────────────────────────────────────────────────

  _allMeta()              { return allMeta(this) }
  _broadcastFullState()   { broadcastFullState(this) }
  _pushPlayerDelta(id)    { pushPlayerDelta(this, id) }
  _exportState()          { return exportState(this) }
  _importState(saved)     { importState(this, saved) }
}
