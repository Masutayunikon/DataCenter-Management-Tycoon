// ─── Mission types ────────────────────────────────────────────────────────────
// deadline = jours avant expiration ; urgency = couleur ; sp = skill points gagnés

const MISSION_TYPES = [
  // ── MISSIONS EXISTANTES (corrigées) ────────────────────────────────────────

  {
    id: 'optimize', label: 'Optimisation serveur', command: 'optimize',
    clientMessage: 'Bonjour, depuis quelques jours mes applis tournent au ralenti. Les temps de réponse ont presque doublé sur toutes mes ressources — CPU, RAM, disque. Pouvez-vous faire une optimisation en profondeur, sans vous limiter à une seule ressource ?',
    args: [
      { flag: '--mode',   values: ['aggressive', 'balanced', 'safe'],   required: true,  hint: 'niveau d\'optimisation' },
      { flag: '--target', values: ['cpu', 'ram', 'disk', 'all'],        required: true,  hint: 'ressource cible' },
    ],
    optimalArgs: { '--mode': 'aggressive', '--target': 'all' },
    deadline: 8, urgency: 'info', sp: 1, satReward: 15, satPenalty: -12,
  },
  {
    id: 'backup', label: 'Backup d\'urgence', command: 'backup',
    clientMessage: 'Salut, j\'ai perdu des fichiers importants la semaine dernière à cause d\'un crash. Je veux des sauvegardes complètes tous les jours, pas juste les différences. Merci de configurer ça !',
    args: [
      { flag: '--schedule', values: ['hourly', 'daily', 'weekly'],      required: true,  hint: 'fréquence de sauvegarde' },
      { flag: '--type',     values: ['full', 'incremental'],            required: true,  hint: 'type de sauvegarde' },
    ],
    optimalArgs: { '--schedule': 'daily', '--type': 'full' },
    deadline: 5, urgency: 'warning', sp: 1, satReward: 12, satPenalty: -20,
  },
  {
    id: 'update', label: 'Mise à jour critique', command: 'update',
    clientMessage: 'Bonsoir, j\'ai reçu une alerte : une faille de sécurité critique a été détectée. Je veux que tous les paquets soient mis à jour, et que le serveur redémarre ensuite pour appliquer les changements.',
    args: [
      { flag: '--package', values: ['all', 'kernel', 'security'],       required: true,  hint: 'paquets à mettre à jour' },
      { flag: '--reboot',  values: ['yes', 'no'],                       required: false, hint: 'redémarrer après (défaut: no)' },
    ],
    optimalArgs: { '--package': 'all', '--reboot': 'yes' },
    deadline: 9, urgency: 'info', sp: 1, satReward: 10, satPenalty: -8,
  },
  {
    id: 'incident', label: 'Incident réseau', command: 'diagnose',
    clientMessage: 'URGENT !! Mon site est totalement inaccessible depuis ce matin. Je ne sais pas si c\'est eth0 ou eth1, diagnostiquez toutes les interfaces. Et prenez le temps qu\'il faut, je préfère un diagnostic complet plutôt qu\'un résultat partiel !',
    args: [
      { flag: '--interface', values: ['eth0', 'eth1', 'all'],           required: true,  hint: 'interface réseau à analyser' },
      { flag: '--timeout',   values: ['10', '30', '60'],                required: false, hint: 'timeout en secondes (défaut: 30)' },
    ],
    optimalArgs: { '--interface': 'all', '--timeout': '60' },
    deadline: 3, urgency: 'critical', sp: 2, satReward: 20, satPenalty: -30,
  },
  {
    id: 'scaling', label: 'Pic de charge', command: 'scale',
    clientMessage: 'Bonjour, on vient de lancer une campagne et le trafic a été multiplié par 3 ! Le serveur est à saturation sur le CPU et la RAM. Il faut absolument adapter les deux ressources à ce volume de trafic.',
    args: [
      { flag: '--resource', values: ['cpu', 'ram', 'both'],             required: true,  hint: 'ressource à redimensionner' },
      { flag: '--factor',   values: ['x1.5', 'x2', 'x3'],              required: true,  hint: 'facteur d\'augmentation' },
    ],
    optimalArgs: { '--resource': 'both', '--factor': 'x3' },
    deadline: 4, urgency: 'warning', sp: 1, satReward: 18, satPenalty: -25,
  },
  {
    id: 'security', label: 'Alerte sécurité', command: 'audit',
    clientMessage: 'Bonjour, des connexions suspectes depuis des IPs inconnues ont été détectées cette nuit. Je veux un audit complet, pas juste les bases, et que les failles trouvées soient corrigées automatiquement.',
    args: [
      { flag: '--level', values: ['basic', 'full', 'paranoid'],         required: true,  hint: 'profondeur de l\'audit' },
      { flag: '--fix',   values: ['yes', 'no'],                         required: true,  hint: 'appliquer les correctifs automatiquement' },
    ],
    optimalArgs: { '--level': 'full', '--fix': 'yes' },
    deadline: 6, urgency: 'warning', sp: 2, satReward: 22, satPenalty: -15,
  },
  {
    id: 'migration', label: 'Migration données', command: 'migrate',
    clientMessage: 'Bonjour, je veux migrer mes données sans interruption de service, et je veux absolument une vérification d\'intégrité après, je ne peux pas me permettre de perdre quoi que ce soit.',
    args: [
      { flag: '--mode',   values: ['live', 'snapshot'],                 required: true,  hint: 'mode de migration' },
      { flag: '--verify', values: ['yes', 'no'],                        required: true,  hint: 'vérifier l\'intégrité post-migration' },
    ],
    optimalArgs: { '--mode': 'live', '--verify': 'yes' },
    deadline: 10, urgency: 'info', sp: 1, satReward: 14, satPenalty: -10,
  },
  {
    id: 'monitoring', label: 'Rapport monitoring', command: 'monitor',
    clientMessage: 'Bonjour, j\'ai besoin d\'un rapport de performances pour mon bilan mensuel. Il me faut les données du mois complet, en format HTML pour le transmettre à ma direction.',
    args: [
      { flag: '--period', values: ['day', 'week', 'month'],             required: true,  hint: 'période couverte par le rapport' },
      { flag: '--format', values: ['text', 'json', 'html'],             required: false, hint: 'format de sortie (défaut: text)' },
    ],
    optimalArgs: { '--period': 'month', '--format': 'html' },
    deadline: 7, urgency: 'info', sp: 1, satReward: 8, satPenalty: -5,
  },
  {
    id: 'ddos', label: 'Atténuation DDoS', command: 'shield',
    clientMessage: 'ALERTE ! Mon service est sous attaque DDoS depuis plusieurs heures. Le simple rate-limit ne suffira pas. Je veux une protection active par filtrage du trafic, maintenue pendant 24h.',
    args: [
      { flag: '--mode',     values: ['rate-limit', 'blackhole', 'scrub'], required: true,  hint: 'stratégie d\'atténuation' },
      { flag: '--duration', values: ['1h', '6h', '24h'],                  required: true,  hint: 'durée de la protection active' },
    ],
    optimalArgs: { '--mode': 'scrub', '--duration': '24h' },
    deadline: 2, urgency: 'critical', sp: 3, satReward: 25, satPenalty: -40,
  },
  {
    id: 'compliance', label: 'Audit de conformité', command: 'comply',
    clientMessage: 'Bonjour, nous avons un audit RGPD dans 10 jours. Pouvez-vous vérifier la conformité de notre environnement et corriger automatiquement les écarts identifiés ?',
    args: [
      { flag: '--standard', values: ['gdpr', 'iso27001', 'pci-dss'],     required: true,  hint: 'norme de conformité ciblée' },
      { flag: '--autofix',  values: ['yes', 'no'],                        required: false, hint: 'corriger les écarts automatiquement (défaut: no)' },
    ],
    optimalArgs: { '--standard': 'gdpr', '--autofix': 'yes' },
    deadline: 10, urgency: 'warning', sp: 2, satReward: 18, satPenalty: -12,
  },
  {
    id: 'restore', label: 'Restauration de backup', command: 'restore',
    clientMessage: 'Catastrophe ! J\'ai perdu toutes les données d\'hier suite à une fausse manipulation. Restaurez depuis le backup d\'hier et vérifiez bien que tout est intact après.',
    args: [
      { flag: '--point',   values: ['latest', 'yesterday', 'last-week'],  required: true,  hint: 'point de restauration' },
      { flag: '--verify',  values: ['yes', 'no'],                         required: true,  hint: 'vérifier l\'intégrité après restauration' },
    ],
    optimalArgs: { '--point': 'yesterday', '--verify': 'yes' },
    deadline: 4, urgency: 'critical', sp: 2, satReward: 22, satPenalty: -35,
  },
  {
    id: 'cdn', label: 'Configuration CDN', command: 'cdn',
    clientMessage: 'Salut, mes utilisateurs en Asie et aux États-Unis ont des temps de chargement horribles. Il me faut une couverture mondiale et un cache agressif pour mes assets statiques qui ne changent jamais.',
    args: [
      { flag: '--regions', values: ['eu', 'us', 'global'],               required: true,  hint: 'couverture géographique du CDN' },
      { flag: '--cache',   values: ['aggressive', 'standard', 'nocache'], required: false, hint: 'politique de cache (défaut: standard)' },
    ],
    optimalArgs: { '--regions': 'global', '--cache': 'aggressive' },
    deadline: 8, urgency: 'info', sp: 1, satReward: 12, satPenalty: -6,
  },

  // ── NOUVELLES MISSIONS ──────────────────────────────────────────────────────

  {
    id: 'ssl_renew', label: 'Renouvellement SSL', command: 'ssl',
    clientMessage: 'Mon certificat SSL expire dans 3 jours ! Les navigateurs commencent déjà à afficher des avertissements. Renouvelez-le automatiquement et redémarrez le serveur web pour appliquer le nouveau certificat.',
    args: [
      { flag: '--auto-renew', values: ['yes', 'no'],   required: true,  hint: 'activer le renouvellement automatique' },
      { flag: '--restart',    values: ['yes', 'no'],   required: true,  hint: 'redémarrer le serveur web après' },
    ],
    optimalArgs: { '--auto-renew': 'yes', '--restart': 'yes' },
    deadline: 3, urgency: 'critical', sp: 1, satReward: 15, satPenalty: -25,
  },
  {
    id: 'firewall', label: 'Configuration pare-feu', command: 'firewall',
    clientMessage: 'Bonjour, après l\'incident de la semaine dernière, je veux durcir la sécurité réseau. Appliquez les règles les plus strictes possible et bloquez tout trafic entrant non autorisé.',
    args: [
      { flag: '--policy',  values: ['strict', 'moderate', 'permissive'], required: true,  hint: 'niveau de restriction des règles' },
      { flag: '--default', values: ['deny', 'allow'],                    required: true,  hint: 'politique par défaut pour le trafic entrant' },
    ],
    optimalArgs: { '--policy': 'strict', '--default': 'deny' },
    deadline: 5, urgency: 'warning', sp: 1, satReward: 14, satPenalty: -18,
  },
  {
    id: 'db_vacuum', label: 'Nettoyage base de données', command: 'dbclean',
    clientMessage: 'Notre base de données a grossi de façon incontrôlée, on a perdu 40 Go d\'espace rien ce mois-ci. Lancez un nettoyage en profondeur et reconstruisez les index pour améliorer les performances.',
    args: [
      { flag: '--depth',   values: ['light', 'full', 'deep'],  required: true,  hint: 'profondeur du nettoyage' },
      { flag: '--reindex', values: ['yes', 'no'],              required: true,  hint: 'reconstruire les index après nettoyage' },
    ],
    optimalArgs: { '--depth': 'deep', '--reindex': 'yes' },
    deadline: 6, urgency: 'info', sp: 1, satReward: 11, satPenalty: -7,
  },
  {
    id: 'log_purge', label: 'Purge des logs', command: 'purge',
    clientMessage: 'Le disque est plein à 98% à cause des logs ! On arrive plus à écrire quoi que ce soit. Supprimez les logs de plus de 7 jours immédiatement, on ne peut pas attendre.',
    args: [
      { flag: '--older-than', values: ['1d', '7d', '30d'], required: true,  hint: 'supprimer les logs plus anciens que' },
      { flag: '--compress',   values: ['yes', 'no'],        required: false, hint: 'compresser avant suppression (défaut: no)' },
    ],
    optimalArgs: { '--older-than': '7d' },
    deadline: 2, urgency: 'critical', sp: 1, satReward: 10, satPenalty: -20,
  },
  {
    id: 'vpn_setup', label: 'Configuration VPN', command: 'vpn',
    clientMessage: 'Bonjour, mon équipe télétravaille et j\'ai besoin d\'un accès sécurisé à l\'infrastructure. Configurez un VPN avec un chiffrement fort, j\'ai des données sensibles à protéger.',
    args: [
      { flag: '--protocol',   values: ['wireguard', 'openvpn', 'ipsec'], required: true,  hint: 'protocole VPN à utiliser' },
      { flag: '--encryption', values: ['aes128', 'aes256', 'chacha20'],  required: true,  hint: 'algorithme de chiffrement' },
    ],
    optimalArgs: { '--protocol': 'wireguard', '--encryption': 'aes256' },
    deadline: 7, urgency: 'info', sp: 2, satReward: 16, satPenalty: -10,
  },
  {
    id: 'disk_expand', label: 'Extension de volume', command: 'expand',
    clientMessage: 'On est à 95% de capacité disque et ça bloque nos déploiements. Doublez l\'espace de stockage et repartitionnez à chaud sans interruption de service.',
    args: [
      { flag: '--size',   values: ['x1.5', 'x2', 'x3'],       required: true,  hint: 'facteur d\'extension du volume' },
      { flag: '--method', values: ['online', 'offline'],        required: true,  hint: 'méthode de redimensionnement' },
    ],
    optimalArgs: { '--size': 'x2', '--method': 'online' },
    deadline: 4, urgency: 'warning', sp: 1, satReward: 13, satPenalty: -22,
  },
  {
    id: 'cron_setup', label: 'Configuration tâches planifiées', command: 'cron',
    clientMessage: 'Bonjour, j\'ai besoin que mon script de génération de rapports tourne automatiquement. Il doit s\'exécuter chaque nuit et envoyer un mail si ça échoue.',
    args: [
      { flag: '--schedule', values: ['hourly', 'nightly', 'weekly'], required: true,  hint: 'fréquence d\'exécution' },
      { flag: '--on-fail',  values: ['email', 'retry', 'ignore'],     required: true,  hint: 'action si la tâche échoue' },
    ],
    optimalArgs: { '--schedule': 'nightly', '--on-fail': 'email' },
    deadline: 8, urgency: 'info', sp: 1, satReward: 9, satPenalty: -5,
  },
  {
    id: 'snapshots', label: 'Snapshots VM', command: 'snapshot',
    clientMessage: 'On fait une mise à jour majeure demain et j\'ai peur que ça parte en vrille. Prenez un snapshot complet de la VM maintenant, avant toute modification.',
    args: [
      { flag: '--type',        values: ['full', 'incremental'],   required: true,  hint: 'type de snapshot' },
      { flag: '--compression', values: ['yes', 'no'],             required: false, hint: 'compresser le snapshot (défaut: no)' },
    ],
    optimalArgs: { '--type': 'full' },
    deadline: 1, urgency: 'critical', sp: 1, satReward: 12, satPenalty: -30,
  },
  {
    id: 'rate_limit', label: 'Limitation de débit API', command: 'ratelimit',
    clientMessage: 'Un client abuse de notre API et génère des milliers de requêtes par seconde, ça ralentit tout le monde. Appliquez des limites très strictes et bloquez les IPs qui dépassent le seuil.',
    args: [
      { flag: '--threshold', values: ['low', 'medium', 'high'], required: true,  hint: 'seuil de déclenchement du rate-limit' },
      { flag: '--action',    values: ['block', 'throttle', 'log'], required: true,  hint: 'action quand le seuil est dépassé' },
    ],
    optimalArgs: { '--threshold': 'low', '--action': 'block' },
    deadline: 3, urgency: 'warning', sp: 1, satReward: 13, satPenalty: -16,
  },
  {
    id: 'load_balance', label: 'Configuration load balancer', command: 'loadbalance',
    clientMessage: 'Bonjour, j\'ai 3 serveurs backend mais tout le trafic arrive sur un seul. Configurez le load balancer en round-robin et activez la persistance de session pour mes utilisateurs connectés.',
    args: [
      { flag: '--algo',    values: ['round-robin', 'least-conn', 'ip-hash'], required: true,  hint: 'algorithme de répartition' },
      { flag: '--session', values: ['sticky', 'none'],                        required: true,  hint: 'persistance de session' },
    ],
    optimalArgs: { '--algo': 'round-robin', '--session': 'sticky' },
    deadline: 6, urgency: 'warning', sp: 1, satReward: 15, satPenalty: -12,
  },
  {
    id: 'container_restart', label: 'Redémarrage conteneurs', command: 'docker',
    clientMessage: 'Plusieurs de mes conteneurs sont en état "Exited" depuis ce matin. Redémarrez-les tous et activez le redémarrage automatique pour éviter que ça se reproduise.',
    args: [
      { flag: '--scope',  values: ['all', 'failed', 'selected'],  required: true,  hint: 'conteneurs à redémarrer' },
      { flag: '--policy', values: ['always', 'on-failure', 'no'], required: true,  hint: 'politique de redémarrage automatique' },
    ],
    optimalArgs: { '--scope': 'failed', '--policy': 'on-failure' },
    deadline: 4, urgency: 'warning', sp: 1, satReward: 11, satPenalty: -14,
  },
  {
    id: 'intrusion', label: 'Détection d\'intrusion', command: 'ids',
    clientMessage: 'URGENT. On vient de recevoir une alerte : quelqu\'un a peut-être eu accès à nos systèmes. Lancez une analyse forensique complète de toutes les connexions des dernières 24h.',
    args: [
      { flag: '--mode',   values: ['realtime', 'forensic', 'passive'], required: true,  hint: 'mode de détection' },
      { flag: '--period', values: ['1h', '24h', '7d'],                 required: true,  hint: 'période d\'analyse' },
    ],
    optimalArgs: { '--mode': 'forensic', '--period': '24h' },
    deadline: 2, urgency: 'critical', sp: 2, satReward: 20, satPenalty: -35,
  },
  {
    id: 'email_server', label: 'Configuration serveur mail', command: 'mailconf',
    clientMessage: 'Nos emails tombent systématiquement dans les spams chez nos clients. Configurez SPF, DKIM et DMARC pour que nos communications soient correctement authentifiées.',
    args: [
      { flag: '--records', values: ['spf', 'dkim', 'all'],          required: true,  hint: 'enregistrements DNS à configurer' },
      { flag: '--policy',  values: ['none', 'quarantine', 'reject'], required: true,  hint: 'politique DMARC' },
    ],
    optimalArgs: { '--records': 'all', '--policy': 'quarantine' },
    deadline: 5, urgency: 'info', sp: 1, satReward: 12, satPenalty: -8,
  },
  {
    id: 'reverse_proxy', label: 'Configuration reverse proxy', command: 'proxy',
    clientMessage: 'Je veux mettre en place un reverse proxy devant mes applications pour centraliser le HTTPS. Activez aussi la compression gzip pour améliorer les performances.',
    args: [
      { flag: '--ssl',     values: ['yes', 'no'],                   required: true,  hint: 'activer HTTPS/SSL' },
      { flag: '--compress',values: ['gzip', 'brotli', 'none'],      required: false, hint: 'compression du trafic (défaut: none)' },
    ],
    optimalArgs: { '--ssl': 'yes', '--compress': 'gzip' },
    deadline: 7, urgency: 'info', sp: 1, satReward: 10, satPenalty: -7,
  },
  {
    id: 'ip_blacklist', label: 'Blacklist IP', command: 'blacklist',
    clientMessage: 'Je reçois des attaques répétées depuis les mêmes plages d\'IPs. Bloquez-les définitivement et mettez à jour la blacklist automatiquement toutes les heures.',
    args: [
      { flag: '--source',  values: ['manual', 'threat-feed', 'both'], required: true,  hint: 'source des IPs à blacklister' },
      { flag: '--refresh', values: ['1h', '24h', 'manual'],           required: true,  hint: 'fréquence de mise à jour de la liste' },
    ],
    optimalArgs: { '--source': 'both', '--refresh': '1h' },
    deadline: 3, urgency: 'warning', sp: 1, satReward: 13, satPenalty: -18,
  },
  {
    id: 'memory_leak', label: 'Fuite mémoire', command: 'memleak',
    clientMessage: 'Mon application consomme de plus en plus de RAM jusqu\'à crasher. Elle redémarre toutes les 6 heures. J\'ai besoin d\'un diagnostic complet pour trouver le processus responsable.',
    args: [
      { flag: '--depth',   values: ['quick', 'full', 'trace'],   required: true,  hint: 'profondeur du diagnostic' },
      { flag: '--output',  values: ['log', 'report', 'dump'],    required: true,  hint: 'format du résultat de l\'analyse' },
    ],
    optimalArgs: { '--depth': 'full', '--output': 'report' },
    deadline: 5, urgency: 'warning', sp: 2, satReward: 18, satPenalty: -20,
  },
  {
    id: 'db_replication', label: 'Réplication base de données', command: 'replicate',
    clientMessage: 'Je veux mettre en place de la haute disponibilité pour ma base de données. En cas de panne du primaire, le basculement doit être automatique et immédiat.',
    args: [
      { flag: '--mode',     values: ['sync', 'async'],           required: true,  hint: 'mode de réplication' },
      { flag: '--failover', values: ['auto', 'manual'],           required: true,  hint: 'basculement en cas de panne' },
    ],
    optimalArgs: { '--mode': 'sync', '--failover': 'auto' },
    deadline: 9, urgency: 'info', sp: 2, satReward: 20, satPenalty: -10,
  },
  {
    id: 'cache_flush', label: 'Vidage du cache', command: 'flushcache',
    clientMessage: 'Mes utilisateurs voient encore l\'ancienne version du site après la mise à jour de ce matin. Videz complètement tous les niveaux de cache maintenant.',
    args: [
      { flag: '--layer',  values: ['app', 'cdn', 'all'],   required: true,  hint: 'couche de cache à vider' },
      { flag: '--warmup', values: ['yes', 'no'],            required: false, hint: 'pré-charger le cache après vidage (défaut: no)' },
    ],
    optimalArgs: { '--layer': 'all' },
    deadline: 2, urgency: 'warning', sp: 1, satReward: 8, satPenalty: -12,
  },
  {
    id: 'bandwidth_throttle', label: 'Limitation de bande passante', command: 'throttle',
    clientMessage: 'Un serveur de backup consomme toute la bande passante la nuit et impacte les autres services. Limitez strictement sa consommation réseau à 20% maximum.',
    args: [
      { flag: '--target', values: ['upload', 'download', 'both'], required: true,  hint: 'sens du trafic à limiter' },
      { flag: '--limit',  values: ['10%', '20%', '50%'],          required: true,  hint: 'pourcentage de bande passante alloué' },
    ],
    optimalArgs: { '--target': 'both', '--limit': '20%' },
    deadline: 6, urgency: 'info', sp: 1, satReward: 9, satPenalty: -6,
  },
  {
    id: 'two_factor', label: 'Authentification 2FA', command: 'auth2fa',
    clientMessage: 'Un de nos comptes administrateur a failli être compromis hier soir. Je veux activer l\'authentification à deux facteurs pour tous les comptes admin immédiatement.',
    args: [
      { flag: '--scope',  values: ['admin', 'all', 'custom'],   required: true,  hint: 'comptes concernés par le 2FA' },
      { flag: '--method', values: ['totp', 'sms', 'hardware'],  required: true,  hint: 'méthode d\'authentification' },
    ],
    optimalArgs: { '--scope': 'admin', '--method': 'totp' },
    deadline: 3, urgency: 'critical', sp: 1, satReward: 16, satPenalty: -28,
  },
  {
    id: 'app_deploy', label: 'Déploiement applicatif', command: 'deploy',
    clientMessage: 'Bonjour, je veux déployer la nouvelle version de mon app en production. En cas de problème, il faut pouvoir revenir en arrière automatiquement si les health checks échouent.',
    args: [
      { flag: '--strategy', values: ['rolling', 'blue-green', 'canary'], required: true,  hint: 'stratégie de déploiement' },
      { flag: '--rollback', values: ['auto', 'manual', 'none'],          required: true,  hint: 'comportement en cas d\'échec' },
    ],
    optimalArgs: { '--strategy': 'blue-green', '--rollback': 'auto' },
    deadline: 7, urgency: 'info', sp: 1, satReward: 14, satPenalty: -12,
  },
  {
    id: 'object_storage', label: 'Configuration stockage objet', command: 'objstore',
    clientMessage: 'J\'ai des téraoctets d\'archives que je dois conserver à long terme. Je veux un stockage économique avec redondance géographique pour ne jamais perdre mes données.',
    args: [
      { flag: '--tier',        values: ['hot', 'cold', 'archive'],  required: true,  hint: 'classe de stockage' },
      { flag: '--redundancy',  values: ['local', 'geo', 'none'],    required: true,  hint: 'niveau de redondance géographique' },
    ],
    optimalArgs: { '--tier': 'archive', '--redundancy': 'geo' },
    deadline: 10, urgency: 'info', sp: 1, satReward: 10, satPenalty: -6,
  },
  {
    id: 'kernel_panic', label: 'Kernel panic', command: 'kerneldbg',
    clientMessage: 'URGENCE. Mon serveur vient de kernel panic et a redémarré tout seul. Je ne sais pas ce qui s\'est passé. Analysez le crash dump complet et dites-moi ce qui a causé ça.',
    args: [
      { flag: '--source', values: ['crashdump', 'syslog', 'both'],  required: true,  hint: 'source d\'analyse' },
      { flag: '--depth',  values: ['summary', 'full', 'trace'],     required: true,  hint: 'profondeur d\'analyse' },
    ],
    optimalArgs: { '--source': 'both', '--depth': 'full' },
    deadline: 2, urgency: 'critical', sp: 2, satReward: 22, satPenalty: -38,
  },
  {
    id: 'geo_block', label: 'Blocage géographique', command: 'geoblock',
    clientMessage: 'Je reçois énormément de trafic malveillant depuis certaines régions où je n\'ai aucun client. Bloquez complètement ces pays et journalisez chaque tentative bloquée.',
    args: [
      { flag: '--action', values: ['block', 'redirect', 'captcha'], required: true,  hint: 'action appliquée aux IPs bloquées' },
      { flag: '--log',    values: ['yes', 'no'],                     required: false, hint: 'journaliser les tentatives bloquées (défaut: no)' },
    ],
    optimalArgs: { '--action': 'block', '--log': 'yes' },
    deadline: 5, urgency: 'warning', sp: 1, satReward: 11, satPenalty: -9,
  },
  {
    id: 'waf', label: 'Pare-feu applicatif WAF', command: 'waf',
    clientMessage: 'Nos logs montrent des tentatives d\'injection SQL et XSS depuis hier. Activez le WAF en mode blocage actif, pas juste en détection, et mettez à jour les règles OWASP.',
    args: [
      { flag: '--mode',       values: ['detect', 'block', 'learning'],  required: true,  hint: 'mode de fonctionnement du WAF' },
      { flag: '--ruleset',    values: ['owasp', 'custom', 'both'],       required: true,  hint: 'ensemble de règles à appliquer' },
    ],
    optimalArgs: { '--mode': 'block', '--ruleset': 'owasp' },
    deadline: 4, urgency: 'warning', sp: 2, satReward: 19, satPenalty: -22,
  },
  {
    id: 'api_gateway', label: 'Déploiement API Gateway', command: 'gateway',
    clientMessage: 'Bonjour, je veux centraliser l\'accès à mes microservices derrière une API Gateway. Activez l\'authentification JWT pour sécuriser tous les endpoints.',
    args: [
      { flag: '--auth',   values: ['jwt', 'apikey', 'oauth2', 'none'],  required: true,  hint: 'méthode d\'authentification' },
      { flag: '--cache',  values: ['yes', 'no'],                         required: false, hint: 'activer le cache de réponses (défaut: no)' },
    ],
    optimalArgs: { '--auth': 'jwt' },
    deadline: 8, urgency: 'info', sp: 1, satReward: 13, satPenalty: -8,
  },
  {
    id: 'network_scan', label: 'Scan réseau', command: 'netscan',
    clientMessage: 'Je veux faire un inventaire complet de ce qui est exposé sur mon réseau. Scannez tout et détectez tous les ports ouverts, même ceux inhabituels.',
    args: [
      { flag: '--scope', values: ['subnet', 'full', 'targeted'], required: true,  hint: 'périmètre du scan' },
      { flag: '--type',  values: ['quick', 'deep', 'stealth'],   required: true,  hint: 'type de scan réseau' },
    ],
    optimalArgs: { '--scope': 'full', '--type': 'deep' },
    deadline: 8, urgency: 'info', sp: 1, satReward: 10, satPenalty: -6,
  },
  {
    id: 'auto_scale', label: 'Auto-scaling', command: 'autoscale',
    clientMessage: 'Mon trafic est très variable : calme la nuit, intense en journée. Je veux que mes serveurs s\'ajustent automatiquement à la charge et descendent en dehors des heures de pointe.',
    args: [
      { flag: '--trigger',  values: ['cpu', 'requests', 'custom'],  required: true,  hint: 'métrique déclenchant le scaling' },
      { flag: '--cooldown', values: ['30s', '2m', '5m'],            required: false, hint: 'délai entre deux ajustements (défaut: 2m)' },
    ],
    optimalArgs: { '--trigger': 'requests' },
    deadline: 9, urgency: 'info', sp: 1, satReward: 14, satPenalty: -8,
  },
  {
    id: 'db_slowquery', label: 'Optimisation requêtes lentes', command: 'queryopt',
    clientMessage: 'Notre application est lente à cause de requêtes SQL qui prennent parfois 10 secondes. Analysez les requêtes les plus lentes et créez les index manquants automatiquement.',
    args: [
      { flag: '--analyze',  values: ['yes', 'no'],              required: true,  hint: 'analyser les requêtes lentes' },
      { flag: '--autoindex',values: ['yes', 'no'],              required: true,  hint: 'créer les index manquants automatiquement' },
    ],
    optimalArgs: { '--analyze': 'yes', '--autoindex': 'yes' },
    deadline: 6, urgency: 'warning', sp: 1, satReward: 16, satPenalty: -12,
  },
  {
    id: 'secret_rotate', label: 'Rotation des secrets', command: 'rotate',
    clientMessage: 'Un ancien employé qui avait accès à nos clés API vient de quitter l\'entreprise. Rotation immédiate de tous les secrets et révocation de ses accès.',
    args: [
      { flag: '--scope',   values: ['api-keys', 'db-passwords', 'all'], required: true,  hint: 'type de secrets à renouveler' },
      { flag: '--revoke',  values: ['yes', 'no'],                        required: true,  hint: 'révoquer les anciens secrets immédiatement' },
    ],
    optimalArgs: { '--scope': 'all', '--revoke': 'yes' },
    deadline: 2, urgency: 'critical', sp: 2, satReward: 21, satPenalty: -32,
  },
  {
    id: 'dns_failover', label: 'Failover DNS', command: 'dnsfail',
    clientMessage: 'Mon datacenter principal est parfois instable. Je veux que le DNS bascule automatiquement vers mon site de secours si le principal ne répond plus.',
    args: [
      { flag: '--check-interval', values: ['30s', '1m', '5m'],   required: true,  hint: 'fréquence des health checks' },
      { flag: '--failover',       values: ['auto', 'manual'],     required: true,  hint: 'basculement automatique ou manuel' },
    ],
    optimalArgs: { '--check-interval': '30s', '--failover': 'auto' },
    deadline: 7, urgency: 'warning', sp: 1, satReward: 15, satPenalty: -15,
  },
  {
    id: 'container_scan', label: 'Scan de vulnérabilités images', command: 'imgscan',
    clientMessage: 'Avant de déployer en production, je veux m\'assurer que mes images Docker ne contiennent aucune faille critique. Bloquez le déploiement si des CVE critiques sont trouvées.',
    args: [
      { flag: '--severity', values: ['critical', 'high', 'all'],       required: true,  hint: 'niveau de sévérité à détecter' },
      { flag: '--on-found', values: ['block', 'warn', 'ignore'],        required: true,  hint: 'action si des vulnérabilités sont trouvées' },
    ],
    optimalArgs: { '--severity': 'critical', '--on-found': 'block' },
    deadline: 5, urgency: 'warning', sp: 1, satReward: 14, satPenalty: -16,
  },
  {
    id: 'smtp_relay', label: 'Configuration relay SMTP', command: 'smtpconf',
    clientMessage: 'On ne reçoit plus nos alertes de monitoring par mail depuis hier. Le relay SMTP est peut-être mal configuré. Réparez ça et testez l\'envoi pour vérifier.',
    args: [
      { flag: '--tls',    values: ['yes', 'no'],                      required: true,  hint: 'chiffrement TLS sur la connexion SMTP' },
      { flag: '--verify', values: ['yes', 'no'],                      required: true,  hint: 'envoyer un mail de test après configuration' },
    ],
    optimalArgs: { '--tls': 'yes', '--verify': 'yes' },
    deadline: 4, urgency: 'warning', sp: 1, satReward: 10, satPenalty: -13,
  },
  {
    id: 'phishing_block', label: 'Blocage tentatives phishing', command: 'antiphish',
    clientMessage: 'Plusieurs employés ont reçu des mails de phishing usurpant notre domaine aujourd\'hui. Activez immédiatement la protection contre l\'usurpation et mettez en quarantaine les mails suspects.',
    args: [
      { flag: '--mode',   values: ['monitor', 'quarantine', 'block'], required: true,  hint: 'action sur les mails suspects' },
      { flag: '--spoof',  values: ['yes', 'no'],                      required: true,  hint: 'bloquer l\'usurpation de domaine' },
    ],
    optimalArgs: { '--mode': 'quarantine', '--spoof': 'yes' },
    deadline: 3, urgency: 'critical', sp: 1, satReward: 17, satPenalty: -26,
  },
  {
    id: 'uptime_monitor', label: 'Surveillance de disponibilité', command: 'watchdog',
    clientMessage: 'Je veux être averti immédiatement si mon site tombe, pas découvrir la panne 30 minutes après mes clients. Vérifiez la disponibilité toutes les minutes.',
    args: [
      { flag: '--interval', values: ['1m', '5m', '15m'],             required: true,  hint: 'fréquence des vérifications' },
      { flag: '--alert',    values: ['email', 'sms', 'both'],         required: true,  hint: 'canal de notification en cas de panne' },
    ],
    optimalArgs: { '--interval': '1m', '--alert': 'both' },
    deadline: 5, urgency: 'warning', sp: 1, satReward: 11, satPenalty: -9,
  },
  {
    id: 'container_orchestrate', label: 'Orchestration conteneurs', command: 'orchestrate',
    clientMessage: 'J\'ai plusieurs services qui doivent démarrer dans un ordre précis et se redémarrer automatiquement en cas de crash. Configurez l\'orchestration avec une politique de restart robuste.',
    args: [
      { flag: '--restart',  values: ['always', 'on-failure', 'never'], required: true,  hint: 'politique de redémarrage' },
      { flag: '--ordering', values: ['strict', 'parallel', 'none'],    required: true,  hint: 'ordre de démarrage des services' },
    ],
    optimalArgs: { '--restart': 'on-failure', '--ordering': 'strict' },
    deadline: 7, urgency: 'info', sp: 1, satReward: 12, satPenalty: -8,
  },
  {
    id: 'perf_benchmark', label: 'Benchmark de performances', command: 'benchmark',
    clientMessage: 'Avant de passer en production, j\'ai besoin de savoir combien de requêtes simultanées mon serveur peut encaisser. Faites un test de charge intensif et produisez un rapport complet.',
    args: [
      { flag: '--concurrency', values: ['low', 'medium', 'high'],   required: true,  hint: 'niveau de charge du test' },
      { flag: '--report',      values: ['summary', 'full', 'none'], required: true,  hint: 'niveau de détail du rapport' },
    ],
    optimalArgs: { '--concurrency': 'high', '--report': 'full' },
    deadline: 8, urgency: 'info', sp: 1, satReward: 10, satPenalty: -5,
  },
  {
    id: 'config_drift', label: 'Détection de dérive de config', command: 'drift',
    clientMessage: 'Je suspecte que quelqu\'un a modifié des configurations sur mes serveurs de production sans passer par notre processus habituel. Comparez l\'état actuel à notre référence et corrigez les écarts.',
    args: [
      { flag: '--compare',  values: ['baseline', 'policy', 'both'],   required: true,  hint: 'référence de comparaison' },
      { flag: '--autofix',  values: ['yes', 'no'],                     required: true,  hint: 'corriger automatiquement les écarts' },
    ],
    optimalArgs: { '--compare': 'both', '--autofix': 'yes' },
    deadline: 5, urgency: 'warning', sp: 2, satReward: 17, satPenalty: -20,
  },
  {
    id: 'zero_downtime', label: 'Maintenance sans interruption', command: 'maintain',
    clientMessage: 'Je dois faire des modifications importantes sur le serveur mais je ne peux pas me permettre la moindre interruption. Gérez ça en mode live, sans couper les connexions actives.',
    args: [
      { flag: '--mode',          values: ['live', 'scheduled', 'offline'], required: true,  hint: 'mode d\'exécution de la maintenance' },
      { flag: '--drain-timeout', values: ['30s', '2m', '10m'],             required: false, hint: 'temps d\'attente avant de forcer (défaut: 2m)' },
    ],
    optimalArgs: { '--mode': 'live' },
    deadline: 6, urgency: 'warning', sp: 1, satReward: 13, satPenalty: -18,
  },
  {
    id: 'log_aggregation', label: 'Agrégation de logs centralisée', command: 'logagg',
    clientMessage: 'Avec 20 serveurs, chercher dans les logs manuellement c\'est ingérable. Je veux centraliser tous les logs en temps réel avec la possibilité de faire des recherches.',
    args: [
      { flag: '--source',    values: ['syslog', 'app', 'all'],          required: true,  hint: 'sources de logs à collecter' },
      { flag: '--retention', values: ['7d', '30d', '90d'],              required: true,  hint: 'durée de conservation des logs' },
    ],
    optimalArgs: { '--source': 'all', '--retention': '30d' },
    deadline: 9, urgency: 'info', sp: 1, satReward: 11, satPenalty: -6,
  },
  {
    id: 'ransomware', label: 'Incident ransomware', command: 'ransomresp',
    clientMessage: 'ON EST SOUS ATTAQUE RANSOMWARE. Des fichiers sont chiffrés sur plusieurs serveurs en ce moment. Isolez immédiatement les machines compromise du reste du réseau !',
    args: [
      { flag: '--action',  values: ['isolate', 'monitor', 'shutdown'],  required: true,  hint: 'réponse immédiate aux machines compromises' },
      { flag: '--scope',   values: ['affected', 'all'],                  required: true,  hint: 'périmètre d\'application' },
    ],
    optimalArgs: { '--action': 'isolate', '--scope': 'affected' },
    deadline: 1, urgency: 'critical', sp: 3, satReward: 30, satPenalty: -50,
  },
  {
    id: 'ipv6_migration', label: 'Migration IPv6', command: 'ipv6',
    clientMessage: 'Mon fournisseur annonce la fin du support IPv4 dans 6 mois. Je veux migrer progressivement en gardant une compatibilité totale IPv4 pendant la transition.',
    args: [
      { flag: '--mode',       values: ['dual-stack', 'ipv6-only', 'tunnel'], required: true,  hint: 'mode de transition IPv6' },
      { flag: '--ipv4-compat',values: ['yes', 'no'],                          required: true,  hint: 'maintenir la compatibilité IPv4' },
    ],
    optimalArgs: { '--mode': 'dual-stack', '--ipv4-compat': 'yes' },
    deadline: 10, urgency: 'info', sp: 2, satReward: 15, satPenalty: -7,
  },
  {
    id: 'ha_cluster', label: 'Cluster haute disponibilité', command: 'cluster',
    clientMessage: 'J\'ai eu une panne de 4 heures le mois dernier à cause d\'un seul point de défaillance. Je veux un cluster actif-actif avec basculement automatique en moins d\'une minute.',
    args: [
      { flag: '--topology',  values: ['active-active', 'active-passive', 'mesh'], required: true,  hint: 'architecture du cluster' },
      { flag: '--failover',  values: ['auto', 'manual'],                           required: true,  hint: 'type de basculement' },
    ],
    optimalArgs: { '--topology': 'active-active', '--failover': 'auto' },
    deadline: 8, urgency: 'warning', sp: 3, satReward: 24, satPenalty: -15,
  },
  {
    id: 'access_revoke', label: 'Révocation d\'accès', command: 'revoke',
    clientMessage: 'Un compte compromis a été détecté. Révoquez tous les accès immédiatement, sessions actives incluses, et forcez un reset de mot de passe.',
    args: [
      { flag: '--scope',       values: ['sessions', 'tokens', 'all'],     required: true,  hint: 'type d\'accès à révoquer' },
      { flag: '--force-reset', values: ['yes', 'no'],                      required: true,  hint: 'forcer la réinitialisation du mot de passe' },
    ],
    optimalArgs: { '--scope': 'all', '--force-reset': 'yes' },
    deadline: 1, urgency: 'critical', sp: 1, satReward: 18, satPenalty: -30,
  },
  {
    id: 's3_lifecycle', label: 'Cycle de vie stockage S3', command: 'lifecycle',
    clientMessage: 'Ma facture de stockage explose. Les fichiers de plus de 3 mois peuvent passer en stockage froid, et tout ce qui dépasse 1 an peut être supprimé automatiquement.',
    args: [
      { flag: '--archive-after', values: ['30d', '90d', '180d'],   required: true,  hint: 'délai avant archivage en stockage froid' },
      { flag: '--delete-after',  values: ['1y', '2y', 'never'],    required: true,  hint: 'délai avant suppression définitive' },
    ],
    optimalArgs: { '--archive-after': '90d', '--delete-after': '1y' },
    deadline: 9, urgency: 'info', sp: 1, satReward: 10, satPenalty: -5,
  },
  {
    id: 'tls_hardening', label: 'Durcissement TLS', command: 'tlsharden',
    clientMessage: 'Notre score SSL Labs est "B" à cause de vieilles versions de TLS encore activées. Je veux désactiver TLS 1.0 et 1.1 et forcer les suites de chiffrement modernes.',
    args: [
      { flag: '--min-version', values: ['tls1.0', 'tls1.2', 'tls1.3'],  required: true,  hint: 'version TLS minimale acceptée' },
      { flag: '--ciphers',     values: ['modern', 'intermediate', 'all'],required: true,  hint: 'suites de chiffrement autorisées' },
    ],
    optimalArgs: { '--min-version': 'tls1.2', '--ciphers': 'modern' },
    deadline: 6, urgency: 'warning', sp: 1, satReward: 13, satPenalty: -10,
  },
  {
    id: 'ci_pipeline', label: 'Optimisation pipeline CI/CD', command: 'ci',
    clientMessage: 'Nos builds prennent 45 minutes alors qu\'ils ne devraient pas dépasser 10 minutes. Activez le cache des dépendances et lancez les tests en parallèle.',
    args: [
      { flag: '--cache',    values: ['yes', 'no'],                        required: true,  hint: 'activer le cache des dépendances' },
      { flag: '--parallel', values: ['yes', 'no'],                        required: true,  hint: 'exécuter les étapes en parallèle' },
    ],
    optimalArgs: { '--cache': 'yes', '--parallel': 'yes' },
    deadline: 7, urgency: 'info', sp: 1, satReward: 11, satPenalty: -7,
  },
  {
    id: 'incident_postmortem', label: 'Post-mortem d\'incident', command: 'postmortem',
    clientMessage: 'Suite à la panne d\'hier, mon équipe a besoin d\'un rapport complet : timeline précise, causes racines, et liste des actions correctives à mettre en place.',
    args: [
      { flag: '--detail',  values: ['timeline', 'root-cause', 'full'],  required: true,  hint: 'niveau de détail du rapport' },
      { flag: '--format',  values: ['text', 'html', 'pdf'],             required: true,  hint: 'format de sortie du post-mortem' },
    ],
    optimalArgs: { '--detail': 'full', '--format': 'pdf' },
    deadline: 5, urgency: 'info', sp: 1, satReward: 9, satPenalty: -5,
  },
  {
    id: 'encryption_at_rest', label: 'Chiffrement des données au repos', command: 'encrypt',
    clientMessage: 'Notre auditeur nous demande de chiffrer toutes les données stockées sur nos serveurs pour être conformes. Appliquez le chiffrement sur tous les volumes et vérifiez que c\'est bien en place.',
    args: [
      { flag: '--scope',   values: ['os', 'data', 'all'],              required: true,  hint: 'volumes à chiffrer' },
      { flag: '--verify',  values: ['yes', 'no'],                      required: true,  hint: 'vérifier le chiffrement après application' },
    ],
    optimalArgs: { '--scope': 'all', '--verify': 'yes' },
    deadline: 8, urgency: 'warning', sp: 2, satReward: 16, satPenalty: -13,
  },
]

const CLIENT_NAMES = [
  'AcmeCorp', 'TechVault', 'DataFlow', 'CloudNine', 'NetForce',
  'BitStream', 'CyberHub', 'InfoSys', 'MegaNet', 'DataPlex',
  'VirtualCo', 'HostPro', 'CoreSys', 'PeakData', 'NexaCloud',
  'GridWork', 'ByteBase', 'IronNode', 'SwiftNet', 'OpenStack',
  // Streaming & media clients
  'StreamZone', 'PixelVault', 'MediaEdge', 'FluxTV', 'WaveStream',
  'VideoBox', 'LiveCast', 'PulseMedia', 'EchoStream', 'ClearView',
  // AI & data science clients
  'NeuralHub', 'DeepStack', 'AlphaModel', 'InferCore', 'TensorBase',
  'DataMinds', 'SynthAI', 'CogniCloud', 'VectorSys', 'MLForge',
]

const ENTERPRISE_NAMES = [
  'Megacorp', 'TechGiant', 'InfraGroup', 'GlobalSys', 'DataHolding',
  'CloudFirst', 'NetConglomerate', 'ServerFarm Inc', 'CyberGroup', 'HyperScale',
  // Additional enterprise names
  'OmniCloud', 'FortressData', 'NexusGroup', 'ApexSystems', 'TeraByte Holdings',
  'QuantumNet', 'PrimaCorp', 'IronVault Ltd', 'CoreMatrix', 'SilverHost SA',
]

export { MISSION_TYPES, CLIENT_NAMES, ENTERPRISE_NAMES }
