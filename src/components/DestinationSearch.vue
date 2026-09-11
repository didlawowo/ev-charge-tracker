<script setup>
import { ref, watch, computed } from 'vue'
import AppIcon from './AppIcon.js'
import AutonomyEditor from './AutonomyEditor.vue'
import { formatSavedAt } from '../utils'

const props = defineProps({
  destination: { type: Object, default: null },
  destinationQuery: { type: String, default: '' },
  suggestions: { type: Array, default: () => [] },
  isSearching: { type: Boolean, default: false },
  routeInfo: { type: Object, default: null },
  autonomy: { type: Number, default: 100 },
  maxAutonomy: { type: Number, default: 470 },
  usableRange: { type: Number, default: 0 },
  loading: { type: Boolean, default: false },
  roundTripMode: { type: Boolean, default: false },
  roundTripAnalysis: { type: Object, default: null },
  plannedStops: { type: Array, default: () => [] },
  alternativeRoutes: { type: Array, default: () => [] },
  selectedRouteIndex: { type: Number, default: 0 },
  savedTrip: { type: Object, default: null }
})

const emit = defineEmits(['search', 'select', 'clear', 'update:autonomy', 'selectRoute', 'resumeTrip', 'forgetTrip'])

const savedTripSummary = computed(() => {
  const trip = props.savedTrip
  if (!trip) return null
  const route = trip.routes[trip.selectedRouteIndex] || trip.routes[0]
  return {
    name: trip.destinationQuery || trip.destination.name,
    km: Math.round(route.distance / 1000),
    date: formatSavedAt(trip.savedAt)
  }
})

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
  clearTimeout(debounceTimeout)
  emit('select', place)
}

// Entrée = première suggestion (clavier mobile « Rechercher »)
const onEnter = (e) => {
  if (props.suggestions.length > 0) {
    onSelect(props.suggestions[0])
    e.target.blur()
  }
}

const onClear = () => {
  clearTimeout(debounceTimeout)
  inputValue.value = ''
  emit('search', '')
  emit('clear')
}

// « Lyon, Métropole de Lyon » → titre « Lyon » + contexte « Métropole de Lyon »
const splitPlace = (name) => {
  const idx = name.indexOf(', ')
  return idx === -1 ? { main: name, sub: '' } : { main: name.slice(0, idx), sub: name.slice(idx + 2) }
}

const formatDuration = (seconds) => {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.round((seconds % 3600) / 60)
  if (hours > 0) {
    return `${hours} h ${minutes.toString().padStart(2, '0')}`
  }
  return `${minutes} min`
}

const formatKm = (meters) => `${Math.round(meters / 1000)} km`

const tripStatus = computed(() => {
  if (!props.routeInfo) return null
  const km = props.routeInfo.distance / 1000
  if (km <= props.usableRange) return { kind: 'ok', label: 'Sans recharge' }
  const n = props.plannedStops.length
  if (n > 0) {
    const unreachable = props.plannedStops.some(s => s.unreachable)
    return {
      kind: unreachable ? 'warn' : 'stops',
      label: `${n} arrêt${n > 1 ? 's' : ''}${unreachable ? ' · autonomie juste' : ''}`
    }
  }
  if (props.loading) return null
  return { kind: 'warn', label: 'Aucune borne atteignable' }
})

const lowAutonomy = computed(() => props.autonomy <= Math.max(50, props.maxAutonomy * 0.15))

const autonomyEditorOpen = ref(false)
</script>

<template>
  <div class="destination-search">
    <div class="search-area">
      <div class="top-row">
        <div class="search-input-wrapper">
          <AppIcon name="search" :size="18" class="search-icon" />
          <input
            type="text"
            :value="inputValue"
            placeholder="Où allez-vous ?"
            class="search-input"
            role="combobox"
            aria-label="Destination"
            aria-autocomplete="list"
            aria-controls="destination-suggestions"
            :aria-expanded="suggestions.length > 0"
            autocomplete="off"
            autocorrect="off"
            spellcheck="false"
            enterkeyhint="search"
            @input="onInput"
            @keydown.enter.prevent="onEnter"
          >
          <div v-if="isSearching" class="search-spinner" role="status" aria-label="Recherche en cours" />
          <button
            v-else-if="inputValue || destination"
            type="button"
            class="clear-btn"
            aria-label="Effacer la destination"
            @click="onClear"
          >
            <AppIcon name="x" :size="18" />
          </button>
        </div>

        <button
          type="button"
          class="autonomy-field"
          :class="{ low: lowAutonomy }"
          aria-haspopup="dialog"
          :aria-label="`Autonomie restante : ${autonomy} km. Modifier`"
          @click="autonomyEditorOpen = true"
        >
          <AppIcon name="battery" :size="20" class="autonomy-icon" />
          <span class="autonomy-text">
            <span class="autonomy-caption">Autonomie</span>
            <span class="autonomy-value">
              <strong class="autonomy-number">{{ autonomy }}</strong>
              <span class="autonomy-unit">km</span>
            </span>
          </span>
        </button>
      </div>

      <AutonomyEditor
        v-if="autonomyEditorOpen"
        :model-value="autonomy"
        :max="maxAutonomy"
        @update:model-value="val => emit('update:autonomy', val)"
        @close="autonomyEditorOpen = false"
      />

      <ul
        v-if="suggestions.length > 0"
        id="destination-suggestions"
        class="suggestions"
        role="listbox"
        aria-label="Suggestions de destination"
      >
        <li v-for="place in suggestions" :key="place.id" role="presentation">
          <button type="button" role="option" class="suggestion-item" @click="onSelect(place)">
            <AppIcon name="pin" :size="18" class="suggestion-icon" />
            <span class="suggestion-text">
              <strong>{{ splitPlace(place.name).main }}</strong>
              <span v-if="splitPlace(place.name).sub">{{ splitPlace(place.name).sub }}</span>
            </span>
          </button>
        </li>
      </ul>
    </div>

    <div
      v-if="savedTripSummary && !destination && !inputValue && suggestions.length === 0"
      class="resume-trip"
    >
      <button type="button" class="resume-main" @click="emit('resumeTrip')">
        <AppIcon name="route" :size="18" class="resume-icon" />
        <span class="resume-text">
          <span class="resume-label">Reprendre le dernier trajet · {{ savedTripSummary.date }}</span>
          <strong>{{ savedTripSummary.name }} · {{ savedTripSummary.km }} km</strong>
        </span>
      </button>
      <button
        type="button"
        class="resume-forget"
        aria-label="Oublier le dernier trajet"
        @click="emit('forgetTrip')"
      >
        <AppIcon name="x" :size="16" />
      </button>
    </div>

    <div v-if="routeInfo" class="route-summary">
      <div class="route-stats-main">
        <span class="route-stat">
          <AppIcon name="route" :size="16" />
          {{ formatKm(routeInfo.distance) }}<span v-if="roundTripMode" class="x2">× 2</span>
        </span>
        <span class="route-stat">
          <AppIcon name="clock" :size="16" />
          {{ formatDuration(roundTripMode ? routeInfo.duration * 2 : routeInfo.duration) }}
        </span>
        <span v-if="tripStatus" class="trip-badge" :class="tripStatus.kind">{{ tripStatus.label }}</span>
      </div>

      <!-- Itinéraires alternatifs -->
      <div v-if="alternativeRoutes.length > 1" class="alternative-routes" role="radiogroup" aria-label="Choix de l'itinéraire">
        <button
          v-for="(route, index) in alternativeRoutes"
          :key="route.id"
          type="button"
          role="radio"
          :aria-checked="index === selectedRouteIndex"
          class="route-option"
          :class="{ active: index === selectedRouteIndex }"
          @click="emit('selectRoute', index)"
        >
          <span class="route-label">{{ index === 0 ? 'Principal' : `Alternatif ${index}` }}</span>
          <span class="route-stats">{{ formatKm(route.distance) }} · {{ formatDuration(route.duration) }}</span>
        </button>
      </div>

      <!-- Analyse aller-retour -->
      <div
        v-if="roundTripAnalysis"
        class="roundtrip-analysis"
        :class="{ warning: roundTripAnalysis.needsCharge, success: !roundTripAnalysis.needsCharge }"
      >
        <AppIcon
          :name="!roundTripAnalysis.needsCharge ? 'check' : roundTripAnalysis.feasible ? 'bolt' : 'alert'"
          :size="18"
          class="analysis-icon"
        />
        <div class="analysis-content">
          <span class="analysis-message">Aller-retour : {{ roundTripAnalysis.message.charAt(0).toLowerCase() + roundTripAnalysis.message.slice(1) }}</span>
          <span v-if="roundTripAnalysis.remainingAfterTrip !== undefined" class="analysis-detail">
            Restant au retour : {{ roundTripAnalysis.remainingAfterTrip }} km
          </span>
          <span v-if="roundTripAnalysis.minChargeNeeded" class="analysis-detail">
            Recharger au moins {{ roundTripAnalysis.minChargeNeeded }} km sur place
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.destination-search {
  position: relative;
  z-index: 1100;
  padding: 6px 12px 10px;
  background: var(--bg-card);
  border-bottom: 1px solid var(--border);
}

.search-area {
  position: relative;
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

.search-icon {
  position: absolute;
  left: 12px;
  color: var(--text-muted);
  pointer-events: none;
}

/* 16px minimum : en dessous, Safari iOS zoome la page au focus */
.search-input {
  width: 100%;
  height: 48px;
  padding: 0 44px 0 40px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 12px;
  color: var(--text);
  font-size: 16px;
  outline: none;
  -webkit-appearance: none;
  appearance: none;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.search-input:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px var(--primary-soft);
}

.search-input::placeholder {
  color: var(--text-muted);
}

.clear-btn {
  position: absolute;
  right: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  background: none;
  border: none;
  border-radius: 10px;
  color: var(--text-muted);
  cursor: pointer;
}

.search-spinner {
  position: absolute;
  right: 14px;
  width: 18px;
  height: 18px;
  border: 2px solid var(--border);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.autonomy-field {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  height: 48px;
  padding: 0 12px 0 10px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 12px;
  color: var(--text);
  text-align: left;
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;
}

.autonomy-field:hover,
.autonomy-field:active {
  border-color: var(--primary);
  background: var(--primary-soft);
}

.autonomy-icon {
  color: var(--primary);
}

.autonomy-field.low .autonomy-icon {
  color: var(--warning);
}

.autonomy-text {
  display: flex;
  flex-direction: column;
  line-height: 1.1;
}

.autonomy-caption {
  font-size: 0.68rem;
  color: var(--text-muted);
}

.autonomy-value {
  display: flex;
  align-items: baseline;
  gap: 3px;
}

.autonomy-number {
  font-size: 16px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.autonomy-unit {
  font-size: 0.8rem;
  color: var(--text-muted);
}

.suggestions {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  z-index: 1200;
  list-style: none;
  padding: 4px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: var(--shadow);
  max-height: 50vh;
  overflow-y: auto;
}

.suggestion-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 52px;
  padding: 8px 10px;
  background: none;
  border: none;
  border-radius: 8px;
  color: var(--text);
  text-align: left;
  cursor: pointer;
}

.suggestion-item:hover,
.suggestion-item:active {
  background: var(--primary-soft);
}

.suggestion-icon {
  flex-shrink: 0;
  color: var(--text-muted);
}

.suggestion-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.suggestion-text strong {
  font-size: 0.95rem;
  font-weight: 600;
}

.suggestion-text span {
  font-size: 0.8rem;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.route-summary {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 10px;
}

.route-stats-main {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px 14px;
  font-size: 0.95rem;
}

.route-stat {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.route-stat .app-icon {
  color: var(--text-muted);
}

.x2 {
  margin-left: 4px;
  font-size: 0.8rem;
  color: var(--text-muted);
}

.trip-badge {
  margin-left: auto;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 0.8rem;
  font-weight: 600;
}

.trip-badge.ok {
  background: var(--primary-soft);
  color: var(--primary);
}

.trip-badge.stops {
  background: rgba(59, 130, 246, 0.18);
  color: #7cb1ff;
}

.trip-badge.warn {
  background: rgba(245, 158, 11, 0.16);
  color: var(--warning);
}

.alternative-routes {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  scrollbar-width: none;
}

.alternative-routes::-webkit-scrollbar {
  display: none;
}

.route-option {
  flex-shrink: 0;
  display: flex;
  align-items: baseline;
  gap: 6px;
  min-height: 36px;
  padding: 7px 12px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 999px;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.2s;
}

.route-option.active {
  background: var(--primary-soft);
  border-color: var(--primary);
  color: var(--text);
}

.route-label {
  font-size: 0.8rem;
  font-weight: 600;
}

.route-stats {
  font-size: 0.75rem;
  opacity: 0.85;
  font-variant-numeric: tabular-nums;
}

.roundtrip-analysis {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 12px;
  font-size: 0.85rem;
}

.roundtrip-analysis.success {
  background: var(--primary-soft);
  color: var(--primary);
}

.roundtrip-analysis.warning {
  background: rgba(245, 158, 11, 0.14);
  color: var(--warning);
}

.analysis-icon {
  flex-shrink: 0;
  margin-top: 1px;
}

.analysis-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.analysis-message {
  font-weight: 600;
}

.analysis-detail {
  font-size: 0.78rem;
  color: var(--text);
  opacity: 0.85;
}

.resume-trip {
  display: flex;
  align-items: stretch;
  gap: 4px;
  margin-top: 8px;
  border: 1px dashed var(--border);
  border-radius: 12px;
}

.resume-main {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 52px;
  padding: 6px 10px;
  background: none;
  border: none;
  border-radius: 12px;
  color: var(--text);
  text-align: left;
  cursor: pointer;
}

.resume-main:active {
  background: var(--primary-soft);
}

.resume-icon {
  flex-shrink: 0;
  color: var(--primary);
}

.resume-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.resume-label {
  font-size: 0.72rem;
  color: var(--text-muted);
}

.resume-text strong {
  font-size: 0.9rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.resume-forget {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  background: none;
  border: none;
  border-radius: 12px;
  color: var(--text-muted);
  cursor: pointer;
}
</style>
