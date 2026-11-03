# Journal des évolutions

Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/).
Les dates sont celles des commits.

## [Non publié]

### Ajouté
- Journal d'audit Pino (`backend/audit.js`) : connexions, inscriptions, commandes, statuts, suppressions et stock ;
  champ `env` (`APP_ENV` ou `NODE_ENV`) dans les logs de tous les services.
- Documentation JSDoc des modules et génération de `docs/API.md` (`npm run docs`).
- Validation Joi des entrées d'authentification, de commande et de stock (`backend/validation/schemas.js`).
- Routes `POST /api/auth/logout` et `GET /api/auth/me`.
- ESLint et Prettier à la racine (`npm run lint`, `npm run format:check`).
- Rapport `audit/AUDIT-SECURITE-ROBUSTESSE.md`.

### Modifié
- Le jeton JWT passe dans un cookie HttpOnly (`SameSite=Strict`, `Secure` en production) au lieu de `localStorage` ;
  protection CSRF par l'en-tête `X-Requested-With`. Le front ne garde que des informations d'affichage.
- CORS limité aux origines de `CORS_ORIGIN` (avec identifiants) ; `Cross-Origin-Resource-Policy: cross-origin`.
- `helmet`, limite de corps à 10 ko, réponses 404 et erreurs en JSON sans stack trace.
- Le démarrage du backend exige un `JWT_SECRET` de 32 caractères minimum.v
- Les e-mails sont enregistrés en minuscules ; `role` limité à `user` ou `admin` dans le modèle.
- Le seed refuse de s'exécuter en production sans `--force`.
- Frontend migré de Create React App vers Vite ; tests Jest autonomes.

### Supprimé
- Code mort : `adminController`, `adminRoutes`, routes gateway inutilisées, fichiers vides du microservice
  `auth-gateway`, doublon `ProductList` du frontend.

### Sécurité
- Corrige l'exposition du jeton aux attaques XSS, l'acceptation de toutes les origines CORS, l'écriture possible
  de champs inconnus (rôle, prix) et les pages d'erreur avec stack trace.

## [0.3.0] - 2026-11-03

### Ajouté
- Journalisation structurée Pino dans le backend, la gateway et les microservices, avec masquage des données sensibles.
- Supervision Uptime Kuma persistante et guide d'accès.
- Workflow CI GitHub Actions : tests, build du frontend et cinq images Docker.

### Modifié
- Mise à jour des dépendances et correctifs des alertes de sécurité React Router.

## [0.2.0] - 2026-11-03

### Sécurité
- Authentification sécurisée : politique de mot de passe (12 caractères), noms en minuscules, limitation des
  tentatives de connexion, comparaison en temps constant du jeton interne.
- Commandes : prix lus côté serveur, idempotence, réservation de stock atomique, transitions de statut contrôlées.

### Corrigé
- Fiabilité de l'authentification et du passage de commande.

## [0.1.0] - 2026-11-03

### Ajouté
- Application e-commerce initiale : produits, panier, commandes, rôles `user` et `admin`.
- Gateway et microservices de notifications (e-mail) et de stock.
- Support Docker (`docker-compose.yml`) et variables d'environnement.
