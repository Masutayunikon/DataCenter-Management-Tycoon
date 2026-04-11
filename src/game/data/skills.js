// ─── Skill tree ───────────────────────────────────────────────────────────────
// spReq = skill points requis (gagnés via fins de contrat)

const SKILLS = {
  // Serveurs — unlocks
  BALANCED_UNLOCK: {
    id: 'BALANCED_UNLOCK', label: 'Serveur Balanced',
    desc: 'Débloque l\'achat de serveurs Balanced',
    category: 'servers', spReq: 5, cost: 2000,
    requires: [], icon: '🖥️',
  },
  PERFORMANCE_UNLOCK: {
    id: 'PERFORMANCE_UNLOCK', label: 'Serveur Performance',
    desc: 'Débloque les serveurs haute performance',
    category: 'servers', spReq: 12, cost: 6000,
    requires: ['BALANCED_UNLOCK'], icon: '⚡',
  },
  GPU_UNLOCK: {
    id: 'GPU_UNLOCK', label: 'Serveur GPU',
    desc: 'Débloque les serveurs GPU (gaming / IA)',
    category: 'servers', spReq: 20, cost: 15000,
    requires: ['PERFORMANCE_UNLOCK'], icon: '🎮',
  },

  // Upgrades Services — Capacité & Marché
  // ── VPS capacity chain ────────────────────────────────────────────────────
  VPS_ENTREPRISE: {
    id: 'VPS_ENTREPRISE', label: 'VPS Haute Capacité',
    desc: 'VPS : RAM max 4→8G, Disk 20→40G.',
    category: 'upgrades', spReq: 8, cost: 3000,
    requires: ['BALANCED_UNLOCK'], icon: '🌐',
    serviceUpgrade: { type: 'VPS', ramMax: 8, diskMax: 40 }
  },
  VPS_ULTRA: {
    id: 'VPS_ULTRA', label: 'VPS Ultra',
    desc: 'VPS : RAM max 8→16G, Disk 40→80G. Clients cloud premium.',
    category: 'upgrades', spReq: 18, cost: 8000,
    requires: ['VPS_ENTREPRISE'], icon: '🌐',
    serviceUpgrade: { type: 'VPS', ramMax: 16, diskMax: 80 }
  },

  // ── Gaming capacity chain ─────────────────────────────────────────────────
  GAMING_PRO: {
    id: 'GAMING_PRO', label: 'Infra Esport',
    desc: 'Gaming : CPU max 80→100, RAM 32→48G.',
    category: 'upgrades', spReq: 16, cost: 9000,
    requires: ['PERFORMANCE_UNLOCK'], icon: '🏆',
    serviceUpgrade: { type: 'GAMING', cpuMax: 100, ramMax: 48 }
  },
  GAMING_ULTRA: {
    id: 'GAMING_ULTRA', label: 'Infra Esport Ultra',
    desc: 'Gaming : CPU max 100→140, RAM 48→80G. Tournois haute fréquence.',
    category: 'upgrades', spReq: 28, cost: 16000,
    requires: ['GAMING_PRO'], icon: '🏆',
    serviceUpgrade: { type: 'GAMING', cpuMax: 140, ramMax: 80 }
  },

  // ── AI capacity chain ─────────────────────────────────────────────────────
  AI_ULTRA: {
    id: 'AI_ULTRA', label: 'LLM Training',
    desc: 'IA : CPU max 200→300, RAM 128→192G.',
    category: 'upgrades', spReq: 22, cost: 18000,
    requires: ['GPU_UNLOCK'], icon: '🧠',
    serviceUpgrade: { type: 'AI_CLOUD', cpuMax: 300, ramMax: 192 }
  },
  AI_EXTREME: {
    id: 'AI_EXTREME', label: 'LLM Training Extreme',
    desc: 'IA : CPU max 300→500, RAM 192→320G. Contrats hyperscale.',
    category: 'upgrades', spReq: 36, cost: 32000,
    requires: ['AI_ULTRA'], icon: '🧠',
    serviceUpgrade: { type: 'AI_CLOUD', cpuMax: 500, ramMax: 320 }
  },

  // ── Streaming capacity chain ──────────────────────────────────────────────
  STREAMING_4K: {
    id: 'STREAMING_4K', label: 'Streaming 4K',
    desc: 'Streaming : Disk max 200→350G.',
    category: 'upgrades', spReq: 13, cost: 6000,
    requires: ['PERFORMANCE_UNLOCK'], icon: '🎬',
    serviceUpgrade: { type: 'STREAMING', diskMax: 350 }
  },
  STREAMING_8K: {
    id: 'STREAMING_8K', label: 'Streaming 8K',
    desc: 'Streaming : Disk max 350→600G. Diffusion ultra-haute définition.',
    category: 'upgrades', spReq: 22, cost: 12000,
    requires: ['STREAMING_4K'], icon: '🎬',
    serviceUpgrade: { type: 'STREAMING', diskMax: 600 }
  },

  // ── Dedicated capacity chain ──────────────────────────────────────────────
  DEDICATED_PRO: {
    id: 'DEDICATED_PRO', label: 'Dédié Pro',
    desc: 'Dédié : CPU max 180→240, RAM 64→96G, Disk 100→150G.',
    category: 'upgrades', spReq: 14, cost: 7500,
    requires: ['BALANCED_UNLOCK'], icon: '🖥️',
    serviceUpgrade: { type: 'DEDICATED', cpuMax: 240, ramMax: 96, diskMax: 150 }
  },
  DEDICATED_ULTRA: {
    id: 'DEDICATED_ULTRA', label: 'Dédié Ultra',
    desc: 'Dédié : CPU max 240→400, RAM 96→192G, Disk 150→300G. Clients haute exigence.',
    category: 'upgrades', spReq: 24, cost: 14000,
    requires: ['DEDICATED_PRO'], icon: '🖥️',
    serviceUpgrade: { type: 'DEDICATED', cpuMax: 400, ramMax: 192, diskMax: 300 }
  },

  // ── Storage capacity chain ────────────────────────────────────────────────
  STORAGE_ULTRA: {
    id: 'STORAGE_ULTRA', label: 'Stockage Ultra',
    desc: 'Stockage : Disk max 400→700G.',
    category: 'upgrades', spReq: 15, cost: 7000,
    requires: ['STORAGE_DENSE_UNLOCK'], icon: '💾',
    serviceUpgrade: { type: 'STORAGE', diskMax: 700 }
  },
  STORAGE_EXTREME: {
    id: 'STORAGE_EXTREME', label: 'Stockage Extrême',
    desc: 'Stockage : Disk max 700→1500G. Archivage massif et cold storage.',
    category: 'upgrades', spReq: 26, cost: 14000,
    requires: ['STORAGE_ULTRA'], icon: '💾',
    serviceUpgrade: { type: 'STORAGE', diskMax: 1500 }
  },

  // Serveurs — upgrades Basic
  BASIC_PLUS: {
    id: 'BASIC_PLUS', label: 'Basic+',
    desc: 'CPU 100→130, RAM 16→22G, +20% conso',
    category: 'upgrades', spReq: 2, cost: 1200,
    requires: [], icon: '⬆️',
    serverUpgrade: { type: 'BASIC', cpuCapacity: 130, ramCapacity: 22, diskCapacity: 240, powerBase: 96 },
  },
  BASIC_PLUS2: {
    id: 'BASIC_PLUS2', label: 'Basic++',
    desc: 'CPU 130→165, RAM 22→30G, +20% conso',
    category: 'upgrades', spReq: 8, cost: 2800,
    requires: ['BASIC_PLUS'], icon: '⬆️',
    serverUpgrade: { type: 'BASIC', cpuCapacity: 165, ramCapacity: 30, diskCapacity: 280, powerBase: 115 },
  },
  BASIC_PLUS3: {
    id: 'BASIC_PLUS3', label: 'Basic+++',
    desc: 'CPU 165→200, RAM 30→40G, +20% conso',
    category: 'upgrades', spReq: 12, cost: 5000,
    requires: ['BASIC_PLUS2'], icon: '⬆️',
    serverUpgrade: { type: 'BASIC', cpuCapacity: 200, ramCapacity: 40, diskCapacity: 320, powerBase: 138 },
  },

  // Serveurs — upgrades Balanced
  BALANCED_PLUS: {
    id: 'BALANCED_PLUS', label: 'Balanced+',
    desc: 'CPU 200→260, RAM 64→85G, +20% conso',
    category: 'upgrades', spReq: 8, cost: 3500,
    requires: ['BALANCED_UNLOCK'], icon: '⬆️',
    serverUpgrade: { type: 'BALANCED', cpuCapacity: 260, ramCapacity: 85, diskCapacity: 620, powerBase: 180 },
  },
  BALANCED_PLUS2: {
    id: 'BALANCED_PLUS2', label: 'Balanced++',
    desc: 'CPU 260→330, RAM 85→110G, +20% conso',
    category: 'upgrades', spReq: 15, cost: 7000,
    requires: ['BALANCED_PLUS'], icon: '⬆️',
    serverUpgrade: { type: 'BALANCED', cpuCapacity: 330, ramCapacity: 110, diskCapacity: 750, powerBase: 215 },
  },

  // Serveurs — upgrades Performance
  PERFORMANCE_PLUS: {
    id: 'PERFORMANCE_PLUS', label: 'Performance+',
    desc: 'CPU 400→520, RAM 256→330G, Disk 300→400G, +20% conso',
    category: 'upgrades', spReq: 15, cost: 5000,
    requires: ['PERFORMANCE_UNLOCK'], icon: '⬆️',
    serverUpgrade: { type: 'PERFORMANCE', cpuCapacity: 520, ramCapacity: 330, diskCapacity: 400, powerBase: 360 },
  },
  PERFORMANCE_PLUS2: {
    id: 'PERFORMANCE_PLUS2', label: 'Performance++',
    desc: 'CPU 520→650, RAM 330→420G, Disk 400→500G, +20% conso',
    category: 'upgrades', spReq: 25, cost: 10000,
    requires: ['PERFORMANCE_PLUS'], icon: '⬆️',
    serverUpgrade: { type: 'PERFORMANCE', cpuCapacity: 650, ramCapacity: 420, diskCapacity: 500, powerBase: 430 },
  },

  // Serveurs — upgrades GPU
  GPU_PLUS: {
    id: 'GPU_PLUS', label: 'GPU+',
    desc: 'CPU 300→390, RAM 128→180G, Disk 200→270G, +22% conso',
    category: 'upgrades', spReq: 22, cost: 8000,
    requires: ['GPU_UNLOCK'], icon: '⬆️',
    serverUpgrade: { type: 'GPU', cpuCapacity: 390, ramCapacity: 180, diskCapacity: 270, powerBase: 550 },
  },
  GPU_PLUS2: {
    id: 'GPU_PLUS2', label: 'GPU++',
    desc: 'CPU 390→500, RAM 180→240G, Disk 270→350G, +20% conso',
    category: 'upgrades', spReq: 35, cost: 18000,
    requires: ['GPU_PLUS'], icon: '⬆️',
    serverUpgrade: { type: 'GPU', cpuCapacity: 500, ramCapacity: 240, diskCapacity: 350, powerBase: 660 },
  },

  // Employés — unlocks
  EMPLOYEE_ASSIGN_UNLOCK: {
    id: 'EMPLOYEE_ASSIGN_UNLOCK', label: 'Tech. Affectation',
    desc: 'Débloque le recrutement de techniciens d\'affectation client',
    category: 'employees', spReq: 2, cost: 500,
    requires: [], icon: '👤',
  },
  EMPLOYEE_SUPPORT_UNLOCK: {
    id: 'EMPLOYEE_SUPPORT_UNLOCK', label: 'Tech. Support',
    desc: 'Débloque les techniciens support (boost satisfaction clients insatisfaits)',
    category: 'employees', spReq: 6, cost: 2500,
    requires: ['EMPLOYEE_ASSIGN_UNLOCK'], icon: '🛠️',
  },
  EMPLOYEE_SECURITY_UNLOCK: {
    id: 'EMPLOYEE_SECURITY_UNLOCK', label: 'Tech. Sécurité',
    desc: 'Débloque les techniciens de sécurité (protection contre les hacks)',
    category: 'employees', spReq: 18, cost: 6000,
    requires: ['EMPLOYEE_SUPPORT_UNLOCK'], icon: '🛡️',
  },

  // Support — résolution de tickets
  SUPPORT_UPGRADE: {
    id: 'SUPPORT_UPGRADE', label: 'Support Avancé',
    desc: 'Techniciens support résolvent 6 tickets/jour au lieu de 3',
    category: 'employees', spReq: 10, cost: 4000,
    requires: ['EMPLOYEE_SUPPORT_UNLOCK'], icon: '🛠️',
  },
  SUPPORT_UPGRADE2: {
    id: 'SUPPORT_UPGRADE2', label: 'Support Expert',
    desc: 'Techniciens support résolvent jusqu\'à 10 tickets/jour',
    category: 'employees', spReq: 20, cost: 8000,
    requires: ['SUPPORT_UPGRADE'], icon: '🛠️',
  },

  // Sécurité — protection hack (multi-niveaux, max 80%)
  SECURITY_LVL1: {
    id: 'SECURITY_LVL1', label: 'Sécurité Niv.1',
    desc: 'Réduit la probabilité de hack de 20% par serveur',
    category: 'employees', spReq: 8, cost: 3000,
    requires: ['EMPLOYEE_SECURITY_UNLOCK'], icon: '🔒',
  },
  SECURITY_LVL2: {
    id: 'SECURITY_LVL2', label: 'Sécurité Niv.2',
    desc: 'Protection hack cumulée : 40%',
    category: 'employees', spReq: 15, cost: 7000,
    requires: ['SECURITY_LVL1'], icon: '🔒',
  },
  SECURITY_LVL3: {
    id: 'SECURITY_LVL3', label: 'Sécurité Niv.3',
    desc: 'Protection hack cumulée : 60%',
    category: 'employees', spReq: 25, cost: 12000,
    requires: ['SECURITY_LVL2'], icon: '🔒',
  },
  SECURITY_LVL4: {
    id: 'SECURITY_LVL4', label: 'Sécurité Niv.4 MAX',
    desc: 'Protection hack maximale : 80% — vos serveurs sont quasi invulnérables',
    category: 'employees', spReq: 40, cost: 20000,
    requires: ['SECURITY_LVL3'], icon: '🔒',
  },

  // Infrastructure
  COOLING_ADV: {
    id: 'COOLING_ADV', label: 'Refroid. Avancé',
    desc: 'Réduit la température des serveurs de 15%',
    category: 'infra', spReq: 3, cost: 1800,
    requires: [], icon: '❄️',
  },
  MONITORING: {
    id: 'MONITORING', label: 'Monitoring',
    desc: 'Alertes précoces — seuil warning à 70% santé',
    category: 'infra', spReq: 4, cost: 2200,
    requires: [], icon: '📊',
  },
  POWER_OPT: {
    id: 'POWER_OPT', label: 'Optim. Énergie',
    desc: 'Consommation électrique -15%',
    category: 'infra', spReq: 8, cost: 3000,
    requires: ['COOLING_ADV'], icon: '🔋',
  },
  POWER_UPGRADE: {
    id: 'POWER_UPGRADE', label: 'Capacité Électrique',
    desc: 'Augmente la capacité électrique de +2000W pour alimenter davantage de serveurs',
    category: 'infra', spReq: 8, cost: 4000,
    requires: ['COOLING_ADV'], icon: '⚡',
    stateEffect: { type: 'addPowerCap', value: 2000 },
  },
  REDUNDANCY: {
    id: 'REDUNDANCY', label: 'Redondance Réseau',
    desc: 'Réduit la durée d\'indisponibilité des serveurs après une panne de 1 jour',
    category: 'infra', spReq: 12, cost: 6000,
    requires: ['MONITORING'], icon: '🔁',
    stateEffect: { type: 'reduceRepairDays', value: 1 },
  },
  GREEN_ENERGY: {
    id: 'GREEN_ENERGY', label: 'Énergie Verte',
    desc: 'Panneau solaire & éolien : consommation électrique -25% supplémentaire + boost image (+5 rep)',
    category: 'infra', spReq: 20, cost: 12000,
    requires: ['POWER_OPT'], icon: '🌱',
    stateEffect: { type: 'greenEnergy', value: true },
  },
  STORAGE_DENSE_UNLOCK: {
    id: 'STORAGE_DENSE_UNLOCK', label: 'Serveur Stockage Dense',
    desc: 'Débloque les serveurs haute densité de stockage (2TB+, idéal Streaming)',
    category: 'servers', spReq: 14, cost: 9000,
    requires: ['BALANCED_UNLOCK'], icon: '💾',
  },
  AUTO_SCALING: {
    id: 'AUTO_SCALING', label: 'Auto-Scaling',
    desc: 'Les clients en pic de charge ne déclenchent plus de ticket de saturation. +10% satisfaction passive.',
    category: 'business', spReq: 18, cost: 8000,
    requires: ['SERVICE_EXPAND', 'MONITORING'], icon: '📈',
  },
  DISASTER_RECOVERY: {
    id: 'DISASTER_RECOVERY', label: 'Plan de Reprise',
    desc: 'En cas de panne réseau globale, 50% des clients sont restaurés automatiquement en 1 jour',
    category: 'infra', spReq: 28, cost: 18000,
    requires: ['REDUNDANCY'], icon: '🛡️',
    stateEffect: { type: 'disasterRecovery', value: true },
  },
  INSURANCE: {
    id: 'INSURANCE', label: 'Assurance Serveurs',
    desc: 'Rembourse 50% des coûts de réparation automatiques (répare aussi sans frais au bout de 5j)',
    category: 'business', spReq: 10, cost: 5000,
    requires: ['EMPLOYEE_SUPPORT_UNLOCK'], icon: '🏦',
    stateEffect: { type: 'insurance', value: true },
  },

  // Business
  CLIENT_RETENTION: {
    id: 'CLIENT_RETENTION', label: 'Fidélisation',
    desc: 'Clients restent 30% plus longtemps',
    category: 'business', spReq: 4, cost: 2000,
    requires: [], icon: '🤝',
  },
  PRICING_FLEX: {
    id: 'PRICING_FLEX', label: 'Flex. Tarifaire',
    desc: 'Impact des changements de prix réduit de 50%',
    category: 'business', spReq: 8, cost: 2500,
    requires: [], icon: '💰',
  },
  PREMIUM_SLA: {
    id: 'PREMIUM_SLA', label: 'SLA Premium',
    desc: '+8 satisfaction de base pour tous les clients',
    category: 'business', spReq: 15, cost: 5000,
    requires: ['CLIENT_RETENTION'], icon: '⭐',
  },
  SERVICE_EXPAND: {
    id: 'SERVICE_EXPAND', label: 'Marketing Services',
    desc: 'Augmente le taux d\'arrivée des clients de 25% pour tous les services',
    category: 'business', spReq: 5, cost: 3000,
    requires: [], icon: '📦',
    // Passive effect — checked in ClientEngine via state.unlockedSkills
  },
  BULK_DEAL: {
    id: 'BULK_DEAL', label: 'Offre Groupée',
    desc: 'Les clients entreprise ont +20% de taux d\'arrivée et paient 15% de plus',
    category: 'business', spReq: 22, cost: 10000,
    requires: ['PREMIUM_SLA', 'SERVICE_EXPAND'], icon: '🏢',
  },
}

export { SKILLS }
