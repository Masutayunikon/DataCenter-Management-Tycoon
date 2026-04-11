// TicketEngine.js — ticket creation & queries

import { createTicket, createNotification } from './GameState.js'
import { playSFX } from './AudioEngine.js'

function addTicket(state, type, message, severity, cell, slot) {
  const serverPos = cell ? { floorId: cell.floorId, x: cell.x, y: cell.y, slot } : null
  addTicketRaw(state, type, message, severity, serverPos, null)
}

function addTicketRaw(state, type, message, severity, serverPos, clientId) {
  state.tickets.push(createTicket(state.nextTicketId++, type, message, severity, state.day, serverPos, clientId))
  if (state.tickets.length > 50) state.tickets.shift()
  playSFX('notification')
}

function hasRecentTicket(state, type, serverPos, clientId, withinDays) {
  return state.tickets.some(t =>
    t.type === type &&
    (clientId ? t.clientId === clientId : true) &&
    (state.day - t.day) <= withinDays &&
    !t.read
  )
}

function addNotification(state, message, severity = 'info') {
  if (!state.notifications) state.notifications = []
  if (state.nextNotificationId === undefined) state.nextNotificationId = 1
  state.notifications.push(createNotification(state.nextNotificationId++, message, severity, state.day))
  if (state.notifications.length > 80) state.notifications.shift()
  playSFX('notification')
}

export { addTicket, addTicketRaw, hasRecentTicket, addNotification }
