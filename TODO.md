# DataCenter Tycoon — TODO

## Solo (existant)
- [ ] Serveur en panne : restart auto → si échoue → payer réparation → si échoue → remplacer

---

## Nouvelles mécaniques (à implémenter)

### Générations de matériel (priorité haute)
Chaque serveur a un champ `generation` (année in-game d'achat).
Chaque année, une nouvelle révision de chaque famille est disponible (+8-12% capacité, +10-15% coût, légère efficacité énergie).
- [ ] Ajouter `generation: currentYear` dans `createServer()` (GameState.js)
- [ ] Dans `serverTypes.js` : transformer chaque type en tableau de générations indexées par année
- [ ] Score matériel dans `ClientPool.js` : `hardwareScore = max(0, 1 - (currentYear - avgServerYear) * 0.08)`
- [ ] Intégrer `hardwareScore` dans `scorePlayer()` comme facteur de scoring (poids ~0.15)
- [ ] Badge visuel dans RackPanel/GameCanvas : 🟢 < 1 an, 🟡 2-3 ans, 🔴 4+ ans
- [ ] Notification annuelle : "Nouvelle génération [TYPE] disponible — +X% capacité"
- [ ] Stat "Âge moyen matériel" dans MultiplayerPanel
- [ ] Vendre un vieux serveur : récupère 30-50% du prix d'achat selon âge

### Système de prêts bancaires
- [ ] Emprunter 2 000–50 000$ à taux journalier (0.1–0.3% selon montant)
- [ ] Remboursement automatique chaque jour (minimum) ou manuel
- [ ] Si dettes > capital → pénalité réputation / game over possible
- [ ] UI : panneau Banque dans ShopPanel avec simulation d'intérêts

### Niveaux SLA (contrats qualité)
- [ ] Bronze (défaut) / Silver (+25% tarif, SLA 95% uptime) / Gold (+75%, SLA 99%)
- [ ] Si SLA non respecté → pénalité réputation + remboursement partiel
- [ ] Les clients Silver/Gold arrivent plus rarement mais restent plus longtemps
- [ ] Indicateur SLA par client dans ClientsPanel

### Vieillissement matériel avancé
- [ ] Reliability dégradation : après 300 jours −0.002/30j, après 600j maintenance +20%
- [ ] Marché d'occasion : chaque semaine 2-3 serveurs usagés disponibles (−40% prix, age 200-400j)
- [ ] Option "refurb" : payer 200$ pour reset l'âge d'un serveur existant

### Bande passante réseau
- [ ] Chaque étage a un switch (capacité par défaut 1 Gbps)
- [ ] GAMING/STREAMING consomment plus de bande passante que VPS/STORAGE
- [ ] Saturation réseau → satisfaction clients −2/j
- [ ] Upgrade switch en jeu (~500$ pour +2 Gbps)

### Incubateur de startups (contrats long terme)
- [ ] Toutes les 60 jours : offre d'un contrat 12 mois à prix fixe garanti
- [ ] Accepter = revenus stables mais slots bloqués
- [ ] Refuser = garder flexibilité marché
- [ ] Nécessite réputation > 40 pour recevoir des offres

### Catastrophes localisées
- [ ] Incendie de rack / surtension / water leak sur 1-4 cellules adjacentes
- [ ] Avec skill SECURITY : 50% chance de sauver les serveurs
- [ ] Déclenché par événements spéciaux (fréquence très rare, ~1 fois/100 jours)

---

---

## Multijoueur — Architecture

### Script Serveur (`/server/`)
Node.js + Socket.io, lancé séparément du serveur Vue.
Importe les données de base depuis `src/game/` (SERVER_TYPES, SERVICES, SKILLS, etc.)

- [ ] `server/index.js` — point d'entrée, création de rooms, gestion connexions
- [ ] `server/GameRoom.js` — logique d'une room (tick partagé, pool clients, events)
- [ ] `server/LobbyRegistry.js` — enregistrement auprès du lobby central (heartbeat 30s)
- [ ] `server/StateSync.js` — broadcast initial full state + deltas ensuite

### Lobby API (`/lobby/`)
Serveur Express léger hébergé sur VPS, reçoit les heartbeats des game servers.

- [ ] `lobby/index.js` — API REST : GET /servers, POST /register, DELETE /unregister
- [ ] `lobby/store.js` — stockage en mémoire des serveurs actifs (TTL 60s sans heartbeat)
- [ ] Endpoint public : liste des serveurs avec nom, description, image URL, rooms[], playerCount

---

## Multijoueur — Game Server

### Rooms
- [ ] Création de room : nom, max joueurs (≤16), mot de passe optionnel
- [ ] Game master : premier joueur ou désigné — peut kick, démarrer, exporter save
- [ ] Export save : snapshot JSON du state complet de la room → rechargeable dans nouvelle room
- [ ] Rejoindre : liste des rooms avec joueurs actifs / max + durée de partie en cours

### Tick partagé
- [ ] `processDayTick` tourne côté serveur uniquement (autorité unique)
- [ ] Events partagés : même event pour tout le monde au même moment
- [ ] Certains events ciblés : DDOS sur le moins cher du marché, etc.

### Pool de clients partagé
- [ ] Génération côté serveur (pas côté client)
- [ ] Chaque client a : budget, type de service, score d'attractivité par joueur
- [ ] Score = f(prix du joueur, réputation, uptime, spécialisation)
- [ ] Attribution : client choisit le joueur avec meilleur score
- [ ] Churn à l'expiry : recalcule les scores — si concurrent >15% plus attractif → migration

### Spécialisation
- [ ] Expert = serviceSlots avec UN seul type actif (les autres à 0)
- [ ] 1 expert sur un type → +60% des clients de ce type en priorité
- [ ] 2 experts → 60% divisé selon réputation relative
- [ ] 3+ experts → bonus réduit à 40% divisé
- [ ] Indicateur visuel "Expert [Type]" dans l'UI

### Graphique de marché
- [ ] Panneau "Marché" visible par tous : demande par type en temps réel
- [ ] Barres horizontales + flèche de tendance (hausse/baisse)
- [ ] Historique 12 derniers mois in-game
- [ ] Changement annuel des pondérations (Gaming monte, Storage descend, etc.)
- [ ] Signal avant changement : news/event quelques jours avant l'année

### Déconnexion / Reconnexion
- [ ] Si joueur déconnecté : datacenter continue à tourner (serveurs, revenus, clients existants)
- [ ] Pas de nouveaux clients ni nouveaux tickets pour le joueur déconnecté
- [ ] Reconnexion : full state envoyé, reprise normale

### Anti-monopole
- [ ] Si joueur >60% du marché : malus "méfiance clients" sur l'attractivité
- [ ] Clients enterprise multi-joueurs : gros contrat nécessitant 2 datacenters = coopération

### Leaderboard & Meta
- [ ] Leaderboard temps réel : revenue total, clients actifs, uptime 30j
- [ ] Saisons : partie dure X années in-game → classement final
- [ ] Mode observateur : rejoindre sans jouer

---

## UI Multijoueur (côté Vue)

- [ ] Écran "Multijoueur" : liste des serveurs (depuis Lobby API)
- [ ] Détail serveur : rooms avec joueurs / max + temps de partie
- [ ] Panneau "Marché partagé" (graphique demande + prix concurrents)
- [ ] Indicateur connexion temps réel (ping, statut)
- [ ] Chat / notifications inter-joueurs (optionnel)
