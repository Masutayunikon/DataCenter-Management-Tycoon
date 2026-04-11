// saveManager.js — Persistent room state to disk

import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { exportState } from './stateSync.js'

const __dir    = dirname(fileURLToPath(import.meta.url))
const SAVES_DIR = join(__dir, '..', 'saves')

if (!existsSync(SAVES_DIR)) mkdirSync(SAVES_DIR, { recursive: true })

const SAVE_MAX_AGE_MS = 24 * 60 * 60 * 1000   // 24 h

function savePath(roomName) {
  const safe = roomName.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64)
  return join(SAVES_DIR, `${safe}.json`)
}

export function saveRoom(room) {
  try {
    const data = exportState(room)
    writeFileSync(savePath(room.name), JSON.stringify(data), 'utf-8')
  } catch (err) {
    console.error(`[Save] Cannot save "${room.name}": ${err.message}`)
  }
}

/** Returns saved data if <24h old, otherwise null. */
export function loadRoomSave(roomName) {
  try {
    const path = savePath(roomName)
    if (!existsSync(path)) return null
    const data = JSON.parse(readFileSync(path, 'utf-8'))
    if (Date.now() - (data.exportedAt ?? 0) > SAVE_MAX_AGE_MS) return null
    return data
  } catch (err) {
    console.error(`[Save] Cannot load save for "${roomName}": ${err.message}`)
    return null
  }
}

export function deleteSave(roomName) {
  try {
    const path = savePath(roomName)
    if (existsSync(path)) unlinkSync(path)
  } catch (_) {}
}
