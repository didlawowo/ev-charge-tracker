<script setup>
import { usePwaInstall } from '../composables/usePwaInstall'

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
    <div v-if="shouldShowBanner" class="install-banner">
      <div class="install-content">
        <div class="install-icon">⚡</div>
        <div class="install-text">
          <strong>Installer EV Finder</strong>
          <p v-if="isAndroid">Accès rapide depuis l'écran d'accueil</p>
          <p v-else-if="isIOS">
            Appuyez sur <span class="ios-share">↑</span> puis "Sur l'écran d'accueil"
          </p>
        </div>
      </div>
      <div class="install-actions">
        <button v-if="isAndroid" class="btn-install" @click="handleInstall">
          Installer
        </button>
        <button class="btn-dismiss" @click="dismissInstall">
          {{ isIOS ? 'OK' : 'Plus tard' }}
        </button>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.install-banner {
  position: fixed;
  bottom: 70px;
  left: 12px;
  right: 12px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 16px;
  z-index: 1000;
  box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.3);
}

.install-content {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.install-icon {
  width: 48px;
  height: 48px;
  background: linear-gradient(135deg, var(--primary), var(--primary-dark));
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
}

.install-text {
  flex: 1;
}

.install-text strong {
  display: block;
  font-size: 1rem;
  margin-bottom: 4px;
}

.install-text p {
  font-size: 0.875rem;
  color: var(--text-muted);
  margin: 0;
}

.ios-share {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  background: #007aff;
  color: white;
  border-radius: 4px;
  font-size: 14px;
  margin: 0 2px;
}

.install-actions {
  display: flex;
  gap: 12px;
}

.btn-install {
  flex: 1;
  padding: 12px 20px;
  background: var(--primary);
  color: white;
  border: none;
  border-radius: 10px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-install:hover {
  background: var(--primary-dark);
}

.btn-install:active {
  transform: scale(0.98);
}

.btn-dismiss {
  padding: 12px 20px;
  background: transparent;
  color: var(--text-muted);
  border: 1px solid var(--border);
  border-radius: 10px;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-dismiss:hover {
  background: rgba(255, 255, 255, 0.05);
  color: var(--text);
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

/* Safe area pour les appareils avec notch en bas */
@supports (padding-bottom: env(safe-area-inset-bottom)) {
  .install-banner {
    bottom: calc(70px + env(safe-area-inset-bottom));
  }
}
</style>
