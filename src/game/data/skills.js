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
    requires: ['BALANCED_UNLOCK'], icon: '⚡', repReq: 50,
  },
  GPU_UNLOCK: {
    id: 'GPU_UNLOCK', label: 'Serveur GPU',
    desc: 'Débloque les serveurs GPU (gaming / IA)',
    category: 'servers', spReq: 20, cost: 15000,
    requires: ['PERFORMANCE_UNLOCK'], icon: '🎮', repReq: 70,
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
    requires: ['BALANCED_UNLOCK'], icon: '💾', repReq: 50,
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

  // Migration à chaud
  LIVE_MIGRATION: {
    id: 'LIVE_MIGRATION', label: 'Migration à Chaud',
    desc: 'Lors du renouvellement d\'un serveur, les clients migrent automatiquement sans interruption de service. Sans ce skill, ils retournent en file d\'attente.',
    category: 'infra', spReq: 18, cost: 10000,
    requires: ['REDUNDANCY'], icon: '🔄',
  },
}

export { SKILLS }
