// IncubatorEngine.js — startup incubator contracts (12-month fixed-price)

import { SERVICES } from './data/services.js'

const INCUBATOR_INTERVAL   = 60   // days between offers
const INCUBATOR_REP_MIN    = 40   // minimum reputation to receive offers
const INCUBATOR_DURATION   = 360  // days (≈12 months)
const INCUBATOR_OFFER_TTL  = 3    // days before offer expires

const ELIGIBLE_SERVICES = ['VPS', 'DEDICATED', 'GAMING', 'STREAMING']

// ─── Offer generation ─────────────────────────────────────────────────────────

function processIncubatorOffer(state) {
  if (state.day % INCUBATOR_INTERVAL !== 0) return
  if ((state.reputation ?? 0) < INCUBATOR_REP_MIN) return
  if (state.pendingIncubatorOffer) return   // one offer at a time

  // Tick off expired offer just in case
  if (state.pendingIncubatorOffer?.expiresDay < state.day)
    state.pendingIncubatorOffer = null

  const serviceId  = ELIGIBLE_SERVICES[Math.floor(Math.random() * ELIGIBLE_SERVICES.length)]
  const svc        = SERVICES[serviceId]
  const slots      = 2 + Math.floor(Math.random() * 3)  // 2-4 clients
  // Fixed daily price per client: 1.5× basePrice (stable premium)
  const fixedPrice = Math.round((svc?.basePrice ?? 20) * 1.5)

  state.pendingIncubatorOffer = {
    serviceId,
    fixedPrice,
    slots,
    durationDays: INCUBATOR_DURATION,
    expiresDay:   state.day + INCUBATOR_OFFER_TTL,
  }
}

// ─── Accept ───────────────────────────────────────────────────────────────────

function acceptIncubatorOffer(state) {
  const offer = state.pendingIncubatorOffer
  if (!offer) return { success: false, message: 'Aucune offre en cours' }

  const contractId = state.day  // unique enough

  if (!state.incubatorContracts) state.incubatorContracts = []

  const contract = {
    id:          contractId,
    serviceId:   offer.serviceId,
    fixedPrice:  offer.fixedPrice,
    slots:       offer.slots,
    startDay:    state.day,
    endDay:      state.day + offer.durationDays,
    clientIds:   [],
  }

  const svc = SERVICES[offer.serviceId]

  for (let i = 0; i < offer.slots; i++) {
    const clientId = state.nextClientId++
    const client = {
      id:               clientId,
      name:             `Startup-${contractId}-${i + 1}`,
      serviceId:        offer.serviceId,
      cpuDemand:        svc ? Math.round((svc.cpuMin + svc.cpuMax) / 2) : 20,
      ramDemand:        svc ? Math.round((svc.ramMin + svc.ramMax) / 2) : 4,
      diskDemand:       svc ? Math.round((svc.diskMin + svc.diskMax) / 2) : 20,
      get demand() { return this.cpuDemand },
      satisfaction:     70,
      durationExpected: offer.durationDays,
      dayArrived:       state.day,
      daysInQueue:      0,
      daysUnhappy:      0,
      serverPos:        null,
      isEnterprise:     false,
      requiredServers:  1,
      serverPositions:  [],
      pendingPositions: [],
      isIncubator:      true,
      incubatorContractId: contractId,
      fixedPrice:       offer.fixedPrice,
    }
    state.clientQueue.push(client)
    contract.clientIds.push(clientId)
  }

  state.incubatorContracts.push(contract)
  state.pendingIncubatorOffer = null

  // Small reputation boost for accepting
  state.reputation = Math.min(100, (state.reputation ?? 0) + 3)

  return { success: true, slots: offer.slots, serviceId: offer.serviceId }
}

// ─── Decline ──────────────────────────────────────────────────────────────────

function declineIncubatorOffer(state) {
  if (!state.pendingIncubatorOffer) return { success: false }
  state.pendingIncubatorOffer = null
  return { success: true }
}

export { processIncubatorOffer, acceptIncubatorOffer, declineIncubatorOffer }
