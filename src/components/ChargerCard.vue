<script setup>
import { computed, inject, ref } from 'vue'
import { navigationUrl, navigationLabel, maxCcsPower, formatDistance } from '../utils'
import AppIcon from './AppIcon.js'

const props = defineProps({
  charger: {
    type: Object,
    required: true
  }
})

const preferredNavigation = inject('preferredNavigation', ref('apple'))
const plannedStops = inject('plannedStops', ref([]))
const focusOnMap = inject('focusOnMap', null)

const navUrl = computed(() => navigationUrl(preferredNavigation.value, props.charger))
const navLabel = computed(() => navigationLabel(preferredNavigation.value))

const maxPower = computed(() => maxCcsPower(props.charger))

const powerClass = computed(() => {
  if (!maxPower.value) return 'unknown'
  if (maxPower.value >= 150) return 'ultra'
  if (maxPower.value >= 50) return 'fast'
  return 'slow'
})

const stopNumber = computed(() =>
  plannedStops.value.find(s => s.id === props.charger.id)?.stopNumber ?? null
)

const place = computed(() => props.charger.town || props.charger.address)
</script>

<template>
  <article class="charger-card" :class="{ offline: !charger.isOperational, 'is-stop': stopNumber }">
    <button
      type="button"
      class="card-main"
      :aria-label="`Voir ${charger.name} sur la carte`"
      @click="focusOnMap?.(charger)"
    >
      <span class="power-badge" :class="powerClass">
        <template v-if="maxPower">
          <strong>{{ maxPower }}</strong>
          <small>kW</small>
        </template>
        <AppIcon v-else name="bolt" :size="20" />
      </span>

      <span class="card-info">
        <span class="name">{{ charger.name }}</span>
        <span class="meta">
          {{ charger.operator }}<template v-if="place"> · {{ place }}</template>
        </span>
        <span class="tags">
          <span v-if="stopNumber" class="tag stop">Arrêt {{ stopNumber }}</span>
          <span v-if="!charger.isOperational" class="tag off">Hors service</span>
          <span v-if="charger.roadAccess === 'unknown'" class="tag off">Accès non vérifié</span>
          <span v-if="charger.roadAccess === 'routable' && charger.roadDetourMinutes > 0" class="tag">Détour ≈ {{ charger.roadDetourMinutes }} min</span>
          <span v-if="charger.numberOfPoints" class="tag">{{ charger.numberOfPoints }} point{{ charger.numberOfPoints > 1 ? 's' : '' }}</span>
          <span v-if="charger.usageCost" class="tag price">{{ charger.usageCost }}</span>
        </span>
      </span>

      <span class="distance">{{ formatDistance(charger.distance) }}</span>
    </button>

    <div class="card-actions">
      <a :href="navUrl" target="_blank" rel="noopener" class="action primary">
        <AppIcon name="navigation" :size="15" />
        {{ navLabel }}
      </a>
      <a
        :href="charger.detailsUrl"
        target="_blank"
        rel="noopener"
        class="action ghost"
        aria-label="Fiche OpenChargeMap"
      >
        Fiche
        <AppIcon name="external" :size="14" />
      </a>
    </div>
  </article>
</template>

<style scoped>
.charger-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 14px;
  overflow: hidden;
}

.charger-card.is-stop {
  border-color: rgba(59, 130, 246, 0.6);
}

.card-main {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 12px 12px 8px;
  background: none;
  border: none;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.power-badge {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  border-radius: 12px;
  line-height: 1;
}

.power-badge strong {
  font-size: 1.05rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}

.power-badge small {
  margin-top: 2px;
  font-size: 0.65rem;
  font-weight: 600;
}

.power-badge.ultra {
  background: var(--primary);
  color: var(--on-primary);
}

.power-badge.fast {
  background: var(--primary-soft);
  color: var(--primary);
}

.power-badge.slow,
.power-badge.unknown {
  background: var(--bg-elevated);
  color: var(--text-muted);
}

.offline .power-badge {
  background: var(--bg-elevated);
  color: var(--text-muted);
}

.card-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.name {
  font-size: 0.95rem;
  font-weight: 600;
  line-height: 1.25;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.meta {
  font-size: 0.8rem;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 4px;
}

.tag {
  padding: 1px 7px;
  border-radius: 6px;
  background: var(--bg-elevated);
  color: var(--text-muted);
  font-size: 0.7rem;
  font-weight: 500;
}

.tag.stop {
  background: rgba(59, 130, 246, 0.2);
  color: #9cc2ff;
}

.tag.off {
  background: rgba(239, 68, 68, 0.16);
  color: #fca5a5;
}

.tag.price {
  max-width: 100%;
  color: var(--warning);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.distance {
  flex-shrink: 0;
  align-self: flex-start;
  font-size: 0.85rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.card-actions {
  display: flex;
  gap: 6px;
  padding: 0 12px 12px 76px;
}

.action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  min-height: 38px;
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--bg-elevated);
  color: var(--text);
  font-size: 0.8rem;
  font-weight: 600;
  text-decoration: none;
  white-space: nowrap;
}

.action.primary {
  border-color: transparent;
  background: var(--primary-soft);
  color: var(--primary);
}

.action.ghost {
  margin-left: auto;
  background: none;
  border-color: transparent;
  color: var(--text-muted);
}

@media (max-width: 360px) {
  .card-actions {
    padding-left: 12px;
  }
}
</style>
