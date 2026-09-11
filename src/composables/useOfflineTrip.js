import { ref, watch, onUnmounted } from 'vue'

export const TRIP_STORAGE_KEY = 'ev-finder:last-trip'
const TRIP_STORAGE_VERSION = 1
const TRIP_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

const readSavedTrip = () => {
  try {
    const raw = localStorage.getItem(TRIP_STORAGE_KEY)
    if (!raw) return null
    const trip = JSON.parse(raw)
    if (trip?.version !== TRIP_STORAGE_VERSION || !trip.destination || !trip.routes?.length) return null
    if (Date.now() - trip.savedAt > TRIP_MAX_AGE_MS) return null
    return trip
  } catch {
    return null
  }
}

// 5 décimales ≈ 1 m : divise la taille du tracé stocké sans perte visible
const roundCoordinates = (coordinates) =>
  coordinates.map(([lng, lat]) => [Math.round(lng * 1e5) / 1e5, Math.round(lat * 1e5) / 1e5])

/**
 * Garde le dernier trajet calculé (itinéraires + bornes) sur l'appareil pour pouvoir
 * le réafficher sans réseau. La politique d'usage d'OpenStreetMap interdit de
 * pré-télécharger les tuiles : seules les données du trajet sont enregistrées, le fond
 * de carte reste limité aux zones déjà affichées (cache du service worker).
 */
export function useOfflineTrip({
  destination,
  destinationQuery,
  chargers,
  alternativeRoutes,
  selectedRouteIndex,
  routeGeometry,
  loading,
  error,
  restoreTrip
}) {
  const isOnline = ref(navigator.onLine)
  const savedTrip = ref(readSavedTrip())
  // Date d'enregistrement du trajet affiché s'il vient du stockage, null pour des données fraîches
  const restoredAt = ref(null)

  const saveTrip = () => {
    const trip = {
      version: TRIP_STORAGE_VERSION,
      savedAt: Date.now(),
      destination: destination.value,
      destinationQuery: destinationQuery.value,
      selectedRouteIndex: selectedRouteIndex.value,
      routes: alternativeRoutes.value.map(route => ({
        ...route,
        coordinates: roundCoordinates(route.coordinates)
      })),
      chargers: chargers.value
    }
    try {
      localStorage.setItem(TRIP_STORAGE_KEY, JSON.stringify(trip))
      savedTrip.value = trip
    } catch {
      // Quota dépassé ou stockage indisponible (navigation privée) : rien à enregistrer
    }
  }

  // Enregistrer dès qu'un trajet et ses bornes ont fini de charger sans erreur
  watch(loading, (isLoading) => {
    if (isLoading || error.value) return
    if (!destination.value || !routeGeometry.value || alternativeRoutes.value.length === 0) return
    restoredAt.value = null
    saveTrip()
  })

  // Nouvelle destination ou destination effacée : on n'affiche plus le trajet enregistré
  watch(destination, (dest) => {
    const saved = savedTrip.value?.destination
    if (!dest || !saved || dest.lat !== saved.lat || dest.lng !== saved.lng) {
      restoredAt.value = null
    }
  })

  const resumeTrip = () => {
    const trip = savedTrip.value
    if (!trip) return
    const index = Math.min(trip.selectedRouteIndex || 0, trip.routes.length - 1)
    restoreTrip({
      routes: trip.routes,
      selectedRouteIndex: index,
      chargers: trip.chargers || [],
      destination: trip.destination
    })
    destination.value = trip.destination
    destinationQuery.value = trip.destinationQuery || trip.destination.name
    restoredAt.value = trip.savedAt
  }

  const forgetTrip = () => {
    try {
      localStorage.removeItem(TRIP_STORAGE_KEY)
    } catch {
      // Stockage indisponible : rien à supprimer
    }
    savedTrip.value = null
  }

  const onOnline = () => { isOnline.value = true }
  const onOffline = () => { isOnline.value = false }
  window.addEventListener('online', onOnline)
  window.addEventListener('offline', onOffline)

  onUnmounted(() => {
    window.removeEventListener('online', onOnline)
    window.removeEventListener('offline', onOffline)
  })

  // App ouverte sans réseau (en voiture) : réafficher directement le dernier trajet
  if (!isOnline.value && savedTrip.value) {
    resumeTrip()
  }

  return {
    isOnline,
    savedTrip,
    restoredAt,
    resumeTrip,
    forgetTrip
  }
}
