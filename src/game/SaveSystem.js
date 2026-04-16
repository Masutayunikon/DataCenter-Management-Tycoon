// SaveSystem.js — localStorage save/load for gameState


const SAVE_KEY     = 'datacenter_save'
const SAVE_VERSION = 5  // bump when save format changes incompatibly

// ─── Save ─────────────────────────────────────────────────────────────────────

function saveGame(state) {
  try {
    const payload = {
      version: SAVE_VERSION,
      savedAt: Date.now(),
      state:   serializeState(state),
    }
    localStorage.setItem(SAVE_KEY, JSON.stringify(payload))
    return { success: true }
  } catch (e) {
    console.error('[SaveSystem] save failed:', e)
    return { success: false, message: e.message }
  }
}

// ─── Load ─────────────────────────────────────────────────────────────────────

function loadGame(gameState) {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return { success: false, message: 'Aucune sauvegarde trouvée' }

    const payload = JSON.parse(raw)
    if (!payload?.state) return { success: false, message: 'Sauvegarde corrompue' }
    if (payload.version !== SAVE_VERSION)
      return { success: false, message: `Version incompatible (v${payload.version} ≠ v${SAVE_VERSION})` }

    applyState(gameState, payload.state)
    return { success: true, savedAt: payload.savedAt }
  } catch (e) {
    console.error('[SaveSystem] load failed:', e)
    return { success: false, message: e.message }
  }
}

function hasSave() {
  return !!localStorage.getItem(SAVE_KEY)
}

function deleteSave() {
  localStorage.removeItem(SAVE_KEY)
}

function getSaveInfo() {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return null
    const payload = JSON.parse(raw)
    return { savedAt: payload.savedAt, version: payload.version, day: payload.state?.day ?? 0 }
  } catch {
    return null
  }
}

// ─── Serialization ────────────────────────────────────────────────────────────
// Strip getter/setter aliases (load, demand) — only plain fields matter.

function serializeState(state) {
  // Deep-copy through JSON to strip non-enumerable getters/setters
  return JSON.parse(JSON.stringify(state, replacer))
}

function replacer(key, value) {
  // Skip computed getter aliases that are already covered by real fields
  if (key === 'load' || key === 'demand') return undefined
  return value
}

// ─── Deserialization ──────────────────────────────────────────────────────────

function applyState(gameState, saved) {
  // Copy all top-level scalar fields
  const scalarFields = [
    'money', 'day', 'speed', 'reputation', 'skillPoints',
    'revenue', 'electricityCost', 'maintenanceCost', 'employeeCost',
    'power', 'powerCap', 'heat', 'nextClientId', 'nextTicketId', 'nextMissionId',
    'nextNotificationId', 'currentFloor',
  ]
  for (const f of scalarFields) {
    if (saved[f] !== undefined) gameState[f] = saved[f]
  }

  // Collections
  if (saved.servicePrices)    Object.assign(gameState.servicePrices,    saved.servicePrices)
  if (saved.serviceSlots)     Object.assign(gameState.serviceSlots,     saved.serviceSlots)
  if (saved.employees)        Object.assign(gameState.employees,        saved.employees)
  if (saved.serviceModes)     Object.assign(gameState.serviceModes,     saved.serviceModes)
  if (saved.serviceTemplates) Object.assign(gameState.serviceTemplates, saved.serviceTemplates)
  if (saved.settings)         Object.assign(gameState.settings,         saved.settings)

  if (Array.isArray(saved.unlockedSkills))  gameState.unlockedSkills  = saved.unlockedSkills
  if (Array.isArray(saved.activeEvents))    gameState.activeEvents    = saved.activeEvents
  if (Array.isArray(saved.eventHistory))    gameState.eventHistory    = saved.eventHistory
  if (Array.isArray(saved.clients))         gameState.clients         = saved.clients
  if (Array.isArray(saved.clientQueue))     gameState.clientQueue     = saved.clientQueue
  if (Array.isArray(saved.tickets))         gameState.tickets         = saved.tickets
  if (Array.isArray(saved.missions))        gameState.missions        = saved.missions
  if (Array.isArray(saved.notifications))   gameState.notifications   = saved.notifications

  // Floors: restore full grid structure
  if (Array.isArray(saved.floors)) {
    gameState.floors = saved.floors
  }

}

export { saveGame, loadGame, hasSave, deleteSave, getSaveInfo }
