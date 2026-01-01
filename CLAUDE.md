# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
npm run dev      # Start development server with HMR
npm run build    # Production build to /dist
npm run preview  # Preview production build locally
```

## Environment Setup

Create `.env` file with:
```
VITE_OPENCHARGE_API_KEY=<your_api_key>
```
Get a free API key from OpenChargeMap.

## Architecture Overview

**Stack**: Vue 3 (Composition API) + Vite + Leaflet + PWA (Workbox)

### Data Flow

App.vue is the root orchestrator that:
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
| `useTileCache` | Offline map tile pre-downloading |

### Components (`src/components/`)

- **MapView**: Leaflet integration with custom emoji-based markers
- **ListView**: Scrollable charger list
- **ChargerCard**: Individual charger display with distance, power, operator
- **FilterBar**: Controls for radius, power, CCS toggle, route filtering
- **DestinationSearch**: Route planning interface with address search

### External APIs

| API | Purpose | Cache Duration |
|-----|---------|----------------|
| OpenChargeMap | Charger data | 5 min (Workbox) |
| OSRM | Route calculation | 1 hour |
| Photon/Komoot | Address search | 1 day |
| OpenStreetMap | Map tiles | 30 days |

## Key Implementation Notes

- **Route-based charger fetching**: Samples points every ~50km along route, fetches chargers near each point, then deduplicates
- **Trip planner algorithm**: Uses Haversine distances, enforces 10% safety margin, targets 80% charge level
- **Winter mode**: Adjusts consumption from 19 to 25 kWh/100km (-24% effective range)
- **Connection type mapping**: Handles both ID-based and title-based identification from OpenChargeMap
- **Offline support**: Workbox caches API responses (NetworkFirst) and map tiles (CacheFirst)

## Deployment

Configured for Netlify deployment (see `netlify.toml`). SPA routing redirects all paths to `/index.html`.
