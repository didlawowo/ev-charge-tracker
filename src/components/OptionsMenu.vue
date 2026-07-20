<script setup>
import { inject, computed } from 'vue'
import { useTileCache } from '../composables/useTileCache'

const emit = defineEmits(['close'])

const { isCaching, cacheProgress, cacheRouteArea } = useTileCache()

const routeGeometry = inject('routeGeometry')
const maxAutonomy = inject('maxAutonomy')
const winterMode = inject('winterMode')
const winterFactor = inject('winterFactor')
const avoidTolls = inject('avoidTolls')
const roundTripMode = inject('roundTripMode')
const onlyCCS = inject('onlyCCS')
const excludeTesla = inject('excludeTesla')
const minPower = inject('minPower')
const onlyOnRoute = inject('onlyOnRoute')
const searchRadius = inject('searchRadius')
const autonomy = inject('autonomy')

const winterPct = computed(() => Math.round((winterFactor?.value ?? 1) * 100))

const hasRoute = computed(() => !!routeGeometry?.value?.length)

const downloadMapForOffline = async () => {
  if (routeGeometry?.value) {
    await cacheRouteArea(routeGeometry.value, 5)
  }
}

const onMaxAutonomyInput = (e) => {
  const val = parseInt(e.target.value)
  if (!Number.isFinite(val)) return
  maxAutonomy.value = val
  // L'autonomie restante ne peut pas dépasser le max voiture
  if (autonomy && autonomy.value > val) {
    autonomy.value = val
  }
}

const onMaxAutonomyBlur = (e) => {
  let val = parseInt(e.target.value)
  if (!Number.isFinite(val)) val = 470
  maxAutonomy.value = Math.min(Math.max(val, 100), 470)
  if (autonomy && autonomy.value > maxAutonomy.value) {
    autonomy.value = maxAutonomy.value
  }
}
</script>

<template>
  <div class="options-backdrop" @click="emit('close')">
    <div class="options-panel" role="dialog" aria-label="Options" @click.stop>
      <div class="options-header">
        <span>Options</span>
        <button class="close-btn" aria-label="Fermer" @click="emit('close')">✕</button>
      </div>

      <!-- Max voiture -->
      <div class="option-block max-autonomy">
        <label for="max-autonomy-input">Autonomie max voiture</label>
        <div class="num-field">
          <input
            id="max-autonomy-input"
            type="text"
            inputmode="numeric"
            pattern="[0-9]*"
            maxlength="3"
            :value="maxAutonomy"
            class="num-input"
            @input="onMaxAutonomyInput"
            @blur="onMaxAutonomyBlur"
          >
          <span class="num-unit">km</span>
        </div>
      </div>

      <!-- Toggles trajet -->
      <div class="option-block toggles">
        <button class="toggle winter" :class="{ active: winterMode }" @click="winterMode = !winterMode">
          <span class="toggle-icon">{{ winterMode ? '❄️' : '☀️' }}</span>
          <span class="toggle-label">{{ winterMode ? 'Hiver' : 'Été' }}</span>
          <span v-if="winterMode" class="toggle-sub">{{ winterPct }}%</span>
        </button>
        <button class="toggle toll" :class="{ active: avoidTolls }" @click="avoidTolls = !avoidTolls">
          <span class="toggle-icon">🛣️</span>
          <span class="toggle-label">{{ avoidTolls ? 'Gratuit' : 'Péages' }}</span>
        </button>
        <button class="toggle roundtrip" :class="{ active: roundTripMode }" @click="roundTripMode = !roundTripMode">
          <span class="toggle-icon">🔄</span>
          <span class="toggle-label">{{ roundTripMode ? 'A/R' : 'Aller' }}</span>
        </button>
      </div>

      <!-- Filtres bornes -->
      <div class="option-block filters">
        <label class="filter-item">
          <input v-model="onlyCCS" type="checkbox">
          <span>CCS uniquement</span>
        </label>

        <label class="filter-item">
          <input v-model="onlyOnRoute" type="checkbox">
          <span>Sur ma route</span>
        </label>

        <label class="filter-item">
          <input v-model="excludeTesla" type="checkbox">
          <span>Sans Tesla</span>
        </label>

        <div class="filter-item">
          <span>Puissance min.</span>
          <select v-model="minPower">
            <option :value="0">Tout</option>
            <option :value="50">50+ kW</option>
            <option :value="100">100+ kW</option>
            <option :value="150">150+ kW</option>
            <option :value="300">300+ kW</option>
          </select>
        </div>

        <div class="filter-item slider-item">
          <span>Rayon</span>
          <input
            type="range"
            :value="searchRadius"
            min="5000"
            max="100000"
            step="5000"
            class="radius-slider"
            @input="e => searchRadius = parseInt(e.target.value)"
          >
          <span class="radius-value">{{ Math.round(searchRadius / 1000) }} km</span>
        </div>
      </div>

      <!-- Carte hors-ligne -->
      <div class="option-block offline-block">
        <button
          type="button"
          class="offline-btn"
          :class="{ caching: isCaching }"
          :disabled="isCaching || !hasRoute"
          :aria-label="isCaching ? `Téléchargement des tuiles en cours, ${cacheProgress}%` : 'Télécharger les tuiles de la carte pour usage hors-ligne'"
          @click="downloadMapForOffline"
        >
          <span v-if="isCaching">Téléchargement… {{ cacheProgress }}%</span>
          <span v-else><span aria-hidden="true">📥 </span>Carte hors-ligne</span>
        </button>
        <span v-if="!hasRoute" class="offline-hint">Définis une destination d'abord</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.options-backdrop {
  position: fixed;
  inset: 0;
  z-index: 2000;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  justify-content: flex-end;
  align-items: flex-start;
  padding: 8px;
  padding-top: calc(8px + env(safe-area-inset-top));
}

.options-panel {
  width: min(340px, 92vw);
  max-height: calc(100dvh - 32px);
  overflow-y: auto;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  padding: 12px;
}

.options-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 1rem;
  cursor: pointer;
  padding: 4px 8px;
}

.option-block {
  padding: 10px 0;
  border-top: 1px solid var(--border);
}

.option-block:first-of-type {
  border-top: none;
}

.max-autonomy {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.875rem;
}

.num-field {
  position: relative;
  display: flex;
  align-items: center;
}

.num-input {
  width: 84px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--primary);
  font-size: 0.95rem;
  font-weight: 600;
  text-align: right;
  padding: 8px 26px 8px 10px;
  outline: none;
  -moz-appearance: textfield;
}

.num-input::-webkit-outer-spin-button,
.num-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.num-input:focus {
  border-color: var(--primary);
}

.num-unit {
  position: absolute;
  right: 8px;
  color: var(--text-muted);
  font-size: 0.8rem;
  pointer-events: none;
}

.toggles {
  display: flex;
  gap: 8px;
}

.toggle {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 8px 6px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.2s;
}

.toggle:hover {
  border-color: var(--primary);
}

.toggle.winter.active {
  background: #3b82f6;
  border-color: #3b82f6;
  color: white;
}

.toggle.toll.active {
  background: #22c55e;
  border-color: #22c55e;
  color: white;
}

.toggle.roundtrip.active {
  background: #8b5cf6;
  border-color: #8b5cf6;
  color: white;
}

.toggle-icon {
  font-size: 1.2rem;
}

.toggle-label {
  font-size: 0.7rem;
  font-weight: 500;
}

.toggle-sub {
  font-size: 0.65rem;
  opacity: 0.8;
}

.filters {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.filter-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.875rem;
  cursor: pointer;
}

.filter-item input[type="checkbox"] {
  width: 18px;
  height: 18px;
  accent-color: var(--primary);
  cursor: pointer;
}

.filter-item select {
  margin-left: auto;
  background: var(--bg);
  border: 1px solid var(--border);
  color: var(--text);
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 0.875rem;
  cursor: pointer;
}

.slider-item {
  gap: 10px;
}

.radius-slider {
  flex: 1;
  height: 4px;
  -webkit-appearance: none;
  appearance: none;
  background: var(--border);
  border-radius: 2px;
  outline: none;
}

.radius-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 16px;
  height: 16px;
  background: var(--primary);
  border-radius: 50%;
  cursor: pointer;
}

.radius-slider::-moz-range-thumb {
  width: 16px;
  height: 16px;
  background: var(--primary);
  border-radius: 50%;
  cursor: pointer;
  border: none;
}

.radius-value {
  color: var(--primary);
  font-weight: 600;
  min-width: 45px;
  text-align: right;
}

.offline-block {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.offline-btn {
  width: 100%;
  padding: 10px 12px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.offline-btn:hover:not(:disabled) {
  border-color: var(--primary);
  background: rgba(16, 185, 129, 0.1);
}

.offline-btn:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.offline-btn.caching {
  background: var(--primary);
  color: white;
  border-color: var(--primary);
}

.offline-hint {
  font-size: 0.75rem;
  color: var(--text-muted);
  text-align: center;
}
</style>
