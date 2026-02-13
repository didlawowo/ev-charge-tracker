<script setup>
import { inject } from 'vue'

const searchRadius = inject('searchRadius')
const minPower = inject('minPower')
const onlyCCS = inject('onlyCCS')
const onlyOnRoute = inject('onlyOnRoute')
</script>

<template>
  <div class="filter-bar">
    <label class="filter-item">
      <input
        v-model="onlyCCS"
        type="checkbox"
      >
      <span>CCS</span>
    </label>

    <div class="filter-item">
      <span>Puissance:</span>
      <select v-model="minPower">
        <option :value="0">Tout</option>
        <option :value="50">50+ kW</option>
        <option :value="100">100+ kW</option>
        <option :value="150">150+ kW</option>
        <option :value="300">300+ kW</option>
      </select>
    </div>

    <label class="filter-item">
      <input
        v-model="onlyOnRoute"
        type="checkbox"
      >
      <span>Sur ma route</span>
    </label>

    <div class="filter-item slider-item">
      <span>Rayon:</span>
      <input
        type="range"
        :value="searchRadius"
        min="5000"
        max="100000"
        step="5000"
        class="distance-slider"
        @input="e => searchRadius = parseInt(e.target.value)"
      >
      <span class="distance-value">{{ Math.round(searchRadius / 1000) }} km</span>
    </div>
  </div>
</template>

<style scoped>
.filter-bar {
  display: flex;
  gap: 12px;
  padding: 10px 16px;
  background: var(--bg-card);
  border-bottom: 1px solid var(--border);
  flex-wrap: wrap;
}

.filter-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.875rem;
  white-space: nowrap;
  cursor: pointer;
}

.filter-item input[type="checkbox"] {
  width: 18px;
  height: 18px;
  accent-color: var(--primary);
  cursor: pointer;
}

.filter-item select {
  background: var(--bg);
  border: 1px solid var(--border);
  color: var(--text);
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 0.875rem;
  cursor: pointer;
}

.slider-item {
  min-width: 140px;
}

.distance-slider {
  width: 80px;
  height: 4px;
  -webkit-appearance: none;
  appearance: none;
  background: var(--border);
  border-radius: 2px;
  outline: none;
}

.distance-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 14px;
  height: 14px;
  background: var(--primary);
  border-radius: 50%;
  cursor: pointer;
}

.distance-slider::-moz-range-thumb {
  width: 14px;
  height: 14px;
  background: var(--primary);
  border-radius: 50%;
  cursor: pointer;
  border: none;
}

.distance-value {
  color: var(--primary);
  font-weight: 600;
  min-width: 45px;
}
</style>
