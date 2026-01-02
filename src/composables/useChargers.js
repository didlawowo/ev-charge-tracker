import { ref, computed, watch } from 'vue'
import { getRouteGeometry, isPointNearRoute } from './useRoute'
import { isCCSConnection } from '../utils'

export function useChargers(position, heading, destination) {
  const chargers = ref([])
  const loading = ref(false)
  const error = ref(null)
  const searchRadius = ref(50000) // metres (50 km par défaut)
  const onlyOnRoute = ref(true)
  const minPower = ref(200) // kW
  const onlyCCS = ref(true)
  const routeGeometry = ref(null)
  const routeInfo = ref(null)

  const OPENCHARGE_API = 'https://api.openchargemap.io/v3/poi'
  const API_KEY = import.meta.env.VITE_OPENCHARGE_API_KEY

  // Connection type IDs mapping (compact mode doesn't include titles)
  const CONNECTION_TYPES = {
    33: 'CCS (Type 2)',
    32: 'CCS (Type 1)',
    2: 'CHAdeMO',
    25: 'Type 2',
    1036: 'Type 2 (Tethered)',
    27: 'Tesla Supercharger',
    30: 'Tesla',
    1: 'Type 1',
    0: 'Inconnu'
  }

  const getConnectionType = (conn) => {
    if (conn.ConnectionType?.Title) {
      return conn.ConnectionType.Title
    }
    return CONNECTION_TYPES[conn.ConnectionTypeID] || 'Inconnu'
  }


  const fetchChargersAlongRoute = async (routeCoords) => {
    if (!routeCoords || routeCoords.length === 0) return

    loading.value = true
    error.value = null

    try {
      if (!API_KEY) {
        throw new Error('Clé API OpenChargeMap manquante')
      }

      // Sample points along the route (every ~50km)
      const samplePoints = []
      const step = Math.max(1, Math.floor(routeCoords.length / 10))
      for (let i = 0; i < routeCoords.length; i += step) {
        samplePoints.push(routeCoords[i])
      }
      // Always include last point
      if (samplePoints[samplePoints.length - 1] !== routeCoords[routeCoords.length - 1]) {
        samplePoints.push(routeCoords[routeCoords.length - 1])
      }

      // Fetch chargers for each sample point
      const allChargers = new Map()

      for (const [lng, lat] of samplePoints) {
        const params = new URLSearchParams({
          key: API_KEY,
          output: 'json',
          latitude: lat,
          longitude: lng,
          distance: 30,
          distanceunit: 'km',
          maxresults: 50,
          compact: false,
          verbose: false
        })

        const response = await fetch(`${OPENCHARGE_API}?${params}`)
        if (!response.ok) continue

        const data = await response.json()

        for (const c of data) {
          if (!allChargers.has(c.ID)) {
            allChargers.set(c.ID, {
              id: c.ID,
              name: c.AddressInfo?.Title || 'Station sans nom',
              address: c.AddressInfo?.AddressLine1 || '',
              town: c.AddressInfo?.Town || '',
              lat: c.AddressInfo?.Latitude,
              lng: c.AddressInfo?.Longitude,
              distance: c.AddressInfo?.Distance * 1000,
              numberOfPoints: c.NumberOfPoints || 0,
              connections: c.Connections?.map(conn => ({
                type: getConnectionType(conn),
                typeId: conn.ConnectionTypeID,
                power: conn.PowerKW,
                quantity: conn.Quantity || 1
              })) || [],
              operator: c.OperatorInfo?.Title || 'Opérateur inconnu',
              isOperational: c.StatusType?.IsOperational !== false,
              usageCost: c.UsageCost || null,
              chargemapUrl: `https://chargemap.com/map?lat=${c.AddressInfo?.Latitude}&lng=${c.AddressInfo?.Longitude}&zoom=18`
            })
          }
        }
      }

      chargers.value = Array.from(allChargers.values())

    } catch (e) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  const fetchChargers = async (lat, lng) => {
    loading.value = true
    error.value = null

    try {
      if (!API_KEY) {
        throw new Error('Clé API OpenChargeMap manquante. Créez un fichier .env avec VITE_OPENCHARGE_API_KEY')
      }

      const params = new URLSearchParams({
        key: API_KEY,
        output: 'json',
        latitude: lat,
        longitude: lng,
        distance: Math.round(searchRadius.value / 1000),
        distanceunit: 'km',
        maxresults: 100,
        compact: false,
        verbose: false
      })

      const response = await fetch(`${OPENCHARGE_API}?${params}`)

      if (!response.ok) {
        throw new Error('Erreur API OpenChargeMap')
      }

      const data = await response.json()

      chargers.value = data.map(c => ({
        id: c.ID,
        name: c.AddressInfo?.Title || 'Station sans nom',
        address: c.AddressInfo?.AddressLine1 || '',
        town: c.AddressInfo?.Town || '',
        lat: c.AddressInfo?.Latitude,
        lng: c.AddressInfo?.Longitude,
        distance: c.AddressInfo?.Distance * 1000,
        numberOfPoints: c.NumberOfPoints || 0,
        connections: c.Connections?.map(conn => ({
          type: getConnectionType(conn),
          typeId: conn.ConnectionTypeID,
          power: conn.PowerKW,
          quantity: conn.Quantity || 1
        })) || [],
        operator: c.OperatorInfo?.Title || 'Opérateur inconnu',
        isOperational: c.StatusType?.IsOperational !== false,
        usageCost: c.UsageCost || null,
        chargemapUrl: `https://chargemap.com/map?lat=${c.AddressInfo?.Latitude}&lng=${c.AddressInfo?.Longitude}&zoom=18`
      }))

    } catch (e) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  const fetchRouteToDestination = async (startPos, dest) => {
    const route = await getRouteGeometry(startPos.lat, startPos.lng, dest.lat, dest.lng)
    if (route) {
      routeGeometry.value = route.coordinates
      routeInfo.value = {
        distance: route.distance,
        duration: route.duration
      }
      await fetchChargersAlongRoute(route.coordinates)
    }
  }

  const filteredChargers = computed(() => {
    let result = chargers.value

    // Filter by search radius
    result = result.filter(c => c.distance <= searchRadius.value)

    // Filter by minimum power
    if (minPower.value > 0) {
      result = result.filter(c => {
        const maxPower = Math.max(...c.connections.map(conn => conn.power || 0))
        return maxPower >= minPower.value
      })
    }

    // Filter by CCS only
    if (onlyCCS.value) {
      result = result.filter(c =>
        c.connections.some(conn => isCCSConnection(conn))
      )
    }

    // Filter by route if enabled and we have a route
    if (onlyOnRoute.value && routeGeometry.value) {
      result = result.filter(c =>
        isPointNearRoute(c.lat, c.lng, routeGeometry.value, 2000)
      )
    }

    // Sort by distance from start
    result.sort((a, b) => a.distance - b.distance)

    return result
  })

  // Watch position changes (only when no destination)
  let fetchTimeout = null
  watch(position, (newPos) => {
    if (!newPos || destination?.value) return

    clearTimeout(fetchTimeout)
    fetchTimeout = setTimeout(() => {
      fetchChargers(newPos.lat, newPos.lng)
    }, 1000)
  }, { immediate: true })

  // Watch destination changes (only react to destination, not position)
  let lastDestId = null
  watch(destination, (dest) => {
    const pos = position?.value
    if (!pos) return

    const destId = dest ? `${dest.lat}-${dest.lng}` : null
    if (destId === lastDestId) return
    lastDestId = destId

    if (dest) {
      fetchRouteToDestination(pos, dest)
    } else {
      // Clear route when destination is cleared
      routeGeometry.value = null
      routeInfo.value = null
      fetchChargers(pos.lat, pos.lng)
    }
  })

  const refreshChargers = () => {
    if (position.value) {
      if (destination?.value) {
        fetchRouteToDestination(position.value, destination.value)
      } else {
        fetchChargers(position.value.lat, position.value.lng)
      }
    }
  }

  return {
    chargers,
    filteredChargers,
    loading,
    error,
    searchRadius,
    minPower,
    onlyCCS,
    onlyOnRoute,
    routeGeometry,
    routeInfo,
    refreshChargers
  }
}
