# Corrections de sécurité — 3 novembre 2026

Ce document décrit le premier lot. Voir [les corrections fonctionnelles suivantes](CORRECTIONS-FONCTIONNELLES.md) pour les bugs désormais corrigés et la politique d'inscription actuelle.

Travail réalisé avec deux agents : un correcteur et un vérificateur indépendant, coordonnés par l'agent principal. Les corrections sont destinées à la branche `dev` uniquement. L'audit initial reste un état de référence avant corrections.

## 1. Authentification — corrigé et vérifié

- Validation des types et longueurs avant toute recherche MongoDB : objets/opérateurs rejetés.
- Messages et codes 401 identiques pour compte absent et mot de passe incorrect ; comparaison bcrypt aussi pour les comptes absents.
- Doublons username/email traités par recherche et gestion de l'erreur d'index unique, y compris en concurrence.
- Nouvelles inscriptions : mot de passe entre 8 et 72 octets UTF-8 ; connexion des comptes historiques avec mot de passe court préservée.
- JWT : algorithme HS256 explicite, identifiant et rôle contrôlés, refus si secret absent. Les jetons émis expirent après une heure.
- Logs de mots de passe, hashes et JWT retirés.
- Limites mémoire : 20 appels de connexion et 10 inscriptions par adresse réseau et fenêtre de 15 minutes ; 429 et Retry-After.

Limite connue : derrière le proxy frontend Docker/reverse proxy, le quota est partagé entre ses utilisateurs. Le stockage est local au processus ; une production multi-instance demande un limiteur partagé et une configuration explicite des proxies de confiance. Aucun en-tête client de forwarding n'est accepté comme preuve d'adresse.

## 2. Commandes — sécurité corrigée et vérifiée

- Le prix client et le total client sont ignorés : lecture des prix catalogue en base et calcul borné en centimes.
- Identifiants, quantités entières positives, doublons de lignes produit et montants non finis/hors précision sûre contrôlés.
- Produits inexistants refusés ; adresse normalisée et bornée ; champs composés d'espaces et méthodes inconnues refusés.
- Identifiant utilisateur issu du JWT ; rôle/statut/utilisateur transmis par le client ne modifient pas le contexte de création.
- DELETE réservé aux administrateurs. Son implémentation métier reste à faire.
- Statut limité aux valeurs du schéma, avec validateurs Mongoose de mise à jour activés.
- Journaux des commandes, adresses et tokens retirés. Les erreurs Axios frontend ne sont plus journalisées en entier, car leur configuration peut contenir des secrets.
- Erreurs des lectures commandes/catalogue interceptées pour éviter des rejets async non gérés.

## 3. Administration du stock — validation corrigée et vérifiée

- Stock entier sûr, positif ou nul ; identifiant produit validé.
- Chaînes numériques du formulaire acceptées, dont `"0"` ; null, booléens, objets, tableaux, espaces, décimales et valeurs négatives refusés avec 400.
- Validation défensive des quantités et prix des lignes de commande, et du stock du modèle produit.

## 4. Dépendances

| Composant | Modifications principales | Paquets signalés après audit npm |
|---|---|---:|
| backend | Axios 1.21.0, Express 4.22.3, Mongoose 8.24.8, jsonwebtoken 9.0.3, proxy-addr 2.0.8 | 0 |
| gateway | Express 4.22.3, express-http-proxy 2.1.2, proxy-addr 2.0.8 | 0 |
| notifications | Express 4.22.3, Nodemailer 10.3.1, body-parser 1.20.9, proxy-addr 2.0.8 | 0 |
| stock-management | Express 4.22.3, proxy-addr 2.0.8 | 0 |
| auth-gateway | Express 4.22.3, proxy-addr 2.0.8 | 0 |
| frontend | Axios 1.21.0 | 72 |

Fichiers package.json et package-lock.json actualisés. Résultats bruts : `npm-audit-apres-*.json`. Zéro alerte npm ne constitue pas une certification de sécurité.

**À traiter séparément :** les 72 signalements frontend restants (4 critiques, 35 élevés, 14 modérés, 19 faibles) concernent React Router et la chaîne historique Create React App et ses transitives. Leur exploitabilité dépend des fonctionnalités/configurations utilisées ; ils ne sont pas tous des failles accessibles dans la SPA. Aucune migration majeure du routeur ou du build n'a été faite dans ce lot. Les 3 signalements modérés des outils de lancement à la racine restent également ouverts ; leur audit initial est conservé. Le frontend Docker utilise toujours le serveur de développement.

## Vérifications

- `npm --prefix backend test` : **22 tests passent** (12 auth, 10 commandes/stock). Les notifications y sont explicitement simulées indépendamment de la configuration.
- `node --test microservices/notifications/index.test.js` : **12 tests passent** après mise à jour Nodemailer, sans email réel.
- Vérification Nodemailer réelle avec transport mémoire : composition du message MIME réussie, sans connexion SMTP.
- Vérificateur indépendant : scénarios réels sur base MongoDB temporaire dédiée et HTTP local. Inscription/hash/login, doublons concurrents, comptes existants, JWT, prix falsifiés, entrées invalides, droits DELETE/statuts, stock zéro et persistance confirmés.
- Compilation frontend après mise à jour Axios : réussie, avec avertissements existants de la chaîne CRA et variable inutilisée. La suite Jest frontend reste un défaut connu de l'audit initial ; elle n'est pas annoncée comme corrigée.
- `git diff --check` : propre.

Les essais utilisent une base temporaire sur un port distinct, sans accès aux données métier ni envoi d'email. Le serveur MongoDB de test a été arrêté après validation. Les tests n'incluent pas de reconstruction des conteneurs Node 22 ; exécution locale sous Node 24.22.1.

## Prochains lots fonctionnels

Restent ouverts : suppression administrative sans réponse, endpoint de validation fictif, réservation/décrémentation atomique du stock et cohérence multi-produit, idempotence des commandes, transitions métier, sélecteurs livraison/paiement et défauts de l'interface. La vérification de l'énumération des statuts ne remplace pas une machine de transitions métier.

Les anciens contrôleurs `adminController.js` ne sont toujours pas montés : ne pas les réactiver sans aligner leurs validations sur les endpoints corrigés. Le microservice stock reste une route factice sans authentification, non exposée par la gateway active ; il ne doit pas être activé publiquement avant sécurisation.
