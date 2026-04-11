// LobbyClient.js — Registers and maintains heartbeat with the Lobby API

import fetch from 'node-fetch'

export class LobbyClient {
  constructor(lobbyUrl, serverInfo) {
    this.lobbyUrl   = lobbyUrl
    this.serverInfo = serverInfo
    this.serverId   = null
    this.secret     = null
    this._timer     = null
  }

  // ─── Register with the lobby ─────────────────────────────────────────────────

  async register() {
    if (!this.lobbyUrl) {
      console.log('[Lobby] No lobbyUrl configured — running without lobby registration')
      return
    }

    try {
      const res = await fetch(`${this.lobbyUrl}/api/servers/register`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          name:               this.serverInfo.name,
          description:        this.serverInfo.description,
          imageUrl:           this.serverInfo.imageUrl,
          isPrivate:          this.serverInfo.isPrivate,
          maxRooms:           this.serverInfo.maxRooms,
          maxPlayersPerRoom:  this.serverInfo.maxPlayersPerRoom,
          wsUrl:              this.serverInfo.publicUrl,
        }),
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const { id, secret } = await res.json()
      this.serverId = id
      this.secret   = secret
      console.log(`[Lobby] Registered as "${this.serverInfo.name}" (${id})`)

      // Start heartbeat every 30s
      this._timer = setInterval(() => this._heartbeat([]), 30_000)
    } catch (err) {
      console.warn('[Lobby] Registration failed:', err.message)
    }
  }

  // ─── Heartbeat — send current room list ──────────────────────────────────────

  async sendHeartbeat(rooms) {
    if (!this.serverId || !this.lobbyUrl) return
    return this._heartbeat(rooms)
  }

  async _heartbeat(rooms) {
    if (!this.serverId || !this.lobbyUrl) return
    try {
      const res = await fetch(`${this.lobbyUrl}/api/servers/${this.serverId}/heartbeat`, {
        method:  'PUT',
        headers: {
          'Content-Type':    'application/json',
          'x-server-secret': this.secret,
        },
        body: JSON.stringify({ rooms }),
      })
      if (!res.ok) console.warn('[Lobby] Heartbeat failed:', res.status)
    } catch (err) {
      console.warn('[Lobby] Heartbeat error:', err.message)
    }
  }

  // ─── Unregister on shutdown ──────────────────────────────────────────────────

  async unregister() {
    clearInterval(this._timer)
    if (!this.serverId || !this.lobbyUrl) return
    try {
      await fetch(`${this.lobbyUrl}/api/servers/${this.serverId}`, {
        method:  'DELETE',
        headers: { 'x-server-secret': this.secret },
      })
      console.log('[Lobby] Unregistered')
    } catch (_) {}
  }
}
