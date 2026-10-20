# AGENTS.md

Guidance for coding agents (and humans) working on this repository.

## Commands

```bash
npm run dev      # Dev server with HMR
npm run build    # Production build to dist/
npm run preview  # Serve the production build locally
npm run lint     # ESLint over src/
npm run test     # Playwright end-to-end tests
```

Equivalent Task tasks exist in `Taskfile.yml` (`task dev`, `task lint`, `task ci`, …).

## Environment

Create a `.env` file from `.env.example`:

```env
VITE_OPENCHARGE_API_KEY=<your_api_key>
```

A free key is available from OpenChargeMap. Because this is a client-side
application, the value is inlined into the bundle at build time.

## Architecture

**Stack**: Vue 3 (Composition API) + Vite + Leaflet + PWA (Workbox).

### Data flow

`App.vue` is the root orchestrator that:

1. Instantiates all composables
2. Uses Vue's `provide()` to inject shared state to all descendants
3. Manages view switching between Map and List modes

### Composables (`src/composables/`)

| Composable | Purpose |
|------------|---------|
| `useGeolocation` | Real-time GPS tracking with `watchPosition()` |
| `useChargers` | Fetches from OpenChargeMap API, handles filtering and deduplication |
| `useDestination` | Address autocomplete via Photon/Komoot API |
| `useRoute` | Route calculation via OSRM |
| `useTripPlanner` | Greedy algorithm for optimal charging stops (accounts for winter consumption) |
| `useOfflineTrip` | Saves the last computed trip (routes + chargers) to localStorage, restores it offline or on "Reprendre" |
| `usePwaInstall` | Install prompt handling |

### Components (`src/components/`)

- **MapView**: Leaflet map, SVG / numbered stop markers, status pills (count, loading, offline)
- **StopsSheet**: Collapsible bottom sheet of recommended charging stops over the map
- **ListView**: Scrollable charger list with empty/error states
- **ChargerCard**: Charger card (power badge, distance, navigation links); tap opens it on the map
- **DestinationSearch**: Address search, remaining range chip, route summary, resume last trip
- **AutonomyEditor**: Bottom sheet to edit the remaining range (input, ±10, slider, % presets)
- **OptionsMenu**: Bottom sheet with vehicle, trip and charger filter options
- **PwaInstallPrompt**: Install prompt UI
- **AppIcon**: Inline SVG icon set (replaces emojis)

### External APIs

| API | Purpose | Cache Duration |
|-----|---------|----------------|
| OpenChargeMap | Charger data | 5 min (Workbox) |
| OSRM | Route calculation | 1 hour |
| Photon/Komoot | Address search | 1 day |
| OpenStreetMap | Map tiles (viewed only) | 7 days |

## Key implementation notes

- **Route-based charger fetching**: samples points every ~50 km along the route, fetches chargers near each point, then deduplicates
- **Trip planner algorithm**: Haversine distances, 10% safety margin, target charge level 80%
- **Winter mode**: consumption goes from 19 to 25 kWh/100 km (−24% effective range)
- **Connection type mapping**: handles both ID-based and title-based identification from OpenChargeMap
- **Offline support**: the last trip is persisted by `useOfflineTrip`; Workbox caches API responses (NetworkFirst) and viewed map tiles (CacheFirst, 7 days). Never pre-download tiles from `tile.openstreetmap.org`: forbidden by the OSM tile usage policy
- **Toll avoidance**: removed — the public OSRM server rejects `exclude=toll`

## Conventions

- UI icons are inline SVG through `AppIcon`; emojis are not used as icons.
- User-facing text is French; code identifiers and commit messages follow the
  surrounding style (Conventional Commits).
- Keep the mobile-first layout: safe-area insets, `100dvh`, tap targets ≥ 44 px.

## Deployment

The app is a static site. `netlify.toml` documents a Netlify deployment
(build `npm run build`, publish `dist/`, SPA redirects to `/index.html`). Any
static host able to serve an SPA works as well.
