# Examen Développeur Full Stack Promo Némésis 2026

Toutes les commandes sont à exécuter depuis le dossier `exam1`.

## Lancement en local

Prérequis : Node.js, npm et MongoDB démarré en local.
Configurer le fichier `.env` à la racine avec les variables nécessaires aux services
(connexion MongoDB, secret JWT, adresses des microservices et identifiants email).

Installer les dépendances au premier lancement :

```bash
npm ci
npm --prefix frontend ci
npm --prefix backend ci
npm --prefix gateway ci
npm --prefix microservices/notifications ci
npm --prefix microservices/stock-management ci
```

Démarrer tous les composants :

```bash
npm run start:all
```

Application : http://localhost:3000. Arrêt : `Ctrl + C`.

## Lancement avec Docker

Prérequis : Docker Desktop démarré.
Au premier lancement, créer la configuration (si `.env.docker` n'existe pas déjà) :

```bash
cp .env.docker.example .env.docker
openssl rand -hex 32
```

Reporter le secret généré dans `JWT_SECRET` du fichier `.env.docker`.
Générer une seconde valeur pour `INTERNAL_API_TOKEN` avec la même commande.
Renseigner les variables email pour activer les notifications.
Ne pas versionner les fichiers contenant des secrets.

Démarrer les conteneurs :

```bash
docker compose --env-file .env.docker up --build -d --wait
```

Application : http://localhost:8080 (serveur de développement React).
La base MongoDB Docker est séparée de la base locale et vide au premier lancement.

Consulter l'état et les logs :

```bash
docker compose --env-file .env.docker ps
docker compose --env-file .env.docker logs -f
```

Arrêter les conteneurs en conservant les données :

```bash
docker compose --env-file .env.docker down
```

## Notifications email

Le microservice conserve `/notify` et accepte `{ to, subject, text }`.
Choisir `EMAIL_PROVIDER=smtp` pour conserver Nodemailer/Gmail, ou `resend`
pour l'API HTTPS (Node.js 22). Le mode SMTP reste le mode par défaut.

- Backend, gateway et notifications : même `INTERNAL_API_TOKEN`, distinct du JWT.
- Backend : `NOTIFICATION_EMAIL` (destinataire des alertes) et `NOTIFICATION_URL`
  (URL complète de la gateway suivie de `/notify`).
- Gateway : `NOTIFI_SERVICE_URL` (URL du microservice, sans `/notify`).
- SMTP : `EMAIL_USER` et `EMAIL_APPLICATION_PASSWORD` dans le microservice.
- Resend : `RESEND_API_KEY` dans le microservice.
  Pour tester sans domaine, configurer `NOTIFICATION_TEST_EMAIL` avec l'adresse
  du compte Resend ; l'expéditeur par défaut est `onboarding@resend.dev`.
  Après validation du domaine, configurer `EMAIL_FROM` avec
  `Promo Némésis Examen Vincent <contact@valneth.com>` et `EMAIL_REPLY_TO` avec
  `contact@valneth.com`. Ces deux variables concernent le mode Resend uniquement.
  Tant que `NOTIFICATION_TEST_EMAIL` est renseignée, elle reste prioritaire.
  La retirer pour utiliser le destinataire demandé par le backend
  (actuellement `NOTIFICATION_EMAIL`, une alerte administrateur, pas encore
  une confirmation envoyée automatiquement à chaque client).
  Sans adresse de test, un expéditeur personnalisé est obligatoire.

Pour `npm run start:all`, renseigner ces valeurs dans le `.env` à la racine.
Pour Docker, utiliser `.env.docker` ; les variables sont transmises par Compose.
Sur Render, définir les variables service par service, avec les URL HTTPS Render.
Ne jamais mettre ces secrets dans le frontend ou dans Git.
Les routes `/health` de la gateway et des notifications sont publiques.
La protection ajoutée concerne `/notify` ; la route de stock reste à sécuriser
avant de déployer la gateway publiquement.

Tests sans envoyer d'email :

```bash
node --test microservices/notifications/index.test.js
```

Un échec email ne supprime pas une commande sauvegardée. Les appels ont un délai
limité : sur Render gratuit, réveiller les services via `/health` avant les tests
pour éviter que leur démarrage à froid dépasse ce délai.
