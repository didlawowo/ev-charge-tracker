<script setup>
import { ref, provide } from 'vue'
import { useGeolocation } from './composables/useGeolocation'
import { useChargers } from './composables/useChargers'
import { useDestination } from './composables/useDestination'
import { useTripPlanner } from './composables/useTripPlanner'
import MapView from './components/MapView.vue'
import ListView from './components/ListView.vue'
import OptionsMenu from './components/OptionsMenu.vue'
import DestinationSearch from './components/DestinationSearch.vue'
import PwaInstallPrompt from './components/PwaInstallPrompt.vue'
import { version } from '../package.json'

const activeTab = ref('map')
const optionsOpen = ref(false)

const {
  position,
  heading,
  speed,
  error: geoError,
  permissionDenied,
  isTracking,
  startTracking
} = useGeolocation()

const {
  destination,
  destinationQuery,
  suggestions,
  isSearching,
  searchDestination,
  selectDestination,
  clearDestination
} = useDestination()

const {
  filteredChargers,
  loading,
  searchRadius,
  minPower,
  onlyCCS,
  excludeTesla,
  onlyOnRoute,
  avoidTolls,
  routeGeometry,
  routeInfo,
  alternativeRoutes,
  selectedRouteIndex,
  selectRoute,
  refreshChargers
} = useChargers(position, heading, destination)

const {
  autonomy,
  maxAutonomy,
  winterMode,
  roundTripMode,
  winterFactor,
  plannedStops,
  roundTripAnalysis,
  relevantChargers
} = useTripPlanner(filteredChargers, routeGeometry, routeInfo)

provide('position', position)
provide('heading', heading)
provide('speed', speed)
provide('chargers', relevantChargers)
provide('loading', loading)
provide('searchRadius', searchRadius)
provide('minPower', minPower)
provide('onlyCCS', onlyCCS)
provide('excludeTesla', excludeTesla)
provide('onlyOnRoute', onlyOnRoute)
provide('routeGeometry', routeGeometry)
provide('destination', destination)
provide('autonomy', autonomy)
provide('maxAutonomy', maxAutonomy)
provide('plannedStops', plannedStops)
provide('winterMode', winterMode)
provide('winterFactor', winterFactor)
provide('avoidTolls', avoidTolls)
provide('roundTripMode', roundTripMode)
provide('alternativeRoutes', alternativeRoutes)
provide('selectedRouteIndex', selectedRouteIndex)
provide('refreshChargers', refreshChargers)

startTracking()
</script>

<template>
  <div class="app">
    <header class="header">
      <h1>⚡ EV Finder <span class="version">v{{ version }}</span></h1>
      <div class="header-actions">
        <span v-if="speed > 0" class="speed">{{ Math.round(speed * 3.6) }} km/h</span>
        <button
          class="icon-btn"
          aria-label="Rafraîchir les bornes"
          :disabled="loading"
          @click="refreshChargers"
        >
          <span :class="{ spinning: loading }" aria-hidden="true">🔄</span>
        </button>
        <button
          class="icon-btn"
          aria-label="Options"
          :aria-expanded="optionsOpen"
          @click="optionsOpen = true"
        >
          <span aria-hidden="true">⚙️</span>
        </button>
        <span
          v-if="position"
          class="dot"
          :class="{ active: isTracking }"
          role="status"
          :aria-label="isTracking ? 'Suivi GPS actif' : 'Suivi GPS inactif'"
        />
      </div>
    </header>

    <OptionsMenu v-if="optionsOpen" @close="optionsOpen = false" />

    <DestinationSearch
      :destination="destination"
      :destination-query="destinationQuery"
      :suggestions="suggestions"
      :is-searching="isSearching"
      :route-info="routeInfo"
      :route-geometry="routeGeometry"
      :autonomy="autonomy"
      :max-autonomy="maxAutonomy"
      :round-trip-mode="roundTripMode"
      :round-trip-analysis="roundTripAnalysis"
      :planned-stops="plannedStops"
      :alternative-routes="alternativeRoutes"
      :selected-route-index="selectedRouteIndex"
      @search="searchDestination"
      @select="selectDestination"
      @clear="clearDestination"
      @update:autonomy="val => autonomy = val"
      @select-route="selectRoute"
    />

    <main class="content">
      <div v-if="permissionDenied" class="permission-help" role="alert">
        <h2>📍 Localisation désactivée</h2>
        <p>{{ geoError }}</p>
        <p class="permission-hint">
          Active la géolocalisation dans les paramètres de ton navigateur, puis clique sur Réessayer.
          Tu peux aussi saisir une destination ci-dessus pour planifier un trajet.
        </p>
        <button class="retry-btn" @click="startTracking">Réessayer</button>
      </div>
      <div v-else-if="geoError" class="error" role="alert" aria-live="assertive">
        {{ geoError }}
      </div>
      <div v-else-if="!position" class="loading" aria-live="polite">
        <div class="spinner" aria-hidden="true" />
        <p>Localisation en cours...</p>
      </div>
      <template v-else>
        <MapView v-show="activeTab === 'map'" />
        <ListView v-show="activeTab === 'list'" />
      </template>
    </main>

    <nav class="tabs" role="tablist" aria-label="Vue carte ou liste">
      <button
        role="tab"
        :aria-selected="activeTab === 'map'"
        :class="{ active: activeTab === 'map' }"
        @click="activeTab = 'map'"
      >
        Carte
      </button>
      <button
        role="tab"
        :aria-selected="activeTab === 'list'"
        :class="{ active: activeTab === 'list' }"
        @click="activeTab = 'list'"
      >
        Liste
      </button>
    </nav>

    <PwaInstallPrompt />
  </div>
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

:root {
  --primary: #10b981;
  --primary-dark: #059669;
  --bg: #0f172a;
  --bg-card: #1e293b;
  --text: #f8fafc;
  --text-muted: #94a3b8;
  --border: #334155;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: var(--bg);
  color: var(--text);
  overflow-x: hidden;
}

/* a11y : indicateur de focus clavier visible et cohérent */
:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
  border-radius: 4px;
}

button:focus:not(:focus-visible),
a:focus:not(:focus-visible),
input:focus:not(:focus-visible),
select:focus:not(:focus-visible) {
  outline: none;
}

/* a11y : respect des préférences de mouvement réduit */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}

.app {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  min-height: 100dvh;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  padding-top: calc(12px + env(safe-area-inset-top));
  background: var(--bg-card);
  border-bottom: 1px solid var(--border);
}

.header h1 {
  font-size: 1.25rem;
  font-weight: 600;
}

.version {
  font-size: 0.65rem;
  font-weight: 400;
  color: var(--text-muted);
  vertical-align: middle;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  font-size: 1.1rem;
  cursor: pointer;
  transition: border-color 0.2s;
}

.icon-btn:hover:not(:disabled) {
  border-color: var(--primary);
}

.icon-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.icon-btn .spinning {
  display: inline-block;
  animation: spin 1s linear infinite;
}

.speed {
  font-size: 0.875rem;
  color: var(--text-muted);
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ef4444;
}

.dot.active {
  background: var(--primary);
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.content {
  flex: 1;
  overflow: auto;
  position: relative;
  /* Garantir que la carte reste grande même avec un trajet + arrêts affichés */
  min-height: max(320px, 45dvh);
}

.loading, .error, .permission-help {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 16px;
  padding: 20px;
  text-align: center;
}

.error {
  color: #ef4444;
}

.permission-help h2 {
  font-size: 1.1rem;
  font-weight: 600;
}

.permission-help p {
  color: var(--text);
  max-width: 360px;
  line-height: 1.5;
}

.permission-help .permission-hint {
  color: var(--text-muted);
  font-size: 0.9rem;
}

.retry-btn {
  padding: 12px 20px;
  background: var(--primary);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 0.95rem;
  font-weight: 500;
  cursor: pointer;
  min-height: 44px;
}

.retry-btn:hover {
  background: var(--primary-dark);
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--border);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.tabs {
  display: flex;
  background: var(--bg-card);
  border-top: 1px solid var(--border);
  padding-bottom: env(safe-area-inset-bottom);
}

.tabs button {
  flex: 1;
  padding: 14px;
  border: none;
  background: none;
  color: var(--text-muted);
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s;
}

.tabs button.active {
  color: var(--primary);
  background: rgba(16, 185, 129, 0.1);
}
</style>
