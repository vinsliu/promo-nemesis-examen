# Frontend

Node.js 22.12+ requis. Installer les dépendances avec `npm ci`.

- `npm start` : serveur Vite sur http://localhost:3000.
- `npm test -- --runInBand` : tests Jest et React Testing Library.
- `npm run build` : version de production dans `build/` (inchangé pour Render).
- `npm run preview` : aperçu local de la compilation.
- `npm audit` : audit de toutes les dépendances, y compris les outils de développement.

`REACT_APP_API_BASE_URL` reste compatible avec les configurations existantes : définir cette variable avant la compilation. Par défaut : `http://localhost:5000/api`.

En Docker, l’API utilise `/api` et le proxy Vite cible `http://backend:5000` via `API_PROXY_TARGET`. `HOST` et `PORT` configurent le serveur de développement. Seule l’URL publique de l’API est incluse dans le bundle ; aucune autre variable du serveur n’est exposée.

Create React App a été remplacé par Vite ; Jest est configuré séparément. Les composants JSX utilisent désormais l’extension `.jsx`.

Les overrides npm de `glob` et `minimatch` imposent les versions corrigées aux outils Jest/Tailwind. `deepmerge` reste en 4.1.1, hors de la plage affectée (4.2.0–4.3.1), en attendant une correction amont. Les tests, leur instrumentation de couverture et la compilation valident ces versions.
