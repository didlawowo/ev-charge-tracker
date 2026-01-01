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

function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000 // Earth radius in meters
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c
}

function toRad(deg) {
  return deg * (Math.PI / 180)
}
