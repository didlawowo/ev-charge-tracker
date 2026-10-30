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
 * Puissance max (kW) parmi les connecteurs CCS d'une borne, ou null si inconnue.
 * @param {{connections:Array<{power?:number}>}} charger
 */
export function maxCcsPower(charger) {
  const powers = (charger.connections || [])
    .filter(isCCSConnection)
    .map(c => c.power)
    .filter(p => p)
  return powers.length > 0 ? Math.max(...powers) : null
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
 * Date/heure courte d'un enregistrement (« 11/09 14:32 »).
 * @param {number} timestamp - millisecondes
 */
export function formatSavedAt(timestamp) {
  return new Date(timestamp).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
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
 * Ouvre la borne choisie comme DESTINATION, pas comme waypoint d'un trajet.
 * Sans origin figée : Plans / Google Maps récupèrent la position GPS actuelle
 * dans leur propre application. Cela évite de guider vers un départ ancien.
 */
export function googleMapsUrl(charger) {
  const point = encodeURIComponent(`${charger.lat},${charger.lng}`)
  return `https://www.google.com/maps/dir/?api=1&destination=${point}&travelmode=driving&dir_action=navigate`
}

export function appleMapsUrl(charger) {
  return `https://maps.apple.com/?daddr=${charger.lat},${charger.lng}&dirflg=d`
}

export function navigationUrl(provider, charger) {
  return provider === 'google' ? googleMapsUrl(charger) : appleMapsUrl(charger)
}

export function navigationLabel(provider) {
  return provider === 'google' ? 'Google Maps' : 'Plans'
}
