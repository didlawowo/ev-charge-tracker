import { haversineDistance } from '../utils'

const OSRM_API = 'https://router.project-osrm.org/route/v1/driving'

export async function getRouteGeometry(startLat, startLng, endLat, endLng, options = {}) {
  const { avoidTolls = false } = options
  const baseUrl = `${OSRM_API}/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson&alternatives=true`

  const fetchRoute = async (url) => {
    const response = await fetch(url)
    if (!response.ok) return null
    const data = await response.json()
    if (data.code !== 'Ok' || !data.routes?.length) return null
    return data.routes.map((route, index) => ({
      id: index,
      coordinates: route.geometry.coordinates,
      distance: route.distance,
      duration: route.duration,
      isMain: index === 0
    }))
  }

  try {
    // Essayer avec exclude=toll si demandé (ne fonctionne pas sur le serveur OSRM public)
    if (avoidTolls) {
      const result = await fetchRoute(`${baseUrl}&exclude=toll`)
      if (result) return result
      // Fallback sans exclude=toll si le serveur ne le supporte pas
      console.warn('OSRM: exclude=toll non supporté, calcul sans évitement des péages')
    }
    return await fetchRoute(baseUrl)
  } catch {
    return null
  }
}

export function isPointNearRoute(pointLat, pointLng, routeCoords, maxDistanceMeters) {
  if (!routeCoords || routeCoords.length === 0) {
    return true
  }

  for (const coord of routeCoords) {
    const [lng, lat] = coord
    const distance = haversineDistance(pointLat, pointLng, lat, lng)

    if (distance <= maxDistanceMeters) {
      return true
    }
  }

  return false
}
