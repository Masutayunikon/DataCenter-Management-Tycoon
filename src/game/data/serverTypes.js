const SERVER_TYPES = {
  BASIC: {
    label:        'Basic',
    cpuCapacity:  100,
    ramCapacity:  16,    // GB
    diskCapacity: 200,   // GB
    powerBase:    80,
    reliability:  0.97,
    cost:         200,
    dailyCost:    8,
    unlockRep:    0,
    color:        '#388bfd',
  },
  BALANCED: {
    label:        'Balanced',
    cpuCapacity:  200,
    ramCapacity:  64,
    diskCapacity: 500,
    powerBase:    150,
    reliability:  0.985,
    cost:         500,
    dailyCost:    18,
    unlockRep:    999,
    color:        '#3fb950',
  },
  PERFORMANCE: {
    label:        'Performance',
    cpuCapacity:  400,
    ramCapacity:  256,
    diskCapacity: 300,
    powerBase:    300,
    reliability:  0.992,
    cost:         1200,
    dailyCost:    35,
    unlockRep:    999,
    color:        '#f78166',
  },
  GPU: {
    label:        'GPU',
    cpuCapacity:  300,
    ramCapacity:  128,
    diskCapacity: 200,
    powerBase:    450,
    reliability:  0.99,
    cost:         2500,
    dailyCost:    60,
    unlockRep:    999,   // never auto-unlocked by rep — requires skill
    color:        '#a371f7',
  },
  STORAGE_DENSE: {
    label:        'Stockage Dense',
    cpuCapacity:  80,
    ramCapacity:  32,
    diskCapacity: 2000,  // GB — massive storage
    powerBase:    200,
    reliability:  0.988,
    cost:         1800,
    dailyCost:    28,
    unlockRep:    999,   // requires skill STORAGE_DENSE_UNLOCK
    color:        '#38bdf8',
  },
}

export { SERVER_TYPES }
