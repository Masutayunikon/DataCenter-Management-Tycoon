// MissionEngine.js — client mission generation, deadlines, resolution
// Missions are the primary source of Skill Points (SP)

import { MISSION_TYPES } from './GameState.js'
import { addTicketRaw } from './TicketEngine.js'
import { clamp } from './SimUtils.js'
import { playSFX } from './AudioEngine.js'

const MISSION_CHANCE_REGULAR    = 0.15  // 15% par client par jour
const MISSION_CHANCE_ENTERPRISE = 0.22  // 22% pour les entreprises

// ─── Step: generate missions for active clients ───────────────────────────────

function generateMissions(state) {
  if (!state.missions) state.missions = []

  let hasNewMissions = false
  for (const client of state.clients) {
    // Max 1 mission en attente par client
    const hasPending = state.missions.some(m => m.clientId === client.id)
    if (hasPending) continue

    // Cooldown par client : commence à 20j, descend jusqu'à 7j
    const cooldown = Math.max(7, 20 - Math.floor(state.day / 15))
    if ((state.day - (client.lastMissionDay ?? -999)) < cooldown) continue

    const chance = client.isEnterprise ? MISSION_CHANCE_ENTERPRISE : MISSION_CHANCE_REGULAR
    if (Math.random() > chance) continue

    const type = MISSION_TYPES[Math.floor(Math.random() * MISSION_TYPES.length)]
    // Enterprise clients rapportent 1 SP de plus
    const sp = (client.isEnterprise ? type.sp + 1 : type.sp)

    const mission = {
      id:          (state.nextMissionId = (state.nextMissionId ?? 0) + 1),
      clientId:    client.id,
      clientName:  client.name,
      isEnterprise: !!(client.isEnterprise),
      typeId:      type.id,
      label:       type.label,
      clientMessage: type.clientMessage ?? '',
      args:        type.args ?? [],
      optimalArgs: type.optimalArgs ?? {},
      command:     type.command,
      urgency:     type.urgency,
      sp,
      satReward:   type.satReward,
      satPenalty:  type.satPenalty,
      deadline:    type.deadline,
      daysLeft:    type.deadline,
      dayCreated:  state.day,
    }
    client.lastMissionDay = state.day
    state.missions.push(mission)
    hasNewMissions = true
  }
  
  if (hasNewMissions) {
    playSFX('notification')
  }
}

// ─── Step: tick deadlines, expire overdue missions ────────────────────────────

function processMissionDeadlines(state) {
  if (!state.missions?.length) return

  const remaining = []
  for (const mission of state.missions) {
    mission.daysLeft--

    if (mission.daysLeft <= 0) {
      // Expirée — pénalité de satisfaction
      const client = state.clients.find(c => c.id === mission.clientId)
      if (client) {
        client.satisfaction = clamp(0, 100, client.satisfaction + mission.satPenalty)
      }
      addTicketRaw(state, 'incident',
        `⏰ Mission expirée : "${mission.label}" — ${mission.clientName} (${mission.satPenalty} sat)`,
        'warning', null, mission.clientId)
      continue
    }
    remaining.push(mission)
  }
  state.missions = remaining
}

// ─── Player action: resolve a mission ────────────────────────────────────────

function resolveMission(state, missionId, satMul = 1, spMul = 1) {
  if (!state.missions) return { success: false, message: 'Aucune mission' }

  const idx = state.missions.findIndex(m => m.id === missionId)
  if (idx === -1) return { success: false, message: 'Mission introuvable' }

  const mission   = state.missions[idx]
  const client    = state.clients.find(c => c.id === mission.clientId)
  const satReward = Math.round(mission.satReward * satMul)
  const sp        = Math.round(mission.sp * spMul)

  if (client) {
    client.satisfaction = clamp(0, 100, client.satisfaction + satReward)
  }

  state.skillPoints = (state.skillPoints ?? 0) + sp
  state.missions.splice(idx, 1)
  state.totalMissionsCompleted = (state.totalMissionsCompleted ?? 0) + 1

  addTicketRaw(state, 'info',
    `✅ "${mission.label}" résolu — ${mission.clientName} (+${satReward} sat, +${sp} SP)`,
    'info', null, mission.clientId)

  return { success: true, sp, satReward }
}

export { generateMissions, processMissionDeadlines, resolveMission }
