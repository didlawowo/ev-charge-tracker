# Architecture

**Stack**: Vue 3 (Composition API) + Vite + Leaflet + PWA (Workbox).

## Data flow

`App.vue` is the root orchestrator that:

1. Instantiates all composables
2. Uses Vue's `provide()` to inject shared state to all descendants
3. Manages view switching between Map and List modes

## Composables (`src/composables/`)

| Composable | Purpose |
|------------|---------|
| `useGeolocation` | Real-time GPS tracking with `watchPosition()` |
| `useChargers` | Fetches from OpenChargeMap API, handles filtering and deduplication |
| `useDestination` | Address autocomplete via Photon/Komoot API |
| `useRoute` | Route calculation via OSRM |
| `useTripPlanner` | Greedy algorithm for optimal charging stops (accounts for winter consumption) |
| `useOfflineTrip` | Saves the last computed trip (routes + chargers) to localStorage, restores it offline or on "Reprendre" |
| `usePwaInstall` | Install prompt handling |
| `useRecentDestinations` | Last 10 destinations in localStorage, accent-insensitive matching |
| `useRouteAccess` | Checks directional road access to corridor chargers via the OSRM table API (one-way roads, motorway areas) |
| `useSeasonalWinterMode` | Winter mode on by default from 1 November to 31 March; manual choice kept for the current season only |
| `useStoredSetting` | localStorage-backed setting with default value and validation |

## Components (`src/components/`)

- **MapView**: Leaflet map, SVG / numbered stop markers, status pills (count, loading, offline)
- **StopsSheet**: Collapsible bottom sheet of recommended charging stops over the map
- **ListView**: Scrollable charger list with empty/error states
- **ChargerCard**: Charger card (power badge, distance, navigation links); tap opens it on the map
- **DestinationSearch**: Address search, remaining range chip, route summary, resume last trip
- **AutonomyEditor**: Bottom sheet to edit the remaining range (input, ±10, slider, % presets)
- **OptionsMenu**: Bottom sheet with vehicle, trip and charger filter options
- **PwaInstallPrompt**: Install prompt UI
- **AppIcon**: Inline SVG icon set (replaces emojis)

## External APIs

| API | Purpose | Cache Duration |
|-----|---------|----------------|
| OpenChargeMap | Charger data | 5 min (Workbox) |
| OSRM | Route calculation and directional access matrix | 1 hour |
| Photon/Komoot | Address search | 1 day |
| OpenStreetMap | Map tiles (viewed only) | 7 days |

## Implementation notes

- **Route-based charger fetching**: samples points every ~50 km along the route, fetches chargers near each point, then deduplicates
- **Trip planner algorithm**: Haversine distances, 10% safety margin, target charge level 80%
- **Winter mode**: consumption goes from 19 to 25 kWh/100 km (−24% effective range); seasonal default, see `useSeasonalWinterMode`
- **Connection type mapping**: handles both ID-based and title-based identification from OpenChargeMap
- **Offline support**: the last trip is persisted by `useOfflineTrip`; Workbox caches API responses (NetworkFirst) and viewed map tiles (CacheFirst, 7 days). Never pre-download tiles from `tile.openstreetmap.org`: forbidden by the OSM tile usage policy
- **Toll avoidance**: removed — the public OSRM server rejects `exclude=toll`
