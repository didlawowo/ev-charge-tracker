<script setup>
import { inject, computed, ref, onMounted, onUnmounted } from 'vue'
import AppIcon from './AppIcon.js'
import { version } from '../../package.json'

const emit = defineEmits(['close'])

const maxAutonomy = inject('maxAutonomy')
const winterMode = inject('winterMode')
const winterFactor = inject('winterFactor')
const roundTripMode = inject('roundTripMode')
const onlyCCS = inject('onlyCCS')
const excludeTesla = inject('excludeTesla')
const maxChargeMinutes = inject('maxChargeMinutes')
const preferredNavigation = inject('preferredNavigation')
const minPower = inject('minPower')
const onlyOnRoute = inject('onlyOnRoute')
const searchRadius = inject('searchRadius')
const autonomy = inject('autonomy')

const closeBtn = ref(null)

const winterPct = computed(() => Math.round((winterFactor?.value ?? 1) * 100))

// Chiffres uniquement ; la valeur n'est appliquée qu'à la validation (blur / Entrée).
// L'appliquer à chaque touche faisait passer le max par « 3 » en tapant « 350 »,
// ce qui ramenait l'autonomie restante à 3 km.
const onMaxAutonomyInput = (e) => {
  const digits = e.target.value.replace(/\D/g, '').slice(0, 3)
  if (e.target.value !== digits) e.target.value = digits
}

const commitMaxAutonomy = (e) => {
  const val = parseInt(e.target.value)
  maxAutonomy.value = Number.isFinite(val) ? Math.min(Math.max(val, 100), 470) : maxAutonomy.value
  e.target.value = maxAutonomy.value
  // L'autonomie restante ne peut pas dépasser le max voiture
  if (autonomy && autonomy.value > maxAutonomy.value) {
    autonomy.value = maxAutonomy.value
  }
}

const selectAll = (e) => {
  const el = e.target
  setTimeout(() => el.setSelectionRange(0, el.value.length), 0)
}

const onKeydown = (e) => {
  if (e.key === 'Escape') emit('close')
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  closeBtn.value?.focus({ preventScroll: true })
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div class="options-backdrop" @click="emit('close')">
    <div
      class="options-panel"
      role="dialog"
      aria-modal="true"
      aria-labelledby="options-title"
      @click.stop
    >
      <span class="grabber" aria-hidden="true" />
      <div class="options-header">
        <h2 id="options-title">Options</h2>
        <button ref="closeBtn" class="close-btn" aria-label="Fermer" @click="emit('close')">
          <AppIcon name="x" :size="20" />
        </button>
      </div>

      <!-- Véhicule -->
      <section class="option-section">
        <h3 class="section-title">Véhicule</h3>
        <div class="row max-autonomy">
          <label for="max-autonomy-input" class="row-text">
            <span class="row-label">Autonomie max</span>
            <span class="row-sub">Batterie à 100 %, en conditions normales</span>
          </label>
          <div class="num-field">
            <input
              id="max-autonomy-input"
              type="text"
              inputmode="numeric"
              pattern="[0-9]*"
              maxlength="3"
              enterkeyhint="done"
              :value="maxAutonomy"
              class="num-input"
              @input="onMaxAutonomyInput"
              @focus="selectAll"
              @blur="commitMaxAutonomy"
              @keydown.enter.prevent="e => e.target.blur()"
            >
            <span class="num-unit">km</span>
          </div>
        </div>
      </section>

      <!-- Trajet -->
      <section class="option-section">
        <h3 class="section-title">Trajet</h3>
        <button
          type="button"
          class="row toggle winter"
          role="switch"
          :aria-checked="winterMode"
          :class="{ active: winterMode }"
          @click="winterMode = !winterMode"
        >
          <span class="row-icon"><AppIcon name="snowflake" :size="18" /></span>
          <span class="row-text">
            <span class="row-label">Mode hiver</span>
            <span class="row-sub">
              {{ winterMode ? `Novembre à mars · autonomie ramenée à ${winterPct} % (25 kWh/100 km)` : 'Désactivé automatiquement dès avril · réglage manuel possible' }}
            </span>
          </span>
          <span class="switch" aria-hidden="true" />
        </button>

        <button
          type="button"
          class="row toggle roundtrip"
          role="switch"
          :aria-checked="roundTripMode"
          :class="{ active: roundTripMode }"
          @click="roundTripMode = !roundTripMode"
        >
          <span class="row-icon"><AppIcon name="repeat" :size="18" /></span>
          <span class="row-text">
            <span class="row-label">Aller-retour</span>
            <span class="row-sub">Vérifie l'autonomie pour revenir</span>
          </span>
          <span class="switch" aria-hidden="true" />
        </button>

        <label class="row filter-item">
          <span class="row-text">
            <span class="row-label">Recharge max. par arrêt</span>
            <span class="row-sub">25 min par défaut · estimation, selon la borne et la voiture</span>
          </span>
          <select v-model.number="maxChargeMinutes" class="select" aria-label="Durée maximale de recharge par arrêt">
            <option v-for="minutes in [10, 15, 20, 25, 30, 40, 45, 60]" :key="minutes" :value="minutes">
              {{ minutes }} min
            </option>
          </select>
        </label>
      </section>

      <!-- Navigation -->
      <section class="option-section">
        <h3 class="section-title">Navigation</h3>
        <label class="row filter-item">
          <span class="row-text">
            <span class="row-label">Ouvrir les itinéraires avec</span>
            <span class="row-sub">Un seul bouton de navigation affiché sur les bornes</span>
          </span>
          <select v-model="preferredNavigation" class="select" aria-label="Application de navigation">
            <option value="apple">Plans</option>
            <option value="google">Google Maps</option>
          </select>
        </label>
      </section>

      <!-- Filtres bornes -->
      <section class="option-section filters">
        <h3 class="section-title">Bornes</h3>

        <label class="row filter-item">
          <span class="row-text">
            <span class="row-label">CCS uniquement</span>
            <span class="row-sub">Prise Combo (Type 1 / Type 2)</span>
          </span>
          <input v-model="onlyCCS" type="checkbox" role="switch" class="switch-input">
        </label>

        <label class="row filter-item">
          <span class="row-text">
            <span class="row-label">Sur ma route</span>
            <span class="row-sub">À moins de 5 km du trajet</span>
          </span>
          <input v-model="onlyOnRoute" type="checkbox" role="switch" class="switch-input">
        </label>

        <label class="row filter-item">
          <span class="row-text">
            <span class="row-label">Masquer les Superchargeurs Tesla</span>
            <span class="row-sub">Activé par défaut</span>
          </span>
          <input v-model="excludeTesla" type="checkbox" role="switch" class="switch-input">
        </label>

        <label class="row filter-item">
          <span class="row-text">
            <span class="row-label">Puissance min.</span>
          </span>
          <select v-model="minPower" class="select">
            <option :value="0">Toutes</option>
            <option :value="50">50 kW et +</option>
            <option :value="100">100 kW et +</option>
            <option :value="150">150 kW et +</option>
            <option :value="300">300 kW et +</option>
          </select>
        </label>

        <div class="radius-block">
          <div class="radius-head">
            <label for="radius-slider" class="row-text">
              <span class="row-label">Rayon de recherche</span>
              <span class="row-sub">Sans destination</span>
            </label>
            <span class="radius-value">{{ Math.round(searchRadius / 1000) }} km</span>
          </div>
          <input
            id="radius-slider"
            type="range"
            :value="searchRadius"
            min="5000"
            max="100000"
            step="5000"
            class="radius-slider"
            @input="e => searchRadius = parseInt(e.target.value)"
          >
        </div>
      </section>

      <!-- PWA iOS : conseil dans les réglages, sans bandeau qui cache la carte. -->
      <section class="option-section">
        <h3 class="section-title">Installation</h3>
        <p class="row-sub">
          Sur iPhone, utilise le menu de partage du navigateur puis « Sur l'écran d'accueil » si cette option est proposée.
        </p>
      </section>

      <!-- Hors-ligne -->
      <section class="option-section">
        <h3 class="section-title">Hors-ligne</h3>
        <div class="row">
          <span class="row-icon"><AppIcon name="offline" :size="18" /></span>
          <span class="row-text">
            <span class="row-label">Dernier trajet enregistré</span>
            <span class="row-sub">
              L'itinéraire, les arrêts et les bornes restent consultables sans réseau.
              Le fond de carte n'est disponible que pour les zones déjà affichées.
            </span>
          </span>
        </div>
      </section>

      <p class="app-version">EV Finder v{{ version }}</p>
    </div>
  </div>
</template>

<style scoped>
.options-backdrop {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: rgba(2, 6, 14, 0.55);
  animation: fade-in 0.2s ease-out;
}

.options-panel {
  position: relative;
  width: 100%;
  max-width: 520px;
  max-height: 88dvh;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 10px 16px calc(16px + env(safe-area-inset-bottom));
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-bottom: none;
  border-radius: 20px 20px 0 0;
  box-shadow: var(--shadow);
  animation: slide-up 0.25s ease-out;
}

/* Grand écran : panneau latéral en haut à droite */
@media (min-width: 700px) {
  .options-backdrop {
    align-items: flex-start;
    justify-content: flex-end;
    padding: 12px;
    padding-top: calc(12px + env(safe-area-inset-top));
  }

  .options-panel {
    width: 380px;
    max-height: calc(100dvh - 24px);
    border-bottom: 1px solid var(--border);
    border-radius: 16px;
  }

  .grabber {
    display: none;
  }
}

@keyframes fade-in {
  from { opacity: 0; }
}

@keyframes slide-up {
  from { transform: translateY(24px); opacity: 0; }
}

.grabber {
  display: block;
  width: 36px;
  height: 4px;
  margin: 0 auto 4px;
  border-radius: 2px;
  background: var(--border);
}

.options-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 2px;
}

.options-header h2 {
  font-size: 1.15rem;
  font-weight: 700;
}

.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  margin-right: -8px;
  background: none;
  border: none;
  border-radius: 12px;
  color: var(--text-muted);
  cursor: pointer;
}

.option-section {
  padding: 10px 0;
  border-top: 1px solid var(--border);
}

.section-title {
  margin: 2px 0 4px;
  color: var(--text-muted);
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.row {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  min-height: 56px;
  padding: 6px 0;
}

.toggle {
  background: none;
  border: none;
  color: var(--text);
  text-align: left;
  cursor: pointer;
}

.row-icon {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: var(--bg-elevated);
  color: var(--text-muted);
  transition: all 0.2s;
}

.toggle.winter.active .row-icon {
  background: rgba(59, 130, 246, 0.2);
  color: #7cb1ff;
}

.toggle.roundtrip.active .row-icon {
  background: rgba(139, 92, 246, 0.22);
  color: #b9a1ff;
}

.row-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.row-label {
  font-size: 0.95rem;
  font-weight: 500;
}

.row-sub {
  color: var(--text-muted);
  font-size: 0.78rem;
  line-height: 1.3;
}

/* Interrupteurs : bouton (trajet) et checkbox native (filtres) partagent le rendu */
.switch,
.switch-input {
  position: relative;
  flex-shrink: 0;
  width: 46px;
  height: 28px;
  border-radius: 14px;
  background: var(--border);
  transition: background 0.2s;
}

.switch::after,
.switch-input::after {
  content: '';
  position: absolute;
  top: 3px;
  left: 3px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  transition: transform 0.2s;
}

.toggle.active .switch,
.switch-input:checked {
  background: var(--primary);
}

.toggle.active .switch::after,
.switch-input:checked::after {
  transform: translateX(18px);
}

.switch-input {
  -webkit-appearance: none;
  appearance: none;
  cursor: pointer;
}

.filter-item {
  cursor: pointer;
}

.select {
  height: 40px;
  padding: 0 10px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 10px;
  color: var(--text);
  font-size: 16px;
  cursor: pointer;
}

.num-field {
  position: relative;
  display: flex;
  align-items: center;
}

.num-input {
  width: 88px;
  height: 44px;
  padding: 0 32px 0 10px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 10px;
  color: var(--text);
  font-size: 16px;
  font-weight: 700;
  text-align: right;
  outline: none;
}

.num-input:focus {
  border-color: var(--primary);
}

.num-unit {
  position: absolute;
  right: 10px;
  color: var(--text-muted);
  font-size: 0.8rem;
  pointer-events: none;
}

.radius-block {
  padding: 8px 0 4px;
}

.radius-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.radius-value {
  color: var(--primary);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.radius-slider {
  width: 100%;
  height: 6px;
  -webkit-appearance: none;
  appearance: none;
  background: var(--border);
  border-radius: 3px;
  outline: none;
}

.radius-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 26px;
  height: 26px;
  background: #fff;
  border: 3px solid var(--primary);
  border-radius: 50%;
  cursor: pointer;
}

.radius-slider::-moz-range-thumb {
  width: 22px;
  height: 22px;
  background: #fff;
  border: 3px solid var(--primary);
  border-radius: 50%;
  cursor: pointer;
}

.app-version {
  padding-top: 8px;
  color: var(--text-muted);
  font-size: 0.72rem;
  text-align: center;
}
</style>
