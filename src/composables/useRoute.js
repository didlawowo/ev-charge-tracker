import { haversineDistance } from '../utils'

const OSRM_API = 'https://router.project-osrm.org/route/v1/driving'

export async function getRouteGeometry(startLat, startLng, endLat, endLng, options = {}) {
  try {
    const { avoidTolls = false } = options
    let url = `${OSRM_API}/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson&alternatives=true`

    if (avoidTolls) {
      url += '&exclude=toll'
    }

    const response = await fetch(url)

    if (!response.ok) {
      return null
    }

    const data = await response.json()

    if (data.code !== 'Ok' || !data.routes?.length) {
      return null
    }

    // Retourne tous les itinéraires (principal + alternatives)
    return data.routes.map((route, index) => ({
      id: index,
      coordinates: route.geometry.coordinates,
      distance: route.distance, // metres
      duration: route.duration, // seconds
      isMain: index === 0
    }))
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
