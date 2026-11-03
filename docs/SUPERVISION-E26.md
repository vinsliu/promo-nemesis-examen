# Supervision E26 — préproduction et production

Configuration réalisée le 3 novembre 2026, vérifiée vers 15 h 49 (Europe/Paris).

## Instance

Uptime Kuma 2 fonctionne sur l'hôte Docker local, avec SQLite dans le volume
persistant `uptime-kuma-data`. Administration : http://localhost:3001.
Une seule instance surveille les deux environnements Render, organisés dans les
groupes Préproduction et Production. Aucun secret n'est recopié dans ce document.

## Sondes actives

| Groupe | Sonde | URL |
| --- | --- | --- |
| Préproduction | Frontend HTTPS | https://preprod.valneth.com |
| Préproduction | Backend et MongoDB | https://promo-nemesis-examen-backend-preprod.onrender.com/api/products |
| Préproduction | Gateway | https://promo-nemesis-examen-gateway-preprod.onrender.com/health |
| Préproduction | Notifications | https://promo-nemesis-examen-notifications.onrender.com/health |
| Production | Frontend HTTPS | https://www.valneth.com |
| Production | Backend et MongoDB | https://promo-nemesis-examen-backend-production.onrender.com/api/products |
| Production | Gateway | https://promo-nemesis-examen-gateway-production.onrender.com/health |
| Production | Notifications | https://promo-nemesis-examen-notifications-xeub.onrender.com/health |

Les huit sondes utilisent GET HTTPS, un intervalle de 60 secondes, deux nouvelles
tentatives et un délai de requête de 48 secondes pour tolérer les démarrages Render.
Les codes acceptés sont 200–299. La vérification TLS reste activée. Les sondes des
frontends activent également les notifications d'expiration du certificat.
Les corps des réponses d'erreur ne sont pas conservés pour les notifications.

Les huit sondes sont UP au contrôle final. Les premiers contrôles de gateway et
notifications en production ont renvoyé 503, puis 200 aux contrôles suivants.
Le tableau de bord compte dix éléments UP : huit sondes et deux groupes.

## Alertes et validation

Canal Resend « Alertes préprod et prod — contact@valneth.com », expéditeur
`Supervision Valneth <contact@valneth.com>`, destinataire `contact@valneth.com`.
La clé existante a été enregistrée dans Kuma avec l'accord explicite de
l'utilisateur. Le canal est activé par défaut pour les nouvelles sondes et son
association aux huit sondes a été vérifiée individuellement.

Validation sans arrêter les applications : une sonde HTTP avec mot-clé dédiée
« Validation E26 — test DOWN puis UP » a recherché une chaîne volontairement
absente du frontend de préproduction, puis le mot `Examen`, présent dans sa réponse.

- DOWN enregistré à 15:47:41.
- UP enregistré à 15:48:10.
- Trois emails confirmés `delivered` dans Resend : test du canal, DOWN et UP.
- La sonde de validation est ensuite mise en pause ; son historique est conservé.

Preuves : [tableau de bord](preuves-supervision/tableau-de-bord.png),
[test DOWN](preuves-supervision/test-down.png), [test UP](preuves-supervision/test-up.png).

## Exploitation et limites

Cette instance locale doit rester en fonctionnement avec Docker et l'ordinateur
allumés pour continuer la surveillance. Elle n'est pas hébergée sur un serveur
indépendant disponible en permanence. Le volume persiste après redémarrage ; ne
pas utiliser `docker compose down -v`. Une sauvegarde de ce volume contient des
secrets et doit rester hors du dépôt.

Les routes `/health` prouvent que le service HTTP répond, pas qu'un email métier
est effectivement livré. Le catalogue sollicite le backend et MongoDB, sans
mutation. Les sondes régulières peuvent maintenir les services Render gratuits
éveillés et consommer leurs quotas. Aucun microservice de stock incomplet n'est
exposé ou ajouté à la supervision distante.

Cette vérification remplace le constat « Kuma non configuré » du rapport historique
`CHECK-EXAMEN-E21-E29.md` pour E26,
sans modifier les conclusions des autres critères.
