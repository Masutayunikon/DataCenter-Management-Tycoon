const COLUMNS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']
const ROWS    = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]

const RACK_COST        = 400
const RACK_SLOTS       = 6
const ELECTRICITY_RATE = 0.015
const FLOOR_COST_BASE  = 10000  // × floors.length to buy next floor
const CELL_UNLOCK_BASE = 400   // base + unlockedCount × 200

export { COLUMNS, ROWS, RACK_COST, RACK_SLOTS, ELECTRICITY_RATE, FLOOR_COST_BASE, CELL_UNLOCK_BASE }
