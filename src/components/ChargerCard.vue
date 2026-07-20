<script setup>
import { computed, inject, ref } from 'vue'
import { googleMapsUrl, appleMapsUrl } from '../utils'

const props = defineProps({
  charger: {
    type: Object,
    required: true
  }
})

const position = inject('position', ref(null))
const destination = inject('destination', ref(null))

const googleUrl = computed(() =>
  googleMapsUrl(position.value, props.charger, destination.value)
)
const appleUrl = computed(() =>
  appleMapsUrl(position.value, props.charger)
)

const formatDistance = (meters) => {
  if (meters < 1000) {
    return `${Math.round(meters)} m`
  }
  return `${(meters / 1000).toFixed(1)} km`
}

// Filtrer pour n'afficher que les CCS
const ccsConnections = computed(() => {
  return props.charger.connections.filter(c =>
    c.typeId === 33 || c.typeId === 32 || c.type.toLowerCase().includes('ccs')
  )
})

const getMaxPower = computed(() => {
  const powers = ccsConnections.value.map(c => c.power).filter(p => p)
  return powers.length > 0 ? Math.max(...powers) : null
})
</script>

<template>
  <div class="charger-card" :class="{ offline: !charger.isOperational }">
    <div class="card-header">
      <div class="distance">{{ formatDistance(charger.distance) }}</div>
      <div v-if="getMaxPower" class="power">{{ getMaxPower }} kW</div>
      <div class="operator">{{ charger.operator }}</div>
    </div>

    <div class="card-body">
      <h3 class="name">{{ charger.name }}</h3>
      <p class="address">{{ charger.town || charger.address }}</p>
    </div>

    <div class="card-footer">
      <div v-if="ccsConnections.length > 0" class="connections">
        <span
          v-for="(conn, i) in ccsConnections.slice(0, 2)"
          :key="i"
          class="connection-tag"
        >
          {{ conn.power }}kW
        </span>
      </div>
      <span v-if="charger.usageCost" class="price">{{ charger.usageCost }}</span>
      <div class="card-actions">
        <a :href="googleUrl" target="_blank" rel="noopener" class="maps-link google">Maps</a>
        <a :href="appleUrl" target="_blank" rel="noopener" class="maps-link apple">Plans</a>
        <a
          :href="charger.detailsUrl"
          target="_blank"
          rel="noopener"
          class="chargemap-link"
        >
          Détails ↗
        </a>
      </div>
    </div>
  </div>
</template>

<style scoped>
.charger-card {
  background: var(--bg-card);
  border-radius: 8px;
  padding: 10px 12px;
  border: 1px solid var(--border);
}

.charger-card.offline {
  opacity: 0.5;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 4px;
  font-size: 0.75rem;
}

.distance {
  font-weight: 600;
  color: var(--primary);
}

.power {
  color: var(--primary);
  font-weight: 500;
}

.operator {
  color: var(--text-muted);
  margin-left: auto;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 120px;
}

.card-body {
  margin-bottom: 6px;
}

.name {
  font-size: 0.9rem;
  font-weight: 600;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.address {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.card-footer {
  display: flex;
  align-items: center;
  gap: 8px;
}

.connections {
  display: flex;
  gap: 4px;
}

.connection-tag {
  font-size: 0.7rem;
  padding: 2px 6px;
  background: var(--border);
  border-radius: 4px;
  color: var(--text-muted);
}

.price {
  font-size: 0.7rem;
  color: #f59e0b;
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
}

.maps-link {
  padding: 4px 8px;
  border-radius: 4px;
  text-decoration: none;
  font-weight: 500;
  font-size: 0.7rem;
  white-space: nowrap;
}

.maps-link.google {
  background: rgba(66, 133, 244, 0.15);
  color: #6ba1ff;
}

.maps-link.apple {
  background: rgba(148, 163, 184, 0.15);
  color: var(--text-muted);
}

.chargemap-link {
  padding: 4px 8px;
  background: rgba(16, 185, 129, 0.15);
  border-radius: 4px;
  color: var(--primary);
  text-decoration: none;
  font-weight: 500;
  font-size: 0.7rem;
  white-space: nowrap;
}
</style>
