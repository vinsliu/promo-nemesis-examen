# Examen Développeur Full Stack Promo Némésis 2026

Toutes les commandes sont à exécuter depuis le dossier `exam1`.

## CI/CD (GitHub Actions et Render)

Le workflow `.github/workflows/ci.yml` s'exécute sur les push et les pull requests
vers `dev` et `main`. Il utilise Node.js 22 pour :

- installer les dépendances avec `npm ci` ;
- tester le backend, y compris l'intégration avec un MongoDB 8 temporaire ;
- tester le frontend et compiler React en mode CI ;
- tester les notifications et leur routage par la gateway sans envoyer d'email ;
- construire les cinq images Docker (backend, frontend, gateway, notifications,
  stock-management), sans les publier dans un registre ;
- exiger la réussite de tous les jobs dans le contrôle `CI validation`.

Aucun secret Atlas, Render ou Resend n'est nécessaire dans GitHub Actions.
La base `exam_functional_verify` existe uniquement dans le runner et disparaît
avec lui. Les tests ne ciblent ni la préproduction ni la production.

### Activation des déploiements

Le workflow prépare les contrôles ; les paramètres Render doivent être activés
manuellement. Pour la première installation :

1. Dans les huit services Render, désactiver temporairement **Auto-Deploy**
   (`Off`) pour éviter un déploiement avant la mise en place des contrôles.
2. Commit et push du workflow et du README sur `dev`, puis attendre le succès
   de tous les contrôles dans l'onglet **Actions** de GitHub.
3. Ouvrir une pull request `dev` vers `main`. Après revue et réussite des contrôles,
   fusionner pour installer également le workflow sur `main`.
4. Dans chaque service Render : **Settings → Build & Deploy → Auto-Deploy →
   After CI Checks Pass**. La préproduction doit suivre `dev`, la production `main`.
5. Pour cette première activation, déployer manuellement le dernier commit validé
   de chaque branche et vérifier les fonctionnalités et `/health`.

Ensuite : push sur `dev` → tests et builds → déploiement préproduction ;
pull request et fusion vers `main` → nouveaux contrôles → déploiement production.
Un contrôle en échec doit empêcher le déploiement automatique et laisser la
version précédente en service. Vérifier ce blocage avec une pull request de test
en échec, sans fusionner son code dans `main`.

Dans GitHub, protéger `main` avec une pull request obligatoire et le contrôle
requis **CI validation**, si le compte et la visibilité du dépôt le permettent.
Render vérifie les contrôles CI, mais ne protège pas les fusions dans GitHub.

Les images Docker valident la conteneurisation locale. Render reconstruit depuis
les sources avec ses propres variables (Node.js pour les services, site statique
pour React) : il ne déploie pas les images construites dans cette CI.
Ne pas réutiliser le build frontend CI pour le déploiement : son URL API `/api`
est une valeur de validation, remplacée au build Render par celle de l'environnement.

Référence : https://render.com/docs/deploys#integrating-with-ci

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

## Authentification

Les nouvelles inscriptions demandent un nom de 3 à 30 caractères,
un email valide (254 caractères maximum) et un mot de passe d'au moins 12 caractères,
avec une majuscule, une minuscule, un chiffre et un caractère spécial, dans la limite
de 72 octets UTF-8. Cette limite évite la troncature silencieuse de bcrypt ; les mots
de passe historiques plus courts restent utilisables à la connexion.
Les nouveaux noms sont enregistrés en minuscules. Leur recherche et leur unicité
sont insensibles aux majuscules/minuscules (collation MongoDB française, force 2).
Les anciens comptes gardent leur nom et leur mot de passe ; aucune fusion automatique
n'est réalisée. Si deux noms historiques ne diffèrent que par la casse, la création
de l'index unique `username_case_insensitive` bloque le démarrage avec un message
explicite : résoudre cette collision avant de relancer. Les espaces autour d'un
nouveau nom et d'un nouvel email sont retirés.
Les doublons de nom ou d'email renvoient 409. Une connexion refusée renvoie 401
avec le même message, que le compte existe ou non.

Les routes limitent les appels à 20 connexions et 10 inscriptions par période
de 15 minutes et par adresse de connexion réseau. Un dépassement renvoie 429
avec `Retry-After`. Les en-têtes de forwarding du client ne sont pas utilisés.
Derrière le proxy du frontend Docker ou un reverse proxy, les utilisateurs
partagent donc le quota de ce proxy. Ce limiteur en mémoire est adapté au
démarrage local sur une instance ; pour la production, prévoir un stockage partagé
et une identification de l'adresse client fondée sur des proxies explicitement
autorisés. Un redémarrage réinitialise les compteurs.

### Session, CORS et validation

Le jeton JWT (1 h) est posé par le serveur dans un cookie `token` **HttpOnly**, `SameSite=Strict`
et `Secure` en production : le JavaScript du navigateur ne peut pas le lire, ce qui limite l'effet
d'une faille XSS. Le front ne conserve en `localStorage` que des informations d'affichage
(nom, rôle, expiration). Les routes `POST /api/auth/logout` et `GET /api/auth/me` ferment et relisent
la session (le rôle vient de la base). Pour les requêtes qui modifient des données, le serveur
exige l'en-tête `X-Requested-With: XMLHttpRequest` (protection CSRF) ; le client axios l'envoie.
L'en-tête `Authorization: Bearer` reste accepté pour les clients d'API.

Toutes les entrées (inscription, connexion, commande, statut, stock) sont validées avec
[Joi](https://joi.dev/) (`backend/validation/schemas.js`) ; les champs inconnus sont supprimés.
Les corps JSON sont limités à 10 ko.

Variables du backend à définir sur chaque environnement (préproduction et production) :

| Variable | Rôle |
| --- | --- |
| `NODE_ENV=production` | Cookie `Secure`, pas de détail d'erreur. Aussi en préproduction. |
| `CORS_ORIGIN` | URL du front avec `https://`, sans `/` final ; plusieurs valeurs séparées par des virgules. En production sans valeur, aucune origine croisée n'est acceptée. |
| `COOKIE_SAMESITE` | `strict` (défaut) ; `none` si le front et l'API sont sur des sites différents (impose `Secure`). |
| `JWT_SECRET` | 32 caractères minimum, différent entre préproduction et production. |
| `APP_ENV` | `preprod` ou `production`, ajouté aux logs (sinon `NODE_ENV`). |
| `LOG_LEVEL` | Niveau des logs Pino (`info` par défaut). |

Le seed `backend/seeder.js` supprime les produits : il refuse de tourner avec `NODE_ENV=production`
sauf option `--force`.

Tests du lot authentification, sans base de données ni email :

```bash
node --test backend/tests/auth.test.js
```

Tous les tests backend (authentification, sécurité commandes et stock), sans email :

```bash
npm --prefix backend test
```

Le détail des corrections est dans [`CHANGELOG.md`](CHANGELOG.md).

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

## Monitoring avec Uptime Kuma

Uptime Kuma 2 est inclus dans `docker-compose.yml`. Il surveille la disponibilité
et les temps de réponse et conserve son compte administrateur, ses sondes et son
historique dans le volume Docker `uptime-kuma-data`.

### Démarrage et accès

Depuis `exam1`, avec Docker Desktop démarré et `.env.docker` configuré comme indiqué
ci-dessus, lancer uniquement le monitoring (sans démarrer ou reconstruire l'application) :

```bash
docker compose --env-file .env.docker up -d uptime-kuma
```

Le lancement complet `docker compose --env-file .env.docker up --build -d --wait`
démarre également Kuma.

**Accès : [http://localhost:3001](http://localhost:3001).** Au premier accès, terminer
l'assistant de configuration et créer le compte administrateur avec un mot de
passe unique. Aucun identifiant par défaut n'est versionné. Pour changer le port,
ajouter `KUMA_PORT=3002` dans `.env.docker`, relancer la commande et ouvrir
`http://localhost:3002`. L'interface est liée à `127.0.0.1` uniquement.

### Sondes locales

Dans l'interface, choisir **Ajouter une sonde**, puis créer les contrôles suivants.
L'application doit être démarrée avec Docker pour que ces adresses fonctionnent.
Les requêtes partent du conteneur Kuma : utiliser les noms des services Docker,
pas `localhost`.

| Nom | Type | Cible | Résultat attendu |
| --- | --- | --- | --- |
| Local — Frontend | HTTP(s) | `http://frontend:3000` | HTTP 200 |
| Local — Backend et MongoDB | HTTP(s) | `http://backend:5000/api/products` | HTTP 200 |
| Local — Gateway | HTTP(s) | `http://gateway:8000/health` | HTTP 200 |
| Local — Notifications | HTTP(s) | `http://notifications:4002/health` | HTTP 200 |
| Local — Stock | Port TCP | Hôte `stock-management`, port `4003` | Connexion acceptée |
| Local — MongoDB | Port TCP | Hôte `mongo`, port `27017` | Connexion acceptée |

Configurer un intervalle de 60 secondes, un délai d'expiration de 10 secondes et
2 nouvelles tentatives pour les sondes HTTP. Restreindre les codes acceptés à
`200`. Le contrôle backend lit le catalogue sans le modifier et sollicite MongoDB.
Les sondes TCP vérifient seulement l'ouverture du port ; les routes `/health` de
la gateway et des notifications vérifient que le processus HTTP répond, sans
garantir la livraison d'un email. Aucune sonde ne doit appeler les routes de
création de commande, d'envoi d'email ou de modification de stock.

### Préproduction et production Render

L'instance locale a été configurée le 3 novembre 2026 avec deux groupes,
**Préproduction** et **Production**, contenant chacun quatre sondes actives :

| Groupe | Frontend | Autres contrôles |
| --- | --- | --- |
| Préproduction | https://preprod.valneth.com | Backend `/api/products`, gateway `/health`, notifications `/health` |
| Production | https://www.valneth.com | Backend `/api/products`, gateway `/health`, notifications `/health` |

Les huit URL exactes et les preuves de validation figurent dans
[`docs/SUPERVISION-E26.md`](docs/SUPERVISION-E26.md).
Ces sondes utilisent un intervalle de **60 secondes**, **2 nouvelles tentatives**,
un délai de **48 secondes** adapté aux démarrages Render et les codes acceptés
**200–299**. La vérification TLS est active ; les sondes des frontends activent
également les alertes d'expiration de certificat. Les réglages de 10 secondes
du tableau local ci-dessus concernent les sondes locales proposées.

Pour consulter l'état, ouvrir le **Dashboard**, développer les deux groupes et
cliquer sur une sonde pour consulter ses temps de réponse et son historique.
Le bouton **Edit / Modifier** permet de mettre à jour l'URL ou les seuils.
Les noms Docker du tableau local ne fonctionnent pas pour Render. Ne pas rendre
un service privé public uniquement pour le surveiller.

Le push Git ne déploie pas Kuma sur Render : le service ajouté ici fonctionne
sur l'hôte Docker où la commande est exécutée. Pour une surveillance continue,
le lancer sur une machine toujours allumée, idéalement distincte de l'application,
avec un stockage persistant. Pour consulter cette instance distante sans exposer
le port d'administration, utiliser un tunnel SSH :

```bash
ssh -N -L 3001:127.0.0.1:3001 utilisateur@serveur-monitoring
```

Puis ouvrir `http://localhost:3001` sur son ordinateur. Sur une offre Render avec
mise en veille, les sondes régulières peuvent maintenir les services éveillés et
les démarrages à froid peuvent dépasser le délai de la sonde ; adapter les seuils
et interpréter ces alertes en conséquence.

### Alertes, validation et exploitation

Le canal **Alertes préprod et prod — contact@valneth.com** est configuré avec
**Resend** : expéditeur `Supervision Valneth <contact@valneth.com>`, destinataire
`contact@valneth.com`. Il est associé aux huit sondes et activé par défaut pour
les nouvelles sondes. La clé est conservée dans Kuma, hors du dépôt.

Dans **Paramètres → Notifications**, modifier ce canal ou utiliser **Test** pour
envoyer un email de contrôle. Dans les paramètres de chaque sonde, vérifier que
le canal reste coché. Une nouvelle installation nécessite de renseigner la clé
Resend dans Kuma, puis de tester et d'associer le canal aux sondes.

Le test du canal et les alertes **DOWN puis UP** ont été validés, avec trois emails
confirmés livrés dans Resend. La sonde dédiée **Validation E26 — test DOWN puis UP**
est conservée en pause avec son historique. Elle utilise une recherche de mot-clé
sur le frontend de préproduction : chaîne volontairement absente pour DOWN,
puis `Examen` pour UP. Cette méthode teste les alertes sans arrêter l'application.
Pour rejouer ce test, modifier le mot-clé de cette sonde, la reprendre, attendre
DOWN, remettre `Examen`, attendre UP, puis remettre la sonde de test en pause.

Pour valider en local, après avoir obtenu des sondes vertes, arrêter uniquement
le frontend, attendre l'état DOWN et l'alerte, puis le redémarrer et vérifier le
retour UP :

```bash
docker compose --env-file .env.docker stop frontend
docker compose --env-file .env.docker start frontend
```

Exécuter ces deux commandes séparément en attendant l'alerte entre les deux.
Conserver des captures du tableau de bord et de l'incident pour la soutenance.
Les sondes et les notifications sont conservées dans le volume de cette instance ;
elles ne sont pas préconfigurées par le fichier Compose. Sur une nouvelle machine
sans restauration du volume, recréer la configuration dans l'interface.

```bash
docker compose --env-file .env.docker logs --tail=100 uptime-kuma
docker compose --env-file .env.docker stop uptime-kuma
docker compose --env-file .env.docker start uptime-kuma
```

`docker compose down` conserve les données ; **ne pas utiliser `down -v`**, qui
supprimerait également les volumes MongoDB et Kuma. Sauvegarder le volume Kuma
avec le conteneur arrêté avant une mise à jour. Les sauvegardes contiennent des
secrets de notification : les conserver hors du dépôt.

Référence : [documentation officielle Uptime Kuma](https://github.com/louislam/uptime-kuma).

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

## Commandes, stock et reprise

Le backend attend la connexion MongoDB, la création des index uniques et la
récupération des opérations interrompues avant de démarrer HTTP. Cette récupération
est conçue pour **une seule instance backend** : ne pas lancer plusieurs instances
sur la même base sans coordination supplémentaire. Elle fonctionne avec MongoDB
standalone, notamment la configuration Compose actuelle, sans replica set.

Chaque création exige un en-tête `Idempotency-Key` (16 à 128 caractères : lettres,
chiffres, tirets ou underscores). Une clé est unique par utilisateur. Rejouer la
même commande renvoie sa version enregistrée sans redécrémenter le stock, même si
le prix catalogue a changé. Réutiliser la clé avec d'autres articles, quantités,
adresse ou méthodes renvoie 409. Une tentative en cours renvoie 409 avec le code
`ORDER_PENDING` ; conserver la clé et réessayer. Une commande supprimée renvoie 410.

Le stock disponible et le marqueur de réservation sont modifiés atomiquement dans
chaque produit. La commande sert de journal durable : si un produit manque, les
réservations déjà prises sont compensées une seule fois. Ce mécanisme n'est pas
une transaction globale multi-documents : en cas d'arrêt brutal, le stock peut
rester temporairement réservé jusqu'au redémarrage et à la récupération. Un échec
de restitution conserve le journal et le marqueur pour une reprise sûre ; le
serveur refuse de démarrer si la récupération échoue. Les tentatives échouées et
les commandes supprimées sont conservées en interne pour garantir l'idempotence.
Une politique d'archivage respectant cette garantie reste à définir pour les gros
volumes. Les marqueurs produit sont retirés lors de la restitution ou de l'expédition.

Les transitions autorisées sont : en attente → en cours de traitement ou annulée ;
en cours → expédiée ou annulée ; expédiée → délivrée. Annulation et suppression avant
expédition restituent uniquement les réservations réellement enregistrées. Les
anciennes commandes sans marqueur ne restituent aucun stock fictif. Les commandes
expédiées/délivrées ne peuvent être annulées ou supprimées. La suppression est
logique et reste réservée à l'administrateur. Le stock saisi en administration est
le **stock disponible**, pas le total incluant les réservations.

Le frontend bloque les confirmations répétées. Il garde dans `sessionStorage`
uniquement des empreintes SHA-256 de tentatives et leurs clés, sans l'adresse de
livraison. Une erreur réseau conserve la clé ; modifier le panier puis revenir au
même contenu retrouve aussi la clé précédente. Vingt tentatives ambiguës maximum
sont conservées sans éviction automatique. Ne pas effacer le stockage d'une session
avec une confirmation ambiguë avant d'avoir vérifié la commande. Le panier seul
est conservé localement, sans adresse ni mode de paiement ; le serveur recalcule
les prix et les disponibilités.

Tests unitaires et interface :

```bash
npm --prefix backend test
CI=true npm --prefix frontend test -- --watchAll=false --runInBand
```

Tests MongoDB optionnels, exclusivement sur une base temporaire dédiée nommée
`exam_functional_verify` (aucun repli vers la configuration métier `MONGO_URI`) :

```bash
TEST_MONGO_URI=mongodb://127.0.0.1:27947/exam_functional_verify npm --prefix backend test
```

Les deux tests d'intégration sont ignorés sans cette variable. Ils créent et
suppriment uniquement leurs fixtures. Ne pas exécuter d'autres requêtes métier
sur cette base pendant les tests de récupération : ils simulent un démarrage.
Les notifications sont simulées ; aucun email n'est envoyé par ces tests.

## Journalisation et audit

Chaque service Node écrit des logs JSON avec [Pino](https://getpino.io/) (`logger.js`) : service, environnement
(`env`), niveau (`LOG_LEVEL`), identifiant de requête (`X-Request-Id`), méthode, route et code de réponse.
Mots de passe, jetons, cookies, e-mails, adresses, en-têtes et corps de requête ne sont jamais écrits.

Les actions sensibles du backend sont tracées par `backend/audit.js` avec `"type":"audit"` : connexion
(succès, échec), inscription, déconnexion, création de commande, changement de statut, suppression de
commande et modification de stock. Chaque événement porte l'action, le résultat, l'identifiant de requête,
l'utilisateur concerné (`actorId`) et la cible (`targetId`), sans donnée personnelle. Pour les consulter,
filtrer les logs Render ou Docker sur `"type":"audit"`.

## Qualité du code

```bash
npm run lint          # ESLint (backend, gateway, microservices)
npm run format:check  # Prettier (vérification)
```

Le frontend garde sa configuration ESLint propre. Les tests : `npm --prefix backend test`,
`npm --prefix frontend test` et `node --test microservices/notifications/index.test.js`.

## Documentation du code

Les fonctions du backend, de la gateway, des microservices et du service de session du front sont
documentées en JSDoc. La documentation de référence est générée dans [`docs/API.md`](docs/API.md) :

```bash
npm run docs
```

Relancer cette commande et commiter `docs/API.md` après toute modification des commentaires JSDoc.
Le journal des évolutions est dans [`CHANGELOG.md`](CHANGELOG.md).
