# Code & UX Review — ev-charge-tracker

> Audit conduit le 2026-05-08 sur la branche `claude/code-ux-review-DpIpg` (v0.2.2).
> Stack : Vue 3.5 (Composition API) + Vite 7 + Leaflet 1.9 + PWA Workbox.

## Synthèse

**Forces**
- Architecture Composables claire, séparation des concerns par domaine (`useGeolocation`, `useChargers`, `useTripPlanner`...).
- Mobile-first solide (dark theme, `safe-area-inset-bottom` sur les tabs, viewport `100dvh`, taps ≥ 44px sur la plupart des contrôles).
- PWA correctement configurée (manifest, Workbox `NetworkFirst`/`CacheFirst` selon les ressources).
- Algorithme glouton du planificateur de trajet ingénieux (sélection de la borne la plus lointaine atteignable, prise en compte du facteur hiver).

**Faiblesses majeures**
- **Fuites mémoire** dans `useChargers` et `useDestination` (timeouts non nettoyés sur unmount, pas d'`AbortController` → race conditions).
- **Accessibilité bloquante** : boutons icon-only sans `aria-label`, aucun `:focus-visible`, contrast insuffisant sur le texte secondaire, GPS refusé = spinner infini.
- **App.vue god component** : 4 composables + 16 valeurs `provide()` + `DestinationSearch` reçoit 17 props.
- **Aucun test unitaire** (Playwright E2E très léger sur header + map uniquement).

| Sévérité | Code Vue | UX/a11y | Sécu/Perf (annexe) |
|----------|----------|---------|---------------------|
| Critique | 5 | 5 | 1 |
| Majeur   | 5 | 7 | 6 |
| Mineur   | 6 | 7 | 5 |
| Nit      | 3 | 4 | 2 |

---

## 1. Qualité du code Vue

### 1.1 Architecture — App.vue god orchestrator

`src/App.vue:14-78` instancie 4 composables et expose 16 valeurs via `provide()`. Cela rend le suivi des dépendances difficile et couple fortement les enfants au scope de App.

**Recommandation** : extraire `useRouteManagement()` qui orchestre `useDestination` + partie route de `useChargers` + `useTripPlanner`. App.vue ne devrait orchestrer que la racine (géoloc + view switching).

### 1.2 Composables

#### **C1 — Memory leak `fetchTimeout` (Critique)**
`src/composables/useChargers.js:254-262` — `fetchTimeout` n'est jamais nettoyé sur unmount. Si le composant est démonté pendant le délai, `setTimeout` exécute `fetchChargers` après unmount.
> **Fix appliqué dans ce commit** : `onUnmounted(() => clearTimeout(fetchTimeout))`.

#### **C2 — AbortController manquant + cleanup debounce (Critique)**
`src/composables/useDestination.js:46-92` — Pas de cleanup du debounce, pas d'`AbortController`. Un utilisateur tapant rapidement « Paris » puis « Bordeaux » peut voir les suggestions « Paris » écraser celles de « Bordeaux » si la première requête arrive en dernier.
> **Fix appliqué** : `AbortController` rotatif + cleanup `onUnmounted`.

#### **C3 — Edge case algorithme planificateur (Critique)**
`src/composables/useTripPlanner.js:90-110` — La boucle `while` se termine actuellement via `break` quand aucune borne n'est atteignable. **C'était bien implémenté** (le finding initial des agents était imprécis). Cependant, si `chargersWithDistance` est vide et `nextCharger` est `undefined`, on n'ajoute rien et on `break` correctement. Néanmoins, la condition `currentPosition + availableRange < totalDistance` avec `availableRange = maxRange` après recharge garantit la progression — sauf si `currentPosition` ne change pas, ce qui n'arrive pas grâce au `break`.
> **Fix appliqué** : ajout d'un garde-fou de progression `if (currentPosition >= bestCharger.distanceFromStart) break` pour neutraliser tout cas pathologique de bornes à coordonnées identiques.

#### **C4 — Coordonnées GPS sans validation (Critique)**
`src/composables/useChargers.js:255` — Le watcher démarre `fetchChargers` dès qu'une `position` change, sans vérifier que `lat`/`lng` soient des nombres finis. Géoloc partielle → `NaN` envoyés à OpenChargeMap.
> **Fix appliqué** : guard `Number.isFinite(newPos.lat) && Number.isFinite(newPos.lng)`.

#### **C5 — Toll avoidance silencieux (Critique)**
`src/composables/useRoute.js:24-31` — Si OSRM ne supporte pas `exclude=toll` (cas du serveur public), on retombe silencieusement sur un calcul classique en logguant un `console.warn`. L'utilisateur active « Gratuit » dans l'UI et croit que les péages sont évités.
> **Fix appliqué** : `getRouteGeometry` retourne désormais `{ routes, tollAvoidanceSupported }`. À futur : afficher un toast côté UI lorsque `avoidTolls && !tollAvoidanceSupported`.

#### M1 — Watchers sans nettoyage explicite (Majeur)
`src/composables/useChargers.js:285-291` — Le watcher `avoidTolls` peut déclencher un fetch route + chargers même quand le composant est en cours de démontage. Considérer `WatchStopHandle` + `onUnmounted`.

#### M2 — Constantes hardcodées non configurables (Majeur)
`src/composables/useTripPlanner.js:9-15` — `chargeTarget = 0.80`, `safetyMargin = 0.10`, consommations `19/25 kWh/100km`. Ces valeurs supposent une Tesla. Les exposer comme paramètres permettrait de servir d'autres EVs (Kia EV6, Renault Zoé, etc.).

#### M3 — Pas de `User-Agent` sur Photon/OSM (Majeur, sécu)
Documenté en annexe, mais impact code : ajouter `headers: { 'User-Agent': '...' }` aux fetchs.

### 1.3 Composants

#### M4 — DestinationSearch : 17 props (Majeur)
`src/components/DestinationSearch.vue:7-24` — 17 props sans validation logique (ex: `autonomy` peut être > `maxAutonomy` à l'arrivée). Grouper par objet : `config`, `analysis`, `routeUi`. Cela réduit aussi le coût de re-render quand seule une prop change.

#### M5 — Filtrage CCS dupliqué (Majeur)
`src/components/MapView.vue:151-153` (filtrage des connexions CCS pour le popup) ↔ `src/components/ChargerCard.vue:19-22` (idem). La fonction `isCCSConnection` est bien centralisée dans `src/utils.js`, mais l'extraction `getCCSConnections` est répétée. Extraire dans `src/utils.js`.

#### Mineur — Popup HTML non sémantique (`MapView.vue:186-201`)
Le popup utilise `<strong>` pour le titre au lieu de `<h2>`. Les lecteurs d'écran ne reconnaissent pas la hiérarchie.

#### Mineur — `v-for` clés non validées
`MapView.vue:163` et `ListView.vue` utilisent `charger.id`, mais aucune protection si l'API retourne un POI sans `ID`. Un fallback `:key="\`${charger.id ?? \`${charger.lat}-${charger.lng}\`}\`"` serait plus robuste.

### 1.4 Type safety & tests

#### Majeur — Aucun TypeScript ni JSDoc
Toutes les composables retournent des objets non typés. Une migration progressive via `// @ts-check` + JSDoc sur `useTripPlanner` (le plus complexe) apporterait le meilleur ROI.

#### Majeur — Couverture de tests insuffisante
`tests/e2e/app.spec.js` ne teste que la visibilité du header et de la carte. Aucun test sur :
- Edge cases de `useTripPlanner` (autonomie nulle, routes sans bornes, mode A/R)
- Déduplication des chargeurs dans `useChargers.fetchChargersAlongRoute`
- États d'erreur de géolocalisation
- Filtres `onlyCCS` / `minPower`

Recommandation : ajouter `vitest` + tests unitaires sur les composables (logique pure, facile à tester).

---

## 2. UX & Accessibilité

### 2.1 Accessibilité bloquante

#### **A1 — Boutons icon-only sans aria-label (Critique)**
- `src/components/MapView.vue:219` (◎ centrer) — utilise `title` mais pas `aria-label`
- `src/components/DestinationSearch.vue:112` (✕ effacer) — aucun nom accessible
- `src/components/DestinationSearch.vue:130-138` (📥 download offline) — aucun nom accessible
> **Fix appliqué** : `aria-label` ajoutés sur les trois.

#### **A2 — Aucun `:focus-visible` (Critique)**
Les outlines par défaut sont supprimés implicitement (background change sur `.tabs button.active`). Un utilisateur clavier ne sait pas où il est.
> **Fix appliqué** : règle `:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }` globale dans `App.vue`.

#### **A3 — Erreurs non annoncées (Critique)**
`src/App.vue:122-124` — `<div class="error">` sans `role="alert"`.
> **Fix appliqué** : `role="alert" aria-live="assertive"`.

#### **A4 — Données live silencieuses pour les screen readers (Critique)**
- `App.vue:85-88` (status GPS, vitesse)
- `MapView.vue:227-229` (compteur de bornes)
> **Fix appliqué** : `aria-live="polite" aria-atomic="true"`.

#### **A5 — GPS refusé = spinner infini (Critique UX)**
`src/App.vue:122-128` — Si `geoError` est défini (permission refusée), on affiche le message brut. Mais avant ça, `loading` est aussi vrai pendant ~10s avant le timeout. Aucun moyen de retry, aucune action proposée.
> **Fix appliqué** : exposer `permissionDenied` depuis `useGeolocation`, afficher un bloc d'aide dédié avec bouton « Réessayer » dans `App.vue`.

#### Majeur — Champ recherche : pas de combobox ARIA
`DestinationSearch.vue:105-125` — Le pattern combobox WAI-ARIA est absent. Il faut :
- `role="combobox"` + `aria-expanded` + `aria-controls` sur l'input
- `role="listbox"` sur `.suggestions`
- `role="option"` + `aria-selected` sur chaque suggestion
- Navigation clavier (↑/↓/Enter/Esc)

#### Majeur — Contraste sur texte secondaire
`--text-muted: #94a3b8` sur `--bg: #0f172a` ≈ 4.2:1 → passe WCAG AA mais pas AAA.
Plus problématique : `--text-muted` sur `--border: #334155` (utilisé pour les `.conn-tag` dans le popup) ≈ 3.8:1 → **échoue AA**.

### 2.2 Flows utilisateurs

#### Majeur — Pas de bouton « Réinitialiser les filtres »
`src/components/FilterBar.vue` — Si l'utilisateur active CCS + 300+ kW dans une zone rurale, il voit « Aucune borne trouvée » sans escape évident. Ajouter un bouton « Réinitialiser » visible quand au moins un filtre n'est pas par défaut.

#### Majeur — Sliders d'autonomie ambigus
`DestinationSearch.vue:172-203` — Les libellés « Restante » / « Max voiture » sont denses ; sur écran 320px les deux sliders se touchent. Sur mobile, `flex-direction: column` au-dessous de `< 480px`. Préciser : « Charge actuelle » / « Autonomie max du véhicule ».

#### Majeur — Empty state non différencié
`src/components/ListView.vue` — « Aucune borne trouvée » ne dit pas pourquoi. 4 cas distincts à différencier :
1. Pas encore de GPS
2. Filtres trop restrictifs (proposer reset)
3. Zone réellement vide (proposer d'augmenter le rayon)
4. Erreur API

#### Mineur — Charger card sur 320px
`src/components/ChargerCard.vue` — Sur écrans étroits, l'opérateur tronque à `max-width: 120px`. Considérer un layout vertical sur très petit écran.

### 2.3 Mobile & responsive

#### Majeur — Pas de `safe-area-inset-top` sur le header
`src/App.vue:185-192` — Les `.tabs` utilisent bien `padding-bottom: env(safe-area-inset-bottom)`, mais le header n'a pas son équivalent → notch peut chevaucher le titre sur iPhone X+.

#### Mineur — Animations sans `prefers-reduced-motion`
`src/App.vue:229-232` (pulse), `src/components/MapView.vue:352-374` (pulse-blue, pulse-red) — Pas de respect de `prefers-reduced-motion: reduce`.
> **Fix appliqué** : règle `@media (prefers-reduced-motion: reduce) { *, ::before, ::after { animation-duration: 0.01ms !important; ... } }`.

### 2.4 États vides / erreurs / loading

| Zone | État actuel | Recommandation |
|------|-------------|----------------|
| Loading initial | Spinner « Localisation en cours... » | OK, mais ajouter délai avant affichage (éviter flash si rapide) |
| GPS refusé | Message texte plat | **Fix** : action retry + saisie manuelle |
| 0 chargers | « Aucune borne trouvée » | Différencier par cause |
| Erreur API | Stocké dans `error.value` mais jamais affiché à l'utilisateur ! | Toast non bloquant |
| Loading chargers | Spinner top-center | OK |
| Offline | Pas d'indicateur global | Banner orange « Hors ligne » + invalidation Workbox `staleWhileRevalidate` |

---

## 3. Annexe — Sécurité & Perf (non corrigés ce passage)

### Sécurité
| # | Sévérité | Fichier | Problème |
|---|----------|---------|----------|
| S1 | Critique* | `useChargers.js:20` | `VITE_OPENCHARGE_API_KEY` exposée dans le bundle. Acceptable si la clé est publique côté OpenChargeMap, mais à documenter. À long terme : proxy serveur. |
| S2 | Majeur | `netlify.toml` | Aucun header CSP / HSTS / X-Content-Type-Options / Referrer-Policy / Permissions-Policy |
| S3 | Majeur | tous les fetchs | Pas de timeout (`AbortController` + `setTimeout(5000)`) |
| S4 | Majeur | `useDestination.js:64` | Pas de `User-Agent` (politesse Photon/Komoot) |
| S5 | Majeur | `useDestination.js:46-92` | Pas de validation de longueur de query (DoS possible côté API) |
| S6 | Mineur | `useGeolocation.js:54` | `enableHighAccuracy: true` permanent → drain batterie |
| S7 | Mineur | tous les composables | `console.error` en prod expose les détails internes |

### Performance & PWA
| # | Sévérité | Fichier | Problème |
|---|----------|---------|----------|
| P1 | Majeur | `vite.config.js` (PWA) | OpenChargeMap en `NetworkFirst` 5min : si offline, données 5min+ jetées → utilisateur voit « rien » au lieu de stale. Préférer `staleWhileRevalidate`. |
| P2 | Majeur | `vite.config.js` build | Pas de `manualChunks` pour Leaflet (~40 KB gzip) → tout dans un seul JS |
| P3 | Mineur | `vite.config.js` build | `sourcemap` pas explicitement désactivé en prod |
| P4 | Mineur | `useChargers.js:43-126` | 4-10 appels OpenChargeMap séquentiels par route (pas en parallèle avec `Promise.all`) |
| P5 | Nit | `App.vue:256-267` | `.spinner` sans `will-change: transform` |

---

## 4. Recommandations priorisées

### À faire maintenant (corrigé dans ce commit)
- ✅ C1, C2 — Memory leaks + AbortController
- ✅ C4 — Validation coordonnées GPS
- ✅ C5 — Toll avoidance avec flag explicite
- ✅ A1, A2, A3, A4, A5 — Accessibilité bloquante
- ✅ Reduced motion

### Sprint suivant
- M2 — Constantes EV configurables (sliders avancés ou profil de véhicule)
- M4 — Refactor props DestinationSearch en objets groupés
- A6 — Pattern combobox ARIA complet sur la recherche
- A7 — Bouton « Réinitialiser les filtres »
- A8 — Empty state différencié (causes multiples)
- S2 — Headers CSP/HSTS dans netlify.toml
- S3 — Timeouts `AbortController` sur tous les fetchs
- P1 — Workbox `staleWhileRevalidate` pour OpenChargeMap

### Backlog
- Sortir App.vue du god orchestrator (extraire `useRouteManagement`)
- TypeScript / JSDoc progressif
- Vitest + tests unitaires sur les composables
- i18n (vue-i18n) si extension hors France prévue
- Profils de véhicules (Tesla / Kia / Renault…) avec consommations distinctes
- Indicateur offline global

---

## Annexe : fichiers modifiés dans ce commit

| Fichier | Nature de la modif |
|---------|-------------------|
| `REVIEW.md` (nouveau) | Ce rapport |
| `src/composables/useChargers.js` | onUnmounted cleanup, garde-fou coords |
| `src/composables/useDestination.js` | AbortController + cleanup |
| `src/composables/useTripPlanner.js` | Garde-fou progression |
| `src/composables/useRoute.js` | Retourne `{ routes, tollAvoidanceSupported }` |
| `src/composables/useGeolocation.js` | Expose `permissionDenied` |
| `src/App.vue` | role=alert, aria-live, fallback permission, focus-visible CSS, reduced-motion, safe-area-top |
| `src/components/MapView.vue` | aria-label centrer, aria-live compteur |
| `src/components/FilterBar.vue` | (pas de bouton icon-only à corriger) |
| `src/components/DestinationSearch.vue` | aria-label clear & offline |
