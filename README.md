# DataCenter Tycoon RTS

Jeu de gestion de datacenter en temps réel — construit avec Vue 3, jouable en solo ou en multijoueur compétitif.

---

## Objectif

Construire et gérer un datacenter rentable : acheter des racks, installer des serveurs, attirer des clients, maintenir une haute satisfaction et développer votre réputation pour accéder aux contrats Enterprise et aux technologies avancées.

---

## Démarrage rapide

```bash
npm install
npm run dev      # client Vue sur http://localhost:5173
node server/index.js  # serveur multijoueur (optionnel)
```

---

## Systèmes de jeu

### Infrastructure

| Élément | Coût | Détail |
|---------|------|--------|
| Rack | 400$ | 6 emplacements de serveur. Cliquer une cellule vide du canvas ouvre le Shop. |
| Cellule déverrouillée | 400$ + 200$ × nb débloquées | Cliquer une cellule verrouillée adjacente l'achète |
| Étage supplémentaire | 10 000$ × nb étages actuels | Augmente la surface disponible |
| Retrait d'un serveur | Remboursement 30% du prix d'achat | Via le panneau rack |

**Capacité électrique** : plafond de 3 000W par défaut. Dépasser ce seuil entraîne une pénalité de 0,08$/W en excès + ticket critique par tick. Skill `POWER_UPGRADE` ajoute +2 000W.

### Serveurs

| Type | Prix | Maintenance/j | Fiabilité | Puissance | Débloquer |
|------|------|--------------|-----------|-----------|-----------|
| Basic | 200$ | 8$/j | 97% | 80W | Toujours disponible |
| Balanced | 500$ | 18$/j | 98,5% | 150W | Skill BALANCED_UNLOCK (5 SP) |
| Performance | 1 200$ | 35$/j | 99,2% | 300W | Skill PERFORMANCE_UNLOCK (12 SP, Rep 50) |
| GPU | 2 500$ | 60$/j | 99% | 450W | Skill GPU_UNLOCK (20 SP, Rep 70) |
| Storage Dense | 1 800$ | 28$/j | 98,8% | 200W | Skill STORAGE_DENSE_UNLOCK (14 SP, Rep 50) |

Les serveurs dégradent leur fiabilité à chaque redémarrage : `80% - lifetimeRestarts × 15%` (plancher 5%). Un serveur en panne depuis 7 jours est réparé automatiquement pour 800$ (400$ avec l'assurance).

**Réparation manuelle** : Normale 200$ (3 jours) / Rapide 400$ (1 jour).

### Services et clients

Chaque service possède un nombre de **slots** (clients actifs simultanés) et un **prix** ajustable.

| Service | Prix base | Clients typiques |
|---------|-----------|-----------------|
| VPS | 8$/j | Petites charges, nombreux clients |
| Dedicated | 45$/j | Charge élevée CPU/RAM |
| Storage | 15$/j | Forte demande disque |
| Gaming | 30$/j | CPU + RAM |
| Streaming | 22$/j | Forte demande disque |
| AI Cloud | 80$/j | CPU + RAM très élevés (GPU requis) |
| Enterprise | 150–500$/j | Contrats 180–365 jours, 2–4 serveurs |

**Mode Templates** : chaque service peut basculer en mode "templates" — vous définissez des configurations clients fixes (CPU/RAM/Disk/prix) au lieu de la génération automatique aléatoire.

**Enterprise** : disponible à partir de **20 de réputation**. Contrats longs, 2 à 4 serveurs simultanés. Rapportent +3 SP à l'expiration, +2 SP au renouvellement.

### Économie

**Revenus** = prix service × clients actifs (ou `dailyRate` pour Enterprise)

**Coûts quotidiens** :
- Maintenance serveurs (par type, voir tableau ci-dessus)
- Électricité = Watts totaux × 0,015$/W (modifié par skills POWER_OPT, GREEN_ENERGY)
- Salaires employés (voir section Employés)
- Pénalité surcharge électrique = 0,08$/W en excès

**Réputation** :
- Gain lent (×0,0006) / Perte rapide (×0,012)
- Sans clients actifs : déclin de -0,15/tick
- Diminishing returns au-delà de 50 : `max(0.02, 1 - rep/100 × 0.98)`

### Employés

Nécessitent le skill correspondant avant embauche.

| Type | Embauche | Salaire/j | Effet |
|------|----------|-----------|-------|
| Affectation | 3 000$ | 80$/j | +5 affectations clients/jour |
| Support | 3 000$ | 100$/j | Boost satisfaction clients insatisfaits, résout 3 tickets/j (6 avec SUPPORT_UPGRADE, 10 avec SUPPORT_UPGRADE2) |
| Sécurité | 3 000$ | 120$/j | Protection contre les hacks |

### Tickets

Les tickets apparaissent automatiquement lors de pannes, surcharges, insatisfactions clients. Le nombre de tickets non résolus dégrade la réputation.

### Événements aléatoires

Des événements surviennent périodiquement : pannes réseau, pics de demande, attaques, fluctuations électriques, etc. Ils modifient temporairement les multiplicateurs de revenus, coûts ou satisfaction.

---

## Arbre de compétences (Skill Tree)

Les **Skill Points (SP)** s'obtiennent à la fin de chaque contrat client (+1 régulier, +3 Enterprise à l'expiration, +2 à la renouvellement).

> **Spécialisation** : certains skills avancés nécessitent un niveau de réputation minimum — vous devez d'abord prouver votre fiabilité avant de vous spécialiser.

### Serveurs — Unlocks

| Skill | SP | Coût | Rep | Effet |
|-------|-----|------|-----|-------|
| BALANCED_UNLOCK | 5 | 2 000$ | — | Serveurs Balanced |
| PERFORMANCE_UNLOCK | 12 | 6 000$ | **50** | Serveurs Performance |
| GPU_UNLOCK | 20 | 15 000$ | **70** | Serveurs GPU |
| STORAGE_DENSE_UNLOCK | 14 | 9 000$ | **50** | Serveurs Stockage Dense |

### Serveurs — Upgrades

Chaînes d'upgrade pour Basic (×3), Balanced (×2), Performance (×2), GPU (×2) — améliorent CPU, RAM, Disk de chaque serveur existant et futur.

### Services — Capacité

Upgrade des limites max CPU/RAM/Disk par service : VPS (×2), Gaming (×2), AI Cloud (×2), Streaming (×2), Dedicated (×2), Storage (×2).

### Employés

- Unlock Affectation → Support → Sécurité (chaîne)
- Support Avancé / Expert (résolution tickets)
- Sécurité Niv.1 à 4 (jusqu'à 80% protection hack)

### Infrastructure

| Skill | Effet |
|-------|-------|
| COOLING_ADV | Température -15% |
| MONITORING | Alertes warning à 70% santé |
| POWER_OPT | Électricité -15% |
| POWER_UPGRADE | Capacité +2 000W |
| REDUNDANCY | Durée panne -1 jour |
| GREEN_ENERGY | Électricité -25% supp. + rep +5 |
| DISASTER_RECOVERY | 50% clients restaurés auto après panne globale |
| INSURANCE | Réparation auto à -50% |

### Business

| Skill | Effet |
|-------|-------|
| CLIENT_RETENTION | Contrats +30% plus longs |
| PRICING_FLEX | Impact prix sur satisfaction -50% |
| PREMIUM_SLA | +8 satisfaction de base |
| SERVICE_EXPAND | Taux d'arrivée +25% |
| BULK_DEAL | Enterprise +20% arrivée, +15% revenu |
| AUTO_SCALING | Pas de ticket saturation lors de pics |

---

## Stratégies

### Démarrage optimal (1 000$ de départ)

1. Acheter 1 rack (400$) + 1 serveur Basic (200$) → reste 400$
2. Activer VPS (slots 5) + Storage (slots 3) — faibles exigences hardware
3. Premier skill : `EMPLOYEE_ASSIGN_UNLOCK` (2 SP, 500$) → affectation automatique
4. Second skill : `CLIENT_RETENTION` (4 SP) → clients restent 30% plus longtemps
5. Ne pas acheter d'employés avant d'avoir ≥ 1 500$/j de revenu net

### Spécialisation Gaming / Esport

- Route : BALANCED_UNLOCK → PERFORMANCE_UNLOCK (rep 50) → GAMING_PRO → GAMING_ULTRA
- Prix Gaming élevé (40–50$/j) + PREMIUM_SLA + BULK_DEAL
- Serveurs Performance avec PERFORMANCE_PLUS2
- Nécessite une bonne gestion thermique (COOLING_ADV + POWER_OPT)

### Spécialisation IA / Enterprise

- Route : GPU_UNLOCK (rep 70) → AI_ULTRA → AI_EXTREME
- Requiert beaucoup d'électricité (GPU = 450W+) → POWER_UPGRADE obligatoire
- Contrats Enterprise très rentables (150–500$/j/contrat × 180–365 jours)
- BULK_DEAL (+15% revenu Enterprise) est essentiel

### Spécialisation Stockage / Streaming

- Route : STORAGE_DENSE_UNLOCK (rep 50) → STORAGE_ULTRA → STORAGE_EXTREME
- Services Storage + Streaming à haute densité disque
- Serveurs Storage Dense ont le meilleur ratio disque/watt

### Défense et fiabilité

- MONITORING + REDUNDANCY → réduction downtime
- Employés Sécurité + SECURITY_LVL1-4 → protection hacks
- INSURANCE → réparer à moitié prix
- DISASTER_RECOVERY → récupération automatique sur panne massive

### Gestion des prix

- Augmenter les prix réduit la satisfaction et ralentit les arrivées
- `PRICING_FLEX` réduit cet impact de 50% — débloquer avant d'ajuster les prix
- Les prix Enterprise sont indépendants (`dailyRate` fixé à la génération du client)

---

## Mode Multijoueur

Le serveur Node.js gère des salles (`/api/rooms`). Les joueurs rejoignent une salle et jouent dans le même univers partagé : mêmes événements, même pool de clients distribués entre joueurs.

**Synchronisation** : les actions (acheter rack, installer serveur, réparer...) sont envoyées au serveur via Socket.io. Le serveur valide et renvoie un delta d'état à tous les joueurs.

**Lobby** : un serveur de lobby central peut enregistrer les salles disponibles. Configurable via les variables d'environnement `LOBBY_URL`, `SERVER_DESCRIPTION`, `SERVER_IMAGE_URL`.

---

## Variables d'environnement (serveur)

| Variable | Défaut | Rôle |
|----------|--------|------|
| `PORT` | 3000 | Port du serveur Socket.io |
| `LOBBY_URL` | — | URL du lobby central pour l'enregistrement |
| `SERVER_DESCRIPTION` | — | Description affichée dans le lobby |
| `SERVER_IMAGE_URL` | — | Image du serveur dans le lobby |

---

## Stack technique

- **Frontend** : Vue 3 (Composition API, `<script setup>`), pas de TypeScript
- **State** : `reactive(createGameState())` dans App.vue, passé en prop
- **Loop** : `requestAnimationFrame` + tick toutes les 10s (ajusté par la vitesse)
- **Serveur** : Node.js + Socket.io
- **Build** : Vite
