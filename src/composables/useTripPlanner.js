import { ref, computed } from 'vue'
import { haversineDistance } from '../utils'

export function useTripPlanner(filteredChargers, routeGeometry, routeInfo) {
  const autonomy = ref(100) // km - autonomie RESTANTE actuelle
  const maxAutonomy = ref(470) // km - autonomie MAX de la voiture (100%)
  const winterMode = ref(false) // Mode hiver (consommation plus élevée)
  const roundTripMode = ref(false) // Mode aller-retour
  const chargeTarget = 0.80 // On recharge jusqu'à 80% (optimal sur borne rapide)
  const safetyMargin = 0.10 // 10% de marge de sécurité (on s'arrête à 10% restant)
  const showChargersThreshold = 0.70 // Afficher les bornes à partir de 70% d'autonomie utilisée (30% restant)

  // Consommation en kWh/100km
  const normalConsumption = 19
  const winterConsumption = 25

  // Facteur de réduction d'autonomie en hiver (19/25 = 0.76, soit -24%)
  const winterFactor = computed(() => {
    return winterMode.value ? normalConsumption / winterConsumption : 1
  })

  // Distance utilisable avec l'autonomie restante actuelle (ajustée pour l'hiver)
  const currentUsableRange = computed(() => {
    return autonomy.value * (1 - safetyMargin) * winterFactor.value
  })

  // Distance utilisable après une recharge à 80% (ajustée pour l'hiver)
  const rangeAfterCharge = computed(() => {
    return maxAutonomy.value * chargeTarget * (1 - safetyMargin) * winterFactor.value
  })

  // Calcule la distance d'un point depuis le départ le long de la route
  const getDistanceAlongRoute = (chargerLat, chargerLng, routeCoords) => {
    if (!routeCoords || routeCoords.length === 0) return Infinity

    let minDistance = Infinity
    let closestIndex = 0

    // Trouver le point de la route le plus proche de la borne
    for (let i = 0; i < routeCoords.length; i++) {
      const [lng, lat] = routeCoords[i]
      const dist = haversineDistance(chargerLat, chargerLng, lat, lng)
      if (dist < minDistance) {
        minDistance = dist
        closestIndex = i
      }
    }

    // Calculer la distance depuis le départ jusqu'à ce point
    let distanceFromStart = 0
    for (let i = 1; i <= closestIndex; i++) {
      const [lng1, lat1] = routeCoords[i - 1]
      const [lng2, lat2] = routeCoords[i]
      distanceFromStart += haversineDistance(lat1, lng1, lat2, lng2)
    }

    return distanceFromStart
  }

  // Planifie les arrêts de charge optimaux
  const plannedStops = computed(() => {
    if (!routeInfo?.value || !routeGeometry?.value || !filteredChargers?.value) {
      return []
    }

    const totalDistance = routeInfo.value.distance / 1000 // en km
    const currentRange = currentUsableRange.value // autonomie restante actuelle
    const maxRange = rangeAfterCharge.value // autonomie après recharge à 80%

    // Si on peut faire le trajet avec l'autonomie restante
    if (totalDistance <= currentRange) {
      return []
    }

    const routeCoords = routeGeometry.value
    const chargers = filteredChargers.value

    // Enrichir les bornes avec leur distance depuis le départ
    const chargersWithDistance = chargers.map(c => ({
      ...c,
      distanceFromStart: getDistanceAlongRoute(c.lat, c.lng, routeCoords) / 1000 // en km
    })).filter(c => c.distanceFromStart < Infinity && c.distanceFromStart > 0)
      .sort((a, b) => a.distanceFromStart - b.distanceFromStart)

    // Algorithme glouton pour sélectionner les arrêts
    const stops = []
    let currentPosition = 0 // km depuis le départ
    let availableRange = currentRange // On démarre avec l'autonomie restante actuelle

    while (currentPosition + availableRange < totalDistance) {
      // Chercher la borne la plus loin qu'on peut atteindre
      const reachableChargers = chargersWithDistance.filter(c =>
        c.distanceFromStart > currentPosition &&
        c.distanceFromStart <= currentPosition + availableRange
      )

      if (reachableChargers.length === 0) {
        // Pas de borne atteignable - essayer de trouver la plus proche
        const nextCharger = chargersWithDistance.find(c => c.distanceFromStart > currentPosition)
        if (nextCharger) {
          // Indiquer qu'on ne peut pas l'atteindre mais c'est la plus proche
          stops.push({
            ...nextCharger,
            stopNumber: stops.length + 1,
            distanceFromPrevious: nextCharger.distanceFromStart - currentPosition,
            remainingDistance: totalDistance - nextCharger.distanceFromStart,
            unreachable: true
          })
        }
        break
      }

      // Prendre la borne la plus loin (optimise le nombre d'arrêts)
      const bestCharger = reachableChargers[reachableChargers.length - 1]

      // Garde-fou : si la "meilleure" borne ne fait pas avancer
      // (coordonnées dupliquées ou erreur de tri), on évite la boucle infinie.
      if (bestCharger.distanceFromStart <= currentPosition) {
        break
      }

      stops.push({
        ...bestCharger,
        stopNumber: stops.length + 1,
        distanceFromPrevious: bestCharger.distanceFromStart - currentPosition,
        remainingDistance: totalDistance - bestCharger.distanceFromStart
      })

      currentPosition = bestCharger.distanceFromStart
      availableRange = maxRange // Après recharge, on repart avec l'autonomie MAX
    }

    return stops
  })

  // Nombre d'arrêts nécessaires
  const stopsNeeded = computed(() => plannedStops.value.length)

  // Est-ce que le trajet est faisable?
  const isTripFeasible = computed(() => {
    if (!routeInfo?.value) return true

    const totalDistance = routeInfo.value.distance / 1000
    if (totalDistance <= currentUsableRange.value) return true

    // Vérifier qu'on a assez de bornes pour faire le trajet
    return plannedStops.value.length > 0 ||
      totalDistance <= currentUsableRange.value
  })

  // Analyse du trajet aller-retour
  const roundTripAnalysis = computed(() => {
    if (!routeInfo?.value || !roundTripMode.value) {
      return null
    }

    const oneWayDistance = routeInfo.value.distance / 1000 // km
    const totalRoundTrip = oneWayDistance * 2
    const currentRange = currentUsableRange.value
    const maxRange = rangeAfterCharge.value

    // Cas 1: Aller-retour possible sans recharge
    if (totalRoundTrip <= currentRange) {
      return {
        feasible: true,
        needsCharge: false,
        message: 'Aller-retour possible sans recharge',
        remainingAfterTrip: Math.round(currentRange - totalRoundTrip)
      }
    }

    // Cas 2: Aller possible, mais besoin de recharger à destination pour le retour
    if (oneWayDistance <= currentRange) {
      const remainingAtDestination = currentRange - oneWayDistance
      const neededForReturn = oneWayDistance

      // Après recharge à 80% à destination, peut-on rentrer?
      if (neededForReturn <= maxRange) {
        const minChargeNeeded = Math.max(0, neededForReturn - remainingAtDestination)
        return {
          feasible: true,
          needsCharge: true,
          chargeLocation: 'destination',
          message: `Recharge nécessaire à destination`,
          minChargeNeeded: Math.round(minChargeNeeded),
          remainingAtDestination: Math.round(remainingAtDestination)
        }
      }
    }

    // Cas 3: Trajet trop long même avec recharges
    if (oneWayDistance > maxRange) {
      return {
        feasible: false,
        needsCharge: true,
        chargeLocation: 'route',
        message: 'Arrêts de recharge nécessaires (voir planification)',
        stopsNeeded: plannedStops.value.length
      }
    }

    // Cas 4: Aller impossible avec autonomie actuelle
    return {
      feasible: false,
      needsCharge: true,
      chargeLocation: 'before',
      message: `Autonomie insuffisante pour l'aller`,
      currentRange: Math.round(currentRange),
      needed: Math.round(oneWayDistance)
    }
  })

  // Bornes pertinentes : seulement celles au-delà de 70% d'autonomie utilisée
  // Quand on est à 30% restant, on commence à voir les bornes
  const relevantChargers = computed(() => {
    // Sans itinéraire, on affiche toutes les bornes filtrées
    if (!routeInfo?.value || !routeGeometry?.value || !filteredChargers?.value) {
      return filteredChargers?.value || []
    }

    const routeCoords = routeGeometry.value
    const chargers = filteredChargers.value

    // Distance à partir de laquelle on affiche les bornes (70% de l'autonomie actuelle)
    const showFromDistance = autonomy.value * showChargersThreshold * winterFactor.value

    // Enrichir les bornes avec leur distance depuis le départ
    const chargersWithRouteDistance = chargers.map(c => {
      const distanceAlongRoute = getDistanceAlongRoute(c.lat, c.lng, routeCoords) / 1000
      return { ...c, distanceAlongRoute }
    }).filter(c => c.distanceAlongRoute < Infinity)

    // Ne garder que les bornes DEVANT nous sur le trajet (jamais celles déjà dépassées,
    // qui se projettent près du départ) et au-delà du seuil d'autonomie (30% restant).
    const MIN_AHEAD_KM = 1 // ignore ce qui est au niveau/derrière le point de départ
    return chargersWithRouteDistance.filter(
      c => c.distanceAlongRoute >= Math.max(showFromDistance, MIN_AHEAD_KM)
    )
  })

  return {
    autonomy,
    maxAutonomy,
    winterMode,
    roundTripMode,
    winterFactor,
    safetyMargin,
    currentUsableRange,
    rangeAfterCharge,
    plannedStops,
    stopsNeeded,
    isTripFeasible,
    roundTripAnalysis,
    relevantChargers
  }
}
