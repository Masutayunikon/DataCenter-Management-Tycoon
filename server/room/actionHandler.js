// actionHandler.js — Processes player actions for a GameRoom

import { allMeta, broadcastFullState, pushPlayerDelta } from './stateSync.js'

/**
 * Process a game action from a player.
 * @returns {Promise<{ ok: boolean, error?: string, data?: * }>}
 */
export async function processAction(room, socketId, type, payload) {
  const player = room.players.get(socketId)
  if (!player || !player.connected) return { ok: false, error: 'Joueur non trouvé' }

  const state = player.state

  try {
    switch (type) {

      // ── Prices & service config ───────────────────────────────────────────

      case 'change_price': {
        const { applyPriceChange } = await import('../../src/game/EconomyEngine.js')
        const oldPrice = state.servicePrices?.[payload.serviceId] ?? 0
        const newPrice = Math.max(1, oldPrice + payload.delta)
        applyPriceChange(state, payload.serviceId, oldPrice, newPrice)
        if (!state.servicePrices) state.servicePrices = {}
        state.servicePrices[payload.serviceId] = newPrice
        break
      }

      case 'change_service_slots': {
        const svc         = payload.serviceId
        const delta       = payload.delta
        const current     = state.serviceSlots?.[svc] ?? 0
        const activeCount = (state.clients ?? []).filter(c => c.serviceId === svc).length
        const newVal      = current + delta
        if (newVal < 0)           return { ok: false, error: 'Valeur invalide' }
        if (newVal < activeCount) return { ok: false, error: 'Clients actifs présents' }
        if (!state.serviceSlots) state.serviceSlots = {}
        state.serviceSlots[svc] = newVal
        break
      }

      case 'set_service_mode': {
        const { serviceId, mode, slotsValue } = payload
        if (!state.serviceModes) state.serviceModes = {}
        if (!state.serviceSlots) state.serviceSlots = {}
        state.serviceModes[serviceId] = mode
        state.serviceSlots[serviceId] = slotsValue ?? 0
        break
      }

      case 'set_service_templates': {
        const { serviceId, templates } = payload
        if (!state.serviceTemplates) state.serviceTemplates = {}
        state.serviceTemplates[serviceId] = templates ?? []
        break
      }

      case 'set_service_slots': {
        const svc         = payload.serviceId
        const value       = payload.value ?? 0
        const activeCount = (state.clients ?? []).filter(c => c.serviceId === svc).length
        if (value < 0)           return { ok: false, error: 'Valeur invalide' }
        if (value < activeCount) return { ok: false, error: 'Clients actifs présents' }
        if (!state.serviceSlots) state.serviceSlots = {}
        state.serviceSlots[svc] = value
        break
      }

      // ── Infrastructure ────────────────────────────────────────────────────

      case 'buy_rack': {
        const { unlockCell } = await import('../../src/game/GridEngine.js')
        const result = unlockCell(state, payload.floorId, payload.x, payload.y)
        if (!result.success) return { ok: false, error: result.message }
        break
      }

      case 'buy_floor': {
        const { buyFloor } = await import('../../src/game/GridEngine.js')
        const result = buyFloor(state, payload.floorId)
        if (!result.success) return { ok: false, error: result.message }
        break
      }

      case 'install_server': {
        const { isServerTypeUnlocked } = await import('../../src/game/SkillEngine.js')
        const { SERVER_TYPES, createServer } = await import('../../src/game/GameState.js')
        const floor = state.floors.find(f => f.id === payload.floorId)
        const cell  = floor?.grid[payload.y]?.[payload.x]
        if (!cell?.rack)                             return { ok: false, error: 'Pas de rack ici' }
        if (cell.rack.servers[payload.slot] !== null) return { ok: false, error: 'Slot occupé' }
        const def = SERVER_TYPES[payload.serverType]
        if (!def)                                    return { ok: false, error: 'Type inconnu' }
        if (!isServerTypeUnlocked(state, payload.serverType))
                                                     return { ok: false, error: 'Non débloqué' }
        if (state.money < def.cost)                  return { ok: false, error: 'Fonds insuffisants' }
        state.money -= def.cost
        cell.rack.servers[payload.slot] = createServer(payload.serverType)
        break
      }

      case 'remove_server': {
        const { removeServer } = await import('../../src/game/ServerEngine.js')
        removeServer(state, payload.floorId, payload.x, payload.y, payload.slot)
        break
      }

      case 'repair_server': {
        const { repairServer } = await import('../../src/game/ServerEngine.js')
        repairServer(state, payload.floorId, payload.x, payload.y, payload.slot)
        break
      }

      case 'restart_server': {
        const { restartServer } = await import('../../src/game/ServerEngine.js')
        restartServer(state, payload.floorId, payload.x, payload.y, payload.slot)
        break
      }

      case 'place_rack': {
        const { createRack, RACK_COST } = await import('../../src/game/GameState.js')
        if (state.money < RACK_COST) return { ok: false, error: 'Fonds insuffisants' }
        const floor = state.floors.find(f => f.id === payload.floorId)
        const cell  = floor?.grid[payload.y]?.[payload.x]
        if (!cell)       return { ok: false, error: 'Cellule invalide' }
        if (cell.locked) return { ok: false, error: 'Cellule verrouillée' }
        if (cell.rack)   return { ok: false, error: 'Rack déjà présent' }
        cell.rack    = createRack()
        state.money -= RACK_COST
        break
      }

      // ── Clients & moves ───────────────────────────────────────────────────

      case 'resolve_mission': {
        const { resolveMission } = await import('../../src/game/MissionEngine.js')
        const result = resolveMission(state, payload.missionId, payload.satMul ?? 1, payload.spMul ?? 1)
        if (!result.success) return { ok: false, error: result.message }
        pushPlayerDelta(room, socketId)
        return { ok: true, sp: result.sp, satReward: result.satReward }
      }

      case 'assign_client': {
        const { assignClientToServer } = await import('../../src/game/SimulationEngine.js')
        const result = assignClientToServer(
          state,
          payload.clientId,
          payload.floorId,
          payload.x,
          payload.y,
          payload.slot,
          true,
        )
        if (!result?.success) return { ok: false, error: result?.message ?? 'Assignation échouée' }
        pushPlayerDelta(room, socketId)
        return { ok: true, activated: result.activated }
      }

      case 'move_client': {
        const { moveClient } = await import('../../src/game/SimulationEngine.js')
        moveClient(state, payload.clientId, payload.targetPos)
        break
      }

      // ── Skills ────────────────────────────────────────────────────────────

      case 'apply_skill': {
        const { applySkill } = await import('../../src/game/SkillEngine.js')
        const result = applySkill(state, payload.skillId)
        if (!result.success) return { ok: false, error: result.message }
        break
      }

      // ── Tenders ───────────────────────────────────────────────────────────

      case 'apply_tender': {
        const tender = room.shared.tenders.find(t => t.id === payload.tenderId)
        if (!tender)                   return { ok: false, error: 'Contrat introuvable' }
        if (tender.status !== 'open')  return { ok: false, error: 'Contrat clôturé' }
        if (tender.applicants.includes(socketId))
          return { ok: false, error: 'Candidature déjà envoyée' }

        const rep   = state.reputation ?? 0
        const slots = state.serviceSlots?.[tender.serviceId] ?? 0
        if (rep < tender.minReputation)
          return { ok: false, error: `Réputation insuffisante (min ${tender.minReputation})` }
        if (slots < tender.minSlots)
          return { ok: false, error: `Slots ${tender.serviceId} insuffisants (min ${tender.minSlots})` }
        if (tender.type === 'specialist') {
          const active = Object.entries(state.serviceSlots ?? {}).filter(([, v]) => v > 0)
          if (active.length !== 1 || active[0][0] !== tender.serviceId)
            return { ok: false, error: `Réservé aux spécialistes ${tender.serviceId}` }
        }

        tender.applicants.push(socketId)
        tender.applicantCount = tender.applicants.length

        room.io?.to(room.id).emit('meta_updated', {
          allMeta: allMeta(room),
          shared:  room.shared,
        })
        return { ok: true }
      }

      // ── Game master actions ───────────────────────────────────────────────

      case 'set_speed': {
        if (socketId !== room.gameMasterId)
          return { ok: false, error: 'Réservé au game master' }
        room.setSpeed(payload.speed, socketId)
        return { ok: true }
      }

      case 'export_state': {
        if (socketId !== room.gameMasterId)
          return { ok: false, error: 'Réservé au game master' }
        return { ok: true, data: room._exportState() }
      }

      case 'import_state': {
        if (socketId !== room.gameMasterId)
          return { ok: false, error: 'Réservé au game master' }
        room._importState(payload.state)
        broadcastFullState(room)
        return { ok: true }
      }

      case 'kick_player': {
        if (socketId !== room.gameMasterId)
          return { ok: false, error: 'Réservé au game master' }
        const target = room.players.get(payload.playerId)
        if (!target) return { ok: false, error: 'Joueur non trouvé' }
        target.socket?.emit('kicked', { reason: 'Expulsé par le game master' })
        target.socket?.leave(room.id)
        room.removePlayer(payload.playerId, false)
        return { ok: true }
      }

      case 'start_game': {
        if (socketId !== room.gameMasterId)
          return { ok: false, error: 'Réservé au game master' }
        if (room.shared.started)
          return { ok: false, error: 'Partie déjà démarrée' }
        room.shared.started = true
        room.startTick()
        room.io?.to(room.id).emit('game_started', { day: room.shared.day })
        room.io?.to(room.id).emit('meta_updated', { allMeta: allMeta(room), shared: room.shared })
        return { ok: true }
      }

      default:
        return { ok: false, error: `Action inconnue: ${type}` }
    }
  } catch (err) {
    console.error(`[Room ${room.id}] Action error (${type}):`, err)
    return { ok: false, error: 'Erreur serveur' }
  }

  // Force delta push for the acting player
  pushPlayerDelta(room, socketId)
  return { ok: true }
}
