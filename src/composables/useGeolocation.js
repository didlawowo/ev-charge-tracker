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
  const lastFixAt = ref(null)

  let watchId = null

  const updateFix = pos => {
    const timestamp = Number.isFinite(pos.timestamp) ? pos.timestamp : Date.now()
    // Le navigateur peut fournir des fixes GPS dans le désordre.
    if (lastFixAt.value !== null && timestamp < lastFixAt.value) return position.value
    lastFixAt.value = timestamp
    position.value = {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      timestamp,
      accuracy: pos.coords.accuracy
    }
    if (Number.isFinite(pos.coords.heading)) heading.value = pos.coords.heading
    if (Number.isFinite(pos.coords.speed)) speed.value = pos.coords.speed
    error.value = null
    permissionDenied.value = false
    signalLost.value = false
    isTracking.value = true
    return position.value
  }

  /**
   * À la demande d'un itinéraire, forcer un fix GPS récent.
   * watchPosition peut avoir livré un point trop vieux (onglet inactif,
   * voiture en mouvement ou navigateur iOS).
   */
  const getFreshPosition = ({ force = false } = {}) => {
    const age = lastFixAt.value === null ? Infinity : Date.now() - lastFixAt.value
    if (!force && position.value && age >= 0 && age < 3000) {
      return Promise.resolve(position.value)
    }
    if (!navigator.geolocation) return Promise.reject(new Error('GPS non disponible'))
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        pos => {
          const freshAge = Date.now() - (pos.timestamp || Date.now())
          if (freshAge > 15000) {
            signalLost.value = true
            reject(new Error('Position GPS trop ancienne. Réessaie dans un instant.'))
            return
          }
          resolve(updateFix(pos))
        },
        () => {
          const ageNow = lastFixAt.value === null ? Infinity : Date.now() - lastFixAt.value
          if (position.value && ageNow < 15000) {
            resolve(position.value)
          } else {
            signalLost.value = true
            reject(new Error('GPS indisponible ou position trop ancienne. Recalcul impossible.'))
          }
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      )
    })
  }


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
        updateFix(pos)
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
    lastFixAt,
    getFreshPosition,
    startTracking,
    stopTracking
  }
}
