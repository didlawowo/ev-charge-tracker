import { ref, computed } from 'vue'
import { haversineDistance, maxCcsPower } from '../utils'
import { useStoredSetting } from './useStoredSetting'

export function useTripPlanner(filteredChargers, routeGeometry, routeInfo) {
  const autonomy = ref(100) // km - autonomie RESTANTE actuelle
  const maxAutonomy = ref(470) // km - autonomie MAX de la voiture (100%)
  const winterMode = ref(false) // Mode hiver (consommation plus élevée)
  const roundTripMode = ref(false) // Mode aller-retour
  // Durée maximum autorisée par arrêt, conservée entre les ouvertures de la PWA.
  const maxChargeMinutes = useStoredSetting('ev-finder:max-charge-minutes', 25, value => {
    const minutes = Number(value)
    return [10, 15, 20, 25, 30, 40, 45, 60].includes(minutes) ? minutes : undefined
  })
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

  // Approximation prudente de la vitesse de recharge utilisable :
  // la puissance annoncée (pic de la borne) n'est pas la puissance moyenne réelle.
  // La courbe de charge, la température et le SoC réels restent inconnus.
  // Plafond véhicule conservateur de 150 kW, moyenne à 65 % du pic.
  const chargingKmPerMinute = charger => {
    const peakKw = maxCcsPower(charger)
    if (!peakKw || !Number.isFinite(peakKw)) return 0
    const averageKw = Math.min(peakKw, 150) * 0.65
    const consumption = winterMode.value ? winterConsumption : normalConsumption
    return averageKw * (1 - safetyMargin) * 100 / (60 * consumption)
  }

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

    // Chaque arrêt est plafonné en minutes, et NON supposé atteindre 80 %
    // automatiquement. On choisit la borne atteignable qui donne la meilleure
    // portée après recharge (sa distance et sa puissance entrent en jeu).
    const stops = []
    let currentPosition = 0 // km depuis le départ
    let availableRange = currentRange // km utilisables avant la prochaine recharge

    while (currentPosition + availableRange < totalDistance && stops.length < chargersWithDistance.length) {
      const currentReach = currentPosition + availableRange

      const candidates = chargersWithDistance
        .filter(c => c.isOperational !== false &&
          c.distanceFromStart > currentPosition &&
          c.distanceFromStart <= currentReach)
        .map(charger => {
          const kmPerMinute = chargingKmPerMinute(charger)
          const rangeAtArrival = Math.max(0, availableRange - (charger.distanceFromStart - currentPosition))
          const limitAt80Pct = Math.max(maxRange, rangeAtArrival)
          const rangeAfterCharge = Math.min(
            limitAt80Pct,
            rangeAtArrival + kmPerMinute * maxChargeMinutes.value
          )
          return {
            charger,
            kmPerMinute,
            rangeAtArrival,
            potentialReach: charger.distanceFromStart + rangeAfterCharge
          }
        })
        .filter(c => c.kmPerMinute > 0 && c.potentialReach > currentReach + 0.01)
        .sort((a, b) => b.potentialReach - a.potentialReach ||
          b.charger.distanceFromStart - a.charger.distanceFromStart)

      const best = candidates[0]
      if (!best) {
        // Aucune solution faisable avec le temps de charge choisi : NE PAS
        // promettre un trajet en supposant une recharge illimitée.
        const nextCharger = chargersWithDistance.find(c =>
          c.isOperational !== false && c.distanceFromStart > currentReach
        )
        if (nextCharger) {
          stops.push({
            ...nextCharger,
            stopNumber: stops.length + 1,
            distanceFromPrevious: nextCharger.distanceFromStart - currentPosition,
            remainingDistance: totalDistance - nextCharger.distanceFromStart,
            unreachable: true
          })
        } else if (stops.length > 0) {
          stops[stops.length - 1].unreachable = true
        }
        break
      }

      const { charger, kmPerMinute, rangeAtArrival, potentialReach } = best
      const limitAt80Pct = Math.max(maxRange, rangeAtArrival)
      // Dernier arrêt : seulement le temps nécessaire pour finir le trajet.
      // Autres arrêts : on autorise le maximum pour garder une marge en aval.
      const requiredGain = potentialReach >= totalDistance
        ? Math.max(0, totalDistance - charger.distanceFromStart - rangeAtArrival)
        : Math.max(0, limitAt80Pct - rangeAtArrival)
      const chargeMinutes = Math.min(maxChargeMinutes.value, Math.ceil(requiredGain / kmPerMinute))
      const rangeAfterCharge = Math.min(
        limitAt80Pct,
        rangeAtArrival + chargeMinutes * kmPerMinute
      )

      stops.push({
        ...charger,
        stopNumber: stops.length + 1,
        distanceFromPrevious: charger.distanceFromStart - currentPosition,
        remainingDistance: totalDistance - charger.distanceFromStart,
        chargeMinutes,
        rangeAfterCharge
      })

      currentPosition = charger.distanceFromStart
      availableRange = rangeAfterCharge
    }

    return stops
  })

  // Nombre d'arrêts nécessaires
  const stopsNeeded = computed(() => plannedStops.value.length)
  const totalChargingMinutes = computed(() => plannedStops.value.reduce(
    (total, stop) => total + (stop.unreachable ? 0 : (stop.chargeMinutes || 0)), 0
  ))

  // Est-ce que le trajet est faisable?
  const isTripFeasible = computed(() => {
    if (!routeInfo?.value) return true

    const totalDistance = routeInfo.value.distance / 1000
    if (totalDistance <= currentUsableRange.value) return true

    const stops = plannedStops.value
    if (stops.length === 0 || stops.some(stop => stop.unreachable)) return false
    const last = stops[stops.length - 1]
    return last.distanceFromStart + last.rangeAfterCharge >= totalDistance - 0.01
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
    maxChargeMinutes,
    totalChargingMinutes,
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
