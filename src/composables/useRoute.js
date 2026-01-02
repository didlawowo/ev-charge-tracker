import { haversineDistance } from '../utils'

const OSRM_API = 'https://router.project-osrm.org/route/v1/driving'

export async function getRouteGeometry(startLat, startLng, endLat, endLng) {
  try {
    const url = `${OSRM_API}/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson`

    const response = await fetch(url)

    if (!response.ok) {
      return null
    }

    const data = await response.json()

    if (data.code !== 'Ok' || !data.routes?.[0]) {
      return null
    }

    return {
      coordinates: data.routes[0].geometry.coordinates,
      distance: data.routes[0].distance, // metres
      duration: data.routes[0].duration  // seconds
    }
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
