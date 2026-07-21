<script setup>
import { ref, watch } from 'vue'

const stopsExpanded = ref(true)

const props = defineProps({
  destination: { type: Object, default: null },
  destinationQuery: { type: String, default: '' },
  suggestions: { type: Array, default: () => [] },
  isSearching: { type: Boolean, default: false },
  routeInfo: { type: Object, default: null },
  routeGeometry: { type: Array, default: null },
  autonomy: { type: Number, default: 100 },
  maxAutonomy: { type: Number, default: 470 },
  roundTripMode: { type: Boolean, default: false },
  roundTripAnalysis: { type: Object, default: null },
  plannedStops: { type: Array, default: () => [] },
  alternativeRoutes: { type: Array, default: () => [] },
  selectedRouteIndex: { type: Number, default: 0 }
})

const emit = defineEmits(['search', 'select', 'clear', 'update:autonomy', 'selectRoute', 'focusStop'])

const inputValue = ref(props.destinationQuery || '')
let debounceTimeout = null

watch(() => props.destinationQuery, (val) => {
  inputValue.value = val
})

const onInput = (e) => {
  inputValue.value = e.target.value
  clearTimeout(debounceTimeout)
  debounceTimeout = setTimeout(() => {
    emit('search', inputValue.value)
  }, 300)
}

const onSelect = (place) => {
  emit('select', place)
}

const onClear = () => {
  inputValue.value = ''
  emit('clear')
}

const formatDuration = (seconds) => {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.round((seconds % 3600) / 60)
  if (hours > 0) {
    return `${hours}h${minutes.toString().padStart(2, '0')}`
  }
  return `${minutes} min`
}

const formatDistance = (meters) => {
  return `${(meters / 1000).toFixed(0)} km`
}

const onAutonomyInput = (e) => {
  const val = parseInt(e.target.value)
  if (!Number.isFinite(val)) return
  // Plafonner au max voiture pendant la saisie (le plancher est appliqué au blur)
  emit('update:autonomy', Math.min(val, props.maxAutonomy))
}

const onAutonomyBlur = (e) => {
  let val = parseInt(e.target.value)
  if (!Number.isFinite(val)) val = 10
  emit('update:autonomy', Math.min(Math.max(val, 10), props.maxAutonomy))
}
</script>

<template>
  <div class="destination-search">
    <div class="top-row">
      <div class="search-input-wrapper">
        <input
          type="text"
          :value="inputValue"
          placeholder="Destination..."
          class="search-input"
          @input="onInput"
        >
        <button
          v-if="destination"
          type="button"
          class="clear-btn"
          aria-label="Effacer la destination"
          @click="onClear"
        >
          <span aria-hidden="true">✕</span>
        </button>
        <div v-if="isSearching" class="search-spinner" role="status" aria-label="Recherche en cours" />
      </div>

      <div class="autonomy-field">
        <input
          type="text"
          inputmode="numeric"
          pattern="[0-9]*"
          maxlength="3"
          :value="autonomy"
          class="autonomy-input"
          aria-label="Autonomie restante en km"
          @input="onAutonomyInput"
          @blur="onAutonomyBlur"
        >
        <span class="autonomy-unit">km</span>
      </div>
    </div>

    <div v-if="suggestions.length > 0" class="suggestions">
      <button
        v-for="place in suggestions"
        :key="place.id"
        class="suggestion-item"
        @click="onSelect(place)"
      >
        {{ place.name }}
      </button>
    </div>

    <div v-if="routeInfo" class="route-info">
      <span>{{ formatDistance(routeInfo.distance) }}{{ roundTripMode ? ' × 2' : '' }}</span>
      <span>{{ formatDuration(roundTripMode ? routeInfo.duration * 2 : routeInfo.duration) }}</span>
    </div>

    <!-- Analyse aller-retour -->
    <div v-if="roundTripAnalysis" class="roundtrip-analysis" :class="{ warning: roundTripAnalysis.needsCharge, success: !roundTripAnalysis.needsCharge }">
      <span v-if="!roundTripAnalysis.needsCharge" class="analysis-icon">✅</span>
      <span v-else-if="roundTripAnalysis.feasible" class="analysis-icon">⚡</span>
      <span v-else class="analysis-icon">⚠️</span>
      <div class="analysis-content">
        <span class="analysis-message">{{ roundTripAnalysis.message }}</span>
        <span v-if="roundTripAnalysis.remainingAfterTrip !== undefined" class="analysis-detail">
          Restant après trajet : {{ roundTripAnalysis.remainingAfterTrip }} km
        </span>
        <span v-if="roundTripAnalysis.minChargeNeeded" class="analysis-detail">
          Recharge min. : {{ roundTripAnalysis.minChargeNeeded }} km
        </span>
      </div>
    </div>

    <!-- Itinéraires alternatifs -->
    <div v-if="alternativeRoutes.length > 1" class="alternative-routes">
      <button
        v-for="(route, index) in alternativeRoutes"
        :key="route.id"
        class="route-option"
        :class="{ active: index === selectedRouteIndex }"
        @click="emit('selectRoute', index)"
      >
        <span class="route-label">{{ index === 0 ? 'Principal' : `Alt ${index}` }}</span>
        <span class="route-stats">{{ formatDistance(route.distance) }} · {{ formatDuration(route.duration) }}</span>
      </button>
    </div>

    <div v-if="plannedStops && plannedStops.length > 0" class="planned-stops">
      <button
        type="button"
        class="stops-header"
        :aria-expanded="stopsExpanded"
        @click="stopsExpanded = !stopsExpanded"
      >
        <span>{{ plannedStops.length }} arrêt{{ plannedStops.length > 1 ? 's' : '' }} recommandé{{ plannedStops.length > 1 ? 's' : '' }}</span>
        <span class="stops-chevron" aria-hidden="true">{{ stopsExpanded ? '▾' : '▸' }}</span>
      </button>
      <div v-show="stopsExpanded" class="stops-list">
        <div
          v-for="stop in plannedStops"
          :key="stop.id"
          class="stop-item"
        >
          <button
            type="button"
            class="stop-main"
            :aria-label="`Voir ${stop.name} sur la carte`"
            @click="emit('focusStop', stop)"
          >
            <span class="stop-number">{{ stop.stopNumber }}</span>
            <div class="stop-info">
              <strong>{{ stop.name }}</strong>
              <span class="stop-details">
                {{ Math.round(stop.distanceFromStart) }} km · {{ stop.operator }}
              </span>
            </div>
            <span class="stop-locate" aria-hidden="true">📍</span>
          </button>
          <a
            :href="stop.detailsUrl"
            target="_blank"
            rel="noopener"
            class="stop-details-link"
          >
            Fiche ↗
          </a>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.destination-search {
  padding: 8px 16px;
  background: var(--bg-card);
  border-bottom: 1px solid var(--border);
}

.top-row {
  display: flex;
  align-items: stretch;
  gap: 8px;
}

.search-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 0;
}

.autonomy-field {
  position: relative;
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.autonomy-input {
  width: 78px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--primary);
  font-size: 0.95rem;
  font-weight: 600;
  text-align: right;
  padding: 10px 26px 10px 10px;
  outline: none;
}

.autonomy-input:focus {
  border-color: var(--primary);
}

.autonomy-unit {
  position: absolute;
  right: 8px;
  color: var(--text-muted);
  font-size: 0.8rem;
  pointer-events: none;
}

.search-input {
  flex: 1;
  background: var(--bg);
  border: 1px solid var(--border);
  color: var(--text);
  padding: 10px 12px;
  border-radius: 8px;
  font-size: 0.9rem;
  outline: none;
}

.search-input:focus {
  border-color: var(--primary);
}

.search-input::placeholder {
  color: var(--text-muted);
}

.clear-btn {
  position: absolute;
  right: 8px;
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 1rem;
  cursor: pointer;
  padding: 4px 8px;
}

.search-spinner {
  position: absolute;
  right: 12px;
  width: 16px;
  height: 16px;
  border: 2px solid var(--border);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.suggestions {
  margin-top: 8px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
  max-height: 200px;
  overflow-y: auto;
}

.suggestion-item {
  width: 100%;
  padding: 10px 12px;
  background: none;
  border: none;
  border-bottom: 1px solid var(--border);
  color: var(--text);
  text-align: left;
  font-size: 0.85rem;
  cursor: pointer;
}

.suggestion-item:last-child {
  border-bottom: none;
}

.suggestion-item:active {
  background: var(--border);
}

.route-info {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 8px;
  font-size: 0.875rem;
  color: var(--primary);
  font-weight: 500;
  flex-wrap: wrap;
}

.planned-stops {
  margin-top: 12px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
  /* Laisser la carte respirer : la liste ne dépasse pas ~2,5 arrêts, le reste scrolle */
  max-height: 168px;
  display: flex;
  flex-direction: column;
}

.stops-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 8px 12px;
  background: var(--primary);
  color: white;
  font-size: 0.8rem;
  font-weight: 500;
  flex-shrink: 0;
  border: none;
  cursor: pointer;
  text-align: left;
}

.stops-chevron {
  font-size: 0.9rem;
  line-height: 1;
}

.stops-list {
  overflow-y: auto;
}

.stop-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-bottom: 1px solid var(--border);
}

.stop-item:last-child {
  border-bottom: none;
}

.stop-main {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 0;
  background: none;
  border: none;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.stop-locate {
  flex-shrink: 0;
  font-size: 0.9rem;
  opacity: 0.7;
}

.stop-details-link {
  flex-shrink: 0;
  padding: 4px 8px;
  background: rgba(16, 185, 129, 0.15);
  border-radius: 4px;
  color: var(--primary);
  text-decoration: none;
  font-weight: 500;
  font-size: 0.7rem;
  white-space: nowrap;
}

.stop-number {
  width: 24px;
  height: 24px;
  background: var(--primary);
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 600;
  flex-shrink: 0;
}

.stop-info {
  flex: 1;
  min-width: 0;
}

.stop-info strong {
  display: block;
  font-size: 0.85rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.stop-details {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.roundtrip-analysis {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-top: 8px;
  padding: 10px 12px;
  border-radius: 8px;
  font-size: 0.85rem;
}

.roundtrip-analysis.success {
  background: rgba(34, 197, 94, 0.15);
  border: 1px solid rgba(34, 197, 94, 0.3);
  color: #22c55e;
}

.roundtrip-analysis.warning {
  background: rgba(245, 158, 11, 0.15);
  border: 1px solid rgba(245, 158, 11, 0.3);
  color: #f59e0b;
}

.analysis-icon {
  font-size: 1.1rem;
  flex-shrink: 0;
}

.analysis-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.analysis-message {
  font-weight: 500;
}

.analysis-detail {
  font-size: 0.75rem;
  opacity: 0.85;
}

.alternative-routes {
  display: flex;
  gap: 8px;
  margin-top: 8px;
  overflow-x: auto;
  padding-bottom: 4px;
}

.route-option {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 8px 12px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.2s;
  min-width: 80px;
  flex-shrink: 0;
}

.route-option:hover {
  border-color: var(--primary);
}

.route-option.active {
  background: var(--primary);
  border-color: var(--primary);
  color: white;
}

.route-label {
  font-size: 0.75rem;
  font-weight: 600;
}

.route-stats {
  font-size: 0.65rem;
  opacity: 0.8;
}
</style>
