// SimulationEngine.js — thin orchestrator; re-exports full public API

import { tryTriggerEvent, tickEvents } from './EventSystem.js'
import { computeNetworkUsage, upgradeSwitch } from './NetworkEngine.js'
import { processIncubatorOffer, acceptIncubatorOffer, declineIncubatorOffer } from './IncubatorEngine.js'
import { generateClients, generateEnterpriseClients, assignQueuedClients, updateSatisfaction, processDepartures, updateReputation } from './ClientEngine.js'
import { updateServerLoads, processServerFailures, computeHeat, computePower, updateServerUptime, processHacks } from './ServerEngine.js'
import { calculateRevenue, calculateElectricityCost, calculateMaintenanceCost, calculateEmployeeCost, generateTickets, autoResolveTickets } from './EconomyEngine.js'
import { generateMissions, processMissionDeadlines } from './MissionEngine.js'
import { MILESTONES } from './GameState.js'
import { allGridCells } from './SimUtils.js'
import { clamp } from './SimUtils.js'
import { playSFX } from './AudioEngine.js'

const DAY_DURATION_MS = 24000

// ─── Uptime streak ────────────────────────────────────────────────────────────

function updateUptimeStreak(state) {
  const anyFailed = [...allGridCells(state)].some(cell =>
    cell.rack?.servers?.some(s => s && s.status === 'failed')
  )
  if (anyFailed) {
    state.currentUptimeStreak = 0
  } else {
    state.currentUptimeStreak = (state.currentUptimeStreak ?? 0) + 1
    state.longestUptime = Math.max(state.longestUptime ?? 0, state.currentUptimeStreak)
  }
}

// ─── Milestone checking ───────────────────────────────────────────────────────

function checkMilestones(state) {
  if (!state.milestones) state.milestones = []
  for (const ms of MILESTONES) {
    if (state.milestones.includes(ms.id)) continue
    if (ms.condition(state)) {
      state.milestones.push(ms.id)
      // Push as a notification so the UI can display it
      const id = state.nextNotificationId ?? 1
      state.nextNotificationId = id + 1
      state.notifications = state.notifications ?? []
      state.notifications.push({
        id,
        message: `🏆 Succès débloqué : ${ms.label} — ${ms.desc}`,
        severity: 'info',
        day: state.day,
        read: false,
        isMilestone: true,
        milestoneId: ms.id,
      })
      playSFX('money')
    }
  }
}

// ─── AUTO_SCALING passive satisfaction bonus ──────────────────────────────────

function applyAutoScalingBonus(state) {
  if (!state.unlockedSkills?.includes('AUTO_SCALING')) return
  for (const client of state.clients) {
    client.satisfaction = clamp(0, 100, (client.satisfaction ?? 50) + 0.1)
  }
}

// ─── Main tick ────────────────────────────────────────────────────────────────

function processDayTick(state) {
  state.day += 1

  tickEvents(state)
  const newEvent = tryTriggerEvent(state)

  generateClients(state)
  generateEnterpriseClients(state)
  assignQueuedClients(state)
  updateServerLoads(state)
  processServerFailures(state)
  processHacks(state)
  computeHeat(state)
  computePower(state)
  computeNetworkUsage(state)
  calculateRevenue(state)
  calculateElectricityCost(state)
  calculateMaintenanceCost(state)
  calculateEmployeeCost(state)
  updateSatisfaction(state)
  applyAutoScalingBonus(state)
  processDepartures(state)
  generateTickets(state)
  autoResolveTickets(state)
  generateMissions(state)
  processIncubatorOffer(state)
  processMissionDeadlines(state)
  updateReputation(state)
  updateServerUptime(state)
  updateUptimeStreak(state)
  checkMilestones(state)

  return newEvent
}

// ─── Re-exports (preserve public API for all components) ─────────────────────

export { DAY_DURATION_MS, processDayTick }

export { getArrivalRate, generateEnterpriseClients, assignClientToServer, getServersForQueueClient, EMPLOYEE_ASSIGN_CAPACITY, EMPLOYEE_ASSIGN_DAILY } from './ClientEngine.js'
export { resolveMission } from './MissionEngine.js'
export { repairServer, restartServer, moveClient, moveAllClients, removeServer, processHacks, getHackProtection, BASE_HACK_CHANCE, AUTO_REPAIR_DAYS, AUTO_REPAIR_COST } from './ServerEngine.js'
export { applyPriceChange } from './EconomyEngine.js'
export { unlockCell, buyFloor, getUnlockCost, isAdjacentToUnlocked } from './GridEngine.js'
export { applySkill, isServerTypeUnlocked } from './SkillEngine.js'
export { findBestServer, getServerLoad, getCompatibleServers } from './SimUtils.js'
export { MILESTONES } from './GameState.js'
export { upgradeSwitch, SWITCH_UPGRADE_COST, SWITCH_BANDWIDTH_INCREMENT } from './NetworkEngine.js'
export { acceptIncubatorOffer, declineIncubatorOffer } from './IncubatorEngine.js'
