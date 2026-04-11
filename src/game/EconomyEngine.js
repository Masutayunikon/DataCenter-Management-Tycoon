// EconomyEngine.js — revenue, costs, price changes, ticket generation

import { SERVER_TYPES, SERVICES, ELECTRICITY_RATE } from './GameState.js'
import { allGridCells, clamp } from './SimUtils.js'
import { addTicketRaw, hasRecentTicket } from './TicketEngine.js'
import { getEventMultiplier } from './EventSystem.js'

const EMPLOYEE_ASSIGN_CAPACITY   = 5   // clients/j par employé d'affectation
const EMPLOYEE_ASSIGN_DAILY      = 80  // $80/j par employé d'affectation
const EMPLOYEE_SUPPORT_DAILY     = 100 // $100/j par technicien support
const EMPLOYEE_SECURITY_DAILY    = 120 // $120/j par technicien sécurité

// ─── Step 7: Revenue ─────────────────────────────────────────────────────────

function calculateRevenue(state) {
  let total = 0
  for (const client of state.clients) {
    // Enterprise clients use their own dailyRate, not servicePrices
    if (client.isEnterprise && client.dailyRate != null) {
      total += client.dailyRate
    } else if (client.fixedPrice != null) {
      total += client.fixedPrice
    } else {
      total += state.servicePrices[client.serviceId] ?? 0
    }
  }
  // BULK_DEAL skill: enterprise clients pay +15%
  if (state.unlockedSkills?.includes('BULK_DEAL')) {
    for (const client of state.clients) {
      if (client.isEnterprise && client.dailyRate != null)
        total += Math.round(client.dailyRate * 0.15)
    }
  }
  state.revenue         = total
  state.money          += total
  state.totalEarned     = (state.totalEarned ?? 0) + total
}

// ─── Step 8: Costs ────────────────────────────────────────────────────────────

function calculateElectricityCost(state) {
  const multiplier  = getEventMultiplier(state, 'electricityMultiplier')
  const powerOpt    = state.unlockedSkills?.includes('POWER_OPT') ? 0.85 : 1.0
  // GREEN_ENERGY skill: additional -25% on top of POWER_OPT
  const greenFactor = state.greenEnergy ? 0.75 : 1.0
  state.electricityCost = Math.round(state.power * ELECTRICITY_RATE * multiplier * powerOpt * greenFactor)
  state.money          -= state.electricityCost
  state.totalLost       = (state.totalLost ?? 0) + state.electricityCost
}

function calculateMaintenanceCost(state) {
  let total = 0
  for (const cell of allGridCells(state)) {
    if (!cell.rack) continue
    for (const server of cell.rack.servers)
      if (server) total += SERVER_TYPES[server.type]?.dailyCost ?? 0
  }
  state.maintenanceCost = total
  state.money          -= total
  state.totalLost       = (state.totalLost ?? 0) + total
}

function calculateEmployeeCost(state) {
  const assignCost   = (state.employees?.assignment ?? 0) * EMPLOYEE_ASSIGN_DAILY
  const supportCost  = (state.employees?.support    ?? 0) * EMPLOYEE_SUPPORT_DAILY
  const securityCost = (state.employees?.security   ?? 0) * EMPLOYEE_SECURITY_DAILY
  state.employeeCost = assignCost + supportCost + securityCost
  state.money       -= state.employeeCost
  state.totalLost    = (state.totalLost ?? 0) + state.employeeCost
}

// ─── Ticket generation ────────────────────────────────────────────────────────

function generateTickets(state) {
  for (const client of state.clients) {
    if (client.satisfaction < 40) {
      if (!hasRecentTicket(state, 'performance', null, client.id, 5)) {
        addTicketRaw(state, 'performance',
          `${client.name} insatisfait (${Math.round(client.satisfaction)}%)`,
          'warning', null, client.id)
      }
    }
  }

  if (state.clientQueue.length >= 3) {
    if (!hasRecentTicket(state, 'capacity', null, null, 3)) {
      addTicketRaw(state, 'capacity',
        `${state.clientQueue.length} clients en attente`,
        'warning', null, null)
    }
  }
}

// ─── Support employee — auto-resolve tickets ──────────────────────────────────
// Base: 3 tickets/employee/day; SUPPORT_UPGRADE → 6; SUPPORT_UPGRADE2 → 10

function getMaxTicketsPerDay(state) {
  if (state.unlockedSkills?.includes('SUPPORT_UPGRADE2')) return 10
  if (state.unlockedSkills?.includes('SUPPORT_UPGRADE'))  return 6
  return 3
}

function autoResolveTickets(state) {
  const supportCount = state.employees?.support ?? 0
  if (supportCount <= 0) return
  const maxPerEmployee = getMaxTicketsPerDay(state)
  let quota = supportCount * maxPerEmployee

  // Prioritise warning, then critical, then info — oldest first
  const unread = state.tickets
    .filter(t => !t.read)
    .sort((a, b) => {
      const pri = { warning: 0, critical: 1, info: 2 }
      return (pri[a.severity] ?? 2) - (pri[b.severity] ?? 2) || a.day - b.day
    })

  for (const ticket of unread) {
    if (quota <= 0) break
    ticket.read = true
    // Give a small satisfaction boost to the related client
    if (ticket.clientId) {
      const client = state.clients.find(c => c.id === ticket.clientId)
      if (client) client.satisfaction = clamp(0, 100, client.satisfaction + 5)
    }
    quota--
  }
}

// ─── Price change → satisfaction impact ──────────────────────────────────────

function applyPriceChange(state, serviceId, oldPrice, newPrice) {
  if (oldPrice === newPrice) return
  const changePct = (newPrice - oldPrice) / Math.max(1, oldPrice)
  const flex      = state.unlockedSkills?.includes('PRICING_FLEX') ? 0.5 : 1.0
  const impact    = changePct * 40 * flex

  for (const client of state.clients) {
    if (client.serviceId !== serviceId) continue
    client.satisfaction = clamp(0, 100, client.satisfaction - impact)
  }
}

export {
  EMPLOYEE_ASSIGN_CAPACITY, EMPLOYEE_ASSIGN_DAILY,
  EMPLOYEE_SUPPORT_DAILY, EMPLOYEE_SECURITY_DAILY,
  calculateRevenue, calculateElectricityCost, calculateMaintenanceCost,
  calculateEmployeeCost, generateTickets, applyPriceChange, autoResolveTickets,
}
