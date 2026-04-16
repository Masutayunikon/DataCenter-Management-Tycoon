// SLAEngine.js — Service Level Agreement tiers

const SLA_CONFIG = {
  BRONZE: { multiplier: 1.0,  uptimeRequired: 0   },
  SILVER: { multiplier: 1.25, uptimeRequired: 0.95 },
  GOLD:   { multiplier: 1.75, uptimeRequired: 0.99 },
}

// ─── Roll SLA level for a new client based on service SLA setting ─────────────

function rollClientSLA(serviceSLASetting) {
  const r = Math.random()
  if (serviceSLASetting === 'GOLD') {
    if (r < 0.10) return 'GOLD'
    if (r < 0.40) return 'SILVER'
    return 'BRONZE'
  }
  if (serviceSLASetting === 'SILVER') {
    if (r < 0.25) return 'SILVER'
    return 'BRONZE'
  }
  return 'BRONZE'
}

// ─── Get price with SLA multiplier applied ────────────────────────────────────

function getSLAPrice(basePrice, slaLevel) {
  const cfg = SLA_CONFIG[slaLevel] ?? SLA_CONFIG.BRONZE
  return Math.round(basePrice * cfg.multiplier)
}

// ─── Process SLA compliance each tick ────────────────────────────────────────

function processSLACompliance(state) {
  for (const client of state.clients) {
    if (!client.slaLevel || client.slaLevel === 'BRONZE') continue
    const cfg = SLA_CONFIG[client.slaLevel]
    if (!cfg || cfg.uptimeRequired === 0) continue

    // Find the server(s) for this client
    let serverOk = true
    if (client.isEnterprise && client.serverPositions?.length > 0) {
      for (const pos of client.serverPositions) {
        const floor = state.floors?.find(f => f.id === pos.floorId)
        const cell  = floor?.grid?.[pos.y]?.[pos.x]
        const server = cell?.rack?.servers?.[pos.slot]
        if (!server || server.status !== 'ok') { serverOk = false; break }
      }
    } else if (client.serverPos) {
      const pos    = client.serverPos
      const floor  = state.floors?.find(f => f.id === pos.floorId)
      const cell   = floor?.grid?.[pos.y]?.[pos.x]
      const server = cell?.rack?.servers?.[pos.slot]
      if (!server || server.status !== 'ok') serverOk = false
    }

    if (serverOk) {
      client.slaUptimeDays = (client.slaUptimeDays ?? 0) + 1
    } else {
      // SLA breach — reputation penalty + partial refund
      const lastNotif = client._slaLastNotifDay ?? -999
      if (state.day - lastNotif >= 5) {
        client._slaLastNotifDay = state.day
        const penalty = client.slaLevel === 'GOLD' ? 2 : 1
        state.reputation = Math.max(0, (state.reputation ?? 0) - penalty)
        // Refund one day of revenue
        const baseP    = state.servicePrices?.[client.serviceId] ?? 0
        const refund   = getSLAPrice(baseP, client.slaLevel)
        state.money    = (state.money ?? 0) - refund

        // Notification
        const id = state.nextNotificationId ?? 1
        state.nextNotificationId = id + 1
        state.notifications = state.notifications ?? []
        state.notifications.push({
          id,
          message:   `⚠️ Violation SLA ${client.slaLevel} — ${client.name} (remboursement $${refund})`,
          severity:  'warning',
          day:       state.day,
          read:      false,
        })
      }
    }
  }
}

// ─── Set service SLA level ────────────────────────────────────────────────────

function setServiceSLA(state, serviceId, level) {
  if (!state.serviceSLA) state.serviceSLA = {}
  if (SLA_CONFIG[level]) state.serviceSLA[serviceId] = level
}

export { SLA_CONFIG, rollClientSLA, getSLAPrice, processSLACompliance, setServiceSLA }
