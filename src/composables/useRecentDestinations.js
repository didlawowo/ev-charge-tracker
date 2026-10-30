import { ref } from 'vue'

export const RECENT_DESTINATIONS_KEY = 'ev-finder:recent-destinations'
const MAX_RECENTS = 10

const isValidPlace = place => place &&
  typeof place.name === 'string' && place.name.trim().length > 0 &&
  Number.isFinite(place.lat) && place.lat >= -90 && place.lat <= 90 &&
  Number.isFinite(place.lng) && place.lng >= -180 && place.lng <= 180

const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()

/**
 * Historique local limité à 10 lieux, sans cookie ni compte.
 * Les lieux sont identifiés par leur nom + leurs coordonnées arrondies (≈ 110 m).
 */
const placeKey = place => `${normalize(place.name)}|${place.lat.toFixed(3)}|${place.lng.toFixed(3)}`

export function useRecentDestinations() {
  const read = () => {
    try {
      const data = JSON.parse(localStorage.getItem(RECENT_DESTINATIONS_KEY) || '[]')
      if (!Array.isArray(data)) return []
      const seen = new Set()
      return data.filter(isValidPlace).filter(place => {
        const key = placeKey(place)
        if (seen.has(key)) return false
        seen.add(key)
        return true
      }).slice(0, MAX_RECENTS)
    } catch {
      return []
    }
  }

  const recentDestinations = ref(read())

  const persist = () => {
    try {
      localStorage.setItem(RECENT_DESTINATIONS_KEY, JSON.stringify(recentDestinations.value))
    } catch {
      // En navigation privée l'historique reste disponible jusqu'à fermeture.
    }
  }

  const rememberDestination = place => {
    if (!isValidPlace(place)) return
    const clean = {
      name: place.name,
      fullName: typeof place.fullName === 'string' ? place.fullName : place.name.split(',')[0],
      lat: place.lat,
      lng: place.lng
    }
    const key = placeKey(clean)
    recentDestinations.value = [
      clean,
      ...recentDestinations.value.filter(p => placeKey(p) !== key)
    ].slice(0, MAX_RECENTS)
    persist()
  }

  const clearRecentDestinations = () => {
    recentDestinations.value = []
    persist()
  }

  const removeRecentDestination = place => {
    if (!isValidPlace(place)) return
    const key = placeKey(place)
    recentDestinations.value = recentDestinations.value.filter(p => placeKey(p) !== key)
    persist()
  }

  return {
    recentDestinations,
    rememberDestination,
    clearRecentDestinations,
    removeRecentDestination
  }
}
