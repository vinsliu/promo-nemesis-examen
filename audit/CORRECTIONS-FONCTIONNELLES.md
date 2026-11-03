# Corrections fonctionnelles — 3 novembre 2026

Suite du lot sécurité, réalisée avec un agent correcteur, un vérificateur indépendant et les contrôles d'intégration de l'agent principal. Publication réservée à `dev`.

## Corrections

- **Authentification :** connexion insensible à la casse, index unique avec collation ; anciens comptes préservés. Nouveaux noms en minuscules. Politique d'inscription conservée selon le choix utilisateur : 12 caractères minimum, majuscule, minuscule, chiffre, caractère spécial, maximum 72 octets UTF-8. Les anciens mots de passe restent utilisables.
- **Commandes et stock :** réservations atomiques par produit, compensation d'une commande multi-produits qui échoue, journal persistant et reprise des opérations interrompues avant ouverture HTTP.
- **Répétitions réseau :** clé d'idempotence obligatoire, unicité par utilisateur, même commande rejouée sans second débit de stock ; empreintes conservées côté navigateur sans stocker l'adresse, y compris si l'utilisateur change puis rétablit son panier après une erreur réseau.
- **Administration :** validation réellement persistée, transitions de statut contrôlées, annulation et suppression avec restitution exactement une fois. Une commande expédiée ne peut pas être annulée/supprimée. La suppression est logique : un journal conservé empêche de recréer la commande avec une ancienne clé.
- **Panier :** réducteur immuable, données publiques persistées et validées, rechargement sans perte du panier, prix/stock rafraîchis lors d'un nouvel ajout depuis le catalogue.
- **Livraison/paiement :** valeurs initiales synchronisées avec l'affichage, validation de l'adresse, URL `/shipping-payment` et compatibilité avec l'ancienne URL mal orthographiée.
- **Sessions :** expiration traitée, nettoyage des données de session, retour vers le parcours demandé après connexion ; rôle retiré à la déconnexion.
- **Interface :** clés React corrigées, produits épuisés désactivés, erreurs de chargement affichées avec nouvelle tentative ; Admin affiche les actions permises et conserve une vue de détails à jour.
- **Tests et dépendances frontend :** Jest/Axios réparé, test CRA obsolète remplacé, outils de test actualisés, React Router 6.30.6 et transitives compatibles mises à jour sans `--force`.

## Vérifications

- Backend : **26 tests passent**, intégrations MongoDB temporaire activées. Les deux intégrations sont ignorées si `TEST_MONGO_URI` n'est pas fourni ; elles exigent une base nommée `exam_functional_verify` et n'utilisent jamais la configuration métier `MONGO_URI`.
- Frontend : **12 tests passent**, couvrant panier, sélecteurs, erreurs, session expirée, verrouillage du checkout, options affichées, administration et idempotence réelle WebCrypto.
- Notifications : **12 tests passent**, aucun email réel.
- Compilation frontend : réussie en mode CI.
- Vérificateur indépendant : scénarios Mongo/HTTP, concurrence du dernier article, compensation, annulations répétées, reprise de journal et noms de comptes insensibles à la casse.
- Navigateur local, base fictive distincte : `BROWSERUSER` retrouve `BrowserUser`, panier conservé au rechargement, commande confirmée avec sélections par défaut, stock de 4 à 3, validation conservée au rechargement, suppression avec retour à 4, stock mis à zéro et bouton d'achat désactivé. Connexion de `browseradmin` également confirmée. Aucun paiement ni email réels.

## Limites importantes

La reprise du journal est conçue pour **une seule instance backend**, comme le déploiement Compose actuel. Elle ne remplace pas des transactions distribuées : les réservations multi-produits sont compensées et peuvent être temporairement visibles avant récupération. Une panne de base pendant la compensation peut nécessiter un redémarrage ; ne pas démarrer plusieurs instances sans coordination supplémentaire.

Des noms historiques ne différant que par la casse empêchent la création de l'index unique : le démarrage échoue avec un message explicite, sans fusion ou suppression automatique de comptes. Il faut résoudre ces collisions avant déploiement si elles existent.

L'audit frontend après mises à jour signale **74 paquets : 0 critique, 13 élevés, 50 modérés, 11 faibles**. Il s'agit d'alertes de dépendances, pas de 74 exploits démontrés. Les alertes restantes demandent notamment une migration de Create React App et une étude des nouvelles majeures du routeur ; aucune rétrogradation vers `react-scripts@0.0.0` ni mise à jour forcée n'a été appliquée. Le JSON correspondant est conservé dans ce dossier. Les comptes de l'audit sécurité précédent restent un état historique.

Le traitement réel d'un paiement, les fonctionnalités des microservices inactifs et une migration du serveur frontend de développement vers un hébergement statique restent hors de ce lot.
