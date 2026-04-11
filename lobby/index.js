// lobby/index.js — DataCenter Tycoon Lobby API
// Hébergé avec le site du jeu. Lance: node index.js (depuis /lobby)

import express        from 'express'
import cors           from 'cors'
import { nanoid }     from 'nanoid'
import { existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dir = dirname(fileURLToPath(import.meta.url))
const app   = express()
const PORT  = process.env.PORT || 4000

app.use(cors())
app.use(express.json())

// Serve built frontend if public/ directory exists (Docker image)
const publicDir = join(__dir, 'public')
if (existsSync(publicDir)) {
  app.use(express.static(publicDir))
}

// ─── Server registry ──────────────────────────────────────────────────────────

/**
 * @type {Map<string, RegisteredServer>}
 * @typedef {Object} RegisteredServer
 * @property {string}   id
 * @property {string}   secret
 * @property {string}   name
 * @property {string}   description
 * @property {string}   imageUrl
 * @property {string}   wsUrl
 * @property {boolean}  isPrivate
 * @property {number}   maxRooms
 * @property {number}   maxPlayersPerRoom
 * @property {Array}    rooms
 * @property {number}   lastHeartbeat
 */
const servers = new Map()

const HEARTBEAT_TTL_MS = 90_000  // serveur considéré mort sans heartbeat depuis 90s

// Nettoyage périodique des serveurs morts
setInterval(() => {
  const now = Date.now()
  for (const [id, server] of servers) {
    if (now - server.lastHeartbeat > HEARTBEAT_TTL_MS) {
      servers.delete(id)
      console.log(`[Lobby] Server "${server.name}" (${id}) expired`)
    }
  }
}, 30_000)

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET /api/servers — liste tous les serveurs actifs (sans le secret)
app.get('/api/servers', (req, res) => {
  const list = [...servers.values()].map(s => ({
    id:                s.id,
    name:              s.name,
    description:       s.description,
    imageUrl:          s.imageUrl,
    isPrivate:         s.isPrivate,
    maxRooms:          s.maxRooms,
    maxPlayersPerRoom: s.maxPlayersPerRoom,
    wsUrl:             s.wsUrl,
    rooms:             s.rooms.map(r => ({
      id:          r.id,
      name:        r.name,
      playerCount: r.playerCount,
      maxPlayers:  r.maxPlayers,
      day:         r.day,
      hasPassword: r.hasPassword,
      inviteCode:  r.inviteCode,
    })),
    playerCount: s.rooms.reduce((n, r) => n + (r.playerCount ?? 0), 0),
    roomCount:   s.rooms.length,
    online:      true,
  }))
  res.json({ servers: list })
})

// GET /api/servers/:id — détail d'un serveur
app.get('/api/servers/:id', (req, res) => {
  const server = servers.get(req.params.id)
  if (!server) return res.status(404).json({ error: 'Serveur introuvable' })
  res.json({
    id:                server.id,
    name:              server.name,
    description:       server.description,
    imageUrl:          server.imageUrl,
    isPrivate:         server.isPrivate,
    maxRooms:          server.maxRooms,
    maxPlayersPerRoom: server.maxPlayersPerRoom,
    wsUrl:             server.wsUrl,
    rooms:             server.rooms,
    playerCount:       server.rooms.reduce((n, r) => n + (r.playerCount ?? 0), 0),
    online:            true,
  })
})

// POST /api/servers/register — enregistrement d'un nouveau serveur de jeu
app.post('/api/servers/register', (req, res) => {
  const {
    name, description, imageUrl,
    isPrivate, maxRooms, maxPlayersPerRoom, wsUrl,
  } = req.body

  if (!name?.trim())  return res.status(400).json({ error: 'name requis' })
  if (!wsUrl?.trim()) return res.status(400).json({ error: 'wsUrl requis' })

  // Éviter les doublons (même URL)
  const existing = [...servers.values()].find(s => s.wsUrl === wsUrl)
  if (existing) {
    // Ré-enregistrement — retourner le même secret
    existing.name             = name
    existing.description      = description ?? ''
    existing.imageUrl         = imageUrl    ?? ''
    existing.isPrivate        = isPrivate   ?? false
    existing.maxRooms         = maxRooms    ?? 10
    existing.maxPlayersPerRoom = maxPlayersPerRoom ?? 16
    existing.lastHeartbeat    = Date.now()
    return res.json({ id: existing.id, secret: existing.secret })
  }

  const id     = nanoid(12)
  const secret = nanoid(32)

  servers.set(id, {
    id, secret, name, wsUrl,
    description:       description      ?? '',
    imageUrl:          imageUrl         ?? '',
    isPrivate:         isPrivate        ?? false,
    maxRooms:          maxRooms         ?? 10,
    maxPlayersPerRoom: maxPlayersPerRoom ?? 16,
    rooms:             [],
    lastHeartbeat:     Date.now(),
  })

  console.log(`[Lobby] Server registered: "${name}" (${id}) @ ${wsUrl}`)
  res.json({ id, secret })
})

// PUT /api/servers/:id/heartbeat — mise à jour du serveur (rooms, joueurs)
app.put('/api/servers/:id/heartbeat', (req, res) => {
  const server = servers.get(req.params.id)
  if (!server) return res.status(404).json({ error: 'Serveur introuvable' })

  const secret = req.headers['x-server-secret']
  if (secret !== server.secret) return res.status(403).json({ error: 'Secret invalide' })

  server.rooms         = req.body.rooms ?? []
  server.lastHeartbeat = Date.now()
  res.json({ ok: true })
})

// DELETE /api/servers/:id — désenregistrement (shutdown propre)
app.delete('/api/servers/:id', (req, res) => {
  const server = servers.get(req.params.id)
  if (!server) return res.status(404).json({ error: 'Serveur introuvable' })

  const secret = req.headers['x-server-secret']
  if (secret !== server.secret) return res.status(403).json({ error: 'Secret invalide' })

  servers.delete(req.params.id)
  console.log(`[Lobby] Server "${server.name}" (${req.params.id}) unregistered`)
  res.json({ ok: true })
})

// ─── Health check ─────────────────────────────────────────────────────────────

app.get('/health', (req, res) => {
  res.json({ ok: true, servers: servers.size, uptime: process.uptime() })
})

// ─── SPA fallback (serves index.html for any non-API route) ──────────────────

if (existsSync(publicDir)) {
  app.get('*', (req, res) => {
    res.sendFile(join(publicDir, 'index.html'))
  })
}

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n🌐 DataCenter Tycoon Lobby API`)
  console.log(`   Port : ${PORT}`)
  console.log(`   GET  /api/servers`)
  console.log(`   POST /api/servers/register`)
  console.log(`   PUT  /api/servers/:id/heartbeat`)
  console.log(`   DEL  /api/servers/:id\n`)
})
