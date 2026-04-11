<template>
  <div class="terminal-overlay" @click.self="$emit('close')">
    <div class="terminal-window">

      <div class="terminal-titlebar">
        <span class="terminal-title">
          TERMINAL — {{ connectionLabel }}
          <span v-if="sshSession" class="ssh-badge"> › SSH {{ sshSession.name }}</span>
        </span>
        <div class="titlebar-actions">
          <span class="conn-status" :class="statusClass">{{ statusLabel }}</span>
          <button class="close-btn" @click="$emit('close')">X</button>
        </div>
      </div>

      <div class="terminal-output" ref="outputRef">
        <div
          v-for="(line, i) in output"
          :key="i"
          class="terminal-line"
          :class="line.type"
        >
          <span v-if="line.type === 'cmd'" class="prompt">{{ line.prefix }} </span>{{ line.text }}
        </div>
      </div>

      <div class="terminal-input-row">
        <span class="prompt">{{ cmdPrompt }}&nbsp;</span>
        <input
          ref="inputRef"
          v-model="inputText"
          class="terminal-input"
          placeholder="help"
          @keydown="onTerminalKeydown"
          spellcheck="false"
          autocomplete="off"
        />
        <button class="exec-btn" @click="execCommand">EXEC</button>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, onMounted } from 'vue'
import { COLUMNS, SERVER_TYPES, SERVICES } from '../game/GameState.js'
import { repairServer, restartServer, assignClientToServer, resolveMission } from '../game/SimulationEngine.js'

const props = defineProps({
  serverPos:  { type: Object,   required: true }, // { floorId, x, y, slot }
  gameState:  { type: Object,   required: true },
  sendAction: { type: Function, default: null },
})

const emit = defineEmits(['close'])

const inputRef   = ref(null)
const outputRef  = ref(null)
const inputText  = ref('')
const output     = ref([])
const cmdHistory = ref([])
const historyIdx = ref(-1)
const sshSession = ref(null)   // null = server OS, client object = inside SSH

// ─── Server access + missions ─────────────────────────────────────────────────

const server = computed(() => {
  const { floorId, x, y, slot } = props.serverPos
  const floor = props.gameState.floors?.find(f => f.id === floorId)
  return floor?.grid[y]?.[x]?.rack?.servers?.[slot] ?? null
})

const cell = computed(() => {
  const { floorId, x, y } = props.serverPos
  const floor = props.gameState.floors?.find(f => f.id === floorId)
  return floor?.grid[y]?.[x] ?? null
})

const serverClients = computed(() =>
  props.gameState.clients.filter(c => {
    if (c.serverPos) {
      return c.serverPos.floorId === props.serverPos.floorId &&
             c.serverPos.x === props.serverPos.x &&
             c.serverPos.y === props.serverPos.y &&
             c.serverPos.slot === props.serverPos.slot
    }
    return c.serverPositions?.some(p =>
      p.floorId === props.serverPos.floorId &&
      p.x === props.serverPos.x &&
      p.y === props.serverPos.y &&
      p.slot === props.serverPos.slot
    )
  })
)

const serverMissions = computed(() =>
  (props.gameState.missions ?? []).filter(m =>
    serverClients.value.some(c => c.id === m.clientId)
  )
)

// Mission du client actuellement SSH
const sshMission = computed(() => {
  if (!sshSession.value) return null
  return (props.gameState.missions ?? []).find(m => m.clientId === sshSession.value.id) ?? null
})

const connectionLabel = computed(() => {
  if (!cell.value) return '???'
  return `F${props.serverPos.floorId} ${cell.value.notation}-0:${props.serverPos.slot}`
})

const statusClass = computed(() => {
  if (!server.value) return 'disconnected'
  return { ok: 'connected', warning: 'warning', failed: 'error', repairing: 'repairing' }[server.value.status] ?? 'connected'
})

const statusLabel = computed(() => {
  if (!server.value) return 'OFFLINE'
  return { ok: 'ONLINE', warning: 'WARNING', failed: 'FAILED', repairing: 'REPAIRING' }[server.value.status] ?? 'ONLINE'
})

const cmdPrompt = computed(() => {
  if (!sshSession.value) return '$'
  const name = sshSession.value.name.toLowerCase().replace(/[^a-z0-9]/g, '')
  return `[${name}@vps${sshSession.value.id}]$`
})

// ─── Boot ─────────────────────────────────────────────────────────────────────

onMounted(() => {
  const s = server.value
  const label = s ? `[${s.label.toUpperCase()}]` : '[UNKNOWN]'
  printLine(`DataCenter OS v1.0 — ${connectionLabel.value} ${label}`, 'system')
  printLine('"help" pour les commandes disponibles.', 'system')

  const ms = serverMissions.value
  if (ms.length > 0) {
    printLine('', 'blank')
    printLine(`⚠ ${ms.length} MISSION(S) EN ATTENTE — connectez-vous au VPS concerné :`, 'warn')
    for (const m of ms) {
      const urgClass = m.urgency === 'critical' ? 'error' : m.urgency === 'warning' ? 'warn' : 'info'
      printLine(`  [${m.clientName}]  ${m.label}  (${m.daysLeft}j)  → connect ${clientDisplayId(m.clientId)}`, urgClass)
    }
  }

  printLine('', 'blank')
  nextTick(() => inputRef.value?.focus())
})

// ─── Command execution ────────────────────────────────────────────────────────

async function execCommand() {
  const raw = inputText.value.trim()
  if (!raw) return

  cmdHistory.value.unshift(raw)
  historyIdx.value = -1
  output.value.push({ text: raw, type: 'cmd', prefix: cmdPrompt.value })
  inputText.value = ''

  const parts = raw.trim().split(/\s+/)
  const cmd   = parts[0].toLowerCase()

  if (sshSession.value) {
    await execSshCommand(cmd, parts)
  } else {
    await execServerCommand(cmd, parts)
  }

  printLine('', 'blank')
  nextTick(scrollBottom)
}

// Strip the "mp_" prefix for display — users type the short ID, not the full internal one
function clientDisplayId(id) { return String(id).replace(/^mp_/, '') }

// Find a client by what the user typed (short numeric string or bare ID)
function findClientById(idStr, list) {
  return list.find(c => String(c.id) === idStr || clientDisplayId(c.id) === idStr)
}

async function execServerCommand(cmd, parts) {
  switch (cmd) {
    case 'help':     cmdHelp();                break
    case 'stats':    cmdStats();               break
    case 'status':   cmdStatus();              break
    case 'logs':     cmdLogs();                break
    case 'restart':  cmdRestart();             break
    case 'repair':   cmdRepair();              break
    case 'clients':  cmdClients();             break
    case 'queue':    cmdQueue();               break
    case 'assign':   await cmdAssign(parts[1]);      break
    case 'connect':  cmdConnect(parts[1]);     break
    case 'ls':       cmdLsVps();               break
    case 'missions': cmdMissions();            break
    case 'clear':    output.value = [];        break
    default: {
      // Commande mission tapée au niveau serveur = erreur orientante
      const mission = serverMissions.value.find(m => m.command === cmd)
      if (mission) {
        printLine(`Permission refusée — exécutez cette commande depuis le VPS du client.`, 'error')
        printLine(`→ connect ${clientDisplayId(mission.clientId)}  puis  $ ${cmd}`, 'warn')
      } else {
        printLine(`Commande inconnue: "${cmd}". Tapez "help".`, 'error')
      }
    }
  }
}

async function execSshCommand(cmd, parts) {
  switch (cmd) {
    case 'exit':
    case 'logout':  cmdSshExit();   break
    case 'help':    cmdSshHelp();   break
    case 'whoami':  cmdSshWhoami(); break
    case 'ps':      cmdSshPs();     break
    case 'uptime':  cmdSshUptime(); break
    case 'clear':   output.value = []; break
    default: {
      const mission = sshMission.value
      if (mission && mission.command === cmd) {
        const rawArgs = parts.slice(1)
        const validationError = validateMissionArgs(mission, rawArgs)
        if (validationError) {
          printLine(validationError, 'error')
          printHint(mission)
        } else {
          const parsedArgs = parseArgs(rawArgs)
          const capacityError = checkScaleCapacity(mission, parsedArgs)
          if (capacityError) {
            printLine(capacityError, 'error')
            printLine('  Migrez ce client vers un serveur plus puissant, ou libérez des ressources.', 'warn')
          } else {
            await cmdResolveMission(mission, parsedArgs)
          }
        }
      } else if (mission) {
        printLine(`Commande inconnue. Mission en attente : $ ${mission.command}`, 'error')
        printHint(mission)
      } else {
        printLine(`Commande inconnue: "${cmd}". Tapez "help" ou "exit".`, 'error')
      }
    }
  }
}

// ─── Server-level commands ────────────────────────────────────────────────────

function cmdHelp() {
  printLine('Commandes serveur :', 'info')
  printLine('  stats         — CPU, RAM, Disk, temp, power', 'output')
  printLine('  status        — état, santé, uptime', 'output')
  printLine('  clients       — liste des clients sur ce serveur', 'output')
  printLine('  logs          — historique incidents', 'output')
  printLine('  restart       — redémarrage GRATUIT (80%/50%/20%)', 'output')
  printLine('  repair        — réparation urgente $400 (1j, garanti)', 'output')
  printLine('  queue         — clients en attente d\'assignation', 'output')
  printLine('  assign <id>   — affecter client ici (+15 sat) ★', 'success')
  printLine('  ls            — liste les VPS hébergés ici', 'output')
  printLine('  connect <id>  — ouvrir session SSH sur le VPS client ★', 'success')
  printLine('  missions      — missions en attente sur ce serveur ★', 'success')
  printLine('  clear         — effacer terminal', 'output')
}

function cmdStats() {
  const s = server.value
  if (!s) { printLine('Serveur non trouvé', 'error'); return }

  const cpuPct  = s.cpuCapacity  > 0 ? Math.round(s.cpuLoad  / s.cpuCapacity  * 100) : 0
  const ramPct  = s.ramCapacity  > 0 ? Math.round(s.ramLoad  / s.ramCapacity  * 100) : 0
  const diskPct = s.diskCapacity > 0 ? Math.round(s.diskLoad / s.diskCapacity * 100) : 0
  const clients = serverClients.value

  printLine(`CPU:     ${s.cpuLoad}/${s.cpuCapacity} (${cpuPct}%)`,   cpuPct  > 90 ? 'error' : cpuPct  > 70 ? 'warn' : 'output')
  printLine(`RAM:     ${s.ramLoad}/${s.ramCapacity} GB (${ramPct}%)`, ramPct  > 90 ? 'error' : ramPct  > 70 ? 'warn' : 'output')
  printLine(`DISK:    ${s.diskLoad}/${s.diskCapacity} GB (${diskPct}%)`, diskPct > 90 ? 'error' : diskPct > 70 ? 'warn' : 'output')
  printLine(`TEMP:    ${s.temperature}°C`, s.temperature > 75 ? 'error' : s.temperature > 60 ? 'warn' : 'output')
  printLine(`POWER:   ${s.powerUsage}W`, 'output')
  printLine(`HEALTH:  ${Math.round(s.health)}%`, s.health < 40 ? 'error' : s.health < 70 ? 'warn' : 'output')
  printLine(`CLIENTS: ${clients.length}`, 'output')
}

function cmdStatus() {
  const s = server.value
  if (!s) { printLine('Serveur non trouvé', 'error'); return }

  const colors = { ok: 'success', warning: 'warn', failed: 'error', repairing: 'info' }
  printLine(`STATUS:   ${s.status.toUpperCase()}`, colors[s.status] ?? 'output')
  printLine(`TYPE:     ${s.label}`, 'output')
  printLine(`HEALTH:   ${Math.round(s.health)}%`, 'output')
  printLine(`UPTIME:   ${s.uptime} jour(s)`, 'output')
  if (s.restartAttempts > 0) {
    const remaining = 3 - s.restartAttempts
    printLine(`RESTART:  ${s.restartAttempts}/3 tentatives — ${remaining} restante(s)`, remaining > 0 ? 'warn' : 'error')
  }
  if (s.status === 'repairing') {
    printLine(`REPAIR:   ${s.repairDaysLeft} jour(s) restant(s)`, 'info')
  }
}

function cmdLogs() {
  const s = server.value
  if (!s) { printLine('Serveur non trouvé', 'error'); return }
  if (s.logs.length === 0) { printLine('Aucun événement.', 'info'); return }

  printLine(`--- ${s.logs.length} événement(s) ---`, 'info')
  for (const log of [...s.logs].reverse()) {
    const t = { warning: 'warn', failure: 'error', repair: 'success' }[log.type] ?? 'output'
    printLine(`[Jour ${log.day}] ${log.message}`, t)
  }
}

function cmdRestart() {
  const s = server.value
  if (!s) { printLine('Serveur non trouvé', 'error'); return }
  if (s.status === 'ok') { printLine('Serveur déjà opérationnel.', 'info'); return }

  const { floorId, x, y, slot } = props.serverPos
  const result = restartServer(props.gameState, floorId, x, y, slot)
  printLine(result.message, result.success ? 'success' : 'error')
}

function cmdRepair() {
  const s = server.value
  if (!s) { printLine('Serveur non trouvé', 'error'); return }
  if (s.status === 'ok') { printLine('Serveur déjà opérationnel.', 'info'); return }

  const { floorId, x, y, slot } = props.serverPos
  const result = repairServer(props.gameState, floorId, x, y, slot, true)
  printLine(result.message, result.success ? 'success' : 'error')
}

function cmdClients() {
  const clients = serverClients.value
  if (clients.length === 0) { printLine('Aucun client.', 'info'); return }

  printLine(`${clients.length} client(s):`, 'info')
  for (const c of clients) {
    const sat = Math.round(c.satisfaction)
    printLine(`  [${c.id}] ${c.name}  [${c.serviceId}]  CPU:${c.cpuDemand}  sat:${sat}%`, sat < 40 ? 'warn' : 'output')
  }
}

function cmdLsVps() {
  const clients = serverClients.value
  if (clients.length === 0) { printLine('Aucun VPS hébergé sur ce serveur.', 'info'); return }

  printLine(`${clients.length} VPS actif(s) :`, 'info')
  for (const c of clients) {
    const sat     = Math.round(c.satisfaction)
    const mission = serverMissions.value.find(m => m.clientId === c.id)
    const mBadge  = mission ? ` ⚠ mission:${mission.command}` : ''
    printLine(`  [${c.id}] ${c.name.padEnd(16)} ${c.serviceId.padEnd(9)} CPU:${String(c.cpuDemand).padStart(3)}  sat:${sat}%${mBadge}`,
      mission ? 'warn' : sat < 40 ? 'warn' : 'output')
  }
  printLine('→ "connect <id>" pour ouvrir une session SSH', 'success')
}

function cmdConnect(idStr) {
  if (!idStr) {
    printLine('Usage : connect <id>  (ex: connect 3)', 'error')
    return
  }

  const client = findClientById(idStr, serverClients.value)
  if (!client) {
    printLine(`Client #${idStr} introuvable sur ce serveur.`, 'error')
    printLine('→ "ls" pour voir les VPS hébergés ici', 'output')
    return
  }

  const sat    = Math.round(client.satisfaction)
  const uptime = props.gameState.day - client.dayArrived
  const svc    = SERVICES[client.serviceId]
  const name   = client.name.toLowerCase().replace(/[^a-z0-9]/g, '')

  printLine(`Établissement de la connexion SSH...`, 'info')
  printLine(`Connecting to ${name}@vps${client.id}.datacenter.local...`, 'output')
  printLine('', 'blank')
  printLine(`Welcome to ${client.name} VPS`, 'system')
  printLine(`Service : ${svc?.label ?? client.serviceId}   Uptime : ${uptime} jour(s)`, 'output')
  printLine(`CPU     : ${client.cpuDemand} / ${server.value?.cpuCapacity ?? '?'} units   RAM : ${client.ramDemand} GB`, 'output')
  printLine(`Status  : ${sat >= 70 ? '✓ SATISFIED' : sat >= 40 ? '⚠ DEGRADED' : '✗ CRITICAL'}`,
    sat >= 70 ? 'success' : sat >= 40 ? 'warn' : 'error')

  const mission = (props.gameState.missions ?? []).find(m => m.clientId === client.id)
  if (mission) {
    printLine('', 'blank')
    printLine(`⚠ MISSION EN ATTENTE : ${mission.label}  (${mission.daysLeft}j)  → +${mission.satReward} sat, +${mission.sp} SP`, 'warn')
    printHint(mission)
  }

  printLine('', 'blank')
  printLine('"help" pour les commandes VPS disponibles.', 'output')

  sshSession.value = client
}

function cmdQueue() {
  const queue = props.gameState.clientQueue
  if (queue.length === 0) { printLine('File vide — aucun client en attente.', 'info'); return }

  printLine(`${queue.length} client(s) en attente :`, 'info')
  for (const c of queue) {
    const daysLeft = 4 - c.daysInQueue
    const urgency  = daysLeft <= 1 ? 'error' : daysLeft <= 2 ? 'warn' : 'output'
    printLine(
      `  [${clientDisplayId(c.id)}] ${c.name.padEnd(16)} ${c.serviceId.padEnd(9)} CPU:${String(c.cpuDemand).padStart(3)}  ${daysLeft}j restant(s)`,
      urgency
    )
  }
  printLine('→ "assign <id>" pour affecter sur CE serveur (+15 satisfaction)', 'success')
}

async function cmdAssign(idStr) {
  if (!idStr) {
    printLine('Usage : assign <id>  (ex: assign 3)', 'error')
    return
  }

  const { floorId, x, y, slot } = props.serverPos

  if (props.sendAction) {
    // Multiplayer: find the full client ID from the short display ID
    const client = findClientById(idStr, props.gameState.clientQueue)
    if (!client) {
      printLine(`Client #${idStr} introuvable dans la file.`, 'error')
      return
    }
    const result = await props.sendAction('assign_client', { clientId: client.id, floorId, x, y, slot })
    printLine(result?.ok ? `${client.name} assigné sur ce serveur.` : (result?.error ?? 'Assignation échouée'), result?.ok ? 'success' : 'error')
  } else {
    const client = findClientById(idStr, props.gameState.clientQueue)
    if (!client) {
      printLine(`Client #${idStr} introuvable dans la file.`, 'error')
      return
    }
    const result = assignClientToServer(props.gameState, client.id, floorId, x, y, slot, true)
    printLine(result.message, result.success ? 'success' : 'error')
  }
}

function cmdMissions() {
  const ms = serverMissions.value
  if (ms.length === 0) {
    printLine('Aucune mission en attente sur ce serveur.', 'info')
    return
  }
  printLine(`${ms.length} mission(s) — connectez-vous au VPS concerné pour résoudre :`, 'warn')
  for (const m of ms) {
    const urgClass = m.urgency === 'critical' ? 'error' : m.urgency === 'warning' ? 'warn' : 'info'
    printLine(`  [${m.clientName}]  ${m.label}  (${m.daysLeft}j)  → +${m.satReward} sat, +${m.sp} SP`, urgClass)
    printLine(`    connect ${clientDisplayId(m.clientId)}  puis  $ ${m.command} ...`, 'output')
  }
}

// ─── SSH-level commands ───────────────────────────────────────────────────────

function cmdSshExit() {
  const name = sshSession.value?.name ?? '?'
  printLine(`Fermeture session SSH — ${name}`, 'info')
  printLine('Connection to VPS closed.', 'output')
  sshSession.value = null
}

function cmdSshHelp() {
  printLine('Commandes disponibles sur ce VPS :', 'info')
  printLine('  whoami   — informations client', 'output')
  printLine('  ps       — processus actifs', 'output')
  printLine('  uptime   — durée de connexion', 'output')
  printLine('  exit     — fermer la session SSH', 'output')
  const m = sshMission.value
  if (m) {
    printLine('', 'blank')
    printLine(`⚠ Mission : ${m.label}  (${m.daysLeft}j restant${m.daysLeft > 1 ? 's' : ''})`, 'warn')
    printHint(m)
  }
}

// ─── Mission arg validation ───────────────────────────────────────────────────

// Returns null if valid, or an error string.
function validateMissionArgs(mission, rawArgs) {
  const parsed = {}
  for (const raw of rawArgs) {
    const m = raw.match(/^(--[a-z0-9-]+)=(.+)$/)
    if (!m) return `Syntaxe invalide : "${raw}". Format attendu : --flag=valeur`
    parsed[m[1]] = m[2]
  }
  for (const argDef of (mission.args ?? [])) {
    if (!argDef.required) continue
    const val = parsed[argDef.flag]
    if (!val) return `Argument manquant : ${argDef.flag}  (${argDef.hint})`
    if (!argDef.values.includes(val))
      return `Valeur invalide pour ${argDef.flag}="${val}". Valeurs acceptées : ${argDef.values.join(', ')}`
  }
  // Validate optional args if provided
  for (const [flag, val] of Object.entries(parsed)) {
    const argDef = (mission.args ?? []).find(a => a.flag === flag)
    if (!argDef) return `Flag inconnu : ${flag}`
    if (!argDef.values.includes(val))
      return `Valeur invalide pour ${flag}="${val}". Valeurs acceptées : ${argDef.values.join(', ')}`
  }
  return null
}

function printHint(mission) {
  if (!mission.args?.length) {
    printLine(`  Syntaxe : $ ${mission.command}`, 'output')
    return
  }
  const required = mission.args.filter(a => a.required)
  const optional = mission.args.filter(a => !a.required)
  const reqPart  = required.map(a => `${a.flag}=<${a.values.join('|')}>`).join(' ')
  const optPart  = optional.map(a => `[${a.flag}=<${a.values.join('|')}>]`).join(' ')
  printLine(`  Syntaxe : $ ${mission.command} ${reqPart} ${optPart}`.trimEnd(), 'output')
  for (const a of mission.args) {
    const req = a.required ? '(requis)' : '(opt.  )'
    printLine(`    ${a.flag.padEnd(12)} ${req}  ${a.hint}`, 'output')
  }
}

function cmdSshWhoami() {
  const c = sshSession.value
  if (!c) return
  const sat = Math.round(c.satisfaction)
  const svc = SERVICES[c.serviceId]
  printLine(`Client  : ${c.name}`, 'output')
  printLine(`Service : ${svc?.label ?? c.serviceId}`, 'output')
  printLine(`CPU     : ${c.cpuDemand} units`, 'output')
  printLine(`RAM     : ${c.ramDemand} GB`, 'output')
  printLine(`Disk    : ${c.diskDemand} GB`, 'output')
  printLine(`Sat.    : ${sat}%`, sat >= 70 ? 'success' : sat >= 40 ? 'warn' : 'error')
  if (c.daysUnhappy > 0)
    printLine(`⚠ Insatisfait depuis ${c.daysUnhappy} jour(s)`, 'error')
}

function cmdSshPs() {
  const c = sshSession.value
  if (!c) return
  const procs = {
    VPS:        ['nginx: master', 'php-fpm: pool', 'mysql: daemon', 'sshd: session'],
    DEDICATED:  ['apache2: worker', 'postgres: main', 'redis-server', 'sshd: session'],
    STORAGE:    ['samba: smbd', 'nfs-kernel-server', 'rsync: daemon', 'sshd: session'],
    GAMING:     ['game-server: main', 'steamcmd: update', 'node: app', 'sshd: session'],
    ENTERPRISE: ['haproxy: master', 'kafka: broker', 'mongodb: mongod', 'sshd: session'],
  }
  const list = procs[c.serviceId] ?? ['sshd: session']
  printLine('  PID    COMMAND', 'info')
  list.forEach((p, i) => printLine(`  ${String(1000 + i * 137).padEnd(6)} ${p}`, 'output'))
}

function cmdSshUptime() {
  const c = sshSession.value
  if (!c) return
  const uptime = props.gameState.day - c.dayArrived
  printLine(`Uptime : ${uptime} jour(s) en ligne (depuis le jour ${c.dayArrived})`, 'output')
}

function parseArgs(rawArgs) {
  const parsed = {}
  for (const raw of rawArgs) {
    const m = raw.match(/^(--[a-z0-9-]+)=(.+)$/)
    if (m) parsed[m[1]] = m[2]
  }
  return parsed
}

function checkScaleCapacity(mission, parsedArgs) {
  if (mission.command !== 'scale') return null
  const client = sshSession.value
  const srv    = server.value
  if (!client || !srv) return null

  const factorMap = { 'x1.5': 1.5, 'x2': 2, 'x3': 3 }
  const factor    = factorMap[parsedArgs['--factor']] ?? 1
  const resource  = parsedArgs['--resource']

  if (resource === 'cpu' || resource === 'both') {
    const extra     = Math.ceil(client.cpuDemand * (factor - 1))
    const available = srv.cpuCapacity - srv.cpuLoad
    if (extra > available)
      return `ERREUR: CPU insuffisant — besoin de +${extra} units libres, disponible: ${available} units`
  }
  if (resource === 'ram' || resource === 'both') {
    const extra     = Math.ceil(client.ramDemand * (factor - 1))
    const available = srv.ramCapacity - srv.ramLoad
    if (extra > available)
      return `ERREUR: RAM insuffisante — besoin de +${extra} GB libres, disponible: ${available} GB`
  }
  return null
}

function computeMissionQuality(mission, parsedArgs) {
  const optimal = mission.optimalArgs ?? {}
  const keys    = Object.keys(optimal)
  if (keys.length === 0) return 1.0
  let matched = 0
  for (const [flag, optVal] of Object.entries(optimal)) {
    if (parsedArgs[flag] === optVal) matched++
  }
  return matched / keys.length
}

async function cmdResolveMission(mission, parsedArgs) {
  const lines = {
    optimize:  ['Analyse des processus en cours...', 'Libération de la mémoire...', 'Tuning des paramètres kernel...'],
    backup:    ['Chiffrement des données...', 'Copie vers stockage distant...', 'Vérification de l\'intégrité...'],
    update:    ['Téléchargement du patch...', 'Arrêt des services...', 'Application des mises à jour...'],
    diagnose:  ['Scan des interfaces réseau...', 'Trace des paquets perdus...', 'Restauration de la route...'],
    scale:     ['Allocation de ressources...', 'Redimensionnement des conteneurs...', 'Rééquilibrage de charge...'],
    audit:     ['Analyse des logs d\'accès...', 'Détection des anomalies...', 'Renforcement des règles firewall...'],
    migrate:   ['Export des données...', 'Transfert sécurisé en cours...', 'Vérification post-migration...'],
    monitor:   ['Collecte des métriques...', 'Génération du rapport...', 'Envoi au client...'],
  }
  for (const step of (lines[mission.command] ?? ['Traitement en cours...'])) {
    printLine(`  ${step}`, 'output')
  }

  const quality = computeMissionQuality(mission, parsedArgs ?? {})
  // quality < 0.5 → partial reward, no SP; >= 0.5 → reduced reward; 1.0 → full
  let satMul = 1.0, spMul = 1, qualityLabel = null
  if (quality < 0.5) {
    satMul = 0.3; spMul = 0
    qualityLabel = { text: '⚠ Mauvais arguments — récompense très réduite, aucun SP', type: 'warn' }
  } else if (quality < 1.0) {
    satMul = 0.6; spMul = 0
    qualityLabel = { text: '~ Arguments partiellement corrects — récompense réduite, aucun SP', type: 'warn' }
  }

  let result
  if (props.sendAction) {
    const res = await props.sendAction('resolve_mission', { missionId: mission.id, satMul, spMul })
    result = res?.ok ? { success: true, sp: res.sp, satReward: res.satReward } : { success: false, message: res?.error ?? 'Erreur serveur' }
  } else {
    result = resolveMission(props.gameState, mission.id, satMul, spMul)
  }
  if (result.success) {
    printLine('', 'blank')
    if (qualityLabel) printLine(qualityLabel.text, qualityLabel.type)
    printLine(`✓ Mission résolue : "${mission.label}"`, 'success')
    printLine(`  +${result.satReward} satisfaction  |  +${result.sp} SP`, 'success')
  } else {
    printLine(`Erreur : ${result.message}`, 'error')
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function printLine(text, type = 'output') { output.value.push({ text, type }) }

function scrollBottom() {
  if (outputRef.value) outputRef.value.scrollTop = outputRef.value.scrollHeight
}

function historyUp() {
  if (cmdHistory.value.length === 0) return
  historyIdx.value = Math.min(historyIdx.value + 1, cmdHistory.value.length - 1)
  inputText.value  = cmdHistory.value[historyIdx.value]
}

function historyDown() {
  if (historyIdx.value <= 0) { historyIdx.value = -1; inputText.value = ''; return }
  historyIdx.value--
  inputText.value = cmdHistory.value[historyIdx.value]
}

// ─── Tab autocomplete ─────────────────────────────────────────────────────────

const SERVER_CMDS = ['help','stats','status','logs','restart','repair','clients','queue','assign','connect','ls','missions','clear']
const SSH_CMDS    = ['help','whoami','ps','uptime','exit','logout','clear']

const tabState = ref(null) // { candidates: [], idx: number } | null

function onTerminalKeydown(e) {
  if (e.key === 'Tab') {
    e.preventDefault()
    tabComplete()
  } else if (e.key === 'Enter') {
    tabState.value = null
    execCommand()
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    tabState.value = null
    historyUp()
  } else if (e.key === 'ArrowDown') {
    e.preventDefault()
    tabState.value = null
    historyDown()
  } else {
    tabState.value = null
  }
}

function computeCompletions(text) {
  const trimmed      = text.trimEnd()
  const trailingSpace = text.endsWith(' ')
  const parts        = trimmed ? trimmed.split(/\s+/) : ['']

  if (!sshSession.value) {
    // ── Server mode ──
    if (parts.length === 1 && !trailingSpace) {
      const prefix = parts[0]
      return SERVER_CMDS.filter(c => c.startsWith(prefix) && c !== prefix)
        .concat(prefix === '' ? [] : SERVER_CMDS.includes(parts[0]) ? [] : [])
        .filter((v, i, a) => a.indexOf(v) === i) // unique
        || SERVER_CMDS
    }
    if ((parts.length === 1 && trailingSpace) || (parts.length === 2 && !trailingSpace)) {
      const cmd       = parts[0]
      const argPrefix = parts.length === 2 ? parts[1] : ''
      if (cmd === 'connect') {
        return serverClients.value
          .map(c => `connect ${clientDisplayId(c.id)}`)
          .filter(s => s.startsWith(`connect ${argPrefix}`))
      }
      if (cmd === 'assign') {
        return props.gameState.clientQueue
          .map(c => `assign ${clientDisplayId(c.id)}`)
          .filter(s => s.startsWith(`assign ${argPrefix}`))
      }
    }
    return []
  } else {
    // ── SSH mode ──
    const mission = sshMission.value
    const sshCmds = mission ? [...SSH_CMDS, mission.command] : [...SSH_CMDS]

    if (parts.length === 1 && !trailingSpace) {
      const prefix = parts[0]
      return prefix
        ? sshCmds.filter(c => c.startsWith(prefix) && c !== prefix)
        : sshCmds
    }

    // Mission arg completion
    if (mission && parts[0] === mission.command) {
      const args = mission.args ?? []
      if (args.length === 0) return []

      // Flags already fully typed (--flag=value)
      const fullyTyped = trailingSpace ? parts.slice(1) : parts.slice(1, -1)
      const typedFlags = new Set(
        fullyTyped.map(p => { const m = p.match(/^(--[a-z0-9-]+)=/); return m?.[1] }).filter(Boolean)
      )

      const lastPart      = trailingSpace ? '' : parts[parts.length - 1]
      const completedBase = trailingSpace ? trimmed : parts.slice(0, -1).join(' ')
      const remaining     = args.filter(a => !typedFlags.has(a.flag))

      if (lastPart.includes('=')) {
        // Complete value
        const eqIdx    = lastPart.indexOf('=')
        const flag     = lastPart.substring(0, eqIdx)
        const valPfx   = lastPart.substring(eqIdx + 1)
        const argDef   = args.find(a => a.flag === flag)
        if (!argDef) return []
        return argDef.values
          .filter(v => v.startsWith(valPfx))
          .map(v => `${completedBase} ${flag}=${v}`.trim())
      } else {
        // Complete flag name
        const matches = lastPart
          ? remaining.filter(a => a.flag.startsWith(lastPart) && a.flag !== lastPart)
          : remaining
        return matches.map(a => `${completedBase} ${a.flag}=`.trim())
      }
    }
    return []
  }
}

function tabComplete() {
  let state = tabState.value
  if (!state) {
    const candidates = computeCompletions(inputText.value)
    if (candidates.length === 0) return
    state = { candidates, idx: 0 }
    tabState.value = state
    inputText.value = state.candidates[0]
  } else {
    state.idx = (state.idx + 1) % state.candidates.length
    inputText.value = state.candidates[state.idx]
  }
  // Move cursor to end
  nextTick(() => {
    if (inputRef.value) {
      inputRef.value.selectionStart = inputRef.value.selectionEnd = inputText.value.length
    }
  })
}
</script>

<style scoped>
.terminal-overlay {
  position: fixed;
  inset: 0;
  background: #00000088;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.terminal-window {
  width: 580px;
  height: 420px;
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  font-family: 'Courier New', monospace;
  font-size: 12px;
  box-shadow: 0 8px 32px #000a;
}

.terminal-titlebar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: #161b22;
  border-bottom: 1px solid #21262d;
  border-radius: 6px 6px 0 0;
  flex-shrink: 0;
}

.terminal-title { color: #58a6ff; font-weight: bold; font-size: 12px; }

.ssh-badge {
  color: #3fb950;
  font-size: 11px;
  font-weight: normal;
}

.titlebar-actions { display: flex; align-items: center; gap: 10px; }

.conn-status {
  font-size: 10px;
  font-weight: bold;
  padding: 2px 8px;
  border-radius: 3px;
}
.conn-status.connected    { background: #0f2d0f; color: #3fb950; }
.conn-status.warning      { background: #3d2b00; color: #d29922; }
.conn-status.error        { background: #2d0a0a; color: #f85149; }
.conn-status.repairing    { background: #1f4068; color: #58a6ff; }
.conn-status.disconnected { background: #21262d; color: #8b949e; }

.close-btn {
  background: transparent;
  border: 1px solid #30363d;
  color: #8b949e;
  font-size: 12px;
  padding: 2px 7px;
  cursor: pointer;
  border-radius: 3px;
}
.close-btn:hover { border-color: #f85149; color: #f85149; }

.terminal-output {
  flex: 1;
  overflow-y: auto;
  padding: 10px 14px;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.terminal-line { white-space: pre-wrap; line-height: 1.5; }
.terminal-line.cmd     { color: #e6edf3; }
.terminal-line.system  { color: #58a6ff; }
.terminal-line.info    { color: #58a6ff; }
.terminal-line.output  { color: #8b949e; }
.terminal-line.success { color: #3fb950; }
.terminal-line.warn    { color: #d29922; }
.terminal-line.error   { color: #f85149; }
.terminal-line.blank   { height: 4px; }

.prompt { color: #3fb950; }

.terminal-input-row {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  border-top: 1px solid #21262d;
  gap: 6px;
  flex-shrink: 0;
}

.terminal-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: #e6edf3;
  font-family: 'Courier New', monospace;
  font-size: 12px;
  caret-color: #3fb950;
}
.terminal-input::placeholder { color: #30363d; }

.exec-btn {
  background: #21262d;
  border: 1px solid #30363d;
  color: #8b949e;
  font-family: monospace;
  font-size: 11px;
  padding: 4px 10px;
  cursor: pointer;
  border-radius: 3px;
}
.exec-btn:hover { border-color: #3fb950; color: #3fb950; }
</style>
