<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import AppIcon from './AppIcon.js'

const props = defineProps({
  modelValue: { type: Number, required: true },
  max: { type: Number, required: true }
})

const emit = defineEmits(['update:modelValue', 'close'])

const MIN = 10

// Brouillon en texte : on ne plafonne pas pendant la frappe (sinon « 3 » devient 10 avant « 30 »)
const draft = ref(String(props.modelValue))
const inputEl = ref(null)
let openedAt = 0

// iOS (Firefox/Brave inclus) peut conserver un décalage du viewport après
// disparition du clavier : recaler l'application une fois l'éditeur fermé.
const restoreViewport = () => {
  window.scrollTo(0, 0)
}

const closeEditor = () => {
  inputEl.value?.blur()
  emit('close')
  window.requestAnimationFrame(restoreViewport)
  window.setTimeout(restoreViewport, 350)
}

// Un double-tap sur le bouton d'autonomie peut tomber sur le fond de la
// modale au deuxième tap. Ne pas refermer immédiatement l'éditeur.
const onBackdropClick = () => {
  if (Date.now() - openedAt < 600) return
  closeEditor()
}

const clamp = (value) => Math.min(Math.max(value, MIN), props.max)

const draftValue = computed(() => {
  const value = parseInt(draft.value, 10)
  return Number.isFinite(value) ? value : null
})

const outOfRange = computed(() =>
  draftValue.value !== null && (draftValue.value < MIN || draftValue.value > props.max)
)

const percent = computed(() =>
  draftValue.value === null ? null : Math.round((clamp(draftValue.value) / props.max) * 100)
)

const sliderValue = computed(() => clamp(draftValue.value ?? props.modelValue))

const presets = computed(() =>
  [20, 50, 80, 100].map(pct => ({
    pct,
    km: clamp(Math.round((props.max * pct) / 100 / 5) * 5)
  }))
)

const setValue = (value) => {
  draft.value = String(clamp(Math.round(value)))
}

const step = (delta) => setValue((draftValue.value ?? props.modelValue) + delta)

const onInput = (e) => {
  const digits = e.target.value.replace(/\D/g, '').slice(0, 3)
  if (e.target.value !== digits) e.target.value = digits
  draft.value = digits
}

// Tout sélectionner au focus : la saisie remplace la valeur au lieu de s'y ajouter.
// setTimeout nécessaire sur Safari iOS, qui repositionne le curseur après le focus.
const selectAll = (e) => {
  const el = e.target
  setTimeout(() => el.setSelectionRange(0, el.value.length), 0)
}

const confirm = () => {
  if (draftValue.value === null) return
  emit('update:modelValue', clamp(draftValue.value))
  closeEditor()
}

const onKeydown = (e) => {
  if (e.key === 'Escape') closeEditor()
}

onMounted(() => {
  openedAt = Date.now()
  window.addEventListener('keydown', onKeydown)
  // Au clavier/souris, prêt à taper. Sur tactile on n'ouvre pas le clavier d'office :
  // il masquerait le curseur et les raccourcis.
  if (!window.matchMedia('(pointer: coarse)').matches) {
    inputEl.value?.focus()
  }
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <Teleport to="body">
    <div class="sheet-backdrop" @click="onBackdropClick">
      <div
        class="sheet autonomy-editor"
        role="dialog"
        aria-modal="true"
        aria-labelledby="autonomy-editor-title"
        @click.stop
      >
        <span class="grabber" aria-hidden="true" />
        <div class="sheet-header">
          <h2 id="autonomy-editor-title">Autonomie restante</h2>
          <button type="button" class="close-btn" aria-label="Annuler" @click="closeEditor">
            <AppIcon name="x" :size="20" />
          </button>
        </div>
        <p class="sheet-hint">Les kilomètres affichés par la voiture.</p>

        <div class="value-row">
          <button type="button" class="step-btn" aria-label="Retirer 10 km" @click="step(-10)">−10</button>
          <label class="value-field" :class="{ invalid: outOfRange }">
            <input
              ref="inputEl"
              type="text"
              inputmode="numeric"
              pattern="[0-9]*"
              maxlength="3"
              enterkeyhint="done"
              class="autonomy-input"
              aria-label="Autonomie restante en km"
              :value="draft"
              @input="onInput"
              @focus="selectAll"
              @keydown.enter.prevent="confirm"
            >
            <span class="value-unit">km</span>
          </label>
          <button type="button" class="step-btn" aria-label="Ajouter 10 km" @click="step(10)">+10</button>
        </div>

        <p class="value-sub" :class="{ warn: outOfRange }" aria-live="polite">
          <template v-if="outOfRange">Entre {{ MIN }} et {{ max }} km</template>
          <template v-else-if="percent !== null">≈ {{ percent }} % de {{ max }} km</template>
          <template v-else>Saisis une valeur</template>
        </p>

        <input
          type="range"
          class="slider"
          :min="MIN"
          :max="max"
          step="5"
          :value="sliderValue"
          aria-label="Régler l'autonomie restante"
          @input="e => (draft = e.target.value)"
        >

        <div class="presets">
          <button
            v-for="preset in presets"
            :key="preset.pct"
            type="button"
            class="preset"
            :class="{ active: draftValue === preset.km }"
            @click="setValue(preset.km)"
          >
            <strong>{{ preset.pct }} %</strong>
            <span>{{ preset.km }} km</span>
          </button>
        </div>

        <button
          type="button"
          class="confirm-btn"
          :disabled="draftValue === null"
          @click="confirm"
        >
          Valider
        </button>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.sheet-backdrop {
  touch-action: manipulation;
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: rgba(2, 6, 14, 0.55);
  animation: fade-in 0.2s ease-out;
}

.sheet {
  width: 100%;
  max-width: 480px;
  max-height: 88dvh;
  overflow-y: auto;
  padding: 10px 16px calc(16px + env(safe-area-inset-bottom));
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-bottom: none;
  border-radius: 20px 20px 0 0;
  box-shadow: var(--shadow);
  animation: slide-up 0.25s ease-out;
}

/* Grand écran : fenêtre centrée */
@media (min-width: 700px) {
  .sheet-backdrop {
    align-items: center;
  }

  .sheet {
    border-bottom: 1px solid var(--border);
    border-radius: 20px;
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

.sheet-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.sheet-header h2 {
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

.sheet-hint {
  color: var(--text-muted);
  font-size: 0.85rem;
}

.value-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 18px;
}

.step-btn {
  flex-shrink: 0;
  width: 64px;
  height: 64px;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: var(--bg-elevated);
  color: var(--text);
  font-size: 1.1rem;
  font-weight: 700;
  cursor: pointer;
}

.step-btn:active {
  background: var(--primary-soft);
  border-color: var(--primary);
}

.value-field {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 6px;
  height: 64px;
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: var(--bg);
  cursor: text;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.value-field:focus-within {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px var(--primary-soft);
}

.value-field.invalid {
  border-color: var(--warning);
}

.autonomy-input {
  width: 3.2ch;
  padding: 0;
  border: none;
  outline: none;
  background: none;
  color: var(--text);
  font-size: 2.4rem;
  font-weight: 800;
  line-height: 62px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.autonomy-input:focus-visible {
  outline: none;
}

.value-unit {
  color: var(--text-muted);
  font-size: 1rem;
  font-weight: 600;
}

.value-sub {
  margin: 8px 0 14px;
  color: var(--text-muted);
  font-size: 0.85rem;
  text-align: center;
}

.value-sub.warn {
  color: var(--warning);
}

.slider {
  width: 100%;
  height: 6px;
  -webkit-appearance: none;
  appearance: none;
  background: var(--border);
  border-radius: 3px;
  outline: none;
}

.slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 30px;
  height: 30px;
  background: #fff;
  border: 3px solid var(--primary);
  border-radius: 50%;
  cursor: pointer;
}

.slider::-moz-range-thumb {
  width: 26px;
  height: 26px;
  background: #fff;
  border: 3px solid var(--primary);
  border-radius: 50%;
  cursor: pointer;
}

.presets {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin-top: 18px;
}

.preset {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  min-height: 52px;
  padding: 6px 4px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--bg-elevated);
  color: var(--text);
  cursor: pointer;
}

.preset strong {
  font-size: 0.95rem;
}

.preset span {
  color: var(--text-muted);
  font-size: 0.72rem;
}

.preset.active {
  border-color: var(--primary);
  background: var(--primary-soft);
}

.confirm-btn {
  width: 100%;
  min-height: 52px;
  margin-top: 18px;
  border: none;
  border-radius: 14px;
  background: var(--primary);
  color: var(--on-primary);
  font-size: 1rem;
  font-weight: 700;
  cursor: pointer;
}

.confirm-btn:disabled {
  opacity: 0.5;
  cursor: default;
}
</style>
