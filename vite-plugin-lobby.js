// vite-plugin-lobby.js
// Injects an in-memory lobby API directly into Vite's dev server.
//
// Endpoints (all under /api/lobby — so they don't clash with game servers):
//   GET    /api/servers              → list registered servers  (LobbyScreen)
//   POST   /api/servers/register     → game server registers itself
//   PUT    /api/servers/:id/heartbeat → game server updates room list
//   DELETE /api/servers/:id          → game server unregisters

import { randomBytes } from 'crypto'

function nanoid(size = 21) {
  return randomBytes(size).toString('base64url').slice(0, size)
}

const SERVER_TTL_MS = 90_000  // remove server if no heartbeat for 90 s

export function lobbyPlugin() {
  /** @type {Map<string, object>} id → serverEntry */
  const servers  = new Map()
  const secrets  = new Map()  // id → secret

  function pruneStale() {
    const now = Date.now()
    for (const [id, srv] of servers) {
      if (now - srv.lastSeen > SERVER_TTL_MS) {
        servers.delete(id)
        secrets.delete(id)
        console.log(`[Lobby] Server "${srv.name}" (${id}) expired`)
      }
    }
  }

  return {
    name: 'vite-lobby',
    configureServer(viteServer) {
      const { middlewares } = viteServer

      // Parse JSON body manually (no express here)
      function readJson(req) {
        return new Promise((resolve, reject) => {
          let body = ''
          req.on('data', c => body += c)
          req.on('end', () => {
            try { resolve(body ? JSON.parse(body) : {}) }
            catch { reject(new Error('Invalid JSON')) }
          })
        })
      }

      function json(res, data, status = 200) {
        res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' })
        res.end(JSON.stringify(data))
      }

      middlewares.use(async (req, res, next) => {
        pruneStale()

        // ── OPTIONS (CORS preflight) ───────────────────────────────────────────
        if (req.method === 'OPTIONS' && req.url.startsWith('/api/servers')) {
          res.writeHead(204, {
            'Access-Control-Allow-Origin':  '*',
            'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE',
            'Access-Control-Allow-Headers': 'Content-Type,x-server-secret',
          })
          return res.end()
        }

        // ── GET /api/servers ──────────────────────────────────────────────────
        if (req.method === 'GET' && req.url === '/api/servers') {
          return json(res, {
            servers: [...servers.values()].map(s => ({
              id:          s.id,
              name:        s.name,
              description: s.description,
              imageUrl:    s.imageUrl,
              isPrivate:   s.isPrivate,
              playerCount: s.playerCount,
              roomCount:   s.roomCount,
              maxRooms:    s.maxRooms,
              wsUrl:       s.wsUrl,
            }))
          })
        }

        // ── POST /api/servers/register ────────────────────────────────────────
        if (req.method === 'POST' && req.url === '/api/servers/register') {
          const body   = await readJson(req).catch(() => null)
          if (!body?.wsUrl) return json(res, { error: 'wsUrl required' }, 400)

          const id     = nanoid(8)
          const secret = nanoid(16)
          servers.set(id, {
            id,
            name:        body.name        ?? 'Unnamed Server',
            description: body.description ?? '',
            imageUrl:    body.imageUrl    ?? '',
            isPrivate:   body.isPrivate   ?? false,
            wsUrl:       body.wsUrl,
            maxRooms:    body.maxRooms    ?? 10,
            playerCount: 0,
            roomCount:   0,
            lastSeen:    Date.now(),
          })
          secrets.set(id, secret)
          console.log(`[Lobby] Registered: "${body.name}" (${id}) @ ${body.wsUrl}`)
          return json(res, { id, secret })
        }

        // ── PUT /api/servers/:id/heartbeat ────────────────────────────────────
        const heartbeatMatch = req.url.match(/^\/api\/servers\/([^/]+)\/heartbeat$/)
        if (req.method === 'PUT' && heartbeatMatch) {
          const id  = heartbeatMatch[1]
          const srv = servers.get(id)
          if (!srv) return json(res, { error: 'Not found' }, 404)
          if (req.headers['x-server-secret'] !== secrets.get(id))
            return json(res, { error: 'Forbidden' }, 403)

          const body = await readJson(req).catch(() => ({}))
          const rooms = body.rooms ?? []
          srv.roomCount   = rooms.length
          srv.playerCount = rooms.reduce((s, r) => s + (r.playerCount ?? 0), 0)
          srv.lastSeen    = Date.now()
          return json(res, { ok: true })
        }

        // ── DELETE /api/servers/:id ───────────────────────────────────────────
        const deleteMatch = req.url.match(/^\/api\/servers\/([^/]+)$/)
        if (req.method === 'DELETE' && deleteMatch) {
          const id = deleteMatch[1]
          if (req.headers['x-server-secret'] !== secrets.get(id))
            return json(res, { error: 'Forbidden' }, 403)
          servers.delete(id)
          secrets.delete(id)
          console.log(`[Lobby] Unregistered: ${id}`)
          return json(res, { ok: true })
        }

        next()
      })

      console.log('[Lobby] API injected into Vite dev server (/api/servers)')
    }
  }
}
