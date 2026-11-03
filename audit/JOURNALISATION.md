# Journalisation Pino

Les quatre services Node actifs (backend, gateway, notifications, stock-management) utilisent Pino 10 et pino-http 11. Les événements de démarrage, de base de données, de seed et d'échec de notification remplacent les appels console. Chaque image Docker conserve son propre module `logger.js` et ses dépendances ; aucun import ne dépend d'un dossier extérieur au service.

Les logs JSON sont écrits sur stdout avec `service`, `level`, `time` et `msg`, directement exploitables par Docker/Render. `LOG_LEVEL` accepte `trace`, `debug`, `info` (défaut), `warn`, `error`, `fatal` et `silent`. Une valeur inconnue revient à `info`. Aucun transport vers un tiers ni fichier de log n'est ajouté.

Les requêtes produisent un identifiant UUID généré par le serveur, renvoyé dans `X-Request-Id`. Le journal HTTP contient la méthode, le modèle de route, le statut et la durée ; les réponses 4xx sont classées `warn`, les 5xx `error`. Les routes non reconnues sont indiquées `unmatched`, sans URL brute.

Les en-têtes, cookies, corps, paramètres de chemin et chaînes de requête ne sont jamais sérialisés. Les erreurs HTTP n'incluent ni message brut ni stack de fournisseur ; les événements applicatifs utilisent des messages contrôlés. Une redaction défensive masque également les champs structurés courants (`password`, `token`, `secret`, etc.). Cette protection ne rend pas sûr un message libre contenant un secret : ne jamais interpoler de données sensibles dans `msg`.

Le frontend conserve ses messages statiques existants : Pino est utilisé pour les serveurs Node, sans ajouter de journalisation navigateur de données personnelles.

Vérifications : `npm --prefix backend test` inclut les tests Pino (JSON, niveau, masquage, corrélation, requêtes réussies/refusées, exceptions et JSON mal formé). Le vérificateur indépendant contrôle aussi les quatre configurations avec HTTP réel. La suite notifications/gateway doit rester valide sans envoi réel d'email.
