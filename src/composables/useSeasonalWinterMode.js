import { ref, onMounted, onUnmounted, watch } from 'vue'

const STORAGE_KEY = 'ev-finder:winter-mode-season'

/**
 * En France : hiver du 1er novembre au 31 mars inclus.
 * L'identifiant change le 1er novembre et le 1er avril : les éventuelles
 * préférences manuelles sont valables uniquement pendant la saison en cours.
 */
export function getWinterSeason(date = new Date()) {
  const month = date.getMonth() // 0 = janvier
  const year = date.getFullYear()
  const winter = month >= 10 || month <= 2
  return {
    winter,
    key: winter
      ? `winter-${month >= 10 ? year : year - 1}`
      : `warm-${year}`
  }
}

function readSeasonPreference(season) {
  try {
    const preference = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
    if (preference?.season === season.key && typeof preference.enabled === 'boolean') {
      return preference.enabled
    }
  } catch {
    // Mode privé ou stockage indisponible : appliquer la saison courante.
  }
  return season.winter
}

export function useSeasonalWinterMode() {
  let season = getWinterSeason()
  const winterMode = ref(readSeasonPreference(season))

  const refreshSeason = () => {
    const current = getWinterSeason()
    if (current.key === season.key) return
    season = current
    winterMode.value = readSeasonPreference(current)
  }

  watch(winterMode, enabled => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ season: season.key, enabled }))
    } catch {
      // Le mode hiver reste réglable pendant la session.
    }
  })

  let refreshInterval = null
  const onVisibility = () => {
    if (!document.hidden) refreshSeason()
  }

  onMounted(() => {
    window.addEventListener('focus', refreshSeason)
    document.addEventListener('visibilitychange', onVisibility)
    refreshInterval = window.setInterval(refreshSeason, 15 * 60 * 1000)
  })

  onUnmounted(() => {
    window.removeEventListener('focus', refreshSeason)
    document.removeEventListener('visibilitychange', onVisibility)
    if (refreshInterval !== null) window.clearInterval(refreshInterval)
  })

  return { winterMode }
}
