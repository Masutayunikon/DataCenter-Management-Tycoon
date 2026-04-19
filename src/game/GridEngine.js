// GridEngine.js — floor/cell unlocking and expansion

import { createFloor, FLOOR_COST_BASE, CELL_UNLOCK_BASE } from './GameState.js'
import { getFloor } from './SimUtils.js'

function getUnlockCost(floor) {
  const unlockedCount = floor.grid.flat().filter(c => !c.locked).length
  return CELL_UNLOCK_BASE + unlockedCount * 200
}

function isAdjacentToUnlocked(grid, x, y) {
  const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]]
  return dirs.some(([dx, dy]) => {
    const nx = x + dx
    const ny = y + dy
    if (nx < 0 || ny < 0 || nx >= 10 || ny >= 10) return false
    return !grid[ny][nx].locked
  })
}

function unlockCell(state, floorId, x, y) {
  const floor = getFloor(state, floorId)
  if (!floor) return { success: false, message: 'Étage introuvable' }
  const cell = floor.grid[y]?.[x]
  if (!cell || !cell.locked) return { success: false, message: 'Case invalide ou déjà débloquée' }
  if (!isAdjacentToUnlocked(floor.grid, x, y)) return { success: false, message: 'Case non adjacente' }

  const cost = getUnlockCost(floor)
  if (state.money < cost) return { success: false, message: `Fonds insuffisants ($${cost} requis)` }

  state.money -= cost
  cell.locked  = false
  return { success: true }
}

function buyFloor(state) {
  const cost = FLOOR_COST_BASE * state.floors.length
  if (state.money < cost) return { success: false, message: `Fonds insuffisants ($${cost} requis)` }

  state.money -= cost
  const newFloor = createFloor(state.floors.length, 2, 2)
  state.floors.push(newFloor)
  return { success: true }
}

export { getUnlockCost, isAdjacentToUnlocked, unlockCell, buyFloor }
