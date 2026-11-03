# Journal des évolutions

Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/).
Les dates sont celles des commits.

## [Non publié]

### Corrigé
- Le formulaire de livraison bloque l'accès au récapitulatif si l'adresse est vide,
  incomplète ou composée d'espaces, affiche une erreur et place le focus sur le champ à compléter.

### Ajouté
- Journal d'audit Pino (`backend/audit.js`) : connexions (succès et échec), inscriptions, déconnexions, création de
  commande, changement de statut, suppression de commande et modification de stock ; champ `env`
  (`APP_ENV` ou `NODE_ENV`) dans les logs de tous les services.
- Validation Joi des entrées d'inscription, de connexion, de commande, de statut et de stock
  (`backend/validation/schemas.js`) ; les champs inconnus sont supprimés.
- Routes `POST /api/auth/logout` et `GET /api/auth/me` (rôle relu en base).
- Documentation JSDoc du backend, de la gateway, des microservices et de `session.js` ; génération de
  `docs/API.md` (`npm run docs`). Commentaires de documentation sur les pages et composants React.
- ESLint et Prettier à la racine (`npm run lint`, `npm run format:check`).

### Sécurité
- **Vol de session par XSS** : le jeton JWT quitte `localStorage` pour un cookie `HttpOnly`, `SameSite=Strict`,
  `Secure` en production ; le front ne garde que des informations d'affichage.
- **CSRF** : les requêtes modifiantes authentifiées par cookie exigent l'en-tête `X-Requested-With`.
- **CORS ouvert à toutes les origines** : liste blanche via `CORS_ORIGIN` (avec identifiants), valeurs normalisées
  (sans `/` final) ; `Cross-Origin-Resource-Policy: cross-origin` pour l'API.
- **En-têtes HTTP** : `helmet` ajouté, `x-powered-by` retiré.
- **Fuite de stack trace** : une erreur ou un JSON invalide répond en JSON sans détail ; 404 JSON.
- **Corps de requête sans limite explicite** : limité à 10 ko.
- **Secret JWT faible ou absent** : le backend refuse de démarrer sous 32 caractères.
- **Écriture de champs non prévus** (`role`, `price`…) : supprimés par Joi ; `role` limité à `user` ou `admin` dans le modèle.
- **Injection dans les identifiants** : les `id` de commande et de produit doivent être des ObjectId hexadécimaux.
- **Seed destructif** : `seeder.js` refuse de s'exécuter en production sans `--force`.
- **Code mort contournant les contrôles** : suppression de `adminController` et `adminRoutes` (statut sans validation).

### Corrigé
- Statut `Validée` absent de l'énumération Mongoose, écrit sans contrôle par l'ancien contrôleur admin.
- Doublons de comptes selon la casse de l'e-mail : les e-mails sont enregistrés en minuscules.
- Bulle du panier qui chevauchait le texte « Panier » dans la barre de navigation.
- Texte illisible en mode sombre du navigateur : thème clair forcé.
- Cellule des quantités du panier qui cassait les bordures du tableau.
- Page de connexion plus haute que l'écran (barre de défilement inutile).
- Commentaire obsolète dans `Navbar` (session « simulée » avec `localStorage`).

### Modifié
- Frontend migré de Create React App vers Vite ; tests Jest autonomes.
- Seul `Authorization: Bearer` restait accepté pour les clients d'API ; il le reste, après le cookie.

### Supprimé
- `adminController`, `adminRoutes`, routes gateway inutilisées (`auth`, `stock`, `notif`), fichier vide du
  microservice `auth-gateway`, doublon `ProductList` du frontend, dossier `audit/`.

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
