// SkillEngine.js — skill tree application

import { SKILLS, SERVER_TYPES, SERVICES } from './GameState.js'
import { allGridCells } from './SimUtils.js'

function applySkill(state, skillId) {
  const skill = SKILLS[skillId]
  if (!skill) return { success: false, message: 'Compétence introuvable' }
  if ((state.unlockedSkills ?? []).includes(skillId))
    return { success: false, message: 'Déjà débloqué' }
  const sp = state.skillPoints ?? 0
  if (sp < skill.spReq)
    return { success: false, message: `Points insuffisants (${skill.spReq} pts requis, vous avez ${sp})` }
  if (skill.requires.some(r => !(state.unlockedSkills ?? []).includes(r)))
    return { success: false, message: 'Prérequis non remplis' }
  if (skill.repReq && (state.reputation ?? 0) < skill.repReq)
    return { success: false, message: `Réputation insuffisante (${skill.repReq} requis, vous avez ${Math.floor(state.reputation ?? 0)})` }
  if (state.money < skill.cost)
    return { success: false, message: `Fonds insuffisants ($${skill.cost} requis)` }

  state.money -= skill.cost
  if (!state.unlockedSkills) state.unlockedSkills = []
  state.unlockedSkills.push(skillId)

  // Service upgrade — update SERVICES templates
  if (skill.serviceUpgrade) {
    const upg = skill.serviceUpgrade;
    const targetService = SERVICES[upg.type];

    if (targetService) {
      // Mise à jour des limites max pour les futurs contrats
      if (upg.cpuMax)  targetService.cpuMax  = upg.cpuMax;
      if (upg.ramMax)  targetService.ramMax  = upg.ramMax;
      if (upg.diskMax) targetService.diskMax = upg.diskMax;

      // Optionnel : On peut aussi augmenter le basePrice car le service devient "Premium"
      targetService.basePrice = Math.round(targetService.basePrice * 1.15);

      console.log(`Service ${upg.type} amélioré !`);
    }
  }

  // State effects — modify state fields at purchase time
  if (skill.stateEffect) {
    const fx = skill.stateEffect
    if (fx.type === 'addPowerCap')
      state.powerCap = (state.powerCap ?? 3000) + fx.value

    // Reduce auto-repair days for all currently-repairing servers
    if (fx.type === 'reduceRepairDays') {
      for (const cell of allGridCells(state)) {
        if (!cell.rack) continue
        for (const server of cell.rack.servers) {
          if (server && server.status === 'repairing' && server.repairDaysLeft > 1)
            server.repairDaysLeft = Math.max(1, server.repairDaysLeft - fx.value)
        }
      }
    }

    if (fx.type === 'greenEnergy') {
      state.greenEnergy = true
      // Immediate small reputation boost for going green
      state.reputation = Math.min(100, (state.reputation ?? 0) + 5)
    }

    if (fx.type === 'disasterRecovery')
      state.hasDisasterRecovery = true

    if (fx.type === 'insurance')
      state.hasInsurance = true
  }

  return { success: true, message: `✅ ${skill.label} débloqué !` }
}

function isServerTypeUnlocked(state, type) {
  if (type === 'BASIC') return true
  if (type === 'STORAGE_DENSE') return (state.unlockedSkills ?? []).includes('STORAGE_DENSE_UNLOCK')
  return (state.unlockedSkills ?? []).includes(`${type}_UNLOCK`)
}

export { applySkill, isServerTypeUnlocked }
