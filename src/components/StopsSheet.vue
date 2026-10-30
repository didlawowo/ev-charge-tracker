<script setup>
import { ref, inject } from 'vue'
import AppIcon from './AppIcon.js'
import { navigationUrl, navigationLabel, maxCcsPower } from '../utils'

defineProps({
  stops: { type: Array, required: true }
})

const emit = defineEmits(['focus'])

const preferredNavigation = inject('preferredNavigation', ref('apple'))

const expanded = ref(true)
</script>

<template>
  <section class="stops-sheet" aria-label="Arrêts de recharge recommandés">
    <button
      type="button"
      class="sheet-handle"
      :aria-expanded="expanded"
      @click="expanded = !expanded"
    >
      <span class="grabber" aria-hidden="true" />
      <span class="sheet-title">
        <AppIcon name="bolt" :size="16" />
        {{ stops.length }} arrêt{{ stops.length > 1 ? 's' : '' }} recommandé{{ stops.length > 1 ? 's' : '' }}
      </span>
      <AppIcon :name="expanded ? 'chevronDown' : 'chevronUp'" :size="20" class="sheet-chevron" />
    </button>

    <ol v-show="expanded" class="stops-list">
      <li
        v-for="stop in stops"
        :key="stop.id"
        class="stop-item"
        :class="{ unreachable: stop.unreachable }"
      >
        <button
          type="button"
          class="stop-main"
          :aria-label="`Voir ${stop.name} sur la carte`"
          @click="emit('focus', stop)"
        >
          <span class="stop-number">{{ stop.stopNumber }}</span>
          <span class="stop-info">
            <strong>{{ stop.name }}</strong>
            <span class="stop-details">
              Km {{ Math.round(stop.distanceFromStart) }}<template v-if="maxCcsPower(stop)"> · {{ maxCcsPower(stop) }} kW</template> · {{ stop.operator }}<template v-if="!stop.unreachable && stop.chargeMinutes"> · ≈ {{ stop.chargeMinutes }} min</template>
            </span>
            <span v-if="stop.unreachable" class="stop-warning">Trajet non réalisable avec cette limite de recharge</span>
          </span>
        </button>
        <a
          class="stop-nav"
          :href="navigationUrl(preferredNavigation, stop)"
          target="_blank"
          rel="noopener"
          :aria-label="`Itinéraire ${navigationLabel(preferredNavigation)} vers ${stop.name}`"
        >
          <AppIcon name="navigation" :size="20" />
        </a>
      </li>
    </ol>
    <p v-if="expanded && stops.length" class="maps-note">
      L'application de navigation choisie calcule indépendamment l'heure d'arrivée. EV Finder limite les recharges à la durée configurée.
    </p>
  </section>
</template>

<style scoped>
.stops-sheet {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-bottom: none;
  border-radius: 18px 18px 0 0;
  box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.35);
}

.sheet-handle {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 50px;
  padding: 16px 16px 8px;
  background: none;
  border: none;
  color: var(--text);
  cursor: pointer;
}

.grabber {
  position: absolute;
  top: 6px;
  left: 50%;
  width: 36px;
  height: 4px;
  border-radius: 2px;
  background: var(--border);
  transform: translateX(-50%);
}

.sheet-title {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.95rem;
  font-weight: 600;
  text-align: left;
}

.sheet-title .app-icon {
  color: var(--primary);
}

.sheet-chevron {
  color: var(--text-muted);
}

.stops-list {
  list-style: none;
  max-height: min(240px, 30vh);
  overflow-y: auto;
  padding: 0 8px 8px;
}

.stop-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.stop-item + .stop-item {
  border-top: 1px solid var(--border);
}

.stop-main {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 60px;
  padding: 8px;
  background: none;
  border: none;
  border-radius: 12px;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.stop-main:active {
  background: var(--bg-elevated);
}

.stop-number {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: var(--info);
  color: #fff;
  font-size: 0.85rem;
  font-weight: 700;
}

.unreachable .stop-number {
  background: var(--warning);
  color: #2a1a00;
}

.stop-info {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.stop-info strong {
  font-size: 0.9rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.stop-details {
  font-size: 0.78rem;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.stop-warning {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--warning);
}

.maps-note {
  padding: 2px 16px 12px;
  color: var(--text-muted);
  font-size: 0.7rem;
  line-height: 1.35;
}

.stop-nav {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: var(--primary-soft);
  color: var(--primary);
}
</style>
