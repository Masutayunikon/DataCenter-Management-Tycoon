// NetworkEngine.js — per-floor network bandwidth tracking

import { SERVICES } from './data/services.js'

const SWITCH_UPGRADE_COST_BASE   = 500   // $ base cost (upgrade #0)
const SWITCH_BANDWIDTH_INCREMENT = 2     // Gbps added per upgrade

/**
 * Progressive cost: 500 × (1 + n/4)²  where n = upgrades already done.
 * First upgrade: $500 — tenth: ~$5 000 — softer than n² but clearly increasing.
 *
 * n │  0    1    2     3     4     5     8    10
 * $ │ 500  800 1150  1550  2000  2550  4500  6150
 */
function getSwitchUpgradeCost(floor) {
  const n = Math.floor(((floor.switchBandwidth ?? 1) - 1) / SWITCH_BANDWIDTH_INCREMENT)
  return Math.round(SWITCH_UPGRADE_COST_BASE * Math.pow(1 + n * 0.25, 2) / 50) * 50
}

/**
 * Called each tick. Computes per-floor bandwidth usage and sets
 * floor.bandwidthUsed (Mbps) and floor.bandwidthSaturated (bool).
 */
function computeNetworkUsage(state) {
  // Accumulate bandwidth per floor from active clients
  const floorUsage = {}   // floorId → Mbps

  for (const client of state.clients) {
    const svc = SERVICES[client.serviceId]
    const bw  = svc?.bandwidthPerClient ?? 20

    const positions = (client.isEnterprise && client.serverPositions?.length > 0)
      ? client.serverPositions
      : (client.serverPos ? [client.serverPos] : [])

    const floors = new Set(positions.map(p => p.floorId))
    for (const fid of floors) {
      floorUsage[fid] = (floorUsage[fid] ?? 0) + bw
    }
  }

  // Update each floor
  for (const floor of state.floors ?? []) {
    const usedMbps = floorUsage[floor.id] ?? 0
    const capMbps  = (floor.switchBandwidth ?? 1) * 1000
    floor.bandwidthUsed      = usedMbps
    floor.bandwidthSaturated = usedMbps > capMbps
  }
}

/**
 * Upgrade a floor's switch bandwidth by SWITCH_BANDWIDTH_INCREMENT Gbps.
 */
function upgradeSwitch(state, floorId) {
  const floor = (state.floors ?? []).find(f => f.id === floorId)
  if (!floor) return { success: false, message: 'Étage introuvable' }

  const cost = getSwitchUpgradeCost(floor)
  if (state.money < cost)
    return { success: false, message: `Fonds insuffisants ($${cost} requis)` }

  state.money -= cost
  floor.switchBandwidth = (floor.switchBandwidth ?? 1) + SWITCH_BANDWIDTH_INCREMENT
  return { success: true }
}

export { computeNetworkUsage, upgradeSwitch, getSwitchUpgradeCost, SWITCH_BANDWIDTH_INCREMENT }
