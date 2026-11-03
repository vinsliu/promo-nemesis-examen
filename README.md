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
