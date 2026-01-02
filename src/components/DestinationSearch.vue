<script setup>
import { ref, watch } from 'vue'
import { useTileCache } from '../composables/useTileCache'

const { isCaching, cacheProgress, cacheRouteArea } = useTileCache()

const props = defineProps({
  destination: { type: Object, default: null },
  destinationQuery: { type: String, default: '' },
  suggestions: { type: Array, default: () => [] },
  isSearching: { type: Boolean, default: false },
  routeInfo: { type: Object, default: null },
  routeGeometry: { type: Array, default: null },
  autonomy: { type: Number, default: 100 },
  maxAutonomy: { type: Number, default: 400 },
  winterMode: { type: Boolean, default: false },
  winterFactor: { type: Number, default: 1 },
  plannedStops: { type: Array, default: () => [] }
})

const emit = defineEmits(['search', 'select', 'clear', 'update:autonomy', 'update:maxAutonomy', 'update:winterMode'])

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

const onAutonomyChange = (e) => {
  const val = parseInt(e.target.value) || 100
  emit('update:autonomy', val)
  // S'assurer que l'autonomie restante ne dépasse pas l'autonomie max
  if (val > props.maxAutonomy) {
    emit('update:maxAutonomy', val)
  }
}

const onMaxAutonomyChange = (e) => {
  const val = parseInt(e.target.value) || 400
  emit('update:maxAutonomy', val)
  // S'assurer que l'autonomie restante ne dépasse pas l'autonomie max
  if (props.autonomy > val) {
    emit('update:autonomy', val)
  }
}

const onWinterModeToggle = () => {
  emit('update:winterMode', !props.winterMode)
}

const downloadMapForOffline = async () => {
  if (props.routeGeometry) {
    await cacheRouteArea(props.routeGeometry, 5)
  }
}
</script>

<template>
  <div class="destination-search">
    <div class="search-input-wrapper">
      <input
        type="text"
        :value="inputValue"
        placeholder="Destination..."
        class="search-input"
        @input="onInput"
      >
      <button v-if="destination" class="clear-btn" @click="onClear">✕</button>
      <div v-if="isSearching" class="search-spinner" />
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
      <span>{{ formatDistance(routeInfo.distance) }}</span>
      <span>{{ formatDuration(routeInfo.duration) }}</span>
      <button
        class="offline-btn"
        :class="{ caching: isCaching }"
        :disabled="isCaching"
        @click="downloadMapForOffline"
      >
        <span v-if="isCaching">{{ cacheProgress }}%</span>
        <span v-else>📥 Offline</span>
      </button>
    </div>

    <div class="autonomy-controls">
      <div class="autonomy-sliders">
        <div class="slider-group">
          <div class="slider-header">
            <span>Restante</span>
            <span class="autonomy-value">{{ autonomy }} km</span>
          </div>
          <input
            type="range"
            :value="autonomy"
            min="0"
            :max="maxAutonomy"
            step="10"
            class="slider"
            @input="onAutonomyChange"
          >
        </div>
        <div class="slider-group">
          <div class="slider-header">
            <span>Max voiture</span>
            <span class="autonomy-value secondary">{{ maxAutonomy }} km</span>
          </div>
          <input
            type="range"
            :value="maxAutonomy"
            min="0"
            max="400"
            step="10"
            class="slider secondary"
            @input="onMaxAutonomyChange"
          >
        </div>
      </div>
      <button
        class="winter-toggle"
        :class="{ active: winterMode }"
        @click="onWinterModeToggle"
      >
        <span class="winter-icon">❄️</span>
        <span class="winter-label">{{ winterMode ? 'Hiver' : 'Été' }}</span>
        <span v-if="winterMode" class="winter-factor">{{ Math.round(winterFactor * 100) }}%</span>
      </button>
    </div>

    <div v-if="plannedStops && plannedStops.length > 0" class="planned-stops">
      <div class="stops-header">
        <span>{{ plannedStops.length }} arrêt{{ plannedStops.length > 1 ? 's' : '' }} recommandé{{ plannedStops.length > 1 ? 's' : '' }}</span>
      </div>
      <div
        v-for="stop in plannedStops"
        :key="stop.id"
        class="stop-item"
      >
        <span class="stop-number">{{ stop.stopNumber }}</span>
        <div class="stop-info">
          <strong>{{ stop.name }}</strong>
          <span class="stop-details">
            {{ Math.round(stop.distanceFromStart) }} km · {{ stop.operator }}
          </span>
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

.search-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
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

.offline-btn {
  padding: 4px 10px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text);
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.2s;
  margin-left: auto;
}

.offline-btn:hover:not(:disabled) {
  border-color: var(--primary);
  background: rgba(16, 185, 129, 0.1);
}

.offline-btn:disabled {
  cursor: not-allowed;
  opacity: 0.7;
}

.offline-btn.caching {
  background: var(--primary);
  color: white;
  border-color: var(--primary);
}

.autonomy-controls {
  display: flex;
  align-items: flex-end;
  gap: 12px;
  margin-top: 10px;
  padding: 8px 0;
}

.autonomy-sliders {
  display: flex;
  gap: 16px;
  flex: 1;
}

.slider-group {
  flex: 1;
}

.slider-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
  font-size: 0.75rem;
  color: var(--text-muted);
}

.autonomy-value {
  color: var(--primary);
  font-weight: 600;
}

.autonomy-value.secondary {
  color: #f59e0b;
}

.slider {
  width: 100%;
  height: 5px;
  -webkit-appearance: none;
  appearance: none;
  background: var(--border);
  border-radius: 3px;
  outline: none;
}

.slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 18px;
  height: 18px;
  background: var(--primary);
  border-radius: 50%;
  cursor: pointer;
  border: 2px solid white;
  box-shadow: 0 2px 4px rgba(0,0,0,0.2);
}

.slider.secondary::-webkit-slider-thumb {
  background: #f59e0b;
}

.slider::-moz-range-thumb {
  width: 18px;
  height: 18px;
  background: var(--primary);
  border-radius: 50%;
  cursor: pointer;
  border: 2px solid white;
  box-shadow: 0 2px 4px rgba(0,0,0,0.2);
}

.slider.secondary::-moz-range-thumb {
  background: #f59e0b;
}

.planned-stops {
  margin-top: 12px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
}

.stops-header {
  padding: 8px 12px;
  background: var(--primary);
  color: white;
  font-size: 0.8rem;
  font-weight: 500;
}

.stop-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--border);
}

.stop-item:last-child {
  border-bottom: none;
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

.winter-toggle {
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
  min-width: 60px;
}

.winter-toggle:hover {
  border-color: var(--primary);
}

.winter-toggle.active {
  background: #3b82f6;
  border-color: #3b82f6;
  color: white;
}

.winter-icon {
  font-size: 1.2rem;
}

.winter-label {
  font-size: 0.7rem;
  font-weight: 500;
}

.winter-factor {
  font-size: 0.65rem;
  opacity: 0.8;
}
</style>
