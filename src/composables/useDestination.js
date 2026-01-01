import { ref } from 'vue'

// Photon API - optimisé pour l'autocomplete (basé sur OSM)
const PHOTON_API = 'https://photon.komoot.io/api'

export function useDestination() {
  const destination = ref(null)
  const destinationQuery = ref('')
  const suggestions = ref([])
  const isSearching = ref(false)

  const formatPlaceName = (props) => {
    const parts = []

    // Nom principal (ville ou lieu)
    if (props.name) {
      parts.push(props.name)
    }

    // Département/région pour différencier les homonymes
    if (props.county) {
      parts.push(props.county)
    } else if (props.state) {
      parts.push(props.state)
    }

    return parts.join(', ')
  }

  const deduplicateSuggestions = (items) => {
    const seen = new Map()

    return items.filter(item => {
      // Clé de déduplication basée sur le nom formaté
      const key = item.name.toLowerCase()

      if (seen.has(key)) {
        return false
      }

      seen.set(key, true)
      return true
    })
  }

  const searchDestination = async (query) => {
    if (!query || query.length < 2) {
      suggestions.value = []
      return
    }

    isSearching.value = true

    try {
      const params = new URLSearchParams({
        q: query,
        lang: 'fr',
        limit: 10,
        lat: 46.6, // Centre de la France pour biais géographique
        lon: 2.5,
        bbox: '-5.5,41.3,9.6,51.1' // Bounding box France
      })

      const response = await fetch(`${PHOTON_API}?${params}`)

      if (!response.ok) {
        throw new Error('Erreur de recherche')
      }

      const data = await response.json()

      // Filtrer pour ne garder que les lieux en France et formater
      const frenchPlaces = data.features
        .filter(f => f.properties.country === 'France')
        .map(f => ({
          id: f.properties.osm_id,
          name: formatPlaceName(f.properties),
          fullName: f.properties.name,
          lat: f.geometry.coordinates[1],
          lng: f.geometry.coordinates[0],
          type: f.properties.osm_value
        }))

      // Dédupliquer et limiter à 5 résultats
      suggestions.value = deduplicateSuggestions(frenchPlaces).slice(0, 5)
    } catch (e) {
      console.error('Erreur recherche destination:', e)
      suggestions.value = []
    } finally {
      isSearching.value = false
    }
  }

  const selectDestination = (place) => {
    destination.value = {
      lat: place.lat,
      lng: place.lng,
      name: place.name
    }
    destinationQuery.value = place.fullName || place.name.split(',')[0]
    suggestions.value = []
  }

  const clearDestination = () => {
    destination.value = null
    destinationQuery.value = ''
    suggestions.value = []
  }

  return {
    destination,
    destinationQuery,
    suggestions,
    isSearching,
    searchDestination,
    selectDestination,
    clearDestination
  }
}
