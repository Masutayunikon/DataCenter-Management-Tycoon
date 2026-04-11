# Progress Tracker

## Done

- [x] Core game loop (day tick, speed controls 0/1/2/3x)
- [x] Grid canvas with floor tabs, cell locking, buy-floor
- [x] Rack placement + server installation (BASIC/BALANCED/PERFORMANCE)
- [x] Client generation, queue system, manual assignment
- [x] Services: VPS, DEDICATED, STORAGE, GAMING
- [x] Satisfaction system (CPU/RAM/disk load, heat, server health)
- [x] Churn: client leaves after 3 days unhappy
- [x] Departure reason tickets (abandon, churn, serveur indisponible, fin de contrat)
- [x] Reputation system (harder gains, diminishing returns, decay without clients)
- [x] Price control per service + satisfaction impact on price change (`applyPriceChange`)
- [x] Random event system (EventSystem.js) with active-events display
- [x] Terminal modal per server (CLI simulation)
- [x] Tickets panel (support tickets, unread badge)
- [x] Skill tree (SkillTreePanel.vue) — 18 skills across 5 categories
  - Server type unlocks: BALANCED, PERFORMANCE, GPU
  - Server upgrades: BASIC+/++/+++, BALANCED+/++
  - Employee unlocks: assign, support, security
  - Infra: COOLING_ADV, MONITORING, POWER_OPT
  - Business: CLIENT_RETENTION, PRICING_FLEX, PREMIUM_SLA
- [x] GPU server type (skill-gated)
- [x] Shop + Skills as drawer overlay modals (TopBar buttons → right-side drawer)
- [x] Right panel responsive width: `clamp(220px, 20vw, 300px)`
- [x] Canvas layout fix (no more black void below grid)
- [x] TopBar stats hover popup (finance, infra, reputation, active events)
- [x] Queue badge in TopBar → click to go to Clients tab
- [x] Employee system (assign tech reduces queue wait, costs/day)
- [x] Auto-repair after 7 days (costs $800)
- [x] Floor unlock + buy system
- [x] **Faster client arrival** — rate ~0.8/j à rep=0 (was 0.045/j), plein effet à rep=50
- [x] **Contract renewal** — 50% chance à sat≥75, 25% à sat≥55 en fin de contrat
- [x] **Enterprise clients** — service ENTERPRISE, 2–4 serveurs requis, demandes élevées (CPU 150–600, RAM 30–200G, Disk 50–400G), badge 🏢, assignment slot-par-slot dans ClientsPanel
- [x] **SimulationEngine split** — découpé en 7 modules (SimUtils, TicketEngine, ServerEngine, ClientEngine, EconomyEngine, GridEngine, SkillEngine) ; SimulationEngine.js est maintenant un orchestrateur mince qui re-exporte toute l'API publique

- [x] **Per-service slot system** — `serviceSlots: { VPS: 0, ... }` replaces `enabledServices`/`maxEnabledServices`; player sets slot count per service (+1/+10/−1/−10); clients arrive only when active+queued < slots; fill bar per service; SERVICE_EXPAND skill reworked to +25% arrival rate (passive)
- [x] **Enterprise client rework** — removed ENTERPRISE from enabledServices/servicePrices; `hidden: true` on service; generated independently via `generateEnterpriseClients` (rep≥20, rate 0–0.08/j); uses `client.dailyRate` (150–500$/j); contracts 180–365 days; revenue uses dailyRate not servicePrices
- [x] **Skill points system** — `state.skillPoints` (earned on contract end: +1 regular, +3 enterprise, +1/2 renewal); SkillTreePanel shows SP; all skills use `spReq` instead of `repReq`; SkillEngine checks SP
- [x] **PERFORMANCE+/++ and GPU+/++ upgrades** — 4 new skills in upgrades category
- [x] **Shop employees: support + security** — gated by skill unlock; support boosts sat of unhappy clients; security shows in shop when unlocked
- [x] **Server repair rework** — 1 restart attempt per failure; chance = max(5%, 80% - lifetimeRestarts×15%); `lifetimeRestarts` field never resets; RackPanel shows correct pct; repair paid as before
- [x] **Electricity impact** — rate 0.005→0.015; `powerCap: 3000` in state; overload penalty $0.08/excess W + critical ticket; TopBar shows power/cap with color; POWER_UPGRADE skill (+2000W cap)

- [x] **Scaling client demands over time** — `getDemandScale(day)` = min(2×, 1 + day/300); applied at client creation via `applyDemandScale`; enterprise clients also scaled
- [x] **Save/load system** — `SaveSystem.js`; auto-save every 5 days; manual 💾/📂 buttons in TopBar; toast feedback; version check; `reapplyServerTypeUpgrades` on load
- [x] **Contracts UI** — `contractDaysLeft` shown per active client; color-coded (normal/soon/urgent); enterprise daily rate shown in purple
- [x] **GPU server in ShopPanel** — already gated by `isUnlocked` in RackPanel install section (no ShopPanel server-type cards exist)
- [x] **`.demand`/`.load` alias cleanup** — all engine/UI code now uses `cpuDemand`/`cpuLoad` directly (safe for JSON serialization)

## Pending / TODO

- [ ] **Terminal gameplay/missions** — clients generate requests, player connects via terminal, earns SP; deferred (complex)

## Architecture Notes

- Never add `align-items: center` to `.canvas-area` — it breaks canvas height
- Skills use `state.unlockedSkills.includes()` passive checks each tick — no stored effect state
- `applySkill` (SkillEngine.js) modifies `SERVER_TYPES` in-place AND iterates all existing servers
- `applyPriceChange` (EconomyEngine.js) is called from ServicesPanel before setting price, halved by `PRICING_FLEX` skill
- Enterprise clients: `isEnterprise=true`, `requiredServers` (2–4), `serverPositions[]` (active slots), `pendingPositions[]` (being assigned in queue). Per-slot demand = `Math.ceil(total / requiredServers)` for capacity checks.
- SimulationEngine.js re-exports all public symbols — composants n'ont pas besoin d'importer les sous-modules directement
