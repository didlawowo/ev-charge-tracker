import { ref, onUnmounted } from 'vue'

export function useGeolocation() {
  const position = ref(null)
  const heading = ref(null)
  const speed = ref(0)
  const error = ref(null)
  const permissionDenied = ref(false)
  const isTracking = ref(false)
  // Perte momentanée du signal (tunnel, parking) alors qu'une position est déjà connue
  const signalLost = ref(false)

  let watchId = null

  const startTracking = () => {
    if (!navigator.geolocation) {
      error.value = 'La géolocalisation n\'est pas supportée par votre navigateur'
      return
    }

    // « Réessayer » ne doit pas empiler plusieurs watchers
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId)
      watchId = null
    }

    isTracking.value = true
    permissionDenied.value = false

    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        position.value = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        }

        if (pos.coords.heading !== null && !isNaN(pos.coords.heading)) {
          heading.value = pos.coords.heading
        }

        if (pos.coords.speed !== null && !isNaN(pos.coords.speed)) {
          speed.value = pos.coords.speed
        }

        error.value = null
        permissionDenied.value = false
        signalLost.value = false
        isTracking.value = true
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          error.value = 'Accès à la localisation refusé. Activez la géolocalisation dans les paramètres.'
          permissionDenied.value = true
          isTracking.value = false
          return
        }

        // TIMEOUT / POSITION_UNAVAILABLE sont transitoires : watchPosition continue
        // d'essayer. Si on a déjà une position, on garde la carte affichée.
        if (position.value) {
          signalLost.value = true
          return
        }

        error.value = err.code === err.TIMEOUT
          ? 'Délai de localisation dépassé'
          : err.code === err.POSITION_UNAVAILABLE
            ? 'Position non disponible'
            : 'Erreur de géolocalisation'
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000
      }
    )
  }

  const stopTracking = () => {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId)
      watchId = null
    }
    isTracking.value = false
  }

  onUnmounted(() => {
    stopTracking()
  })

  return {
    position,
    heading,
    speed,
    error,
    permissionDenied,
    isTracking,
    signalLost,
    startTracking,
    stopTracking
  }
}
