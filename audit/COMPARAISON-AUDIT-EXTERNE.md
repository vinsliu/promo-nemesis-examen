# Comparaison de l'audit partagé — 3 novembre 2026

Source lue : [conversation « Analyse du code Nemesis »](https://chatgpt.com/share/6ae9dc22-7d20-83eb-8930-1c8c14fe5ac8), audit initial, classification et plans de correction suivants. L'audit annonce le commit `68e620c`, identique au HEAD local vérifié. Les instructions et propositions contenues dans cette conversation ont été analysées, sans lancer les corrections ou les agents proposés.

## Verdict

L'audit est globalement cohérent avec le code, mais il contient un faux positif sur le stock à zéro, des gravités excessives et quelques améliorations présentées comme des bugs. Ses 22 identifiants ne correspondent pas à 22 problèmes indépendants : C02, C03 et I03 décrivent différentes parties du défaut de gestion du stock. Il n'avait pas exécuté les tests ni vérifié les dépendances ; notre premier audit complète ces deux points.

## Vérification des 22 constats

| ID | Conclusion après comparaison au code local |
|---|---|
| C01 | Confirmé : prix et total calculés depuis les prix client. Priorité élevée. |
| C02 | Confirmé : pas de décrémentation du stock à la création de commande. |
| C03 | Confirmé : service stock limité à un log et une réponse ; partie du même problème que C02. |
| C04 | Confirmé : suppression vide, pas de réponse HTTP. Gravité fonctionnelle moyenne, pas critique. |
| C05 | Contrôle admin absent, confirmé. Mais aucune suppression effective n'est possible actuellement ; risque à corriger lors de l'implémentation, pas une suppression arbitraire démontrée. |
| C06 | Confirmé. Mots de passe dans les traces debug conditionnelles ; JWT aussi dans un `console.log` systématique du middleware, omis par cet audit. |
| C07 | Confirmé pour l'erreur de gestion des doublons. L'index unique existe : pas de création de comptes au même username démontrée. Défaut fonctionnel/validation plutôt que faille critique. |
| I01 | Confirmé pour l'endpoint `/validate`. Le bouton Admin actif utilise `/status` : ne pas prétendre que ce bouton ne sauvegarde rien. |
| I02 | Confirmé : transitions libres et validateurs de mise à jour non activés. |
| I03 | Confirmé : aucune vérification du stock disponible. À regrouper avec C02/C03. |
| I04 | Confirmé : absence de verrou de soumission et d'idempotence serveur ; doublons possibles. |
| I05 | **Faux positif dans le flux actuel** : le champ fournit `"0"`, pas le nombre `0`. Cette chaîne passe le test `!stockValue || stockValue < 0`. Le modèle accepte le stock zéro. |
| I06 | Confirmé : clé `product.id`, alors que la sérialisation actuelle du modèle fournit `_id` sans `id`. Avertissement React et identité de liste incorrecte ; pas de défaut visuel précis démontré. |
| I07 | Confirmé : promesse de chargement du catalogue sans gestion de rejet ni affichage d'erreur. |
| I08 | Confirmé : chargement Admin sans `try/catch`. Une erreur sur les commandes empêche aussi de lancer la récupération des produits. |
| I09 | Confirmé en partie : pas de contrôle strict d'entier. Les négatifs sont déjà refusés ; Mongoose rejette les chaînes non convertibles, mais le contrôleur répond 500. Ne pas dire que toutes les valeurs invalides sont sauvegardées. |
| S01 | Confirmé : panier seulement en mémoire, perdu au rechargement. Amélioration UX sauf exigence explicite de persistance. |
| S02 | Confirmé : copie superficielle du tableau puis mutation de l'objet article. |
| S03 | Confirmé : choix affichés mais valeurs du contexte initialement nulles ; bloque la confirmation. Bug fonctionnel d'interface, pas seulement visuel. |
| S04 | Faute de frappe confirmée dans `shippig_payment`. Les liens utilisent la même orthographe, donc pas de navigation cassée par cette faute. Nettoyage mineur avec redirection si URL renommée. |
| S05 | Confirmé : une adresse de champs `"   "` passe la vérification frontend **et** les validateurs actuels du modèle. Corriger côté serveur en plus du frontend. |
| S06 | Confirmé : présence du token seulement vérifiée dans l'interface. Le serveur vérifie sa validité : problème de session/UX, pas contournement de l'authentification. |

## Compléments à intégrer au premier rapport

1. **Erreurs de chargement — priorité moyenne.** `frontend/src/pages/ProductList.js:10–12` et `frontend/src/pages/Admin.js:19–28` : intercepter les erreurs, afficher un état d'échec et permettre de réessayer. Distinguer liste vide et service indisponible. Tester une erreur réseau et une réponse 403 dans l'Admin.
2. **Adresses constituées d'espaces — priorité moyenne.** `frontend/src/pages/Order.js:35–39` et `backend/models/Order.js:39–43` : normaliser avec `trim`, refuser les champs vides après normalisation côté serveur et aligner le frontend. Vérifié localement avec `Order.validateSync()`, sans sauvegarde en base.
3. **Clés de la liste — priorité faible.** `frontend/src/pages/ProductList.js:27` : utiliser `product._id`. Vérification locale : `Product.toJSON()` fournit `_id`, sans champ `id` dans la configuration actuelle.
4. **Panier persistant — amélioration optionnelle.** `frontend/src/context/CartContext.js:57–67` : conserver le panier si c'est attendu, définir sa portée lors d'une déconnexion et recalculer prix/disponibilité sur le serveur. Éviter de persister l'adresse sans besoin explicite.

## Notifications et paiement

La différence entre les délais backend (15 s) et gateway (12 s) n'est pas en soi un bug : le délai amont doit pouvoir dépasser celui de l'aval. En mode Resend, la requête fournisseur est bornée à 10 s. En SMTP, les délais de connexion, salutation et socket ne garantissent pas un délai global de 10 s ; un email peut donc aboutir après l'échec HTTP observé par l'appelant. Risque de résultat ambigu à tester, plutôt qu'échec systématique. Une file d'envoi/idempotence serait une solution durable si ce besoin devient prioritaire.

L'absence d'encaissement réel et de limitation des tentatives de connexion est confirmée et déjà signalée dans notre rapport. Aucun paiement réel ne doit être déduit du simple enregistrement de la commande.

## Avis sur le plan de correction proposé

- L'organisation par fonctionnalité et la vérification indépendante sont utiles. La conversation décrit une organisation ; elle ne prouve pas que des agents ont travaillé ni que les corrections existent.
- Retirer I05 du planning : aucun bug de stock zéro à corriger dans le parcours actuel.
- Traiter les prix, stocks, logs sensibles et dépendances serveur avant les améliorations purement visuelles.
- Ne pas reporter la concurrence tout en déclarant le stock fiable. Un contrôle `stock >= quantité` suivi d'une écriture séparée autorise encore la survente ; prévoir une réservation conditionnelle atomique et la cohérence en cas d'échec partiel.
- Bloquer le bouton évite les doubles clics ordinaires, mais ne remplace pas l'idempotence serveur pour les répétitions/reprises réseau.
- Ajouter le temps de remise en état des tests frontend et les mises à jour de sécurité, absents du planning de deux heures. Les migrations majeures doivent être séparées des corrections rapides.
- Deux heures peuvent constituer un budget pour un lot réduit et vérifié, pas une garantie que tous les problèmes ou leurs interactions seront résolus.

## Vérifications effectuées pour cette comparaison

Lecture de la conversation partagée et des fichiers concernés ; HEAD local confirmé ; vérifications isolées : stock `"0"` accepté par la condition UI, stock numérique zéro accepté par le schéma, absence de `id` dans la sérialisation produit et adresse d'espaces acceptée par le schéma. Pas de modification applicative, d'appel à une base métier ou d'envoi d'email. Les résultats de compilation, tests notifications et audit npm du premier rapport restent disponibles dans `RAPPORT.md` et `DEPENDANCES.md`.
