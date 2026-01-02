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
