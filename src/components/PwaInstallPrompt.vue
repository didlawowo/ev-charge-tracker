<script setup>
import { usePwaInstall } from '../composables/usePwaInstall'
import AppIcon from './AppIcon.js'

const {
  isIOS,
  isAndroid,
  shouldShowBanner,
  installApp,
  dismissInstall
} = usePwaInstall()

const handleInstall = async () => {
  await installApp()
}
</script>

<template>
  <Transition name="slide-up">
    <div v-if="shouldShowBanner" class="install-banner" role="dialog" aria-label="Installer l'application">
      <div class="install-icon"><AppIcon name="bolt" :size="20" /></div>
      <div class="install-text">
        <strong>Installer EV Finder</strong>
        <p v-if="isAndroid">Accès rapide depuis l'écran d'accueil</p>
        <p v-else-if="isIOS">
          <span class="ios-share" aria-hidden="true">↑</span> Partager, puis « Sur l'écran d'accueil »
        </p>
      </div>
      <div class="install-actions">
        <button v-if="isAndroid" class="btn-install" @click="handleInstall">
          Installer
        </button>
        <button class="btn-dismiss" :aria-label="isIOS ? 'Fermer' : 'Plus tard'" @click="dismissInstall">
          <template v-if="isAndroid">Plus tard</template>
          <AppIcon v-else name="x" :size="18" />
        </button>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
/* Au-dessus de la barre d'onglets (56px) sans masquer les contrôles de la carte */
.install-banner {
  position: fixed;
  left: auto;
  right: 12px;
  width: min(300px, calc(100vw - 24px));
  bottom: calc(72px + env(safe-area-inset-bottom));
  z-index: 1500;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 16px;
  box-shadow: var(--shadow);
}

.install-icon {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 10px;
  background: var(--primary);
  color: var(--on-primary);
}

.install-text {
  flex: 1;
  min-width: 0;
}

.install-text strong {
  display: block;
  font-size: 0.9rem;
}

.install-text p {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.78rem;
  line-height: 1.35;
}

.ios-share {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  background: #007aff;
  color: white;
  border-radius: 4px;
  font-size: 11px;
  vertical-align: -2px;
}

.install-actions {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 4px;
}

.btn-install {
  min-height: 40px;
  padding: 0 14px;
  background: var(--primary);
  color: var(--on-primary);
  border: none;
  border-radius: 10px;
  font-size: 0.85rem;
  font-weight: 700;
  cursor: pointer;
}

.btn-dismiss {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 44px;
  min-height: 44px;
  padding: 0 8px;
  background: none;
  border: none;
  border-radius: 10px;
  color: var(--text-muted);
  font-size: 0.85rem;
  cursor: pointer;
}

/* Animation */
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.3s ease-out;
}

.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(100%);
  opacity: 0;
}
</style>
