// index.js — DataCenter Tycoon Multiplayer Game Server
// Launch: node index.js (from the /server directory)

import { createServer }  from 'http'
import { Server }        from 'socket.io'
import express           from 'express'
import { nanoid }        from 'nanoid'
import { readFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { GameRoom }         from './GameRoom.js'
import { LobbyClient }      from './LobbyClient.js'
import { loadRoomSave, saveRoom, deleteSave } from './room/saveManager.js'

// ─── Config ───────────────────────────────────────────────────────────────────

const __dir        = dirname(fileURLToPath(import.meta.url))
const configPath   = join(__dir, 'server.config.json')
const examplePath  = join(__dir, 'config.example.json')

if (!existsSync(configPath)) {
  console.error(
    '[Server] server.config.json not found.\n' +
    '         Copy config.example.json → server.config.json and fill in your values.'
  )
  process.exit(1)
}

const CONFIG = JSON.parse(readFileSync(configPath, 'utf-8'))
const PORT          = CONFIG.port            ?? 3001
const MAX_ROOMS     = CONFIG.maxRooms        ?? 10
const MAX_PLAYERS   = CONFIG.maxPlayersPerRoom ?? 16
const IS_PRIVATE    = CONFIG.isPrivate       ?? false
const SERVER_PASS   = CONFIG.serverPassword  ?? ''
const LOBBY_URL     = CONFIG.lobbyUrl        ?? ''
const PUBLIC_URL    = CONFIG.publicUrl       ?? `http://localhost:${PORT}`

// ─── HTTP + Socket.io setup ───────────────────────────────────────────────────

const app    = express()
const http   = createServer(app)
const io     = new Server(http, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
})

app.use(express.json())

// Public server info endpoint (for direct connection without lobby)
app.get('/info', (req, res) => {
  res.json({
    name:              CONFIG.name,
    description:       CONFIG.description ?? '',
    imageUrl:          CONFIG.imageUrl    ?? '',
    isPrivate:         IS_PRIVATE,
    maxRooms:          MAX_ROOMS,
    maxPlayersPerRoom: MAX_PLAYERS,
    rooms:             [...rooms.values()].map(r => r.toLobbyMeta()),
  })
})

// Lobby-compatible endpoint: this server lists itself
app.get('/api/servers', (req, res) => {
  const playerCount = [...rooms.values()].reduce(
    (sum, r) => sum + [...r.players.values()].filter(p => p.connected).length, 0
  )
  res.json({
    servers: [{
      id:          'local',
      name:        CONFIG.name,
      description: CONFIG.description ?? '',
      imageUrl:    CONFIG.imageUrl    ?? '',
      isPrivate:   IS_PRIVATE,
      playerCount,
      roomCount:   rooms.size,
      maxRooms:    MAX_ROOMS,
      wsUrl:       PUBLIC_URL,
    }]
  })
})

// ─── Room registry ────────────────────────────────────────────────────────────

/** @type {Map<string, GameRoom>} roomId → GameRoom */
const rooms = new Map()

/** @type {Map<string, string>} inviteCode → roomId */
const inviteCodes = new Map()

function getRoomList() {
  return [...rooms.values()].map(r => r.toLobbyMeta())
}

const PRUNE_IDLE_MS = 24 * 60 * 60 * 1000   // 24 h

function pruneEmptyRooms() {
  for (const [id, room] of rooms) {
    if (room.isEmpty && Date.now() - room.createdAt > PRUNE_IDLE_MS) {
      room.stopTick()
      saveRoom(room)   // Persist before deletion
      inviteCodes.delete(room.inviteCode)
      rooms.delete(id)
      console.log(`[Server] Room "${room.name}" (${id}) pruned after 24h — state saved`)
    }
  }
}
setInterval(pruneEmptyRooms, 60_000)

// ─── Lobby registration ───────────────────────────────────────────────────────

const lobby = new LobbyClient(LOBBY_URL, {
  name:              CONFIG.name,
  description:       CONFIG.description ?? '',
  imageUrl:          CONFIG.imageUrl    ?? '',
  isPrivate:         IS_PRIVATE,
  maxRooms:          MAX_ROOMS,
  maxPlayersPerRoom: MAX_PLAYERS,
  publicUrl:         PUBLIC_URL,
})

lobby.register()

// Heartbeat: update lobby with current room list every 30s
setInterval(() => {
  lobby.sendHeartbeat(getRoomList())
}, 30_000)

// ─── Socket.io connection handler ────────────────────────────────────────────

io.on('connection', socket => {
  console.log(`[Server] Client connected: ${socket.id}`)

  let currentRoomId = null

  // ── Get server info & room list ────────────────────────────────────────────
  socket.on('get_server_info', (serverPassword, cb) => {
    if (IS_PRIVATE && serverPassword !== SERVER_PASS)
      return cb({ ok: false, error: 'Mot de passe serveur incorrect' })
    cb({
      ok:    true,
      name:  CONFIG.name,
      description: CONFIG.description ?? '',
      imageUrl: CONFIG.imageUrl ?? '',
      isPrivate: IS_PRIVATE,
      maxRooms: MAX_ROOMS,
      maxPlayersPerRoom: MAX_PLAYERS,
      rooms: getRoomList(),
    })
  })

  // ── Create room ────────────────────────────────────────────────────────────
  socket.on('create_room', ({ playerName, roomName, maxPlayers, roomPassword, serverPassword }, cb) => {
    cb = cb ?? (() => {})

    if (IS_PRIVATE && serverPassword !== SERVER_PASS)
      return cb({ ok: false, error: 'Mot de passe serveur incorrect' })
    if (!playerName?.trim())
      return cb({ ok: false, error: 'Nom de joueur requis' })
    if (!roomName?.trim())
      return cb({ ok: false, error: 'Nom de room requis' })
    if (rooms.size >= MAX_ROOMS)
      return cb({ ok: false, error: `Limite de ${MAX_ROOMS} rooms atteinte` })

    const room = new GameRoom({
      name:          roomName.trim(),
      password:      roomPassword || null,
      maxPlayers:    Math.min(maxPlayers || 4, MAX_PLAYERS),
      gameMasterId:  socket.id,
    })
    room.io = io

    // Restore from save if one exists for this room name
    const save = loadRoomSave(roomName.trim())
    if (save) {
      room._pendingSave = save
      Object.assign(room.shared, save.shared)
      console.log(`[Room ${room.id}] Restoring save for "${roomName}" (day ${save.shared?.day ?? '?'})`)
    }

    rooms.set(room.id, room)
    inviteCodes.set(room.inviteCode, room.id)

    const result = room.addPlayer(socket, playerName.trim(), roomPassword)
    if (!result.ok) {
      rooms.delete(room.id)
      inviteCodes.delete(room.inviteCode)
      return cb(result)
    }

    currentRoomId = room.id

    lobby.sendHeartbeat(getRoomList())
    console.log(`[Server] Room created: "${roomName}" (${room.id}) by "${playerName}"`)
    cb({ ok: true, roomId: room.id, inviteCode: room.inviteCode })
  })

  // ── Join room ──────────────────────────────────────────────────────────────
  socket.on('join_room', ({ playerName, roomId, inviteCode, roomPassword, reconnectToken }, cb) => {
    cb = cb ?? (() => {})

    if (!playerName?.trim())
      return cb({ ok: false, error: 'Nom de joueur requis' })

    // Resolve by invite code if provided
    const resolvedId = inviteCode
      ? inviteCodes.get(inviteCode.toUpperCase())
      : roomId

    const room = rooms.get(resolvedId)
    if (!room) return cb({ ok: false, error: 'Room introuvable' })

    // Try reconnect first
    if (room.reconnectPlayer(socket, playerName.trim(), reconnectToken ?? null)) {
      currentRoomId = room.id
      return cb({ ok: true, roomId: room.id, reconnected: true })
    }

    const result = room.addPlayer(socket, playerName.trim(), roomPassword)
    if (!result.ok) return cb(result)

    currentRoomId = room.id
    lobby.sendHeartbeat(getRoomList())
    cb({ ok: true, roomId: room.id })
  })

  // ── Leave room ─────────────────────────────────────────────────────────────
  socket.on('leave_room', (_, cb) => {
    cb = cb ?? (() => {})
    if (!currentRoomId) return cb({ ok: false, error: 'Pas dans une room' })
    const room = rooms.get(currentRoomId)
    room?.removePlayer(socket.id, false)
    currentRoomId = null
    lobby.sendHeartbeat(getRoomList())
    cb({ ok: true })
  })

  // ── Game actions ───────────────────────────────────────────────────────────
  socket.on('player_action', async ({ type, payload }, cb) => {
    cb = cb ?? (() => {})
    if (!currentRoomId) return cb({ ok: false, error: 'Pas dans une room' })
    const room = rooms.get(currentRoomId)
    if (!room)          return cb({ ok: false, error: 'Room introuvable' })
    const result = await room.processAction(socket.id, type, payload ?? {})
    cb(result)
  })

  // ── Chat ───────────────────────────────────────────────────────────────────
  socket.on('chat_message', ({ text }) => {
    if (!currentRoomId) return
    const room   = rooms.get(currentRoomId)
    const player = room?.players.get(socket.id)
    if (!player || !text?.trim()) return
    io.to(currentRoomId).emit('chat_message', {
      from: player.name,
      text: text.trim().slice(0, 200),
      day:  room.shared.day,
    })
  })

  // ── Disconnect ─────────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    if (currentRoomId) {
      const room = rooms.get(currentRoomId)
      room?.removePlayer(socket.id, true)  // mark disconnected, keep state
    }
    lobby.sendHeartbeat(getRoomList())
    console.log(`[Server] Client disconnected: ${socket.id}`)
  })
})

// ─── Start ────────────────────────────────────────────────────────────────────

http.listen(PORT, () => {
  console.log(`\n🖥️  DataCenter Tycoon Game Server`)
  console.log(`   Name    : ${CONFIG.name}`)
  console.log(`   Port    : ${PORT}`)
  console.log(`   Private : ${IS_PRIVATE ? 'Oui' : 'Non'}`)
  console.log(`   Max rooms: ${MAX_ROOMS} × ${MAX_PLAYERS} joueurs`)
  console.log(`   Lobby   : ${LOBBY_URL || '(aucun)'}`)
  console.log(`   URL     : ${PUBLIC_URL}\n`)
})

// ─── Graceful shutdown ────────────────────────────────────────────────────────

async function shutdown() {
  console.log('\n[Server] Shutting down...')
  for (const room of rooms.values()) room.stopTick()
  await lobby.unregister()
  process.exit(0)
}

process.on('SIGINT',  shutdown)
process.on('SIGTERM', shutdown)
