// src/game/useMultiplayer.js — Socket.io composable for multiplayer

import { ref, readonly } from 'vue'
import { io } from 'socket.io-client'

// localStorage helpers for reconnect tokens: keyed by roomId
function _saveToken(rId, token) {
  try {
    const all = JSON.parse(localStorage.getItem('dcg_tokens') ?? '{}')
    all[rId] = token
    localStorage.setItem('dcg_tokens', JSON.stringify(all))
  } catch (_) {}
}
function _loadToken(rId) {
  try {
    const all = JSON.parse(localStorage.getItem('dcg_tokens') ?? '{}')
    return all[rId] ?? null
  } catch (_) { return null }
}

export function useMultiplayer() {
  const socket          = ref(null)
  const connected       = ref(false)
  const inRoom          = ref(false)
  const roomId          = ref(null)
  const inviteCode      = ref(null)
  const isGameMaster    = ref(false)
  const reconnectToken  = ref(null)
  const players         = ref([])   // playerMeta[] pour tous les joueurs
  const chat            = ref([])   // { from, text, day }[]
  const error           = ref(null)
  const shared          = ref(null) // état partagé de la room (day, speed, events, marketWeights)
  const roomInfo        = ref(null) // { id, name, inviteCode, gameMasterId, maxPlayers }

  let _onFullState  = null
  let _onDeltaState = null

  function connect(serverUrl) {
    if (socket.value) {
      socket.value.removeAllListeners()
      socket.value.disconnect()
    }

    error.value   = null
    const s = io(serverUrl, { transports: ['websocket'], timeout: 8000 })
    socket.value  = s

    s.on('connect', () => {
      connected.value = true
      error.value     = null
    })

    s.on('disconnect', () => {
      connected.value = false
    })

    s.on('connect_error', (err) => {
      error.value     = `Connexion impossible : ${err.message}`
      connected.value = false
    })

    s.on('full_state', (data) => {
      if (data.shared)   shared.value   = data.shared
      if (data.room)     roomInfo.value = data.room
      if (data.allMeta)  players.value  = data.allMeta
      if (data.reconnectToken) {
        reconnectToken.value = data.reconnectToken
        if (data.room?.id) _saveToken(data.room.id, data.reconnectToken)
      }
      // Determine GM status from room data
      if (data.room) {
        isGameMaster.value = s.id === data.room.gameMasterId
      }
      _onFullState?.(data.playerState)
    })

    s.on('delta_state', (data) => {
      if (data.shared) shared.value = data.shared
      _onDeltaState?.(data.personal)
    })

    s.on('meta_updated', (data) => {
      if (data.allMeta) players.value = data.allMeta
      if (data.shared)  shared.value  = data.shared
    })

    s.on('player_joined', ({ player }) => {
      if (!players.value.find(p => p.id === player.id))
        players.value = [...players.value, player]
    })

    s.on('player_left', ({ playerId }) => {
      players.value = players.value.filter(p => p.id !== playerId)
    })

    s.on('player_disconnected', ({ playerId }) => {
      players.value = players.value.map(p =>
        p.id === playerId ? { ...p, connected: false } : p
      )
    })

    s.on('player_reconnected', ({ player }) => {
      players.value = players.value.map(p => p.id === player.id ? player : p)
    })

    s.on('chat_message', (msg) => {
      chat.value = [...chat.value.slice(-199), msg]
    })

    s.on('room_closed', () => {
      inRoom.value       = false
      roomId.value       = null
      inviteCode.value   = null
      isGameMaster.value = false
    })

    s.on('game_master_changed', ({ gameMasterId }) => {
      if (roomInfo.value) roomInfo.value = { ...roomInfo.value, gameMasterId }
      // Vérifier si on est le nouveau GM
      if (socket.value && gameMasterId === s.id) isGameMaster.value = true
    })

    s.on('speed_changed', ({ speed }) => {
      if (shared.value) shared.value = { ...shared.value, speed }
    })

    s.on('game_started', () => {
      if (shared.value) shared.value = { ...shared.value, started: true }
    })

    s.on('kicked', () => {
      inRoom.value = false
      roomId.value = null
      error.value  = 'Vous avez été expulsé de la room.'
    })
  }

  function disconnect() {
    socket.value?.removeAllListeners()
    socket.value?.disconnect()
    socket.value         = null
    connected.value      = false
    inRoom.value         = false
    roomId.value         = null
    inviteCode.value     = null
    isGameMaster.value   = false
    reconnectToken.value = null
    players.value        = []
    chat.value           = []
    shared.value         = null
    roomInfo.value       = null
    error.value          = null
  }

  async function getServerInfo(serverPassword = '') {
    return new Promise((resolve) => {
      if (!socket.value) return resolve({ ok: false, error: 'Non connecté' })
      socket.value.emit('get_server_info', serverPassword, (res) => resolve(res ?? { ok: false }))
    })
  }

  async function createRoom(opts) {
    return new Promise((resolve) => {
      if (!socket.value) return resolve({ ok: false, error: 'Non connecté' })
      socket.value.emit('create_room', opts, (res) => {
        if (res?.ok) {
          inRoom.value       = true
          roomId.value       = res.roomId
          inviteCode.value   = res.inviteCode
          isGameMaster.value = true
          chat.value         = []
          players.value      = []
        }
        resolve(res ?? { ok: false })
      })
    })
  }

  async function joinRoom(opts) {
    return new Promise((resolve) => {
      if (!socket.value) return resolve({ ok: false, error: 'Non connecté' })
      // Attach stored reconnect token if we have one for this room
      const storedToken = opts.roomId ? _loadToken(opts.roomId) : null
      const payload = storedToken ? { ...opts, reconnectToken: storedToken } : opts
      socket.value.emit('join_room', payload, (res) => {
        if (res?.ok) {
          inRoom.value  = true
          roomId.value  = res.roomId
          chat.value    = []
          players.value = []
          // isGameMaster will be set correctly by the full_state handler
        }
        resolve(res ?? { ok: false })
      })
    })
  }

  async function leaveRoom() {
    return new Promise((resolve) => {
      socket.value?.emit('leave_room', {}, () => {
        inRoom.value         = false
        roomId.value         = null
        inviteCode.value     = null
        isGameMaster.value   = false
        reconnectToken.value = null
        players.value        = []
        chat.value           = []
        shared.value         = null
        roomInfo.value       = null
        resolve({ ok: true })
      })
    })
  }

  async function exportState() {
    return sendAction('export_state')
  }

  async function importState(savedState) {
    return sendAction('import_state', { state: savedState })
  }

  async function sendAction(type, payload = {}) {
    return new Promise((resolve) => {
      if (!socket.value) return resolve({ ok: false, error: 'Non connecté' })
      socket.value.emit('player_action', { type, payload }, (res) => resolve(res ?? { ok: false }))
    })
  }

  function sendChat(text) {
    socket.value?.emit('chat_message', { text })
  }

  function setCallbacks({ fullState, deltaState }) {
    _onFullState  = fullState
    _onDeltaState = deltaState
  }

  return {
    socket:          readonly(socket),
    connected:       readonly(connected),
    inRoom:          readonly(inRoom),
    roomId:          readonly(roomId),
    inviteCode:      readonly(inviteCode),
    isGameMaster:    readonly(isGameMaster),
    reconnectToken:  readonly(reconnectToken),
    players:         readonly(players),
    chat:            readonly(chat),
    error:           readonly(error),
    shared:          readonly(shared),
    roomInfo:        readonly(roomInfo),
    connect,
    disconnect,
    getServerInfo,
    createRoom,
    joinRoom,
    leaveRoom,
    sendAction,
    sendChat,
    setCallbacks,
    exportState,
    importState,
  }
}
