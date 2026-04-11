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
  if (!floor) return false
  const cell = floor.grid[y]?.[x]
  if (!cell || !cell.locked) return false
  if (!isAdjacentToUnlocked(floor.grid, x, y)) return false

  const cost = getUnlockCost(floor)
  if (state.money < cost) return false

  state.money -= cost
  cell.locked  = false
  return true
}

function buyFloor(state) {
  const cost = FLOOR_COST_BASE * state.floors.length
  if (state.money < cost) return false

  state.money -= cost
  const newFloor = createFloor(state.floors.length, 2, 2)
  state.floors.push(newFloor)
  return true
}

export { getUnlockCost, isAdjacentToUnlocked, unlockCell, buyFloor }
