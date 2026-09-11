<script setup>
import { inject, ref, computed } from 'vue'
import ChargerCard from './ChargerCard.vue'
import AppIcon from './AppIcon.js'

const chargers = inject('chargers')
const loading = inject('loading')
const chargersError = inject('chargersError', ref(null))
const routeGeometry = inject('routeGeometry', ref(null))
const searchRadius = inject('searchRadius', ref(50000))
const openOptions = inject('openOptions', () => {})
const refreshChargers = inject('refreshChargers', () => {})

const scopeLabel = computed(() =>
  routeGeometry.value
    ? 'le long du trajet'
    : `dans un rayon de ${Math.round(searchRadius.value / 1000)} km`
)
</script>

<template>
  <div class="list-view">
    <div v-if="loading && chargers.length === 0" class="list-state">
      <div class="spinner" aria-hidden="true" />
      <p>Recherche des bornes…</p>
    </div>

    <div v-else-if="chargersError && chargers.length === 0" class="list-state" role="alert">
      <span class="state-icon warn"><AppIcon name="alert" :size="26" /></span>
      <p class="state-title">Impossible de charger les bornes</p>
      <span class="state-text">{{ chargersError }}</span>
      <button type="button" class="primary-btn" @click="refreshChargers">Réessayer</button>
    </div>

    <div v-else-if="chargers.length === 0" class="list-state">
      <span class="state-icon"><AppIcon name="bolt" :size="26" /></span>
      <p class="state-title">Aucune borne trouvée</p>
      <span class="state-text">
        <template v-if="routeGeometry">
          Aucune borne ne correspond aux filtres au-delà de 70 % de ton autonomie sur ce trajet.
        </template>
        <template v-else>
          Aucune borne {{ scopeLabel }} avec les filtres actuels.
        </template>
      </span>
      <button type="button" class="primary-btn" @click="openOptions">Modifier les filtres</button>
    </div>

    <template v-else>
      <div class="list-header">
        <p>
          <strong>{{ chargers.length }} borne{{ chargers.length > 1 ? 's' : '' }}</strong>
          <span>{{ scopeLabel }}</span>
        </p>
        <button type="button" class="filters-btn" @click="openOptions">
          <AppIcon name="sliders" :size="16" />
          Filtres
        </button>
      </div>

      <div class="charger-list">
        <ChargerCard
          v-for="charger in chargers"
          :key="charger.id"
          :charger="charger"
        />
      </div>
    </template>
  </div>
</template>

<style scoped>
.list-view {
  height: 100%;
  overflow-y: auto;
  padding: 8px 12px 16px;
  -webkit-overflow-scrolling: touch;
}

.list-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  height: 100%;
  padding: 24px;
  text-align: center;
}

.state-title {
  font-size: 1.05rem;
  font-weight: 600;
}

.state-text {
  max-width: 320px;
  color: var(--text-muted);
  font-size: 0.9rem;
  line-height: 1.45;
}

.list-header {
  position: sticky;
  top: -8px;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin: -8px -12px 8px;
  padding: 10px 12px;
  background: var(--bg);
}

.list-header p {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 0 6px;
  font-size: 0.95rem;
}

.list-header p span {
  color: var(--text-muted);
  font-size: 0.8rem;
}

.filters-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 36px;
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--bg-card);
  color: var(--text);
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
}

.charger-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--border);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
