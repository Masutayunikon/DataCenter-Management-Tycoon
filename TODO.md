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


