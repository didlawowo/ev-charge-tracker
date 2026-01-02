<script setup>
import { inject } from 'vue'
import ChargerCard from './ChargerCard.vue'

const chargers = inject('chargers')
const loading = inject('loading')
</script>

<template>
  <div class="list-view">
    <div v-if="loading && chargers.length === 0" class="loading-state">
      <div class="spinner" />
      <p>Recherche des bornes...</p>
    </div>

    <div v-else-if="chargers.length === 0" class="empty-state">
      <p>Aucune borne trouvée</p>
      <span>Essayez de modifier les filtres</span>
    </div>

    <div v-else class="charger-list">
      <ChargerCard
        v-for="charger in chargers"
        :key="charger.id"
        :charger="charger"
      />
    </div>
  </div>
</template>

<style scoped>
.list-view {
  height: 100%;
  overflow-y: auto;
  padding: 8px;
  -webkit-overflow-scrolling: touch;
}

.loading-state, .empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 12px;
  color: var(--text-muted);
}

.empty-state span {
  font-size: 0.875rem;
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

.charger-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-bottom: 10px;
}
</style>
