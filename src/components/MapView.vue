<script setup>
import { ref, inject, onMounted, watch } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { isCCSConnection, googleMapsUrl, appleMapsUrl } from '../utils'

const position = inject('position')
const chargers = inject('chargers')
const loading = inject('loading')
const destination = inject('destination')
const plannedStops = inject('plannedStops')
const alternativeRoutes = inject('alternativeRoutes', ref([]))
const selectedRouteIndex = inject('selectedRouteIndex', ref(0))
const focusStop = inject('focusStop', ref(null))

const mapContainer = ref(null)
let map = null
let userMarker = null
let destinationMarker = null
let chargersLayer = null
let chargerMarkers = {}
let routeLayer = null

const userIcon = L.divIcon({
  className: 'user-marker',
  html: '<div class="user-dot"></div>',
  iconSize: [20, 20],
  iconAnchor: [10, 10]
})

const chargerIcon = L.divIcon({
  className: 'charger-marker',
  html: '<div class="charger-dot">⚡</div>',
  iconSize: [32, 32],
  iconAnchor: [16, 16]
})

const teslaIcon = L.divIcon({
  className: 'tesla-marker',
  html: '<div class="tesla-dot">⚡</div>',
  iconSize: [32, 32],
  iconAnchor: [16, 16]
})

const plannedStopIcon = L.divIcon({
  className: 'planned-stop-marker',
  html: '<div class="planned-stop-dot">⚡</div>',
  iconSize: [44, 44],
  iconAnchor: [22, 22]
})

const teslaPlannedStopIcon = L.divIcon({
  className: 'tesla-planned-stop-marker',
  html: '<div class="tesla-planned-stop-dot">⚡</div>',
  iconSize: [44, 44],
  iconAnchor: [22, 22]
})

const isTesla = (charger) => {
  const operator = (charger.operator || '').toLowerCase()
  return operator.includes('tesla') || operator.includes('supercharger')
}

const destinationIcon = L.divIcon({
  className: 'destination-marker',
  html: '<div class="destination-dot">📍</div>',
  iconSize: [32, 32],
  iconAnchor: [16, 32]
})

onMounted(() => {
  if (!mapContainer.value) return

  map = L.map(mapContainer.value, {
    zoomControl: false
  }).setView([46.603354, 1.888334], 6)

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap'
  }).addTo(map)

  L.control.zoom({ position: 'bottomright' }).addTo(map)

  chargersLayer = L.layerGroup().addTo(map)
  routeLayer = L.layerGroup().addTo(map)

  // Si la position GPS est déjà connue au montage (course avec le watch immédiat),
  // centrer dessus tout de suite — sinon on resterait bloqué sur la vue France.
  if (position?.value) {
    userMarker = L.marker([position.value.lat, position.value.lng], { icon: userIcon }).addTo(map)
    map.setView([position.value.lat, position.value.lng], 13)
  }

  // Ajuste la taille des pastilles selon le zoom (petites quand on dézoome,
  // pour ne pas masquer l'itinéraire). z<=6 → 0.4, z>=12 → 1 (linéaire entre).
  const updateMarkerScale = () => {
    const z = map.getZoom()
    let scale = 1
    if (z <= 6) scale = 0.4
    else if (z < 12) scale = 0.4 + (z - 6) * (0.6 / 6)
    mapContainer.value.style.setProperty('--marker-scale', scale.toFixed(2))
  }
  map.on('zoomend', updateMarkerScale)
  updateMarkerScale()
})

// Watch route changes - affiche toutes les routes (alternatives en gris, sélectionnée en vert)
watch([alternativeRoutes, selectedRouteIndex], ([routes, selectedIdx]) => {
  if (!map || !routeLayer) return

  routeLayer.clearLayers()

  if (!routes || routes.length === 0) return

  // D'abord les routes alternatives (en dessous)
  routes.forEach((route, index) => {
    if (index === selectedIdx) return // On dessine la route principale après

    const latLngs = route.coordinates.map(([lng, lat]) => [lat, lng])
    const polyline = L.polyline(latLngs, {
      color: '#64748b',
      weight: 3,
      opacity: 0.5,
      dashArray: '10, 10'
    })
    routeLayer.addLayer(polyline)
  })

  // Ensuite la route sélectionnée (au-dessus)
  const selected = routes[selectedIdx]
  if (selected) {
    const latLngs = selected.coordinates.map(([lng, lat]) => [lat, lng])
    const polyline = L.polyline(latLngs, {
      color: '#10b981',
      weight: 4,
      opacity: 0.8
    })

    routeLayer.addLayer(polyline)

    // Fit map to show entire route
    map.fitBounds(polyline.getBounds(), { padding: [50, 50] })
  }
}, { immediate: true })

// Watch destination changes
watch(destination, (dest) => {
  if (!map) return

  if (destinationMarker) {
    map.removeLayer(destinationMarker)
    destinationMarker = null
  }

  if (dest) {
    destinationMarker = L.marker([dest.lat, dest.lng], { icon: destinationIcon }).addTo(map)
  } else if (position?.value) {
    // Destination effacée : recentrer sur la position GPS d'origine
    map.setView([position.value.lat, position.value.lng], 13)
  }
}, { immediate: true })

watch(position, (pos) => {
  if (!map || !pos) return

  if (userMarker) {
    userMarker.setLatLng([pos.lat, pos.lng])
  } else {
    userMarker = L.marker([pos.lat, pos.lng], { icon: userIcon }).addTo(map)
    map.setView([pos.lat, pos.lng], 13)
  }
}, { immediate: true })

// Filtrer pour n'afficher que les connecteurs CCS
const getCCSConnections = (connections) => {
  return connections.filter(c => isCCSConnection(c))
}

watch([chargers, plannedStops], ([newChargers, stops]) => {
  if (!map || !chargersLayer) return

  chargersLayer.clearLayers()
  chargerMarkers = {}

  // IDs des arrêts planifiés
  const plannedStopIds = new Set((stops || []).map(s => s.id))

  newChargers.forEach(charger => {
    const isPlannedStop = plannedStopIds.has(charger.id)
    const tesla = isTesla(charger)
    let icon
    if (isPlannedStop) {
      icon = tesla ? teslaPlannedStopIcon : plannedStopIcon
    } else {
      icon = tesla ? teslaIcon : chargerIcon
    }
    const marker = L.marker([charger.lat, charger.lng], { icon, zIndexOffset: isPlannedStop ? 1000 : 0 })

    // N'afficher que les CCS
    const ccsConnections = getCCSConnections(charger.connections)
    const connectionsHtml = ccsConnections
      .map(c => `<span class="conn-tag">${c.type}${c.power ? ` ${c.power}kW` : ''}</span>`)
      .slice(0, 3)
      .join('')

    // Afficher le prix si disponible
    const priceHtml = charger.usageCost
      ? `<p class="price">${charger.usageCost}</p>`
      : ''

    const gUrl = googleMapsUrl(position.value, charger, destination.value)
    const aUrl = appleMapsUrl(position.value, charger)

    const popupContent = `
      <div class="popup">
        <strong>${charger.name}</strong>
        <p class="operator">${charger.operator}</p>
        <p>${charger.address}</p>
        <div class="stats">
          <span>${Math.round(charger.distance)}m</span>
          <span>${charger.numberOfPoints} borne${charger.numberOfPoints > 1 ? 's' : ''}</span>
        </div>
        <div class="connections">${connectionsHtml}</div>
        ${priceHtml}
        <div class="popup-actions">
          <a class="popup-btn google" href="${gUrl}" target="_blank" rel="noopener">Google Maps</a>
          <a class="popup-btn apple" href="${aUrl}" target="_blank" rel="noopener">Plans</a>
        </div>
        <a href="${charger.detailsUrl}" target="_blank" rel="noopener">
          Voir la fiche ↗
        </a>
      </div>
    `

    marker.bindPopup(popupContent)
    chargersLayer.addLayer(marker)
    chargerMarkers[charger.id] = marker
  })
}, { immediate: true })

// Recentrer + ouvrir la bulle quand on clique un arrêt recommandé dans la liste
watch(focusStop, (stop) => {
  if (!map || !stop) return
  map.setView([stop.lat, stop.lng], 15)
  const marker = chargerMarkers[stop.id]
  if (marker) marker.openPopup()
})

const centerOnUser = () => {
  if (map && position.value) {
    map.setView([position.value.lat, position.value.lng], 14)
  }
}
</script>

<template>
  <div class="map-container">
    <div ref="mapContainer" class="map" />

    <button
      class="center-btn"
      type="button"
      aria-label="Centrer la carte sur ma position"
      title="Centrer sur ma position"
      @click="centerOnUser"
    >
      <span aria-hidden="true">◎</span>
    </button>

    <div v-if="loading" class="map-loading" role="status" aria-live="polite">
      <div class="spinner-small" aria-hidden="true" />
      <span class="visually-hidden">Chargement des bornes…</span>
    </div>

    <div v-if="chargers.length > 0" class="charger-count" aria-live="polite" aria-atomic="true">
      {{ chargers.length }} borne{{ chargers.length > 1 ? 's' : '' }}
    </div>
  </div>
</template>

<style scoped>
.map-container {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 400px;
}

.map {
  width: 100%;
  height: 100%;
  min-height: 400px;
  background: var(--bg);
}

.center-btn {
  position: absolute;
  bottom: 100px;
  right: 10px;
  z-index: 1000;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: none;
  background: var(--bg-card);
  color: var(--text);
  font-size: 1.5rem;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0,0,0,0.3);
}

.map-loading {
  position: absolute;
  top: 10px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  background: var(--bg-card);
  padding: 8px 16px;
  border-radius: 20px;
}

.spinner-small {
  width: 20px;
  height: 20px;
  border: 2px solid var(--border);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.charger-count {
  position: absolute;
  top: 10px;
  left: 10px;
  z-index: 1000;
  background: var(--primary);
  color: white;
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 0.875rem;
  font-weight: 500;
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>

<style>
.user-marker .user-dot {
  width: 20px;
  height: 20px;
  background: #3b82f6;
  border: 3px solid white;
  border-radius: 50%;
  box-shadow: 0 2px 8px rgba(0,0,0,0.3);
}

.charger-marker .charger-dot {
  width: 32px;
  height: 32px;
  background: #22c55e;
  border: 2px solid white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  transform: scale(var(--marker-scale, 1));
  transform-origin: center;
  transition: transform 0.15s ease;
}

.tesla-marker .tesla-dot {
  width: 32px;
  height: 32px;
  background: #475569;
  border: 2px solid white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  box-shadow: 0 2px 8px rgba(71, 85, 105, 0.4);
  transform: scale(var(--marker-scale, 1));
  transform-origin: center;
  transition: transform 0.15s ease;
}

.planned-stop-marker .planned-stop-dot {
  width: 44px;
  height: 44px;
  background: #3b82f6;
  border: 3px solid white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.5);
  animation: pulse-blue 2s infinite;
  transform: scale(var(--marker-scale, 1));
  transform-origin: center;
  transition: transform 0.15s ease;
}

@keyframes pulse-blue {
  0%, 100% { box-shadow: 0 4px 12px rgba(59, 130, 246, 0.5); }
  50% { box-shadow: 0 4px 20px rgba(59, 130, 246, 0.8); }
}

.tesla-planned-stop-marker .tesla-planned-stop-dot {
  width: 44px;
  height: 44px;
  background: #475569;
  border: 3px solid white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  box-shadow: 0 4px 12px rgba(71, 85, 105, 0.5);
  animation: pulse-slate 2s infinite;
  transform: scale(var(--marker-scale, 1));
  transform-origin: center;
  transition: transform 0.15s ease;
}

@keyframes pulse-slate {
  0%, 100% { box-shadow: 0 4px 12px rgba(71, 85, 105, 0.5); }
  50% { box-shadow: 0 4px 20px rgba(71, 85, 105, 0.85); }
}

.destination-marker .destination-dot {
  font-size: 28px;
  filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
}

.leaflet-popup-content-wrapper {
  background: var(--bg-card);
  color: var(--text);
  border-radius: 12px;
}

.leaflet-popup-tip {
  background: var(--bg-card);
}

.leaflet-popup-content .popup {
  padding: 4px;
}

.leaflet-popup-content .popup strong {
  display: block;
  margin-bottom: 4px;
}

.leaflet-popup-content .popup p {
  margin: 4px 0;
  color: var(--text-muted);
  font-size: 0.875rem;
}

.leaflet-popup-content .popup a {
  display: inline-block;
  margin-top: 8px;
  color: var(--primary);
  text-decoration: none;
  font-weight: 500;
}

.leaflet-popup-content .popup .operator {
  color: var(--primary);
  font-weight: 500;
  margin-bottom: 4px;
}

.leaflet-popup-content .popup .stats {
  display: flex;
  gap: 12px;
  margin: 8px 0;
  font-size: 0.875rem;
  color: var(--text-muted);
}

.leaflet-popup-content .popup .connections {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin: 8px 0;
}

.leaflet-popup-content .popup .conn-tag {
  background: var(--border);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.75rem;
  color: var(--text);
}

.leaflet-popup-content .popup .price {
  color: #f59e0b;
  font-size: 0.8rem;
  margin-top: 6px;
}

.leaflet-popup-content .popup .popup-actions {
  display: flex;
  gap: 6px;
  margin-top: 8px;
}

.leaflet-popup-content .popup .popup-actions .popup-btn {
  margin-top: 0;
  padding: 5px 10px;
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 600;
}

.leaflet-popup-content .popup .popup-actions .popup-btn.google {
  background: rgba(66, 133, 244, 0.15);
  color: #4285f4;
}

.leaflet-popup-content .popup .popup-actions .popup-btn.apple {
  background: rgba(100, 116, 139, 0.18);
  color: #475569;
}
</style>
