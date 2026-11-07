import { ref, computed, onMounted, onUnmounted } from 'vue'

export function usePwaInstall() {
  const deferredPrompt = ref(null)
  const isInstalled = ref(false)
  const isIOS = ref(false)
  const isAndroid = ref(false)
  const showInstallBanner = ref(false)
  const installDismissed = ref(false)

  // Détecter la plateforme
  const detectPlatform = () => {
    const ua = navigator.userAgent || navigator.vendor || window.opera
    isIOS.value = /iPad|iPhone|iPod/.test(ua) && !window.MSStream
    isAndroid.value = /android/i.test(ua)
  }

  // Vérifier si l'app est déjà installée
  const checkInstalled = () => {
    // Mode standalone = déjà installée
    if (window.matchMedia('(display-mode: standalone)').matches) {
      isInstalled.value = true
      return true
    }
    // iOS standalone
    if (navigator.standalone === true) {
      isInstalled.value = true
      return true
    }
    return false
  }

  // Vérifier si l'utilisateur a déjà refusé l'installation
  const checkDismissed = () => {
    const dismissed = localStorage.getItem('pwa-install-dismissed')
    if (dismissed) {
      const dismissedTime = parseInt(dismissed, 10)
      // Réafficher après 7 jours
      if (Date.now() - dismissedTime < 7 * 24 * 60 * 60 * 1000) {
        installDismissed.value = true
        return true
      }
    }
    return false
  }

  // Gérer l'événement beforeinstallprompt (Android/Chrome)
  const handleBeforeInstallPrompt = (e) => {
    e.preventDefault()
    deferredPrompt.value = e

    if (!checkInstalled() && !checkDismissed()) {
      showInstallBanner.value = true
    }
  }

  // Gérer l'événement appinstalled
  const handleAppInstalled = () => {
    isInstalled.value = true
    showInstallBanner.value = false
    deferredPrompt.value = null
  }

  // Installer l'app (Android)
  const installApp = async () => {
    if (!deferredPrompt.value) return false

    try {
      deferredPrompt.value.prompt()
      const { outcome } = await deferredPrompt.value.userChoice

      if (outcome === 'accepted') {
        isInstalled.value = true
        showInstallBanner.value = false
      }

      deferredPrompt.value = null
      return outcome === 'accepted'
    } catch (error) {
      console.error('Erreur lors de l\'installation:', error)
      return false
    }
  }

  // Fermer la bannière sans installer
  const dismissInstall = () => {
    showInstallBanner.value = false
    installDismissed.value = true
    localStorage.setItem('pwa-install-dismissed', Date.now().toString())
  }

  // Peut-on installer? (Android avec prompt disponible OU iOS non installé)
  const canInstall = computed(() => {
    if (isInstalled.value) return false
    return deferredPrompt.value !== null || (isIOS.value && !isInstalled.value)
  })

  // Afficher la bannière si conditions remplies
  const shouldShowBanner = computed(() => {
    if (isInstalled.value || installDismissed.value) return false
    if (isAndroid.value && deferredPrompt.value) return showInstallBanner.value
    // Sur iOS le bandeau masquait les contrôles (Firefox et Brave inclus).
    // L'aide d'installation est maintenant dans Options, sans overlay.
    return false
  })

  onMounted(() => {
    detectPlatform()
    checkInstalled()
    checkDismissed()

    // Écouter l'événement beforeinstallprompt
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    // Pas de bannière automatique sur iOS : elle recouvrait la navigation.
  })

  onUnmounted(() => {
    window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.removeEventListener('appinstalled', handleAppInstalled)
  })

  return {
    isInstalled,
    isIOS,
    isAndroid,
    canInstall,
    shouldShowBanner,
    installApp,
    dismissInstall
  }
}
