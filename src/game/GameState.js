import { COLUMNS, ROWS, RACK_COST, RACK_SLOTS, ELECTRICITY_RATE, FLOOR_COST_BASE, CELL_UNLOCK_BASE } from './data/constants.js'
import { SERVICES } from './data/services.js'
import { SERVER_TYPES } from './data/serverTypes.js'
import { SKILLS } from './data/skills.js'
import { MISSION_TYPES, CLIENT_NAMES, ENTERPRISE_NAMES } from './data/missions.js'
import { MILESTONES } from './data/milestones.js'

// ─── Factory functions ────────────────────────────────────────────────────────

function createServer(type = 'BASIC') {
  const def = SERVER_TYPES[type]
  return {
    type,
    label:           def.label,
    cpuCapacity:     def.cpuCapacity,
    ramCapacity:     def.ramCapacity,
    diskCapacity:    def.diskCapacity,
    cpuLoad:         0,
    ramLoad:         0,
    diskLoad:        0,
    // legacy alias (used in a few places for heat/power calculations)
    get load() { return this.cpuLoad },
    set load(v) { this.cpuLoad = v },
    temperature:     20,
    powerUsage:      0,
    reliability:     def.reliability,
    status:          'ok',
    health:          100,
    repairDaysLeft:   0,
    failedDays:       0,
    restartAttempts:  0,
    lifetimeRestarts: 0,  // never resets — degrades restart success chance
    uptime:           0,
    logs:            [],
    services:        [],
    modules:         [],
  }
}

function createRack() {
  return {
    coolingLevel: 1,
    maxHeat:      100,
    efficiency:   1.0,
    servers:      Array(RACK_SLOTS).fill(null),
  }
}

function createClient(id, day, serviceId = 'VPS') {
  const svc          = SERVICES[serviceId] ?? SERVICES.VPS
  const isEnterprise = !!(svc.minServers)
  const nameList     = isEnterprise ? ENTERPRISE_NAMES : CLIENT_NAMES
  const nameIndex    = (id - 1) % nameList.length

  function rand(min, max) { return min + Math.floor(Math.random() * (max - min + 1)) }

  const requiredServers = isEnterprise
    ? svc.minServers + Math.floor(Math.random() * (svc.maxServers - svc.minServers + 1))
    : 1

  return {
    id,
    name:             `${nameList[nameIndex]}-${id}`,
    serviceId,
    cpuDemand:        rand(svc.cpuMin,  svc.cpuMax),
    ramDemand:        rand(svc.ramMin,  svc.ramMax),
    diskDemand:       rand(svc.diskMin, svc.diskMax),
    // legacy alias
    get demand() { return this.cpuDemand },
    satisfaction:     50,
    durationExpected: (isEnterprise ? 60 : 20) + Math.floor(Math.random() * (isEnterprise ? 121 : 71)),
    dayArrived:       day,
    daysInQueue:      0,
    daysUnhappy:      0,
    serverPos:        null,
    // Enterprise multi-server fields
    isEnterprise,
    requiredServers,
    serverPositions:  [],   // active server slots (filled = active)
    pendingPositions: [],   // slots being assigned in queue
  }
}

function createTicket(id, type, message, severity, day, serverPos = null, clientId = null) {
  return {
    id,
    type,
    message,
    severity,  // 'info' | 'warning' | 'critical'
    day,
    read:      false,
    serverPos, // { floorId, x, y, slot } | null
    clientId,
  }
}

function createNotification(id, message, severity, day) {
  return { id, message, severity, day, read: false }
}

function createServiceTemplate(id, name, cpuDemand, ramDemand, diskDemand, fixedPrice, slots = 10) {
  return { id, name, cpuDemand, ramDemand, diskDemand, fixedPrice, slots }
}

// ─── Floor / Grid ─────────────────────────────────────────────────────────────

function createFloor(id, unlockedRows = 3, unlockedCols = 3) {
  const grid = []
  for (let y = 0; y < ROWS.length; y++) {
    const row = []
    for (let x = 0; x < COLUMNS.length; x++) {
      const locked = !(x < unlockedCols && y < unlockedRows)
      row.push({ x, y, floorId: id, notation: `${COLUMNS[x]}${ROWS[y]}`, rack: null, locked })
    }
    grid.push(row)
  }
  return { id, name: id === 0 ? 'RDC' : `Étage ${id}`, grid }
}

function createGameState() {
  return {
    floors:             [createFloor(0, 1, 1)],
    currentFloor:       0,
    money:              1000,
    settings: {
      masterVolume: 50,
      musicVolume: 50,
      sfxVolume: 80,
    },
    // Per-service prices (player configures these — ENTERPRISE uses client.dailyRate instead)
    servicePrices:      { VPS: 8, DEDICATED: 45, STORAGE: 15, GAMING: 30, STREAMING: 22, AI_CLOUD: 80 },
    // Slot counts per service (0 = disabled, N = max concurrent clients accepted)
    serviceSlots:       { VPS: 0, DEDICATED: 0, STORAGE: 0, GAMING: 0, STREAMING: 0, AI_CLOUD: 0 },
    revenue:            0,
    electricityCost:    0,
    maintenanceCost:    0,
    employeeCost:       0,
    employees: {
      assignment: 0,
      support:    0,
      security:   0,
    },
    power:              0,
    powerCap:           3000,  // W — overload penalty above this
    heat:               0,
    reputation:         0,
    skillPoints:        0,  // earned on contract completion; used for skill tree
    clients:            [],
    clientQueue:        [],
    nextClientId:       1,
    tickets:            [],
    nextTicketId:       1,
    notifications:      [],
    nextNotificationId: 1,
    missions:           [],
    nextMissionId:      0,
    activeEvents:       [],
    eventHistory:       [],
    unlockedSkills:     [],
    day:                0,
    hour:               0,
    speed:              1,
    // Service templates — per-service tier lists
    serviceTemplates:   { VPS: [], DEDICATED: [], STORAGE: [], GAMING: [], STREAMING: [], AI_CLOUD: [] },
    serviceModes:       { VPS: 'auto', DEDICATED: 'auto', STORAGE: 'auto', GAMING: 'auto', STREAMING: 'auto', AI_CLOUD: 'auto' },
    // ── Progression & stats tracking ─────────────────────────────────────────
    totalEarned:        0,   // cumulative revenue across all days
    totalLost:          0,   // cumulative costs & fines across all days
    totalClientsServed: 0,   // how many clients have been successfully completed
    totalMissionsCompleted: 0,
    longestUptime:      0,   // high score: consecutive days without any server failure
    currentUptimeStreak: 0,
    // ── Infrastructure flags ──────────────────────────────────────────────────
    greenEnergy:        false,  // set true by GREEN_ENERGY skill
    hasInsurance:       false,  // set true by INSURANCE skill
    hasDisasterRecovery: false, // set true by DISASTER_RECOVERY skill
    // ── Milestones ────────────────────────────────────────────────────────────
    // Unlocked milestone IDs recorded here for the UI to display achievements
    milestones:         [],
  }
}

export {
  COLUMNS, ROWS,
  RACK_COST, RACK_SLOTS, ELECTRICITY_RATE,
  FLOOR_COST_BASE, CELL_UNLOCK_BASE,
  SERVER_TYPES, SERVICES, MISSION_TYPES, CLIENT_NAMES, ENTERPRISE_NAMES, SKILLS, MILESTONES,
  createGameState, createFloor, createRack, createServer, createClient, createTicket, createNotification, createServiceTemplate,
}
