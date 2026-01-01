import { ref, watch } from 'vue'

export function useTileCache() {
  const isCaching = ref(false)
  const cacheProgress = ref(0)
  const cachedTiles = ref(0)

  // Convertit lat/lng en coordonnées de tuile
  const latLngToTile = (lat, lng, zoom) => {
    const n = Math.pow(2, zoom)
    const x = Math.floor((lng + 180) / 360 * n)
    const latRad = lat * Math.PI / 180
    const y = Math.floor((1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2 * n)
    return { x, y }
  }

  // Génère les URLs des tuiles pour une zone
  const getTileUrls = (centerLat, centerLng, radiusKm, zooms = [10, 11, 12, 13]) => {
    const urls = []
    const servers = ['a', 'b', 'c']

    for (const zoom of zooms) {
      // Calcul approximatif du nombre de tuiles pour couvrir le rayon
      const tilesPerKm = Math.pow(2, zoom) / 40075 // circonférence terre en km
      const tileRadius = Math.ceil(radiusKm * tilesPerKm)

      const center = latLngToTile(centerLat, centerLng, zoom)

      for (let dx = -tileRadius; dx <= tileRadius; dx++) {
        for (let dy = -tileRadius; dy <= tileRadius; dy++) {
          const x = center.x + dx
          const y = center.y + dy
          const server = servers[(x + y) % 3]
          urls.push(`https://${server}.tile.openstreetmap.org/${zoom}/${x}/${y}.png`)
        }
      }
    }

    return urls
  }

  // Pré-télécharge les tuiles le long d'une route
  const cacheRouteArea = async (routeCoords, radiusKm = 5) => {
    if (!routeCoords || routeCoords.length === 0) return

    isCaching.value = true
    cacheProgress.value = 0
    cachedTiles.value = 0

    // Échantillonner des points le long de la route
    const samplePoints = []
    const step = Math.max(1, Math.floor(routeCoords.length / 20))

    for (let i = 0; i < routeCoords.length; i += step) {
      const [lng, lat] = routeCoords[i]
      samplePoints.push({ lat, lng })
    }

    // Collecter toutes les URLs uniques
    const allUrls = new Set()
    for (const point of samplePoints) {
      const urls = getTileUrls(point.lat, point.lng, radiusKm, [11, 12, 13])
      urls.forEach(url => allUrls.add(url))
    }

    const urlArray = Array.from(allUrls)
    const total = urlArray.length

    // Télécharger par lots de 10
    const batchSize = 10
    for (let i = 0; i < urlArray.length; i += batchSize) {
      const batch = urlArray.slice(i, i + batchSize)

      await Promise.all(
        batch.map(url =>
          fetch(url, { mode: 'no-cors' }).catch(() => {})
        )
      )

      cachedTiles.value = Math.min(i + batchSize, total)
      cacheProgress.value = Math.round((cachedTiles.value / total) * 100)
    }

    isCaching.value = false
    return cachedTiles.value
  }

  // Pré-télécharge les tuiles autour d'une position
  const cacheAroundPosition = async (lat, lng, radiusKm = 10) => {
    isCaching.value = true
    cacheProgress.value = 0
    cachedTiles.value = 0

    const urls = getTileUrls(lat, lng, radiusKm, [10, 11, 12, 13, 14])
    const total = urls.length

    const batchSize = 10
    for (let i = 0; i < urls.length; i += batchSize) {
      const batch = urls.slice(i, i + batchSize)

      await Promise.all(
        batch.map(url =>
          fetch(url, { mode: 'no-cors' }).catch(() => {})
        )
      )

      cachedTiles.value = Math.min(i + batchSize, total)
      cacheProgress.value = Math.round((cachedTiles.value / total) * 100)
    }

    isCaching.value = false
    return cachedTiles.value
  }

  return {
    isCaching,
    cacheProgress,
    cachedTiles,
    cacheRouteArea,
    cacheAroundPosition
  }
}
