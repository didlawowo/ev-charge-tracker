<script setup>
import { ref, inject, onMounted, onUnmounted, watch, nextTick } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
  isCCSConnection,
  isTeslaCharger,
  googleMapsUrl,
  appleMapsUrl,
  maxCcsPower,
  formatDistance,
  formatSavedAt,
  escapeHtml
} from '../utils'
import AppIcon from './AppIcon.js'
import StopsSheet from './StopsSheet.vue'

const position = inject('position')
const chargers = inject('chargers')
const loading = inject('loading')
const destination = inject('destination')
const plannedStops = inject('plannedStops')
const alternativeRoutes = inject('alternativeRoutes', ref([]))
const selectedRouteIndex = inject('selectedRouteIndex', ref(0))
const focusStop = inject('focusStop', ref(null))
const chargersError = inject('chargersError', ref(null))
const signalLost = inject('signalLost', ref(false))
const openOptions = inject('openOptions', () => {})
const refreshChargers = inject('refreshChargers', () => {})
const isOnline = inject('isOnline', ref(true))
const restoredAt = inject('restoredAt', ref(null))

const mapContainer = ref(null)
const sheetWrap = ref(null)
const sheetHeight = ref(0)
// Sur écran tactile on zoome au pincement : pas besoin des boutons +/−
const hasZoomControl = !L.Browser.mobile

let map = null
let userMarker = null
let destinationMarker = null
let chargersLayer = null
let chargerMarkers = {}
let routeLayer = null
let routeBounds = null
let resizeObserver = null

const BOLT_SVG = '<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true"><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z"/></svg>'

const userIcon = L.divIcon({
  className: 'user-marker',
  html: '<div class="user-dot"></div>',
  iconSize: [22, 22],
  iconAnchor: [11, 11]
})

const chargerIcon = (variant) => L.divIcon({
  className: 'charger-marker',
  html: `<div class="charger-dot ${variant}">${BOLT_SVG}</div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 15]
})

const CHARGER_ICONS = {
  default: chargerIcon(''),
  tesla: chargerIcon('tesla'),
  offline: chargerIcon('offline')
}

// Les arrêts affichent leur numéro, le même que dans la liste des arrêts
const stopIcon = (stop) => L.divIcon({
  className: 'planned-stop-marker',
  html: `<div class="planned-stop-dot${stop.unreachable ? ' unreachable' : ''}">${stop.stopNumber}</div>`,
  iconSize: [38, 38],
  iconAnchor: [19, 19]
})

const destinationIcon = L.divIcon({
  className: 'destination-marker',
  html: '<svg viewBox="0 0 24 24" width="36" height="36" aria-hidden="true"><path d="M12 22s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z" fill="#ef4444" stroke="#fff" stroke-width="1.5"/><circle cx="12" cy="10" r="2.6" fill="#fff"/></svg>',
  iconSize: [36, 36],
  iconAnchor: [18, 34]
})

const popupHtml = (charger, stop) => {
  const power = maxCcsPower(charger)
  const tags = charger.connections
    .filter(isCCSConnection)
    .slice(0, 3)
    .map(c => `<span class="conn-tag">${escapeHtml(c.type)}${c.power ? ` · ${c.power} kW` : ''}</span>`)
    .join('')
  const place = [charger.address, charger.town].filter(Boolean).join(', ')
  const points = charger.numberOfPoints
  // URLs calculées à l'ouverture : la position a pu changer depuis la création du marqueur
  const gUrl = googleMapsUrl(position.value, charger, destination.value)
  const aUrl = appleMapsUrl(position.value, charger)

  return `
    <div class="popup">
      ${stop ? `<span class="popup-stop">Arrêt ${stop.stopNumber}</span>` : ''}
      <div class="popup-head">
        <div class="popup-title">
          <strong>${escapeHtml(charger.name)}</strong>
          <span class="operator">${escapeHtml(charger.operator)}</span>
        </div>
        ${power ? `<span class="popup-power">${power}<small>kW</small></span>` : ''}
      </div>
      ${place ? `<p class="popup-address">${escapeHtml(place)}</p>` : ''}
      <div class="stats">
        <span>${formatDistance(charger.distance)}</span>
        ${points ? `<span>${points} point${points > 1 ? 's' : ''} de charge</span>` : ''}
        ${charger.isOperational ? '' : '<span class="off">Hors service</span>'}
      </div>
      ${tags ? `<div class="connections">${tags}</div>` : ''}
      ${charger.usageCost ? `<p class="price">${escapeHtml(charger.usageCost)}</p>` : ''}
      <div class="popup-actions">
        <a class="popup-btn primary" href="${escapeHtml(gUrl)}" target="_blank" rel="noopener">Google Maps</a>
        <a class="popup-btn" href="${escapeHtml(aUrl)}" target="_blank" rel="noopener">Plans</a>
      </div>
      <a class="popup-link" href="${escapeHtml(charger.detailsUrl)}" target="_blank" rel="noopener">Fiche OpenChargeMap ↗</a>
    </div>
  `
}

const renderRoutes = () => {
  if (!map || !routeLayer) return

  routeLayer.clearLayers()

  const routes = alternativeRoutes.value
  const selectedIdx = selectedRouteIndex.value
  if (!routes || routes.length === 0) return

  // D'abord les routes alternatives (en dessous)
  routes.forEach((route, index) => {
    if (index === selectedIdx) return // On dessine la route principale après

    const latLngs = route.coordinates.map(([lng, lat]) => [lat, lng])
    routeLayer.addLayer(L.polyline(latLngs, {
      color: '#64748b',
      weight: 4,
      opacity: 0.6,
      dashArray: '8, 10'
    }))
  })

  // Ensuite la route sélectionnée (au-dessus), avec un liseré pour la lisibilité
  const selected = routes[selectedIdx]
  if (selected) {
    const latLngs = selected.coordinates.map(([lng, lat]) => [lat, lng])
    routeLayer.addLayer(L.polyline(latLngs, { color: '#064e3b', weight: 8, opacity: 0.35 }))
    const polyline = L.polyline(latLngs, { color: '#10b981', weight: 5, opacity: 0.95 })
    routeLayer.addLayer(polyline)
    routeBounds = polyline.getBounds()
    fitRoute()
  } else {
    routeBounds = null
  }
}

// Cadrer tout le trajet en laissant de la place au panneau des arrêts
const fitRoute = () => {
  if (!map || !routeBounds) return
  map.fitBounds(routeBounds, {
    paddingTopLeft: [40, 60],
    paddingBottomRight: [40, sheetHeight.value + 40]
  })
}

const renderDestination = () => {
  if (!map) return
  const dest = destination.value

  if (destinationMarker) {
    map.removeLayer(destinationMarker)
    destinationMarker = null
  }

  if (dest) {
    destinationMarker = L.marker([dest.lat, dest.lng], { icon: destinationIcon, zIndexOffset: 500 }).addTo(map)
  } else if (position?.value) {
    // Destination effacée : recentrer sur la position GPS d'origine
    map.setView([position.value.lat, position.value.lng], 13)
  }
}

const renderChargers = () => {
  if (!map || !chargersLayer) return

  chargersLayer.clearLayers()
  chargerMarkers = {}

  const stopsById = new Map((plannedStops.value || []).map(s => [s.id, s]))

  chargers.value.forEach(charger => {
    const stop = stopsById.get(charger.id)
    let icon
    if (stop) icon = stopIcon(stop)
    else if (!charger.isOperational) icon = CHARGER_ICONS.offline
    else if (isTeslaCharger(charger)) icon = CHARGER_ICONS.tesla
    else icon = CHARGER_ICONS.default

    const marker = L.marker([charger.lat, charger.lng], { icon, zIndexOffset: stop ? 1000 : 0 })
    marker.bindPopup(() => popupHtml(charger, stop), {
      minWidth: 250,
      maxWidth: 300,
      autoPanPaddingTopLeft: L.point(16, 70),
      autoPanPaddingBottomRight: L.point(16, 16)
    })
    chargersLayer.addLayer(marker)
    chargerMarkers[charger.id] = marker
  })
}

onMounted(() => {
  if (!mapContainer.value) return

  map = L.map(mapContainer.value, {
    zoomControl: false,
    // Le double-tap n'est jamais un geste de zoom dans EV Finder :
    // on conserve uniquement le pinch-to-zoom sur mobile.
    doubleClickZoom: false
  }).setView([46.603354, 1.888334], 6)

  // Seule URL admise par la politique d'usage OSM (les sous-domaines a/b/c peuvent être coupés).
  // crossOrigin : réponses CORS plutôt qu'opaques, pour que le service worker puisse les garder en cache.
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19,
    crossOrigin: true
  }).addTo(map)

  if (hasZoomControl) {
    L.control.zoom({ position: 'bottomright' }).addTo(map)
  }

  chargersLayer = L.layerGroup().addTo(map)
  routeLayer = L.layerGroup().addTo(map)

  // Si la position GPS est déjà connue au montage (course avec le watch immédiat),
  // centrer dessus tout de suite — sinon on resterait bloqué sur la vue France.
  if (position?.value) {
    userMarker = L.marker([position.value.lat, position.value.lng], { icon: userIcon, zIndexOffset: 800 }).addTo(map)
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

  // Leaflet ne détecte pas seul les changements de taille (onglet Liste → Carte,
  // bandeau d'itinéraire qui grandit) : sans invalidateSize, des zones grises apparaissent.
  resizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) {
      if (entry.target === mapContainer.value) {
        map?.invalidateSize()
      } else if (entry.target === sheetWrap.value) {
        sheetHeight.value = entry.target.offsetHeight
      }
    }
  })
  resizeObserver.observe(mapContainer.value)
  if (sheetWrap.value) resizeObserver.observe(sheetWrap.value)

  // Données déjà disponibles avant le montage
  renderRoutes()
  renderDestination()
  renderChargers()
})

onUnmounted(() => {
  resizeObserver?.disconnect()
  map?.remove()
  map = null
})

watch(sheetWrap, (el, previous) => {
  if (!resizeObserver) return
  if (previous) resizeObserver.unobserve(previous)
  if (el) resizeObserver.observe(el)
  else sheetHeight.value = 0
})

// Le trajet est cadré avant que les arrêts soient calculés : quand le panneau apparaît,
// on recadre pour que la destination ne se retrouve pas cachée dessous.
watch(sheetHeight, (height, previous) => {
  if (previous === 0 && height > 0) fitRoute()
})

// Routes : alternatives en gris pointillé, sélectionnée en vert
watch([alternativeRoutes, selectedRouteIndex], renderRoutes)

watch(destination, renderDestination)

watch(position, (pos) => {
  if (!map || !pos) return

  if (userMarker) {
    userMarker.setLatLng([pos.lat, pos.lng])
  } else {
    userMarker = L.marker([pos.lat, pos.lng], { icon: userIcon, zIndexOffset: 800 }).addTo(map)
    map.setView([pos.lat, pos.lng], 13)
  }
})

watch([chargers, plannedStops], renderChargers)

// Recentrer + ouvrir la bulle quand on choisit un arrêt ou une borne de la liste
watch(focusStop, async (stop) => {
  if (!map || !stop) return
  // Venant de l'onglet Liste, la carte vient juste d'être réaffichée
  await nextTick()
  map.invalidateSize()
  map.setView([stop.lat, stop.lng], 15, { animate: false })
  // Remonter la borne au-dessus du panneau des arrêts
  if (sheetHeight.value) map.panBy([0, sheetHeight.value / 2], { animate: false })
  chargerMarkers[stop.id]?.openPopup()
})

const onSheetFocus = (stop) => {
  focusStop.value = { ...stop }
}

const centerOnUser = () => {
  if (map && position.value) {
    map.setView([position.value.lat, position.value.lng], 14)
  }
}
</script>

<template>
  <div
    class="map-container"
    :class="{ 'has-zoom': hasZoomControl }"
    :style="{ '--sheet-h': `${sheetHeight}px` }"
  >
    <div ref="mapContainer" class="map" />

    <div class="map-status">
      <div v-if="loading" class="status-pill" role="status" aria-live="polite">
        <span class="spinner-small" aria-hidden="true" />
        Recherche des bornes…
      </div>
      <button v-else-if="chargersError" type="button" class="status-pill error" @click="refreshChargers">
        <AppIcon name="alert" :size="15" />
        Bornes indisponibles · Réessayer
      </button>
      <button v-else-if="chargers.length === 0" type="button" class="status-pill warn" @click="openOptions">
        <AppIcon name="sliders" :size="15" />
        Aucune borne · Modifier les filtres
      </button>
      <div v-else class="status-pill charger-count" aria-live="polite" aria-atomic="true">
        <AppIcon name="bolt" :size="15" />
        {{ chargers.length }} borne{{ chargers.length > 1 ? 's' : '' }}
      </div>

      <div v-if="!isOnline" class="status-pill offline" role="status">
        <AppIcon name="offline" :size="15" />
        Hors-ligne<template v-if="restoredAt"> · trajet du {{ formatSavedAt(restoredAt) }}</template>
      </div>
      <button v-else-if="restoredAt" type="button" class="status-pill" @click="refreshChargers">
        Trajet du {{ formatSavedAt(restoredAt) }} · Actualiser
      </button>

      <div v-if="signalLost" class="status-pill warn" role="status">
        Signal GPS perdu
      </div>
    </div>

    <button
      class="center-btn"
      type="button"
      aria-label="Centrer la carte sur ma position"
      title="Centrer sur ma position"
      @click="centerOnUser"
    >
      <AppIcon name="locate" :size="22" />
    </button>

    <div v-if="plannedStops.length > 0" ref="sheetWrap" class="sheet-wrap">
      <StopsSheet :stops="plannedStops" @focus="onSheetFocus" />
    </div>
  </div>
</template>

<style scoped>
.map-container {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.map {
  width: 100%;
  height: 100%;
  background: var(--bg);
}

.map-container :deep(.leaflet-bottom) {
  bottom: var(--sheet-h, 0px);
}

.map-status {
  position: absolute;
  top: 12px;
  left: 12px;
  right: 12px;
  z-index: 1000;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  pointer-events: none;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 34px;
  padding: 6px 12px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--bg-card);
  color: var(--text);
  font-size: 0.85rem;
  font-weight: 600;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  pointer-events: auto;
}

button.status-pill {
  cursor: pointer;
}

.status-pill.charger-count {
  background: var(--primary);
  border-color: var(--primary);
  color: var(--on-primary);
}

.status-pill.warn {
  color: var(--warning);
}

.status-pill.error {
  color: #fca5a5;
}

.status-pill.offline {
  background: #3a2a0a;
  border-color: rgba(245, 158, 11, 0.5);
  color: #fcd34d;
}

.center-btn {
  position: absolute;
  right: 12px;
  bottom: calc(var(--sheet-h, 0px) + 28px);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border: 1px solid var(--border);
  border-radius: 50%;
  background: var(--bg-card);
  color: var(--text);
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35);
}

.has-zoom .center-btn {
  bottom: calc(var(--sheet-h, 0px) + 100px);
}

.sheet-wrap {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1001;
}

.spinner-small {
  width: 14px;
  height: 14px;
  border: 2px solid var(--border);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>

<style>
.user-marker .user-dot {
  width: 22px;
  height: 22px;
  background: #3b82f6;
  border: 3px solid white;
  border-radius: 50%;
  box-shadow: 0 0 0 6px rgba(59, 130, 246, 0.25), 0 2px 8px rgba(0, 0, 0, 0.3);
}

.charger-marker .charger-dot {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  background: #16a34a;
  color: #fff;
  border: 2px solid white;
  border-radius: 50%;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.35);
  transform: scale(var(--marker-scale, 1));
  transform-origin: center;
  transition: transform 0.15s ease;
}

.charger-marker .charger-dot.tesla {
  background: #475569;
}

.charger-marker .charger-dot.offline {
  background: #94a3b8;
  opacity: 0.85;
}

.planned-stop-marker .planned-stop-dot {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  background: #2563eb;
  color: #fff;
  font-size: 17px;
  font-weight: 800;
  border: 3px solid white;
  border-radius: 50%;
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.5);
  animation: pulse-blue 2s infinite;
  transform: scale(max(var(--marker-scale, 1), 0.7));
  transform-origin: center;
  transition: transform 0.15s ease;
}

.planned-stop-marker .planned-stop-dot.unreachable {
  background: #d97706;
}

@keyframes pulse-blue {
  0%, 100% { box-shadow: 0 4px 12px rgba(37, 99, 235, 0.5); }
  50% { box-shadow: 0 4px 22px rgba(37, 99, 235, 0.85); }
}

.destination-marker svg {
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.35));
}

.leaflet-popup-content-wrapper {
  background: var(--bg-card);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 14px;
  box-shadow: var(--shadow);
}

.leaflet-popup-tip {
  background: var(--bg-card);
}

.leaflet-popup-content {
  margin: 14px 16px;
  font-size: 14px;
  line-height: 1.35;
}

.leaflet-container a.leaflet-popup-close-button {
  top: 6px;
  right: 6px;
  width: 30px;
  height: 30px;
  font-size: 22px;
  line-height: 30px;
  color: var(--text-muted);
}

.popup .popup-stop {
  display: inline-block;
  margin-bottom: 6px;
  padding: 2px 8px;
  border-radius: 999px;
  background: #2563eb;
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.03em;
  text-transform: uppercase;
}

.popup .popup-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  padding-right: 22px;
}

.popup .popup-title {
  min-width: 0;
}

.popup .popup-title strong {
  display: block;
  font-size: 15px;
}

.popup .popup-title .operator {
  color: var(--primary);
  font-size: 13px;
  font-weight: 500;
}

.popup .popup-power {
  flex-shrink: 0;
  padding: 5px 8px;
  border-radius: 8px;
  background: var(--primary-soft);
  color: var(--primary);
  font-size: 18px;
  font-weight: 800;
  line-height: 1;
}

.popup .popup-power small {
  margin-left: 2px;
  font-size: 11px;
  font-weight: 600;
}

.popup .popup-address {
  margin: 6px 0;
  color: var(--text-muted);
  font-size: 13px;
}

.popup .stats {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  font-size: 13px;
}

.popup .stats .off {
  color: var(--danger);
  font-weight: 600;
}

.popup .connections {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin: 8px 0 4px;
}

.popup .conn-tag {
  padding: 2px 8px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg-elevated);
  color: var(--text);
  font-size: 12px;
}

.popup .price {
  margin: 6px 0 0;
  color: var(--warning);
  font-size: 12px;
}

.popup .popup-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-top: 12px;
}

.leaflet-container .popup a.popup-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 42px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--bg-elevated);
  color: var(--text);
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
}

.leaflet-container .popup a.popup-btn.primary {
  border-color: var(--primary);
  background: var(--primary);
  color: var(--on-primary);
}

.leaflet-container .popup a.popup-link {
  display: block;
  margin-top: 10px;
  color: var(--primary);
  font-size: 13px;
  font-weight: 500;
  text-align: center;
  text-decoration: none;
}
</style>
