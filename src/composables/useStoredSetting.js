import { ref, watch } from 'vue'

/**
 * Réglage local avec valeur par défaut et validation des anciennes données.
 * La PWA reste utilisable lorsque le stockage est bloqué (navigation privée).
 */
export function useStoredSetting(key, fallback, parse) {
  let initialValue = fallback
  try {
    const stored = window.localStorage.getItem(key)
    if (stored !== null) {
      const parsed = parse(stored)
      if (parsed !== undefined && parsed !== null) initialValue = parsed
    }
  } catch {
    // Stockage indisponible : garder le réglage par défaut.
  }

  const setting = ref(initialValue)
  watch(setting, value => {
    try {
      window.localStorage.setItem(key, String(value))
    } catch {
      // Le réglage fonctionne pour la session, même sans stockage.
    }
  })
  return setting
}
