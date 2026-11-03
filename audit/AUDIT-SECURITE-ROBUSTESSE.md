# Audit sécurité et robustesse du code (E27 – E28)

Périmètre : `backend/`, `frontend/`, `gateway/`, `microservices/`, `docker-compose.yml`, `Dockerfile.node`, `frontend/Dockerfile`, `.github/workflows/ci.yml`.
Méthode : relecture statique de tout le code, `npm audit --omit=dev` dans chaque package, vérification de l'historique git pour les secrets. L'application n'a pas été lancée ; aucun test n'a été exécuté pour cet audit.
Référentiel : slides 27 à 35 de la consigne (Joi, cookie HttpOnly, try/catch, messages client, ESLint/Prettier, dépendances + Winston, debug).

Gravité : **Critique** (exploitable à distance, impact fort) · **Élevée** · **Moyenne** · **Faible**.

## 1. Synthèse

Le code a déjà été durci par les corrections précédentes (voir `CORRECTIONS-SECURITE.md`). Je ne retrouve plus les failles classiques :
rôle fourni par le client, prix fourni par le client, injection NoSQL sur le login, routes admin sans contrôle, secrets dans git, `alg: none`.

Ce qui reste concerne surtout les points que la consigne cite explicitement et qui ne sont pas encore traités :

| # | Sujet | Gravité | Slide |
|---|-------|---------|-------|
| S1 | JWT stocké dans `localStorage` | Élevée | 28 |
| S2 | CORS ouvert à toutes les origines | Élevée | – |
| S3 | Pas de gestionnaire d'erreurs global (stack trace HTML hors production) | Moyenne | 29 |
| S4 | Frontend « prod » = serveur de développement CRA | Élevée | E22/E24 |
| S5 | Rate limit basé sur l'IP du socket : tous les clients partagent l'IP du proxy | Moyenne | – |
| S6 | Validation manuelle, pas de Joi ; e-mail non normalisé | Moyenne | 27 |
| S7 | Pas de journalisation applicative (Winston), erreurs avalées | Moyenne | 33 / E25 |
| S8 | Code mort dangereux (`adminController`, `adminRoutes`, stock-management) | Moyenne | – |
| S9 | Pas d'ESLint/Prettier hors CRA | Faible | 31 |
| S10 | Pas de documentation générée ni de CHANGELOG | Moyenne | E29 |

## 2. Failles de sécurité (E28)

### S1 – Token JWT dans `localStorage` — Élevée
- `frontend/src/pages/Login.js:25-27`, `frontend/src/services/client.js:6`, `frontend/src/services/session.js:5`.
- Toute XSS (ou script tiers compromis) lit le token et peut agir en tant qu'admin pendant 1 h. La consigne (slide 28) cite exactement ce cas.
- Correction : renvoyer le token dans un cookie `HttpOnly; Secure; SameSite=Strict` depuis `authController.login`, lire le cookie dans `authenticateToken` (`cookie-parser`), ajouter une route `POST /api/auth/logout` qui l'efface, et passer `withCredentials: true` côté axios. Ne garder côté front que `username`/`role` (non sensibles, purement cosmétiques). Avec un cookie, ajouter une protection CSRF : `SameSite=Strict` suffit si front et API partagent le même site ; sinon jeton CSRF ou en-tête personnalisé obligatoire.
- Le décodage du token côté front (`session.js`) n'a plus de raison d'être : exposer `GET /api/auth/me`.

### S2 – CORS ouvert — Élevée
- `backend/server.js:10` : `app.use(cors())` accepte toute origine. Incompatible avec S1 (cookies) et inutile en production.
- Correction : `cors({ origin: process.env.CORS_ORIGIN.split(','), credentials: true })`, liste blanche par environnement (préprod / prod).

### S3 – Pas de `helmet`, pas de limite de corps explicite, `x-powered-by` exposé — Moyenne
- `backend/server.js:11` : `express.json()` (limite par défaut 100 ko, non explicite) ; le service notifications, lui, fixe 16 ko.
- Correction : `helmet()`, `app.disable('x-powered-by')`, `express.json({ limit: '10kb' })` et CSP stricte sur le front servi par nginx.

### S4 – Rate limit indexé sur l'IP du socket — Moyenne
- `backend/middlewares/authRateLimit.js:10` : le choix de ne pas lire `X-Forwarded-For` est correct tant que le backend est exposé en direct. Derrière le proxy CRA, un reverse proxy ou Render, **tous les utilisateurs partagent la même IP** : 20 échecs de connexion bloquent tout le site pendant 15 min (déni de service trivial), à l'inverse un attaquant distribué n'est pas limité.
- Correction : `app.set('trust proxy', <nombre de proxys>)` et clé `req.ip`, plus un compteur par compte (`username`) en plus de l'IP. Utiliser `express-rate-limit` avec un store partagé (Redis) dès qu'il y a plus d'une instance (le commentaire du fichier le dit déjà).
- Aucun rate limit sur `POST /api/orders` ni sur les routes admin.

### S5 – Session JWT : pas de révocation, rôle figé dans le token — Moyenne
- `backend/middlewares/authMiddleware.js:12-18` : le rôle vient du token ; un admin rétrogradé ou un compte supprimé garde ses droits jusqu'à 1 h. Pas de déconnexion côté serveur.
- Correction : charger l'utilisateur en base (ou un `tokenVersion`) dans `authenticateToken` pour les routes admin, au minimum.

### S6 – Validation des entrées sans Joi, e-mail non normalisé — Moyenne
- `backend/controllers/authController.js:11-44`, `orderController.js:9-33`, `productController.js:12-19` : validations manuelles correctes mais dispersées et non réutilisables ; la consigne (slide 27) demande Joi.
- `register` stocke l'e-mail tel que saisi (`authController.js:47`) alors que l'index unique est sensible à la casse : `A@x.fr` et `a@x.fr` créent deux comptes. Le username est déjà en minuscules, pas l'e-mail.
- `models/User.js` : `role` sans `enum`, `email` sans `lowercase`/`trim`/`match`. `models/Product.js` : `price` sans `min: 0`, `name`/`description` sans `maxlength`/`trim`. `models/Order.js` : `total` sans `min`.
- Correction : un middleware `validate(schema)` avec Joi (`stripUnknown: true`, `abortEarly: false`) pour `register`, `login`, `createOrder`, `updateStock`, `updateStatus` ; contraintes équivalentes dans les schémas Mongoose.

### S7 – Gestion des secrets — Moyenne
- Bien : `.env*` ignorés, jamais commités (historique vérifié : aucun commit n'a touché `.env`, `.env.docker`, `atlas-credentials-*.env`). Les secrets font 64 caractères.
- Risques restants :
  - `.env` contient **à la fois** `MONGO_URI` et `MONGO_URI_PRE`, deux bases Atlas, ainsi que le mot de passe d'application Gmail : une erreur de variable pointe l'environnement de test sur la prod.
  - `atlas-credentials-prod.env` / `-preprod.env` sont dans le dossier du projet.
  - Le `JWT_SECRET` de `.env` diffère de celui de `.env.docker` (bien) mais rien n'impose une longueur minimale au démarrage (`backend/server.js:18` teste seulement la présence).
- Correction : un fichier d'environnement par déploiement (variables Render), valider `JWT_SECRET.length >= 32` au démarrage, sortir les fichiers `atlas-credentials-*` du dépôt de travail, faire pivoter tout secret qui aurait transité par un canal non sûr.

### S8 – Service notifications : destinataire fourni par l'appelant — Faible à moyenne
- `microservices/notifications/index.js:20-35` : tout porteur du `INTERNAL_API_TOKEN` peut envoyer un e-mail à n'importe quelle adresse (relais). Le token est comparé en temps constant (bien), mais pas de rate limit.
- Correction : liste blanche de destinataires ou destinataire fixé côté service ; limiter le débit ; ne pas exposer le port du service (déjà le cas dans `docker-compose.yml`).

### S9 – Microservice `stock-management` : XSS réfléchi et service non authentifié — Faible (non exposé aujourd'hui)
- `microservices/stock-management/index.js:7-11` : `res.send(\`...${productId}\`)` renvoie du `text/html` avec une valeur non échappée ; aucun contrôle d'accès ; `productId`/`quantity` jamais validés ; entrée journalisée telle quelle (injection de logs) ; port 4003 codé en dur. La route de la gateway est commentée, donc non exploitable via le gateway, mais le service est démarré par docker-compose.
- Correction : soit le supprimer, soit `res.json`, valider avec Joi, exiger le token interne, lire `PORT` depuis l'environnement. Aujourd'hui il ne met d'ailleurs **rien** à jour (simple `console.log`).

### S10 – Seeder destructif — Moyenne
- `backend/seeder.js:54` : `Product.deleteMany()` sans garde. Lancé contre la production avec `MONGO_URI` d'Atlas, il efface le catalogue et laisse des commandes avec des `productId` orphelins et des réservations perdues. Options Mongoose `useNewUrlParser`/`useUnifiedTopology` obsolètes. Ne crée aucun compte admin (le seul moyen d'en avoir un est d'éditer la base à la main).
- Correction : refuser de tourner si `NODE_ENV === 'production'` sans `--force`, ne supprimer que les produits du seed, créer un admin depuis des variables d'environnement.

### S11 – Docker / conteneurs — voir aussi §4
- `docker-compose.yml` : MongoDB sans authentification (non publié sur l'hôte, donc risque limité au réseau Docker), aucun `cap_drop`, `no-new-privileges`, `read_only`, ni limite de ressources ; gateway, notifications et stock-management sans `healthcheck`.
- Bien : utilisateur `node` non-root, `npm ci --omit=dev`, ports liés à `127.0.0.1`, variables obligatoires (`:?`), `.dockerignore` correct.

## 3. Bugs et robustesse (E27)

### R1 – Aucun gestionnaire d'erreurs global ni 404 — Moyenne
- `backend/server.js` : un JSON invalide dans le corps déclenche l'erreur par défaut d'Express. Hors `NODE_ENV=production` (donc en `npm start` local ou si la variable manque sur Render), la réponse est une page HTML avec la **stack trace**.
- Correction : middleware final `(err, req, res, next)` renvoyant `{ message }` en JSON (400 pour `entity.parse.failed`, 500 sinon) et un handler 404.

### R2 – Pas d'arrêt propre, pas de garde sur les rejets non gérés — Moyenne
- `backend/server.js:23` : `app.listen` sans gestion de `SIGTERM`/`SIGINT` (une requête de commande en cours peut être coupée entre `reserve` et l'activation ; le `recoverOrders` la rattrape au redémarrage, mais autant éviter). Pas de `process.on('unhandledRejection')`. Pas de route `/health` dédiée (le healthcheck Compose interroge `/api/products`, donc dépend de MongoDB et du catalogue).
- Correction : `server.close()` + `mongoose.disconnect()` sur signal, route `GET /health`, handler de rejets non gérés qui journalise puis quitte.

### R3 – Erreurs avalées, aucune trace — Moyenne
- Presque tous les `catch {}` du backend (`authController.js:31`, `orderController.js:100,128,171`, `productController.js:31`) renvoient 500/503 **sans rien journaliser** : une panne MongoDB ou un bug est invisible. `console.error` fixe est utilisé ailleurs sans contexte.
- Correction : un logger Winston (slide 33) injecté partout : niveau, horodatage, `requestId`, route, `userId`, erreur ; aucun mot de passe, token ni adresse complète. Voir S-journal ci-dessous.

### R4 – Code mort dangereux — Moyenne
- `backend/routes/adminRoutes.js` n'est pas monté dans `server.js`, mais `controllers/adminController.js` reste : aucune validation d'`id`/`status`/`stock`, statut `'Validée'` absent de l'enum Mongoose (`findByIdAndUpdate` sans `runValidators` l'écrit quand même), écrase sans contrôle de transition ni restitution de stock, renvoie 200 même si l'id n'existe pas, `notify` en échec renvoie 500 **après** l'écriture. Si quelqu'un monte ce routeur, tout le durcissement de `orderController` est contourné.
- `gateway/routes/auth.js`, `gateway/routes/stock.js` (non utilisés), `gateway/routes/notif.js` et `microservices/auth-gateway/index.js` (fichiers vides).
- `frontend/src/components/handlePaymentChange.js` est utilisé (`ShippingPayment.js`) mais son nom est trompeur : c'est un composant de sélection, à renommer `PaymentMethodSelection.js`.
- Correction : supprimer. Garder `lifecycle.transitions` comme source unique.

### R5 – `createOrder` : bien conçu, quelques angles — Faible
- Points forts : prix recalculé côté serveur en centimes, clé d'idempotence, réservation de stock atomique par produit, reprise au démarrage.
- À noter : la compensation de stock est répétable mais pas transactionnelle (pas de transaction Mongo multi-documents) ; `recoverOrders` suppose **une seule instance** et ne doit jamais tourner pendant du trafic (commentaire dans `orderLifecycle.js:42`) : la montée en charge horizontale n'est donc pas possible en l'état.
- Le front envoie `price` et `total` (`Order.js:60-70`) : ignorés par le serveur, à retirer pour ne pas laisser croire qu'ils comptent. `if (response.error)` (`Order.js:75`) est du code mort avec axios (les erreurs lèvent une exception).
- Les changements de statut et le stock ne déclenchent plus de notification (l'ancien `adminController` en envoyait), alors que la consigne prévoit des notifications sur « mise à jour stock et validation commande ».
- Pas de pagination sur `GET /api/orders` ni `GET /api/products`.

### R6 – Frontend — Faible à moyenne
- `session.js:28` : `setInterval` d'une seconde par composant qui utilise `useSession` (Navbar, routes protégées…) : décodage JWT en boucle, inutile. Utiliser un timer unique calé sur `exp`.
- `alert()` pour les erreurs et confirmations (`Login.js:37`, `Register.js`, `Order.js:76,82,87`) : la slide 30 demande des messages utilisateur propres (toasts / zone d'alerte accessible). `Admin.js` le fait déjà avec `role="alert"`.
- `Login.js` : pas de blocage du double envoi, pas de validation, appelle `axios` directement et non `client`.
- Après une commande réussie, aucune redirection ni page de confirmation ; le client ne peut pas consulter ses commandes (pas de route `GET /api/orders/mine`).
- Bien : aucun `dangerouslySetInnerHTML`/`innerHTML`/`eval` dans `frontend/src` (React échappe tout) ; `returnTo` du login est validé contre les redirections ouvertes ; panier restauré avec validation stricte.

## 4. Dépendances (E27 / slide 33)

`npm audit --omit=dev` :

| Package | Vulnérabilités |
|---------|----------------|
| backend | 0 |
| gateway | 0 |
| microservices/notifications | 0 |
| microservices/stock-management | 0 |
| **frontend** | **74** (11 faibles, 50 moyennes, 13 élevées) |

- Les 74 alertes du frontend viennent de `react-scripts@5.0.1` (déclaré en `dependencies`, donc embarqué dans l'image) : `nth-check`, `postcss`, `webpack-dev-server`, `svgo`, `serialize-javascript`, `underscore`, etc. CRA n'est plus maintenu ; ces paquets ne sont pas dans le bundle livré mais le sont dans l'image Docker. Correction durable : migrer vers Vite (les tests passeraient à Vitest) ; à défaut, construire l'image avec un build multi-étapes qui ne contient que `build/` + nginx.
- Mises à jour majeures à planifier : `express@4` → 5, `bcryptjs@2` → 3, `axios` (le plancher `^1.21.0` doit être relevé vers la version réellement installée dans `package.json`).
- Paquet `debug` présent dans le backend mais **jamais utilisé**.
- Ajouter `npm audit --omit=dev --audit-level=high` et Dependabot (ou Renovate) à la CI.

## 5. Journalisation et audit (E25 / slides 33-35)

- Aucun logger structuré : uniquement des `console.log`/`console.error` fixes. Pas de Winston, pas de journal HTTP (morgan ou équivalent), pas d'identifiant de requête.
- Aucune trace d'audit des actions sensibles : connexions réussies/échouées, 429, création d'admin, changement de statut, suppression de commande, modification de stock.
- À mettre en place : Winston (JSON, sortie stdout pour que Docker/Render collectent, rotation fichier optionnelle), `debug` pour le développement (`DEBUG=app:*`), journal d'audit séparé (`audit.log` ou collection `AuditLog`) avec `userId`, action, cible, IP, horodatage.
- Ne jamais journaliser : mot de passe, token, clé Resend, corps complet de requête.

## 6. Qualité de code et documentation (slide 31, E29)

- ESLint/Prettier : seul le frontend a `eslintConfig` (CRA). Rien pour `backend/`, `gateway/`, `microservices/`, pas de Prettier, pas de script `lint`/`format`, pas de contrôle en CI.
- Documentation (E29) : aucun JSDoc, aucune génération de documentation (JSDoc/TypeDoc/Swagger-OpenAPI), **pas de `CHANGELOG.md`**. À produire : JSDoc sur les contrôleurs et services, OpenAPI pour l'API, `CHANGELOG.md` au format Keep a Changelog.
- Tests : le backend et les notifications sont bien couverts (auth, commandes, cycle de vie, notifications). Rien pour la gateway ni pour le microservice stock ; pas de tests des routes admin du frontend côté E2E.
- CI (`.github/workflows/ci.yml`, **non suivi par git** à ce jour) : actions épinglées par SHA et permissions minimales (bien). Manquent : audit des dépendances, analyse de secrets (gitleaks), scan d'images (Trivy), lint, et surtout la partie **CD** (déploiement automatique préprod puis prod), qui est décrite dans le README mais pas implémentée dans le workflow.

## 7. Infrastructure déjà vue en passant (E22 – E26)

- **S4 – Frontend « production » = serveur de développement** : `frontend/Dockerfile` lance `npm start` (webpack-dev-server) avec toutes les devDependencies et un proxy via `npm pkg set proxy`. C'est le point le plus faible pour la mise en production : lent, non durci, surface d'attaque large, sockets de dev (`WDS_SOCKET_PORT=0`). À remplacer par `npm run build` puis nginx (`nginx:alpine`, utilisateur non-root, CSP, en-têtes de sécurité, `/api` en reverse proxy vers le backend).
- Pas de séparation préprod/prod dans `docker-compose.yml` : un seul fichier ; prévoir `docker-compose.preprod.yml` / `docker-compose.prod.yml` (ou profils) avec variables distinctes.
- Supervision (E26) : aucun endpoint de métriques, aucune sonde d'alerte dans le dépôt. Prévoir `/health` + `/ready`, un monitoring externe (UptimeRobot/Better Stack) et des alertes sur 5xx, latence, pic de 401/429.

## 8. Plan de correction priorisé

1. **Rapide, forte valeur** (≈ 1 h) : gestionnaire d'erreurs global + 404, `helmet`, limite de corps, CORS en liste blanche, suppression du code mort (`adminController`, `adminRoutes`, fichiers vides, `handlePaymentChange`), `JWT_SECRET >= 32`, normalisation de l'e-mail, garde du seeder.
2. **Consigne explicite** (≈ 1-2 h) : Joi sur toutes les entrées, JWT en cookie HttpOnly + `GET /auth/me` + logout, Winston + journal d'audit, ESLint + Prettier sur les 5 packages.
3. **Mise en production** : Dockerfile frontend multi-étapes + nginx, `trust proxy` et rate limit par compte, healthchecks manquants, durcissement Compose, job CD et scans de sécurité dans la CI.
4. **E29** : JSDoc + OpenAPI générés, `CHANGELOG.md`, mise à jour du README.
5. **Plus tard** : migration Vite, Express 5, transactions MongoDB ou file de réservation si plusieurs instances.

## 9. Ce qui est déjà correct (à conserver)

- Rôle jamais accepté du client ; prix et total recalculés côté serveur en centimes.
- JWT : algorithme imposé (`HS256`), expiration 1 h, claims vérifiés ; comparaison bcrypt même pour un compte inconnu (pas de signal de timing) ; messages d'erreur génériques.
- Idempotence des commandes et réservation de stock atomique ; transitions de statut explicites.
- Jeton interne comparé en temps constant entre backend → gateway → notifications ; services internes non publiés sur l'hôte.
- Aucun secret dans l'historique git ; actions GitHub épinglées par SHA.
- Aucun sink XSS dans le React.
