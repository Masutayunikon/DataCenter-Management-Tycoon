// NetworkEngine.js — per-floor network bandwidth tracking

import { SERVICES } from './data/services.js'

const SWITCH_UPGRADE_COST        = 500   // $ per upgrade
const SWITCH_BANDWIDTH_INCREMENT = 2     // Gbps added per upgrade

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
  if (!floor)                       return { success: false, message: 'Étage introuvable' }
  if (state.money < SWITCH_UPGRADE_COST)
    return { success: false, message: `Fonds insuffisants ($${SWITCH_UPGRADE_COST} requis)` }

  state.money -= SWITCH_UPGRADE_COST
  floor.switchBandwidth = (floor.switchBandwidth ?? 1) + SWITCH_BANDWIDTH_INCREMENT
  return { success: true }
}

export { computeNetworkUsage, upgradeSwitch, SWITCH_UPGRADE_COST, SWITCH_BANDWIDTH_INCREMENT }
