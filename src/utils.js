/**
 * Calcule la distance entre deux points GPS en mètres (formule de Haversine)
 */
export function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000 // Rayon de la Terre en mètres
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

/**
 * Vérifie si une connexion est de type CCS (Type 1 ou Type 2)
 * CCS Type 2 = ID 33, CCS Type 1 = ID 32
 */
export function isCCSConnection(conn) {
  if (conn.typeId === 33 || conn.typeId === 32) {
    return true
  }
  if (conn.ConnectionTypeID === 33 || conn.ConnectionTypeID === 32) {
    return true
  }
  const type = conn.type || conn.ConnectionType?.Title || ''
  return type.toLowerCase().includes('ccs')
}

/**
 * Formate une distance en mètres pour l'affichage (« 850 m », « 12,4 km », « 108 km »).
 * @param {number} meters
 */
export function formatDistance(meters) {
  if (!Number.isFinite(meters)) return ''
  if (meters < 1000) return `${Math.round(meters)} m`
  const km = meters / 1000
  return km < 100 ? `${km.toFixed(1).replace('.', ',')} km` : `${Math.round(km)} km`
}

/**
 * Échappe une chaîne pour l'insérer dans du HTML construit à la main
 * (bulles Leaflet). Les données OpenChargeMap sont saisies par des tiers.
 * @param {unknown} value
 */
export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * URL publique de la fiche d'une borne. L'ancienne URL
 * openchargemap.org/site/poi/details/<id> renvoie désormais une 404 puis la page de connexion.
 * @param {number} id
 */
export function openChargeMapUrl(id) {
  return `https://map.openchargemap.io/#/poi/${id}`
}

/**
 * Détermine si une borne est un site Tesla (Supercharger).
 * @param {{operator?:string}} charger
 */
export function isTeslaCharger(charger) {
  const operator = (charger.operator || '').toLowerCase()
  return operator.includes('tesla') || operator.includes('supercharger')
}

/**
 * Construit une URL d'itinéraire Google Maps intégrant la borne au trajet.
 * - Sans destination : itinéraire simple position → borne.
 * - Avec destination : borne en point de passage (position → borne → destination).
 * @param {{lat:number,lng:number}|null} origin - position de départ
 * @param {{lat:number,lng:number}} charger - borne sélectionnée
 * @param {{lat:number,lng:number}|null} dest - destination finale (optionnelle)
 */
export function googleMapsUrl(origin, charger, dest) {
  const o = origin ? `${origin.lat},${origin.lng}` : ''
  const finalDest = dest ? `${dest.lat},${dest.lng}` : `${charger.lat},${charger.lng}`
  const wp = dest ? `&waypoints=${charger.lat},${charger.lng}` : ''
  return `https://www.google.com/maps/dir/?api=1&origin=${o}&destination=${finalDest}${wp}&travelmode=driving`
}

/**
 * Construit une URL d'itinéraire Apple Plans vers la borne.
 * Note : l'URL scheme Apple ne gère pas de point de passage intermédiaire fiable,
 * on route donc position → borne (la destination finale n'est pas incluse).
 * @param {{lat:number,lng:number}|null} origin - position de départ
 * @param {{lat:number,lng:number}} charger - borne sélectionnée
 */
export function appleMapsUrl(origin, charger) {
  const s = origin ? `saddr=${origin.lat},${origin.lng}&` : ''
  return `https://maps.apple.com/?${s}daddr=${charger.lat},${charger.lng}&dirflg=d`
}
