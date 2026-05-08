import { ref, onUnmounted } from 'vue'

export function useGeolocation() {
  const position = ref(null)
  const heading = ref(null)
  const speed = ref(0)
  const error = ref(null)
  const permissionDenied = ref(false)
  const isTracking = ref(false)

  let watchId = null

  const startTracking = () => {
    if (!navigator.geolocation) {
      error.value = 'La géolocalisation n\'est pas supportée par votre navigateur'
      return
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
      },
      (err) => {
        switch (err.code) {
          case err.PERMISSION_DENIED:
            error.value = 'Accès à la localisation refusé. Activez la géolocalisation dans les paramètres.'
            permissionDenied.value = true
            break
          case err.POSITION_UNAVAILABLE:
            error.value = 'Position non disponible'
            break
          case err.TIMEOUT:
            error.value = 'Délai de localisation dépassé'
            break
          default:
            error.value = 'Erreur de géolocalisation'
        }
        isTracking.value = false
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
    startTracking,
    stopTracking
  }
}
