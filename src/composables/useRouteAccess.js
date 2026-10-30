import { isPointNearRoute } from './useRoute'

const OSRM_TABLE_API = 'https://router.project-osrm.org/table/v1/driving'
const MAX_BATCH_SIZE = 40
const MAX_VERIFIED_PER_ROUTE = 160
const ROUTE_CORRIDOR_M = 5000

const motorwayArea = charger => /\b(?:aire|autoroute|rest area|service area|motorway)\b/i.test(
  `${charger.name || ''} ${charger.address || ''} ${charger.town || ''}`
)

/**
 * Approximation fondée sur la circulation DIRIGÉE : un itinéraire qui passe
 * par la borne doit rester proche de l'itinéraire direct. Un accès uniquement
 * depuis la chaussée opposée provoque généralement un long détour / demi-tour.
 *
 * OSRM utilise les routes et sens uniques d'OSM, mais ne prouve pas à 100 %
 * l'accès à un parking : les données routières et les coordonnées des bornes
 * doivent aussi être correctes. Les résultats inconnus ne seront pas planifiés.
 */
export async function verifyChargerRoadAccess(routeCoords, chargers, fetcher = fetch) {
  const access = new Map(chargers.map(c => [c.id, { roadAccess: 'unknown' }]))
  if (!routeCoords || routeCoords.length < 2) return access
  const origin = routeCoords[0]
  const dest = routeCoords[routeCoords.length - 1]
  if (!origin || !dest) return access

  // On valide en priorité les stations proches du trajet. Pour un très long
  // trajet, les validations suivantes pourront être faites lors du recalcul.
  const candidates = chargers.filter(c =>
    Number.isFinite(c.lat) && Number.isFinite(c.lng) &&
    isPointNearRoute(c.lat, c.lng, routeCoords, ROUTE_CORRIDOR_M)
  ).sort((a, b) => a.distance - b.distance).slice(0, MAX_VERIFIED_PER_ROUTE)

  const batchRequest = async batch => {
    const len = batch.length
    const coords = [origin, ...batch.map(c => [c.lng, c.lat]), dest]
    const path = coords.map(([lng, lat]) => `${lng.toFixed(6)},${lat.toFixed(6)}`).join(';')
    const approach = ['unrestricted', ...batch.map(() => 'curb'), 'unrestricted'].join(';')
    const destIndices = Array.from({ length: len + 1 }, (_, i) => i + 1).join(';')
    const sourceIndices = Array.from({ length: len }, (_, i) => i + 1).join(';')
    const base = `${OSRM_TABLE_API}/${path}?annotations=duration&approaches=${approach}`
    const [first, second] = await Promise.all([
      fetcher(`${base}&sources=0&destinations=${destIndices}`),
      fetcher(`${base}&sources=${sourceIndices}&destinations=${len + 1}`)
    ])
    if (!first.ok || !second.ok) return
    const [from, to] = await Promise.all([first.json(), second.json()])
    if (from.code !== 'Ok' || to.code !== 'Ok') return
    const baseline = from.durations?.[0]?.[len]
    if (!Number.isFinite(baseline)) return

    batch.forEach((charger, index) => {
      const before = from.durations?.[0]?.[index]
      const after = to.durations?.[index]?.[0]
      // On refuse aussi les points mal recollés au réseau routier.
      const snapBefore = from.destinations?.[index]?.distance
      const snapAfter = to.sources?.[index]?.distance
      if (!Number.isFinite(before) || !Number.isFinite(after) ||
        !Number.isFinite(snapBefore) || !Number.isFinite(snapAfter) ||
        Math.max(snapBefore, snapAfter) > 750) return

      const detourSeconds = Math.max(0, before + after - baseline)
      // Plus strict sur une aire d'autoroute pour éviter la chaussée opposée.
      const maxDetourSeconds = motorwayArea(charger) ? 240 : 600
      access.set(charger.id, {
        roadAccess: detourSeconds <= maxDetourSeconds ? 'routable' : 'detour',
        roadDetourMinutes: Math.round(detourSeconds / 60)
      })
    })
  }

  // Le serveur de démonstration OSRM n'est pas un SLA : échec = inconnu,
  // jamais 'accessible' par défaut.
  const batches = []
  for (let i = 0; i < candidates.length; i += MAX_BATCH_SIZE) {
    batches.push(candidates.slice(i, i + MAX_BATCH_SIZE))
  }
  await Promise.allSettled(batches.map(batchRequest))
  return access
}
