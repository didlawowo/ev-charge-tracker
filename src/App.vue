<script setup>
import { ref, provide, computed } from 'vue'
import { useGeolocation } from './composables/useGeolocation'
import { useChargers } from './composables/useChargers'
import { useDestination } from './composables/useDestination'
import { useTripPlanner } from './composables/useTripPlanner'
import { useOfflineTrip } from './composables/useOfflineTrip'
import MapView from './components/MapView.vue'
import ListView from './components/ListView.vue'
import OptionsMenu from './components/OptionsMenu.vue'
import DestinationSearch from './components/DestinationSearch.vue'
import PwaInstallPrompt from './components/PwaInstallPrompt.vue'
import AppIcon from './components/AppIcon.js'

// Raccourcis PWA du manifest : /?view=map et /?view=list
const initialView = new URLSearchParams(window.location.search).get('view') === 'list' ? 'list' : 'map'
const activeTab = ref(initialView)
const optionsOpen = ref(false)
const focusStop = ref(null)

// Clic sur un arrêt ou une borne de la liste : basculer sur la carte et la centrer dessus
const focusOnMap = (charger) => {
  activeTab.value = 'map'
  focusStop.value = { ...charger } // nouvel objet à chaque clic pour re-déclencher le watch
}

const openOptions = () => {
  optionsOpen.value = true
}

const {
  position,
  heading,
  speed,
  error: geoError,
  permissionDenied,
  isTracking,
  signalLost,
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
  chargers: rawChargers,
  filteredChargers,
  loading,
  error: chargersError,
  searchRadius,
  minPower,
  onlyCCS,
  excludeTesla,
  onlyOnRoute,
  routeGeometry,
  routeInfo,
  alternativeRoutes,
  selectedRouteIndex,
  selectRoute,
  restoreTrip,
  refreshChargers
} = useChargers(position, heading, destination)

const {
  autonomy,
  maxAutonomy,
  winterMode,
  roundTripMode,
  maxChargeMinutes,
  totalChargingMinutes,
  winterFactor,
  currentUsableRange,
  plannedStops,
  roundTripAnalysis,
  relevantChargers
} = useTripPlanner(filteredChargers, routeGeometry, routeInfo)

const {
  isOnline,
  savedTrip,
  restoredAt,
  resumeTrip,
  forgetTrip
} = useOfflineTrip({
  destination,
  destinationQuery,
  chargers: rawChargers,
  alternativeRoutes,
  selectedRouteIndex,
  routeGeometry,
  loading,
  error: chargersError,
  restoreTrip
})

const gpsState = computed(() => {
  if (signalLost.value) return 'weak'
  return isTracking.value ? 'active' : 'off'
})

const gpsLabel = computed(() => ({
  active: 'Suivi GPS actif',
  weak: 'Signal GPS perdu, dernière position conservée',
  off: 'Suivi GPS inactif'
})[gpsState.value])

const listBadge = computed(() => {
  const n = relevantChargers.value.length
  return n > 99 ? '99+' : String(n)
})

provide('position', position)
provide('heading', heading)
provide('speed', speed)
provide('chargers', relevantChargers)
provide('loading', loading)
provide('chargersError', chargersError)
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
provide('roundTripMode', roundTripMode)
provide('maxChargeMinutes', maxChargeMinutes)
provide('alternativeRoutes', alternativeRoutes)
provide('selectedRouteIndex', selectedRouteIndex)
provide('refreshChargers', refreshChargers)
provide('focusStop', focusStop)
provide('focusOnMap', focusOnMap)
provide('openOptions', openOptions)
provide('signalLost', signalLost)
provide('isOnline', isOnline)
provide('restoredAt', restoredAt)

startTracking()
</script>

<template>
  <div class="app">
    <header class="header">
      <h1 class="brand">
        <span class="brand-mark"><AppIcon name="bolt" :size="16" /></span>
        EV Finder
      </h1>
      <div class="header-actions">
        <span v-if="speed > 0" class="speed">{{ Math.round(speed * 3.6) }} km/h</span>
        <span
          v-if="position"
          class="gps-dot"
          :class="gpsState"
          role="status"
          :aria-label="gpsLabel"
          :title="gpsLabel"
        />
        <button
          class="icon-btn"
          aria-label="Rafraîchir les bornes"
          :disabled="loading"
          @click="refreshChargers"
        >
          <AppIcon name="refresh" :class="{ spinning: loading }" />
        </button>
        <button
          class="icon-btn"
          aria-label="Options"
          :aria-expanded="optionsOpen"
          @click="openOptions"
        >
          <AppIcon name="sliders" />
        </button>
      </div>
    </header>

    <DestinationSearch
      :destination="destination"
      :destination-query="destinationQuery"
      :suggestions="suggestions"
      :is-searching="isSearching"
      :route-info="routeInfo"
      :autonomy="autonomy"
      :max-autonomy="maxAutonomy"
      :usable-range="currentUsableRange"
      :loading="loading"
      :round-trip-mode="roundTripMode"
      :round-trip-analysis="roundTripAnalysis"
      :planned-stops="plannedStops"
      :total-charging-minutes="totalChargingMinutes"
      :max-charge-minutes="maxChargeMinutes"
      :alternative-routes="alternativeRoutes"
      :selected-route-index="selectedRouteIndex"
      :saved-trip="savedTrip"
      @search="searchDestination"
      @select="selectDestination"
      @clear="clearDestination"
      @update:autonomy="val => autonomy = val"
      @select-route="selectRoute"
      @resume-trip="resumeTrip"
      @forget-trip="forgetTrip"
    />

    <main class="content">
      <div v-if="!position && permissionDenied" class="state-panel" role="alert">
        <span class="state-icon"><AppIcon name="pin" :size="28" /></span>
        <h2>Localisation désactivée</h2>
        <p>{{ geoError }}</p>
        <p class="state-hint">
          Autorise la localisation pour ce site dans les réglages du navigateur, puis réessaie.
          Elle sert de point de départ à la recherche et aux itinéraires.
        </p>
        <button class="primary-btn" @click="startTracking">Réessayer</button>
      </div>
      <div v-else-if="!position && geoError" class="state-panel" role="alert" aria-live="assertive">
        <span class="state-icon warn"><AppIcon name="alert" :size="28" /></span>
        <p>{{ geoError }}</p>
        <button class="primary-btn" @click="startTracking">Réessayer</button>
      </div>
      <div v-else-if="!position" class="state-panel" aria-live="polite">
        <div class="spinner" aria-hidden="true" />
        <p>Localisation en cours…</p>
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
        <span class="tab-icon"><AppIcon name="map" :size="22" /></span>
        <span>Carte</span>
      </button>
      <button
        role="tab"
        :aria-selected="activeTab === 'list'"
        :class="{ active: activeTab === 'list' }"
        @click="activeTab = 'list'"
      >
        <span class="tab-icon">
          <AppIcon name="list" :size="22" />
          <span v-if="position && relevantChargers.length > 0" class="tab-badge" aria-hidden="true">{{ listBadge }}</span>
        </span>
        <span>Liste</span>
      </button>
    </nav>

    <OptionsMenu v-if="optionsOpen" @close="optionsOpen = false" />

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
  --primary-soft: rgba(16, 185, 129, 0.16);
  --on-primary: #03271a;
  --info: #3b82f6;
  --warning: #f59e0b;
  --danger: #ef4444;
  --bg: #0b1220;
  --bg-card: #131c2e;
  --bg-elevated: #1c273b;
  --text: #f1f5f9;
  --text-muted: #a3b1c6;
  --border: #2a3850;
  --shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: var(--bg);
  color: var(--text);
  overflow: hidden;
  -webkit-tap-highlight-color: transparent;
  -webkit-font-smoothing: antialiased;
}

button,
input,
select {
  font: inherit;
  color: inherit;
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
  height: 100vh;
  height: 100dvh;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  padding: 4px 6px 0 14px;
  padding-top: calc(4px + env(safe-area-inset-top));
  background: var(--bg-card);
}

.brand {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 1.05rem;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.brand-mark {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 8px;
  background: var(--primary);
  color: var(--on-primary);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 2px;
}

.icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  background: none;
  border: none;
  border-radius: 12px;
  color: var(--text);
  cursor: pointer;
  transition: background 0.2s;
}

.icon-btn:hover:not(:disabled),
.icon-btn:active:not(:disabled) {
  background: var(--bg-elevated);
}

.icon-btn:disabled {
  color: var(--text-muted);
  cursor: default;
}

.spinning {
  animation: spin 1s linear infinite;
}

.speed {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
  margin-right: 4px;
}

.gps-dot {
  width: 8px;
  height: 8px;
  margin: 0 8px;
  border-radius: 50%;
  background: var(--danger);
}

.gps-dot.active {
  background: var(--primary);
  animation: pulse 2s infinite;
}

.gps-dot.weak {
  background: var(--warning);
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.45; }
}

.content {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  position: relative;
}

.state-panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 12px;
  padding: 24px;
  text-align: center;
}

.state-panel h2 {
  font-size: 1.15rem;
  font-weight: 600;
}

.state-panel p {
  max-width: 340px;
  line-height: 1.5;
}

.state-panel .state-hint {
  color: var(--text-muted);
  font-size: 0.9rem;
}

.state-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--primary-soft);
  color: var(--primary);
}

.state-icon.warn {
  background: rgba(245, 158, 11, 0.16);
  color: var(--warning);
}

.primary-btn {
  min-height: 48px;
  padding: 0 24px;
  background: var(--primary);
  color: var(--on-primary);
  border: none;
  border-radius: 12px;
  font-weight: 600;
  cursor: pointer;
}

.primary-btn:hover {
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
  position: relative;
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  min-height: 56px;
  border: none;
  background: none;
  color: var(--text-muted);
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: color 0.2s;
}

.tabs button.active {
  color: var(--primary);
}

.tabs button.active::before {
  content: '';
  position: absolute;
  top: 0;
  left: 32%;
  right: 32%;
  height: 3px;
  border-radius: 0 0 3px 3px;
  background: var(--primary);
}

.tab-icon {
  position: relative;
  display: flex;
}

.tab-badge {
  position: absolute;
  top: -6px;
  left: 15px;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background: var(--primary);
  color: var(--on-primary);
  font-size: 0.68rem;
  font-weight: 700;
  line-height: 18px;
  text-align: center;
}
</style>
