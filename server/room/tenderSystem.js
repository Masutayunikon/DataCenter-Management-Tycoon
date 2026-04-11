// tenderSystem.js — Tender generation, awarding, and lifecycle for a GameRoom

import { nanoid } from 'nanoid'

// ─── Constants ────────────────────────────────────────────────────────────────

const TENDER_SERVICES = ['VPS', 'DEDICATED', 'STORAGE', 'GAMING']

const TENDER_LABELS = {
  budget:     ['Contrat Hébergement Basique', 'Migration Web PME', 'Infra Cloud Startup', 'Pack Mutualisé Pro'],
  premium:    ['SLA Enterprise Gold', 'Datacenter Haute Dispo', 'Infrastructure Mission-Critical', 'Contrat Premium Plus'],
  specialist: ['Hub Gaming National', 'NAS Professionnel', 'Cluster VPS Dédié', 'Serveur Dédié Exclusif'],
}

// ─── Private: create tender definition ───────────────────────────────────────

function _buildTenderDef(day, serviceId, type) {
  const labels   = TENDER_LABELS[type]
  const label    = labels[Math.floor(Math.random() * labels.length)]
  const duration = 180 + Math.floor(Math.random() * 186)  // 180–365 days
  const reqSvr   = 2 + Math.floor(Math.random() * 3)      // 2–4
  const dailyRev = 150 + Math.floor(Math.random() * 351)  // 150–500 $/day
  const minSlots = 2 + Math.floor(Math.random() * 3)

  const minReputation = type === 'budget' ? 15 : type === 'premium' ? 20 : 35

  return {
    id:              nanoid(6),
    type,
    serviceId,
    label,
    minReputation,
    minSlots,
    dailyRevenue:    dailyRev,
    duration,
    requiredServers: reqSvr,
    openedDay:       day,
    expiresDay:      day + 1,
    status:          'open',
    winnerId:        null,
    winnerName:      null,
    applicants:      [],
    applicantCount:  0,
  }
}

// ─── Generate a batch of tenders ─────────────────────────────────────────────

export function generateTenders(room, day) {
  const types = ['budget', 'premium', 'specialist']
  const count = 2 + Math.floor(Math.random() * 2)  // 2–3 per batch

  for (let i = 0; i < count; i++) {
    const type      = types[Math.floor(Math.random() * types.length)]
    const serviceId = TENDER_SERVICES[Math.floor(Math.random() * TENDER_SERVICES.length)]
    room.shared.tenders.push(_buildTenderDef(day, serviceId, type))
  }

  console.log(`[Room ${room.id}] Generated ${count} tenders on day ${day}`)

  room.io?.to(room.id).emit('tenders_available', {
    tenders: room.shared.tenders.filter(t => t.status === 'open'),
  })
}

// ─── Award a tender to the best candidate ────────────────────────────────────

export function awardTender(room, tender) {
  const candidates = tender.applicants
    .map(id => room.players.get(id))
    .filter(Boolean)

  if (candidates.length === 0) {
    tender.status = 'expired'
    return
  }

  let winner = null
  if (tender.type === 'budget') {
    winner = candidates.reduce((best, p) => {
      const price  = p.state.servicePrices?.[tender.serviceId] ?? Infinity
      const bPrice = best.state.servicePrices?.[tender.serviceId] ?? Infinity
      return price < bPrice ? p : best
    })
  } else {
    winner = candidates.reduce((best, p) =>
      (p.state.reputation ?? 0) > (best.state.reputation ?? 0) ? p : best
    )
  }

  tender.status     = 'awarded'
  tender.winnerId   = winner.id
  tender.winnerName = winner.name

  // Push enterprise client to winner's queue
  const reqSvr = tender.requiredServers
  winner.state.clientQueue.push({
    id:               `ent_${tender.id}`,
    name:             `[${tender.label}]`,
    serviceId:        tender.serviceId,
    isEnterprise:     true,
    dailyRate:        tender.dailyRevenue,
    requiredServers:  reqSvr,
    serverPositions:  [],
    pendingPositions: [],
    cpuDemand:        reqSvr * 25,
    ramDemand:        reqSvr * 30,
    diskDemand:       reqSvr * 20,
    satisfaction:     85,
    daysUnhappy:      0,
    durationExpected: tender.duration,
    dayArrived:       room.shared.day,
    serverPos:        null,
  })

  console.log(`[Room ${room.id}] Tender "${tender.label}" awarded to "${winner.name}"`)

  room.io?.to(room.id).emit('tender_awarded', {
    tenderId:   tender.id,
    winnerName: winner.name,
    winnerId:   winner.id,
    label:      tender.label,
  })
}

// ─── Process tenders each tick ────────────────────────────────────────────────

export function processTenders(room) {
  const day = room.shared.day

  // Generate new batch if needed
  if (day >= room._nextTenderDay) {
    generateTenders(room, day)
    room._nextTenderDay = day + 18 + Math.floor(Math.random() * 8)  // +18–25 days
  }

  // Award / expire open tenders past their deadline
  let anyChanged = false
  for (const tender of room.shared.tenders) {
    if (tender.status !== 'open') continue
    if (day < tender.expiresDay) continue

    if (tender.applicants.length === 0) {
      tender.status = 'expired'
    } else {
      awardTender(room, tender)
    }
    anyChanged = true
  }

  // Prune: keep last 5 closed + all open
  const open   = room.shared.tenders.filter(t => t.status === 'open')
  const closed = room.shared.tenders.filter(t => t.status !== 'open')
    .sort((a, b) => b.openedDay - a.openedDay)
    .slice(0, 5)
  room.shared.tenders = [...open, ...closed]

  if (anyChanged) {
    room.io?.to(room.id).emit('meta_updated', {
      allMeta: room._allMeta(),
      shared:  room.shared,
    })
  }
}
