# Audit npm — 3 novembre 2026

Résultats de `npm audit --json --package-lock-only` et `npm outdated --json`, sans installation ni correction. Les JSON voisins contiennent les avis, plages affectées et versions interrogées.

| Composant | Critiques | Élevées | Modérées | Faibles | Total |
|---|---:|---:|---:|---:|---:|
| root | 0 | 0 | 3 | 0 | 3 |
| backend | 3 | 5 | 2 | 0 | 10 |
| frontend | 4 | 36 | 15 | 19 | 74 |
| gateway | 1 | 3 | 1 | 0 | 5 |
| microservices-notifications | 1 | 4 | 1 | 0 | 6 |
| microservices-stock-management | 1 | 3 | 1 | 0 | 5 |
| microservices-auth-gateway | 1 | 3 | 1 | 0 | 5 |

Les comptes portent sur des paquets signalés, incluent les dépendances transitives et se recoupent entre composants. Ils ne constituent pas un nombre de failles exploitables dans cette application. Le frontend inclut les outils de compilation et de développement, présents aussi dans son conteneur actuel.
