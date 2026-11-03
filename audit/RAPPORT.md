# Analyse du code — 3 novembre 2026

État de référence avant corrections. Voir [les corrections de sécurité et leurs vérifications](CORRECTIONS-SECURITE.md) pour l'état actuel.

Périmètre : backend Express/Mongoose, frontend React, gateway, microservices, Docker et sept arbres npm. Analyse sans modification du code applicatif ni des dépendances. Les références sont relatives à `exam1` et les numéros de lignes correspondent à l'état audité.

## Problèmes à traiter en priorité

### 1. Élevée — Les prix des commandes sont contrôlés par le client

`backend/controllers/orderController.js:34–48`, `backend/models/Order.js:10–18`.

Le serveur copie `items[].price` et calcule le total avec ces prix, sans lire les produits. Un utilisateur connecté peut commander un article à 0 €, à un prix négatif ou référencer un ObjectId sans produit associé. La quantité a un minimum de 1 mais aucune contrainte d'entier. Vérification locale : `Order.validateSync()` accepte un prix de -100 et une quantité de 1,5, avec un total de -150. La sauvegarde en base n'a pas été exécutée.

Correction : recevoir seulement les identifiants et quantités ; charger les produits, vérifier leur existence, imposer des quantités entières positives et recalculer les prix et le total côté serveur. Représenter les montants en centimes pour maîtriser les arrondis.

### 2. Élevée — Aucun contrôle ni décrémentation des stocks lors de la commande

`backend/controllers/orderController.js:54–80`, `microservices/stock-management/index.js:7–10`.

La commande est sauvegardée sans vérifier le stock. L'appel au service de stock est commenté et ce service ne fait lui-même qu'écrire un log. Les produits épuisés peuvent être commandés indéfiniment. La gateway ne monte pas non plus sa route stock (`gateway/server.js:19`).

Correction : réserver/décrémenter avec une condition atomique `stock >= quantité` et garantir la cohérence entre réservation et commande. Un simple contrôle suivi d'une écriture séparée laisserait une course entre acheteurs.

### 3. Élevée — Des secrets d'authentification sont écrits dans les logs

`backend/middlewares/authMiddleware.js:7`, `backend/controllers/authController.js:12,17,24,35,50`, `frontend/src/services/api.js:11`.

Le middleware journalise systématiquement chaque JWT reçu. Les traces `debug`, lorsqu'elles sont activées, contiennent les mots de passe en clair, les utilisateurs avec leurs hashes et les JWT. Un accès aux logs permet alors de récupérer des sessions encore valides. Les commandes et adresses sont également journalisées (`orderController.js:9–12,57`).

Correction : retirer les mots de passe, tokens, hashes et données personnelles inutiles ; journaliser des identifiants techniques et codes d'erreur. Révoquer les secrets/sessions exposés si ces traces ont été collectées dans un environnement partagé.

### 4. Moyenne — Les endpoints d'authentification n'imposent pas le type des champs

`backend/controllers/authController.js:11–20,34–39`, `backend/routes/authRoutes.js:7–8`.

`username` et `email` sont injectés directement dans les filtres MongoDB. Vérification sans base : le cast Mongoose conserve `username: { $ne: null }`. Cela permet de modifier le sens de la recherche. Le contrôle bcrypt reste présent : ce constat ne démontre pas une connexion sans mot de passe. Les réponses distinguent aussi utilisateur absent et mot de passe incorrect, et aucun limiteur de tentatives n'est présent dans l'application.

Correction : valider un corps JSON avec des chaînes non vides et des longueurs bornées, rejeter les objets/opérateurs, normaliser l'email, limiter les tentatives et retourner une erreur d'authentification uniforme. Un éventuel contrôle externe au projet n'a pas été vérifié.

### 5. Moyenne — La suppression de commande ne répond jamais

`backend/routes/orderRoutes.js:10`, `backend/controllers/orderController.js:149–152`.

Le contrôleur lit `req.body.orderId` alors que la route fournit `req.params.id`, ne supprime rien et n'envoie aucune réponse. Vérifié par appel isolé du contrôleur. La route manque également de `isAdmin`, malgré son commentaire ; aucune suppression non autorisée effective n'est démontrée puisque la fonction est vide.

Correction : définir qui peut supprimer, appliquer le contrôle correspondant, lire le paramètre de route, effectuer l'opération et retourner 204 ou 404.

### 6. Moyenne — L'API de validation annonce un succès sans modifier la commande

`backend/routes/orderRoutes.js:11`, `backend/controllers/orderController.js:161–164`.

`PUT /api/orders/:id/validate` retourne 200 sans opération en base et lit un champ absent du corps. Vérification isolée : « Commande undefined validée avec succès. », zéro appel de mise à jour. L'interface Admin actuelle utilise l'autre endpoint `/status`, donc ce défaut concerne l'API de validation et son client `adminApi.validateOrder`, pas le bouton actif de l'écran Admin.

Correction : utiliser `req.params.id`, mettre à jour vers un statut autorisé, vérifier l'existence et retourner le résultat persisté.

### 7. Moyenne — Le statut des commandes peut sortir de l'énumération

`backend/controllers/orderController.js:173–181`, `backend/models/Order.js:34–37`.

L'endpoint monté vérifie seulement que `status` est truthy. `findByIdAndUpdate` est appelé sans `runValidators: true` : un administrateur peut enregistrer un statut arbitraire. Aucune transition métier n'est contrôlée, par exemple une commande annulée peut être expédiée.

Correction : valider le type, la liste des statuts et les transitions permises, puis activer les validateurs de mise à jour.

### 8. Moyenne — Les choix affichés par défaut ne sont pas enregistrés dans le panier

`frontend/src/context/CartContext.js:57–60`, `frontend/src/components/ShippingMethodSelection.js:19–28`, `frontend/src/components/handlePaymentChange.js:20–27`.

Les deux valeurs initiales sont `null`, mais les listes n'ont pas d'option vide. Le navigateur affiche donc le premier choix alors que le contexte reste vide tant qu'aucun changement n'a lieu. La confirmation refuse ensuite la commande pour méthodes manquantes (`pages/Order.js:23–24`). Constat par lecture du flux ; pas de test navigateur de ce scénario.

Correction : initialiser les valeurs sur les premiers choix ou afficher une option explicite « Sélectionner » de valeur vide.

### 9. Moyenne — Les confirmations répétées peuvent créer plusieurs commandes

`frontend/src/pages/Order.js:16–72`, `backend/controllers/orderController.js:45–61`.

Aucun état de soumission ne désactive le bouton et aucune clé d'idempotence ne protège le serveur. Pendant l'attente, notamment celle de la notification, plusieurs clics lancent plusieurs créations pour le même panier. La perte de la réponse suivie d'une nouvelle tentative a le même risque.

Correction : désactiver le bouton pendant l'envoi et garantir côté serveur l'unicité d'une tentative de commande avec une clé d'idempotence.

### 10. Moyenne — Des erreurs de base peuvent devenir des rejets de promesse non gérés

`backend/controllers/productController.js:4–6`, `backend/controllers/orderController.js:154–157`, `backend/server.js:12–14`.

Les lectures async sont montées directement sous Express 4 sans `try/catch` ni wrapper transmettant les erreurs à `next`. Un rejet MongoDB ne suit pas correctement la chaîne de gestion HTTP et peut arrêter Node selon sa configuration. L'application n'a pas de middleware d'erreur centralisé.

Correction : envelopper les handlers async ou migrer vers Express 5 après validation ; fournir un gestionnaire d'erreur et des réponses cohérentes. Non provoqué contre une base réelle.

## Autres défauts et limites

- **Panier : mutation de l'état précédent.** `frontend/src/context/CartContext.js:13–15` copie le tableau mais modifie l'objet partagé. Copier aussi l'article modifié. Les snapshots antérieurs du state sont sinon altérés.
- **Session expirée : interface incohérente.** `ProtectedRoute.js:6` vérifie seulement la présence du token ; le serveur expire le JWT après une heure. L'interface laisse poursuivre puis affiche une erreur technique. Gérer globalement les 401/403, la reconnexion et le retour au parcours d'achat. Modifier `localStorage.role` permet d'afficher l'écran admin, mais les API montées vérifient bien le rôle du JWT : aucun contournement serveur démontré.
- **Inscription : collisions mal gérées.** `authController.js:39` recherche seulement l'email ; un username déjà utilisé échoue ensuite sur l'index unique et produit une 500 générique. Traiter les erreurs de duplication et valider les champs.
- **Stock administratif : validation incomplète.** `productController.js:14–26` refuse les nombres négatifs mais accepte les décimales et les chaînes numériques par cast ; imposer un entier non négatif. Pas de bug « impossible de saisir zéro » démontré dans l'UI : le champ fournit la chaîne `"0"`, qui est truthy.
- **Paiement : fonction non implémentée.** Seul le nom du moyen de paiement est sauvegardé ; aucun encaissement ou contrôle de transaction n'est présent. C'est une limite fonctionnelle si un paiement réel est attendu, pas la preuve qu'une commande est marquée payée à tort.
- **Code administratif non monté.** `backend/routes/adminRoutes.js` n'est pas importé dans `server.js`. Ses contrôleurs ne correspondent donc pas aux endpoints utilisés par l'interface. Ils contiennent notamment un statut `Validée` absent du schéma et peuvent retourner 500 après une modification réussie si l'email échoue. Nettoyer ces doublons avant de les réactiver.
- **Service de stock non protégé mais inactif.** Sa route directe n'a pas d'authentification. Actuellement elle ne modifie aucune donnée et la gateway ne l'expose pas. La sécuriser avant de lui confier une écriture ; Compose ne publie pas son port sur l'hôte.
- **Frontend Docker : serveur de développement.** `frontend/Dockerfile:11` utilise `npm start`, avec les dépendances et fonctionnalités de développement. Pour une production, compiler et servir les fichiers statiques. Le mapping Compose actuel est limité à `127.0.0.1`, ce qui réduit l'exposition locale.

## Dépendances : mises à jour requises

Les versions ci-dessous ont été interrogées sur le registre npm pendant cet audit. Elles sont des cibles proposées, pas des mises à jour installées ou validées. Les détails exhaustifs et les comptes par composant sont dans `DEPENDANCES.md` et les fichiers JSON voisins.

| Bibliothèque | Version verrouillée | Cible proposée | Priorité / réserve |
|---|---|---|---|
| mongoose | 8.8.1 | 8.24.8 | Urgente : avis critiques, rester d'abord dans la majeure 8 |
| axios | 1.7.7 | 1.21.0 | Urgente, backend et frontend ; avis élevés |
| express | 4.21.1 | 4.22.3 | Urgente dans les cinq services concernés ; renouveler aussi les transitives |
| nodemailer | 6.9.16 | 10.3.1 | Prioritaire ; migration majeure et tests SMTP nécessaires ; 6.10.1 ne suffit pas à tous les avis |
| body-parser | 1.20.3 | supprimer la dépendance directe inutilisée, ou 1.20.9 | `express.json` est utilisé ; corriger aussi la copie transitive via Express |
| react-router-dom | 6.4.5 | migration étudiée vers 7.18.5 | Avis élevés ; la plage actuelle `6.4` bloque même les mineures 6.x |
| jsonwebtoken | 9.0.2 | 9.0.3 | Maintenance |
| express-http-proxy | 2.1.1 | 2.1.2 | Maintenance |
| cors / debug / dotenv | 2.8.5 / 4.3.7 / 16.4.5 | 2.8.6 / 4.4.3 / 16.6.1 | Maintenance sans migration majeure |
| postcss / autoprefixer | 8.4.49 / 10.4.20 | 8.5.32 / 10.6.2 | Revoir aussi les copies transitives dans la chaîne de compilation |
| tailwindcss | 3.4.15 | 3.4.19 | Correctif dans la majeure actuelle ; 4.x est une migration distincte |
| react-scripts | 5.0.1 | remplacer Create React App | Aucun simple upgrade suffisant proposé ; moderniser la chaîne de compilation |

React et React DOM peuvent rester en 18.3.1 pendant les corrections prioritaires. Le passage vers React 19, Tailwind 4, Express 5, Mongoose 9 ou les nouvelles majeures des outils de test doit être traité séparément avec des vérifications de compatibilité.

Ne pas appliquer aveuglément `npm audit fix --force` : l'audit propose notamment des rétrogradations de nodemon/npm-run-all et `react-scripts@0.0.0`. Ce ne sont pas des remédiations acceptables sans analyse.

**Exposition réelle :** les alertes npm ne démontrent pas automatiquement un exploit dans le projet. L'URL de notification Axios est définie par configuration, pas directement par l'acheteur ; les fonctionnalités Mongoose `populate().match` visées par certains avis ne sont pas utilisées dans le code audité ; le code ne configure pas `trust proxy` ni de contrôle d'accès fondé sur l'IP pour l'avis critique `proxy-addr`. Les avis React Router liés au SSR ne correspondent pas à cette SPA. Les dépendances vulnérables doivent néanmoins être renouvelées.

Sources : [avis Mongoose CVE-2025-23061](https://github.com/advisories/GHSA-vg7j-7cwx-8wgw), [avis Axios CVE-2025-27152](https://github.com/advisories/GHSA-jr5f-v2jv-69x6), [avis proxy-addr](https://github.com/advisories/GHSA-jqcg-44mw-7w3h). React a annoncé la dépréciation de Create React App le 14 février 2025 : [annonce officielle](https://react.dev/blog/2025/02/14/sunsetting-create-react-app). Chaque JSON npm contient les autres sources et plages affectées.

## Vérifications et limites

- Notifications : `node --test microservices/notifications/index.test.js` — **12/12 passent**, fournisseurs simulés, aucun email envoyé.
- Compilation frontend : `npm run build` — **réussie** sous Node 24.22.1 ; avertissement sur les données Browserslist anciennes. Les images Docker Node 22 n'ont pas été reconstruites pour cet audit.
- Frontend : `CI=true npm test -- --watchAll=false --runInBand` — **échec avant exécution**, Jest ne transforme pas l'entrée ESM d'Axios. Le test existant attend en plus « learn react », absent de l'application, et ne fournit pas `CartProvider`. Il faut le remplacer par des tests du comportement réel.
- Vérifications isolées sans MongoDB : prix négatif/quantité fractionnaire acceptés par le schéma, opérateur `$ne` conservé dans le filtre utilisateur, validation sans mise à jour et suppression sans réponse.
- Audit npm et versions : sept composants interrogés ; résultats bruts conservés. Aucun paquet installé ou mis à jour.
- Pas de scénario complet navigateur + MongoDB, de test de charge, d'audit d'images Docker ou d'infrastructure distante. Pas d'envoi d'email ni de modification de données métier. Les fichiers `.env` ne sont pas suivis dans l'état Git courant ; leur historique et la validité de leurs secrets ne sont pas certifiés.

Ordre recommandé : fiabiliser prix/stocks et supprimer les logs sensibles ; corriger les dépendances serveur vulnérables ; réparer les routes et la validation ; sécuriser la soumission du checkout ; remettre les tests frontend en état et moderniser son build.
