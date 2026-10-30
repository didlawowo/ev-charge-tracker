import { ref, computed, watch, onUnmounted } from 'vue'
import { getRouteGeometry, isPointNearRoute } from './useRoute'
import { isCCSConnection, haversineDistance, isTeslaCharger, openChargeMapUrl } from '../utils'
import { useStoredSetting } from './useStoredSetting'

export function useChargers(position, heading, destination, getFreshPosition = null) {
  const chargers = ref([])
  const loading = ref(false)
  const error = ref(null)
  const searchRadius = ref(50000) // metres (50 km par défaut)
  const onlyOnRoute = ref(true)
  const minPower = ref(100) // kW
  const onlyCCS = ref(true)
  // Exclure Tesla dès le premier lancement ; l'utilisateur peut réactiver le réseau.
  const excludeTesla = useStoredSetting('ev-finder:exclude-tesla', true, value => {
    if (value === 'true') return true
    if (value === 'false') return false
    return undefined
  })
  const routeGeometry = ref(null)
  const routeInfo = ref(null)
  const alternativeRoutes = ref([]) // Itinéraires alternatifs
  const selectedRouteIndex = ref(0) // Index de l'itinéraire sélectionné

  const OPENCHARGE_API = 'https://api.openchargemap.io/v3/poi'
  const API_KEY = import.meta.env.VITE_OPENCHARGE_API_KEY

  // Largeur du couloir "sur ma route" (indépendant du Rayon qui sert à la recherche
  // circulaire sans destination). On ne garde que les bornes réellement sur le trajet.
  const ROUTE_CORRIDOR_M = 5000 // 5 km de part et d'autre du tracé

  // Sans destination, on ne relance la recherche que si l'on s'est déplacé de plus
  // de cette distance (sinon chaque mise à jour GPS en roulant déclenche un appel API).
  const REFETCH_DISTANCE_M = 2000

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

  const toCharger = (c, startPos) => {
    const lat = c.AddressInfo?.Latitude
    const lng = c.AddressInfo?.Longitude
    return {
      id: c.ID,
      name: c.AddressInfo?.Title || 'Station sans nom',
      address: c.AddressInfo?.AddressLine1 || '',
      town: c.AddressInfo?.Town || '',
      lat,
      lng,
      // Distance depuis la position de départ (pas depuis le point d'échantillonnage)
      distance: haversineDistance(startPos.lat, startPos.lng, lat, lng),
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
      detailsUrl: openChargeMapUrl(c.ID)
    }
  }

  // Filtres appliqués côté API : sans eux, maxresults renvoie les N bornes les plus
  // proches (souvent des bornes lentes en ville) et le filtre client n'en garde aucune.
  const apiFilterParams = () => {
    const params = {}
    if (minPower.value > 0) params.minpowerkw = minPower.value
    if (onlyCCS.value) params.connectiontypeid = '33,32'
    return params
  }

  const fetchPois = async (lat, lng, distanceKm, maxResults) => {
    const params = new URLSearchParams({
      key: API_KEY,
      output: 'json',
      latitude: lat,
      longitude: lng,
      distance: distanceKm,
      distanceunit: 'km',
      maxresults: maxResults,
      compact: false,
      verbose: false,
      ...apiFilterParams()
    })
    const response = await fetch(`${OPENCHARGE_API}?${params}`)
    if (!response.ok) {
      throw new Error('Erreur API OpenChargeMap')
    }
    return response.json()
  }

  // Numéro de la dernière requête bornes : une réponse plus ancienne arrivée en retard
  // (ex. recherche autour de soi lancée juste avant de choisir une destination) est ignorée.
  let chargersRequestId = 0
  let lastFetchPos = null

  const fetchChargersAlongRoute = async (routeCoords, startPos) => {
    if (!routeCoords || routeCoords.length === 0) return

    const requestId = ++chargersRequestId
    loading.value = true
    error.value = null

    try {
      if (!API_KEY) {
        throw new Error('Clé API OpenChargeMap manquante')
      }

      // Sample points along the route (~10 points)
      const samplePoints = []
      const step = Math.max(1, Math.floor(routeCoords.length / 10))
      for (let i = 0; i < routeCoords.length; i += step) {
        samplePoints.push(routeCoords[i])
      }
      // Always include last point
      if (samplePoints[samplePoints.length - 1] !== routeCoords[routeCoords.length - 1]) {
        samplePoints.push(routeCoords[routeCoords.length - 1])
      }

      // Requêtes en parallèle : un trajet ≈ 11 appels, en série cela prenait plusieurs secondes
      const results = await Promise.allSettled(
        samplePoints.map(([lng, lat]) => fetchPois(lat, lng, 30, 50))
      )
      if (requestId !== chargersRequestId) return

      const fulfilled = results.filter(r => r.status === 'fulfilled')
      if (fulfilled.length === 0) {
        throw new Error('Erreur API OpenChargeMap')
      }

      const allChargers = new Map()
      for (const { value: data } of fulfilled) {
        for (const c of data) {
          if (!allChargers.has(c.ID)) {
            allChargers.set(c.ID, toCharger(c, startPos))
          }
        }
      }

      chargers.value = Array.from(allChargers.values())
    } catch (e) {
      if (requestId === chargersRequestId) error.value = e.message
    } finally {
      if (requestId === chargersRequestId) loading.value = false
    }
  }

  const fetchChargers = async (lat, lng) => {
    const requestId = ++chargersRequestId
    loading.value = true
    error.value = null
    lastFetchPos = { lat, lng }

    try {
      if (!API_KEY) {
        throw new Error('Clé API OpenChargeMap manquante. Créez un fichier .env avec VITE_OPENCHARGE_API_KEY')
      }

      const data = await fetchPois(lat, lng, Math.round(searchRadius.value / 1000), 100)
      if (requestId !== chargersRequestId) return

      chargers.value = data.map(c => toCharger(c, { lat, lng }))
    } catch (e) {
      if (requestId === chargersRequestId) error.value = e.message
    } finally {
      if (requestId === chargersRequestId) loading.value = false
    }
  }

  // Même principe pour l'itinéraire : si la destination change pendant le calcul OSRM,
  // l'ancien résultat ne doit pas écraser le nouveau.
  let routeRequestId = 0
  let lastRouteStart = null
  let lastRouteRequestedAt = 0
  let rerouteTimeout = null
  const ROUTE_RECALC_DISTANCE_M = 1500
  const ROUTE_RECALC_MIN_INTERVAL_MS = 15000

  const clearRoute = () => {
    routeRequestId++
    clearTimeout(rerouteTimeout)
    lastRouteStart = null
    routeGeometry.value = null
    routeInfo.value = null
    alternativeRoutes.value = []
    selectedRouteIndex.value = 0
  }

  const fetchRouteToDestination = async (startPos, dest, { forceFresh = false } = {}) => {
    // Invalider IMMÉDIATEMENT les calculs et recherches de bornes précédents :
    // une réponse arrivée dans le désordre ne doit plus rétablir l'ancien départ.
    const requestId = ++routeRequestId
    ++chargersRequestId
    clearTimeout(rerouteTimeout)
    loading.value = true
    error.value = null

    try {
      // À chaque demande explicite, demander un nouveau fix non caché.
      const current = getFreshPosition
        ? await getFreshPosition({ force: forceFresh })
        : startPos
      if (requestId !== routeRequestId) return
      const routeStart = current || startPos
      if (!routeStart) throw new Error('Position GPS indisponible pour le départ')

      lastRouteStart = { lat: routeStart.lat, lng: routeStart.lng }
      lastRouteRequestedAt = Date.now()

      const routes = await getRouteGeometry(routeStart.lat, routeStart.lng, dest.lat, dest.lng)
      if (requestId !== routeRequestId) return
      if (!routes || routes.length === 0) throw new Error('Itinéraire introuvable')

      alternativeRoutes.value = routes
      selectedRouteIndex.value = 0
      const selected = routes[0]
      routeGeometry.value = selected.coordinates
      routeInfo.value = {
        distance: selected.distance,
        duration: selected.duration
      }
      await fetchChargersAlongRoute(selected.coordinates, routeStart)
    } catch (e) {
      if (requestId !== routeRequestId) return
      // Ne jamais conserver un ancien tracé après un recalcul impossible.
      alternativeRoutes.value = []
      routeGeometry.value = null
      routeInfo.value = null
      error.value = e.message || 'Position GPS ou itinéraire indisponible'
      loading.value = false
    }
  }

  const selectRoute = async (index) => {
    if (index < 0 || index >= alternativeRoutes.value.length) return
    const pos = position?.value
    if (!pos) return

    if (lastRouteStart && haversineDistance(
      lastRouteStart.lat, lastRouteStart.lng, pos.lat, pos.lng
    ) > ROUTE_RECALC_DISTANCE_M) {
      // Les alternatives d'un ancien tracé ne sont plus pertinentes en roulant.
      await fetchRouteToDestination(pos, destination.value, { forceFresh: true })
      return
    }

    selectedRouteIndex.value = index
    const selected = alternativeRoutes.value[index]
    routeGeometry.value = selected.coordinates
    routeInfo.value = {
      distance: selected.distance,
      duration: selected.duration
    }
    await fetchChargersAlongRoute(selected.coordinates, pos)
  }

  const filteredChargers = computed(() => {
    let result = chargers.value

    // Filter by search radius ONLY when no route (otherwise we want chargers along the whole route)
    if (!routeGeometry.value) {
      result = result.filter(c => c.distance <= searchRadius.value)
    }

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

    // Exclure les Superchargeurs Tesla si demandé
    if (excludeTesla.value) {
      result = result.filter(c => !isTeslaCharger(c))
    }

    // Filter by route proximity if enabled and we have a route
    // On utilise un couloir étroit fixe (pas le Rayon, trop large) pour ne garder
    // que les bornes réellement sur le trajet sélectionné.
    if (onlyOnRoute.value && routeGeometry.value) {
      result = result.filter(c =>
        isPointNearRoute(c.lat, c.lng, routeGeometry.value, ROUTE_CORRIDOR_M)
      )
    }

    // Copie avant tri : sans filtre actif, result est chargers.value et sort()
    // muterait l'état réactif depuis un computed.
    return [...result].sort((a, b) => a.distance - b.distance)
  })

  // Réagit à un changement de destination (ou à la première position GPS si la
  // destination a été choisie avant le fix : sans ça l'itinéraire n'était jamais calculé).
  let lastDestId = null
  const syncDestination = () => {
    const pos = position?.value
    if (!pos) return

    const dest = destination?.value
    const destId = dest ? `${dest.lat}-${dest.lng}` : null
    if (destId === lastDestId) return
    lastDestId = destId

    if (dest) {
      fetchRouteToDestination(pos, dest)
    } else {
      // Clear route when destination is cleared (sinon les tracés restent affichés)
      clearRoute()
      fetchChargers(pos.lat, pos.lng)
    }
  }

  let fetchTimeout = null
  watch(position, (newPos) => {
    if (!newPos) return
    if (!Number.isFinite(newPos.lat) || !Number.isFinite(newPos.lng)) return

    if (destination?.value) {
      syncDestination()
      // Dès que l'on a avancé d'au moins 1,5 km, recalcul depuis le GPS actuel.
      // Anti-rebond / throttle évitent d'appeler OSRM à chaque nouvelle position.
      if (lastRouteStart &&
        haversineDistance(lastRouteStart.lat, lastRouteStart.lng, newPos.lat, newPos.lng) >= ROUTE_RECALC_DISTANCE_M &&
        Date.now() - lastRouteRequestedAt >= ROUTE_RECALC_MIN_INTERVAL_MS &&
        navigator.onLine) {
        clearTimeout(rerouteTimeout)
        rerouteTimeout = setTimeout(() => {
          if (destination?.value) {
            fetchRouteToDestination(position.value, destination.value, { forceFresh: true })
          }
        }, 2000)
      }
      return
    }

    if (lastFetchPos && haversineDistance(lastFetchPos.lat, lastFetchPos.lng, newPos.lat, newPos.lng) < REFETCH_DISTANCE_M) {
      return
    }

    clearTimeout(fetchTimeout)
    // Indiquer le chargement dès maintenant : sinon « Aucune borne » s'affiche pendant le debounce
    loading.value = true
    fetchTimeout = setTimeout(() => {
      fetchChargers(newPos.lat, newPos.lng)
    }, 1000)
  }, { immediate: true })

  watch(destination, syncDestination)

  // Les filtres puissance/CCS/rayon sont envoyés à l'API : il faut relancer la recherche
  // (sans recalculer l'itinéraire OSRM). Debounce pour le slider de rayon.
  let filterTimeout = null
  const refetchForFilters = () => {
    clearTimeout(filterTimeout)
    filterTimeout = setTimeout(() => {
      const pos = position?.value
      if (!pos) return
      // Hors-ligne : les filtres s'appliquent quand même aux bornes déjà chargées (côté client)
      if (!navigator.onLine) return
      if (routeGeometry.value) {
        fetchChargersAlongRoute(routeGeometry.value, pos)
      } else {
        fetchChargers(pos.lat, pos.lng)
      }
    }, 400)
  }
  watch([minPower, onlyCCS], refetchForFilters)
  watch(searchRadius, () => {
    if (!routeGeometry.value) refetchForFilters()
  })

  onUnmounted(() => {
    clearTimeout(fetchTimeout)
    clearTimeout(filterTimeout)
    clearTimeout(rerouteTimeout)
  })

  // Réaffiche un trajet enregistré sans appel réseau (voir useOfflineTrip)
  const restoreTrip = ({ routes, selectedRouteIndex: index, chargers: savedChargers, destination: dest }) => {
    routeRequestId++
    chargersRequestId++
    clearTimeout(rerouteTimeout)
    lastRouteStart = position?.value ? { lat: position.value.lat, lng: position.value.lng } : null
    clearTimeout(fetchTimeout)
    clearTimeout(filterTimeout)
    // Empêche syncDestination de relancer le calcul quand la destination sera réassignée
    lastDestId = `${dest.lat}-${dest.lng}`

    alternativeRoutes.value = routes
    selectedRouteIndex.value = index
    const selected = routes[index]
    routeGeometry.value = selected.coordinates
    routeInfo.value = {
      distance: selected.distance,
      duration: selected.duration
    }
    chargers.value = savedChargers
    error.value = null
    loading.value = false
  }

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
    excludeTesla,
    onlyOnRoute,
    routeGeometry,
    routeInfo,
    alternativeRoutes,
    selectedRouteIndex,
    selectRoute,
    restoreTrip,
    refreshChargers
  }
}
