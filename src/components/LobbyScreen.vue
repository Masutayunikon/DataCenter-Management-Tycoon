<template>
  <div class="lobby-wrap">
    <div class="lobby-panel">

      <!-- Header -->
      <div class="lobby-header">
        <span class="lobby-title">🌐 DATACENTER TYCOON — MULTIJOUEUR</span>
        <button class="lobby-back" @click="$emit('back')">← Retour</button>
      </div>

      <!-- Error banner -->
      <Transition name="fade">
        <div v-if="mp.error.value" class="error-bar">⚠️ {{ mp.error.value }}</div>
      </Transition>

      <!-- Connection step -->
      <div v-if="!mp.connected.value" class="section">
        <div class="section-title">CONNEXION AU SERVEUR</div>

        <!-- Tabs -->
        <div class="tab-row">
          <button class="tab-btn" :class="{ active: tab === 'lobby' }" @click="tab = 'lobby'">
            📋 Via lobby
          </button>
          <button class="tab-btn" :class="{ active: tab === 'direct' }" @click="tab = 'direct'">
            🔗 Connexion directe
          </button>
        </div>

        <!-- Lobby tab -->
        <div v-if="tab === 'lobby'" class="tab-body">
          <div class="field-row">
            <label>URL du lobby</label>
            <div class="input-btn-row">
              <input v-model="lobbyUrl" placeholder="http://localhost:4000" class="text-input" @keydown.enter="fetchServers" />
              <button class="btn-blue" :disabled="fetchingServers" @click="fetchServers">
                {{ fetchingServers ? '…' : 'Chercher' }}
              </button>
            </div>
          </div>

          <div v-if="lobbyError" class="inline-error">{{ lobbyError }}</div>

          <!-- Server list -->
          <div v-if="serverList.length > 0" class="server-list">
            <div
              v-for="srv in serverList"
              :key="srv.id"
              class="server-card"
              :class="{ selected: selectedServer?.id === srv.id }"
              @click="selectServer(srv)"
            >
              <div class="srv-header">
                <span class="srv-name">{{ srv.name }}</span>
                <span class="srv-badge" :class="srv.isPrivate ? 'private' : 'public'">
                  {{ srv.isPrivate ? '🔒 Privé' : '🌍 Public' }}
                </span>
              </div>
              <div class="srv-desc" v-if="srv.description">{{ srv.description }}</div>
              <div class="srv-stats">
                <span>👥 {{ srv.playerCount }} joueur(s)</span>
                <span>🏠 {{ srv.roomCount }}/{{ srv.maxRooms }} rooms</span>
              </div>
            </div>
          </div>
          <div v-else-if="searched && serverList.length === 0" class="empty-msg">
            Aucun serveur trouvé.
          </div>
        </div>

        <!-- Direct tab -->
        <div v-if="tab === 'direct'" class="tab-body">
          <div class="field-row">
            <label>URL du serveur (ws://...)</label>
            <div class="input-btn-row">
              <input v-model="directUrl" placeholder="http://localhost:3001" class="text-input" @keydown.enter="connectDirect" />
              <button class="btn-blue" @click="connectDirect">Connecter</button>
            </div>
          </div>
        </div>

        <!-- Server password (when selected server is private) -->
        <div v-if="selectedServer?.isPrivate || (tab === 'direct' && mp.connected.value && serverInfoData?.isPrivate)" class="field-row">
          <label>Mot de passe serveur</label>
          <input v-model="serverPass" type="password" class="text-input" placeholder="Mot de passe requis" />
        </div>

        <!-- Connect to selected server -->
        <button
          v-if="selectedServer && !mp.connected.value"
          class="btn-green full-width"
          @click="connectToSelected"
        >
          Connecter à {{ selectedServer.name }}
        </button>
      </div>

      <!-- Connected: room browser + forms -->
      <div v-else class="section">
        <div class="section-title">
          <span>{{ serverInfoData?.name ?? 'Serveur connecté' }}</span>
          <span class="connected-dot">● connecté</span>
          <button class="btn-danger-sm" @click="doDisconnect">Déconnecter</button>
        </div>
        <div v-if="serverInfoData?.description" class="srv-desc" style="margin-bottom:10px">
          {{ serverInfoData.description }}
        </div>

        <!-- Player name -->
        <div class="field-row">
          <label>Votre pseudo</label>
          <input v-model="playerName" class="text-input" placeholder="MonPseudo" maxlength="20" />
        </div>

        <div class="two-col">
          <!-- Left: room list -->
          <div class="col">
            <div class="sub-title">ROOMS DISPONIBLES</div>
            <div v-if="serverInfoData?.rooms?.length === 0" class="empty-msg">Aucune room ouverte.</div>
            <div
              v-for="room in serverInfoData?.rooms ?? []"
              :key="room.id"
              class="room-card"
              :class="{ full: room.playerCount >= room.maxPlayers }"
              @click="selectedRoom = room"
            >
              <div class="room-row">
                <span class="room-name">{{ room.name }}</span>
                <span class="room-day">J{{ room.day }}</span>
              </div>
              <div class="room-row">
                <span class="room-players">👥 {{ room.playerCount }}/{{ room.maxPlayers }}</span>
                <span v-if="room.hasPassword" class="room-lock">🔒</span>
                <span class="room-code" title="Code invitation">{{ room.inviteCode }}</span>
              </div>
            </div>

            <!-- Join by invite code -->
            <div class="sub-title" style="margin-top:14px">REJOINDRE PAR CODE</div>
            <div class="input-btn-row">
              <input v-model="inviteCodeInput" class="text-input mono-input" placeholder="ABC123" maxlength="6" style="text-transform:uppercase" />
              <button class="btn-blue" @click="joinByCode">Rejoindre</button>
            </div>
          </div>

          <!-- Right: create or join room -->
          <div class="col">
            <!-- Join selected room -->
            <div v-if="selectedRoom" class="form-box">
              <div class="sub-title">REJOINDRE « {{ selectedRoom.name }} »</div>
              <div v-if="selectedRoom.hasPassword" class="field-row">
                <label>Mot de passe room</label>
                <input v-model="joinRoomPass" type="password" class="text-input" />
              </div>
              <div class="btn-row">
                <button class="btn-green" @click="joinSelectedRoom" :disabled="!playerName.trim()">
                  Rejoindre
                </button>
                <button class="btn-ghost" @click="selectedRoom = null">Annuler</button>
              </div>
              <div v-if="joinError" class="inline-error">{{ joinError }}</div>
            </div>

            <!-- Create room -->
            <div v-else class="form-box">
              <div class="sub-title">CRÉER UNE ROOM</div>
              <div class="field-row">
                <label>Nom de la room</label>
                <input v-model="newRoomName" class="text-input" placeholder="Ma DataCenter" maxlength="30" />
              </div>
              <div class="field-row">
                <label>Max joueurs</label>
                <div class="number-row">
                  <button class="num-btn" @click="newRoomMax = Math.max(2, newRoomMax - 1)">−</button>
                  <span class="num-val">{{ newRoomMax }}</span>
                  <button class="num-btn" @click="newRoomMax = Math.min(16, newRoomMax + 1)">+</button>
                </div>
              </div>
              <div class="field-row">
                <label>Mot de passe (optionnel)</label>
                <input v-model="newRoomPass" type="password" class="text-input" placeholder="Laisser vide = public" />
              </div>
              <button class="btn-green full-width" @click="createRoom" :disabled="!playerName.trim() || !newRoomName.trim()">
                + Créer la room
              </button>
              <div v-if="createError" class="inline-error">{{ createError }}</div>
            </div>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, watchEffect } from 'vue'

const props = defineProps({
  mp: { type: Object, required: true },
})
const emit = defineEmits(['back', 'joined'])

// ── State ─────────────────────────────────────────────────────────────────────
const tab            = ref('lobby')
const lobbyUrl       = ref('http://localhost:5173')
const directUrl      = ref('http://localhost:3001')
const fetchingServers = ref(false)
const searched       = ref(false)
const lobbyError     = ref('')
const serverList     = ref([])
const selectedServer = ref(null)
const serverPass     = ref('')
const serverInfoData = ref(null)

const playerName     = ref(localStorage.getItem('dcg-player-name') ?? '')
const selectedRoom   = ref(null)
const joinRoomPass   = ref('')
const joinError      = ref('')
const inviteCodeInput = ref('')

const newRoomName    = ref('')
const newRoomMax     = ref(4)
const newRoomPass    = ref('')
const createError    = ref('')

// ── Lobby API fetch ───────────────────────────────────────────────────────────

async function fetchServers() {
  if (!lobbyUrl.value.trim()) return
  fetchingServers.value = true
  lobbyError.value = ''
  searched.value = false
  try {
    const res  = await fetch(`${lobbyUrl.value.replace(/\/$/, '')}/api/servers`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    serverList.value = data.servers ?? []
    searched.value   = true
  } catch (e) {
    lobbyError.value = `Erreur : ${e.message}`
    serverList.value = []
  } finally {
    fetchingServers.value = false
  }
}

onMounted(() => {
  if (lobbyUrl.value) fetchServers()
})

watch(playerName, (v) => {
  if (v) localStorage.setItem('dcg-player-name', v)
})

function selectServer(srv) {
  selectedServer.value = srv
  serverPass.value     = ''
}

async function connectToSelected() {
  if (!selectedServer.value) return
  props.mp.connect(selectedServer.value.wsUrl)
  // Wait a bit then get server info
  await new Promise(r => setTimeout(r, 1200))
  await loadServerInfo()
}

async function connectDirect() {
  if (!directUrl.value.trim()) return
  props.mp.connect(directUrl.value.trim())
  await new Promise(r => setTimeout(r, 1200))
  await loadServerInfo()
}

async function loadServerInfo() {
  const res = await props.mp.getServerInfo(serverPass.value)
  if (res.ok) {
    serverInfoData.value = res
  } else {
    props.mp.error.value = res.error ?? 'Impossible de récupérer les infos du serveur'
  }
}

function doDisconnect() {
  props.mp.disconnect()
  serverInfoData.value = null
  selectedRoom.value   = null
  selectedServer.value = null
}

// ── Join / Create room ────────────────────────────────────────────────────────

async function joinSelectedRoom() {
  joinError.value = ''
  const res = await props.mp.joinRoom({
    playerName:   playerName.value.trim(),
    roomId:       selectedRoom.value.id,
    roomPassword: joinRoomPass.value || undefined,
    serverPassword: serverPass.value || undefined,
  })
  if (res.ok) {
    emit('joined', { playerName: playerName.value.trim(), reconnected: res.reconnected })
  } else {
    joinError.value = res.error ?? 'Erreur inconnue'
  }
}

async function joinByCode() {
  if (!inviteCodeInput.value.trim()) return
  joinError.value = ''
  const res = await props.mp.joinRoom({
    playerName:     playerName.value.trim(),
    inviteCode:     inviteCodeInput.value.trim().toUpperCase(),
    serverPassword: serverPass.value || undefined,
  })
  if (res.ok) {
    emit('joined', { playerName: playerName.value.trim(), reconnected: res.reconnected })
  } else {
    joinError.value = res.error ?? 'Code invalide'
  }
}

async function createRoom() {
  createError.value = ''
  const res = await props.mp.createRoom({
    playerName:     playerName.value.trim(),
    roomName:       newRoomName.value.trim(),
    maxPlayers:     newRoomMax.value,
    roomPassword:   newRoomPass.value || undefined,
    serverPassword: serverPass.value || undefined,
  })
  if (res.ok) {
    emit('joined', { playerName: playerName.value.trim(), isGameMaster: true })
  } else {
    createError.value = res.error ?? 'Erreur inconnue'
  }
}
</script>

<style scoped>
.lobby-wrap {
  position: fixed;
  inset: 0;
  background: rgba(13, 17, 23, 0.92);
  z-index: 400;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow-y: auto;
}

.lobby-panel {
  width: clamp(480px, 80vw, 880px);
  max-height: 92vh;
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 8px;
  box-shadow: 0 12px 48px rgba(0,0,0,0.8);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.lobby-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: #0d1117;
  border-bottom: 1px solid #21262d;
  flex-shrink: 0;
}

.lobby-title {
  font-family: monospace;
  font-size: 13px;
  font-weight: bold;
  color: #58a6ff;
  letter-spacing: 1px;
}

.lobby-back {
  background: transparent;
  border: 1px solid #30363d;
  color: #8b949e;
  font-family: monospace;
  font-size: 11px;
  padding: 3px 10px;
  cursor: pointer;
  border-radius: 3px;
  transition: all 0.1s;
}
.lobby-back:hover { border-color: #58a6ff; color: #58a6ff; }

.error-bar {
  background: #2e0a0a;
  border-bottom: 1px solid #6e2020;
  color: #f85149;
  font-family: monospace;
  font-size: 11px;
  padding: 6px 16px;
}

.section {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.section-title {
  font-family: monospace;
  font-size: 11px;
  font-weight: bold;
  color: #58a6ff;
  letter-spacing: 1px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding-bottom: 8px;
  border-bottom: 1px solid #21262d;
}

.connected-dot {
  color: #3fb950;
  font-size: 10px;
}

.sub-title {
  font-family: monospace;
  font-size: 10px;
  font-weight: bold;
  color: #8b949e;
  letter-spacing: 1px;
  margin-bottom: 6px;
  text-transform: uppercase;
}

/* Tabs */
.tab-row {
  display: flex;
  gap: 4px;
}
.tab-btn {
  background: #21262d;
  border: 1px solid #30363d;
  color: #8b949e;
  font-family: monospace;
  font-size: 11px;
  padding: 4px 12px;
  cursor: pointer;
  border-radius: 3px;
  transition: all 0.1s;
}
.tab-btn.active { background: #1f4068; border-color: #58a6ff; color: #58a6ff; }
.tab-btn:hover:not(.active) { border-color: #484f58; color: #e6edf3; }

.tab-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* Fields */
.field-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.field-row label {
  font-family: monospace;
  font-size: 10px;
  color: #8b949e;
}

.input-btn-row {
  display: flex;
  gap: 6px;
}

.text-input {
  flex: 1;
  background: #0d1117;
  border: 1px solid #30363d;
  color: #e6edf3;
  font-family: monospace;
  font-size: 11px;
  padding: 5px 8px;
  border-radius: 3px;
  outline: none;
  transition: border-color 0.1s;
}
.text-input:focus { border-color: #58a6ff; }
.mono-input { text-transform: uppercase; letter-spacing: 3px; }

.inline-error {
  font-family: monospace;
  font-size: 10px;
  color: #f85149;
  padding: 3px 0;
}

/* Server list */
.server-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 200px;
  overflow-y: auto;
}

.server-card {
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: 5px;
  padding: 8px 10px;
  cursor: pointer;
  transition: all 0.1s;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.server-card:hover { border-color: #58a6ff; background: #0d1a2e; }
.server-card.selected { border-color: #58a6ff; background: #0d1a2e; }

.srv-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.srv-name {
  font-family: monospace;
  font-size: 12px;
  font-weight: bold;
  color: #e6edf3;
}
.srv-badge {
  font-family: monospace;
  font-size: 9px;
  padding: 1px 6px;
  border-radius: 8px;
}
.srv-badge.public  { background: #0a2e0a; color: #3fb950; }
.srv-badge.private { background: #1a1200; color: #d29922; }
.srv-desc {
  font-family: monospace;
  font-size: 10px;
  color: #8b949e;
}
.srv-stats {
  display: flex;
  gap: 12px;
  font-family: monospace;
  font-size: 10px;
  color: #484f58;
}

.empty-msg {
  font-family: monospace;
  font-size: 11px;
  color: #484f58;
  text-align: center;
  padding: 16px 0;
}

/* Two-column layout */
.two-col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  flex: 1;
}

.col {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

/* Room cards */
.room-card {
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: 4px;
  padding: 7px 10px;
  cursor: pointer;
  transition: all 0.1s;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.room-card:hover { border-color: #3fb950; }
.room-card.full  { opacity: 0.5; cursor: not-allowed; }
.room-card.full:hover { border-color: #30363d; }

.room-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}
.room-name    { font-family: monospace; font-size: 11px; font-weight: bold; color: #e6edf3; }
.room-day     { font-family: monospace; font-size: 10px; color: #484f58; }
.room-players { font-family: monospace; font-size: 10px; color: #8b949e; }
.room-lock    { font-size: 10px; }
.room-code    { font-family: monospace; font-size: 10px; color: #58a6ff; letter-spacing: 2px; }

/* Form box */
.form-box {
  background: #0d1117;
  border: 1px solid #21262d;
  border-radius: 5px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.number-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.num-btn {
  background: #21262d;
  border: 1px solid #30363d;
  color: #e6edf3;
  font-family: monospace;
  width: 24px;
  height: 24px;
  cursor: pointer;
  border-radius: 3px;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.1s;
}
.num-btn:hover { border-color: #58a6ff; }
.num-val {
  font-family: monospace;
  font-size: 14px;
  font-weight: bold;
  color: #e6edf3;
  min-width: 24px;
  text-align: center;
}

.btn-row {
  display: flex;
  gap: 6px;
}

/* Buttons */
.btn-blue, .btn-green, .btn-ghost {
  font-family: monospace;
  font-size: 11px;
  padding: 5px 12px;
  border-radius: 3px;
  cursor: pointer;
  border: 1px solid;
  transition: all 0.1s;
  white-space: nowrap;
}
.btn-blue  { background: #1f4068; border-color: #58a6ff; color: #58a6ff; }
.btn-blue:hover  { background: #2a5a8a; }
.btn-blue:disabled { opacity: 0.4; cursor: not-allowed; }
.btn-green { background: #0a2e0a; border-color: #238636; color: #3fb950; }
.btn-green:hover  { background: #0d3d0d; }
.btn-green:disabled { opacity: 0.4; cursor: not-allowed; }
.btn-ghost { background: transparent; border-color: #30363d; color: #8b949e; }
.btn-ghost:hover { border-color: #484f58; color: #e6edf3; }
.full-width { width: 100%; }

.btn-danger-sm {
  margin-left: auto;
  background: transparent;
  border: 1px solid #6e2020;
  color: #f85149;
  font-family: monospace;
  font-size: 9px;
  padding: 2px 8px;
  cursor: pointer;
  border-radius: 3px;
}
.btn-danger-sm:hover { background: #2e0a0a; }

.fade-enter-active, .fade-leave-active { transition: opacity 0.15s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
