<script setup>
import { ref, provide } from 'vue'
import { useGeolocation } from './composables/useGeolocation'
import { useChargers } from './composables/useChargers'
import { useDestination } from './composables/useDestination'
import { useTripPlanner } from './composables/useTripPlanner'
import MapView from './components/MapView.vue'
import ListView from './components/ListView.vue'
import FilterBar from './components/FilterBar.vue'
import DestinationSearch from './components/DestinationSearch.vue'
import PwaInstallPrompt from './components/PwaInstallPrompt.vue'

const activeTab = ref('map')

const {
  position,
  heading,
  speed,
  error: geoError,
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
  onlyOnRoute,
  routeGeometry,
  routeInfo
} = useChargers(position, heading, destination)

const {
  autonomy,
  maxAutonomy,
  winterMode,
  winterFactor,
  plannedStops
} = useTripPlanner(filteredChargers, routeGeometry, routeInfo)

provide('position', position)
provide('heading', heading)
provide('speed', speed)
provide('chargers', filteredChargers)
provide('loading', loading)
provide('searchRadius', searchRadius)
provide('minPower', minPower)
provide('onlyCCS', onlyCCS)
provide('onlyOnRoute', onlyOnRoute)
provide('routeGeometry', routeGeometry)
provide('destination', destination)
provide('autonomy', autonomy)
provide('plannedStops', plannedStops)
provide('winterMode', winterMode)

startTracking()
</script>

<template>
  <div class="app">
    <header class="header">
      <h1>⚡ EV Finder</h1>
      <div v-if="position" class="status">
        <span v-if="speed > 0" class="speed">{{ Math.round(speed * 3.6) }} km/h</span>
        <span class="dot" :class="{ active: isTracking }" />
      </div>
    </header>

    <DestinationSearch
      :destination="destination"
      :destination-query="destinationQuery"
      :suggestions="suggestions"
      :is-searching="isSearching"
      :route-info="routeInfo"
      :route-geometry="routeGeometry"
      :autonomy="autonomy"
      :max-autonomy="maxAutonomy"
      :winter-mode="winterMode"
      :winter-factor="winterFactor"
      :planned-stops="plannedStops"
      @search="searchDestination"
      @select="selectDestination"
      @clear="clearDestination"
      @update:autonomy="val => autonomy = val"
      @update:max-autonomy="val => maxAutonomy = val"
      @update:winter-mode="val => winterMode = val"
    />

    <FilterBar />

    <main class="content">
      <div v-if="geoError" class="error">
        {{ geoError }}
      </div>
      <div v-else-if="!position" class="loading">
        <div class="spinner" />
        <p>Localisation en cours...</p>
      </div>
      <template v-else>
        <MapView v-show="activeTab === 'map'" />
        <ListView v-show="activeTab === 'list'" />
      </template>
    </main>

    <nav class="tabs">
      <button
        :class="{ active: activeTab === 'map' }"
        @click="activeTab = 'map'"
      >
        Carte
      </button>
      <button
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
  background: var(--bg-card);
  border-bottom: 1px solid var(--border);
}

.header h1 {
  font-size: 1.25rem;
  font-weight: 600;
}

.status {
  display: flex;
  align-items: center;
  gap: 8px;
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
  min-height: 300px;
}

.loading, .error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 16px;
}

.error {
  color: #ef4444;
  padding: 20px;
  text-align: center;
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
