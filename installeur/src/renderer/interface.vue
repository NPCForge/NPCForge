<template>
  <div class="container container-narrow py-4">
    <h1 class="mb-1">🚀 NPCForge — Assistant d'installation</h1>
    <p class="text-secondary">Vérifie Docker, installe l'API et le Jeu.</p>

    <div class="d-flex gap-2 my-3">
      <button @click="startInstallation" class="btn btn-primary">
        {{ installing ? 'Installation en cours...' : 'Lancer l\'installation' }}
      </button>
      <button 
        v-if="installationComplete" 
        @click="openLauncher" 
        class="btn btn-outline-light"
      >
        Ouvrir le Launcher
      </button>
    </div>

    <!-- Étape 1: Docker -->
    <div class="card mb-3">
      <div class="card-header d-flex justify-content-between align-items-center">
        <div class="step-title">
          <span class="badge rounded-pill badge-soft">1</span>
          <strong>Docker</strong>
        </div>
        <div class="step-status" :class="getStatusClass(dockerStatus)">
          {{ dockerStatus }}
        </div>
      </div>
      <div class="card-body">
        <small class="mono text-secondary d-block mb-2">docker --version</small>
        <div class="progress">
          <div 
            class="progress-bar progress-bar-striped" 
            :style="{ width: dockerProgress + '%' }"
          ></div>
        </div>
        <div class="mt-2 small text-secondary">{{ dockerLog }}</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const installing = ref(false)
const installationComplete = ref(false)
const dockerStatus = ref('En attente…')
const dockerProgress = ref(0)
const dockerLog = ref('')

const startInstallation = async () => {
  installing.value = true
  dockerStatus.value = 'Vérification…'
  dockerProgress.value = 0
  
  try {
    // Appel à votre logique d'installation
    await checkDocker()
    installationComplete.value = true
  } catch (error) {
    dockerStatus.value = 'Erreur'
    dockerLog.value = error.message
  } finally {
    installing.value = false
  }
}

const checkDocker = async () => {
  // À implémenter avec votre logique actuelle
  dockerLog.value = 'Vérification de Docker...'
  dockerProgress.value = 50
  
  // Simulation - remplacez par votre code réel
  await new Promise(resolve => setTimeout(resolve, 1000))
  
  dockerStatus.value = 'Installé ✓'
  dockerProgress.value = 100
  dockerLog.value = 'Docker est correctement installé'
}

const openLauncher = () => {
  // À implémenter
  console.log('Ouvrir le Launcher')
}

const getStatusClass = (status) => {
  if (status.includes('✓')) return 'text-success'
  if (status.includes('Erreur')) return 'text-danger'
  if (status.includes('cours')) return 'text-info'
  return 'text-warning'
}
</script>

<style scoped>
.step-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.step-status {
  font-size: 0.9rem;
  opacity: 0.9;
}

.badge-soft {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace;
  opacity: 0.85;
}
</style>
