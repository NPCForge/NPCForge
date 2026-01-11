<template>
  <div class="container container-narrow py-4">
    <h1 class="mb-1">🚀 NPCForge — Assistant d'installation</h1>
    <p class="text-secondary">Vérifie Docker, installe l'API et le Jeu.</p>

    <div class="d-flex gap-2 my-3">
      <button 
        @click="startInstallation" 
        :disabled="installing"
        class="btn btn-primary"
      >
        {{ installing ? 'Installation en cours...' : 'Lancer l\'installation' }}
      </button>
      <button 
        v-if="allStepsComplete" 
        @click="openLauncher" 
        class="btn btn-outline-light"
      >
        Ouvrir le Launcher
      </button>
    </div>

    <!-- Étapes d'installation -->
    <template v-for="(step, index) in steps" :key="index">
      <div class="card mb-3">
        <div class="card-header d-flex justify-content-between align-items-center">
          <div class="step-title">
            <span class="badge rounded-pill badge-soft">{{ index + 1 }}</span>
            <strong>{{ step.title }}</strong>
          </div>
          <div class="step-status" :class="getStatusClass(step.status)">
            {{ step.status }}
          </div>
        </div>
        <div class="card-body">
          <template v-if="step.requiresInput">
            <div class="mb-3">
              <label :for="`input-${index}`" class="form-label">
                {{ step.inputLabel }}
              </label>
              <div class="input-group">
                <input 
                  :id="`input-${index}`" 
                  v-model="step.inputValue"
                  :type="step.inputType"
                  class="form-control" 
                  autocomplete="off"
                  :placeholder="step.inputPlaceholder"
                />
                <button 
                  v-if="step.inputType === 'password'"
                  @click="toggleInputVisibility(index)"
                  type="button" 
                  class="btn btn-outline-secondary"
                >
                  {{ step.showInput ? 'Masquer' : 'Afficher' }}
                </button>
                <button 
                  @click="saveInput(index)"
                  type="button" 
                  class="btn btn-primary"
                >
                  Enregistrer
                </button>
              </div>
              <div v-if="step.inputMessage" class="small mt-1" :class="`text-${step.inputMessageType}`">
                {{ step.inputMessage }}
              </div>
            </div>
          </template>

          <small v-if="step.command" class="mono text-secondary d-block mb-2">{{ step.command }}</small>
          <div class="progress">
            <div 
              class="progress-bar progress-bar-striped" 
              :class="{ 'progress-bar-animated': installing }"
              :style="{ width: step.progress + '%' }"
            ></div>
          </div>
          <div class="mt-2 small text-secondary" v-html="step.log"></div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'

const installing = ref(false)
const allStepsComplete = ref(false)

const steps = reactive([
  {
    title: 'Docker',
    status: 'En attente…',
    progress: 0,
    log: '',
    command: 'docker --version',
    requiresInput: false,
  },
  {
    title: 'API (release la plus récente)',
    status: 'En attente…',
    progress: 0,
    log: '',
    command: 'Téléchargement, génération du .env, docker compose up -d',
    requiresInput: true,
    inputLabel: 'Clé API GPT (obligatoire)',
    inputPlaceholder: 'sk-...',
    inputValue: '',
    inputType: 'password',
    showInput: false,
    inputMessage: '',
    inputMessageType: 'secondary',
  },
  {
    title: 'Jeu (release v1.2)',
    status: 'En attente…',
    progress: 0,
    log: '',
    command: 'Téléchargement et préparation du binaire',
    requiresInput: false,
  },
])

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

const startInstallation = async () => {
  installing.value = true
  allStepsComplete.value = false

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]
    if (step.requiresInput && !step.inputValue.trim()) {
      step.status = 'En attente d\'input'
      step.inputMessage = 'Veuillez entrer une valeur'
      step.inputMessageType = 'warning'
      installing.value = false
      return
    }

    step.status = 'En cours…'
    await executeStep(i)
  }

  installing.value = false
  allStepsComplete.value = true
}

const executeStep = async (index) => {
  const step = steps[index]
  
  // Étape Docker
  if (index === 0 && step.title === 'Docker') {
    try {
      const result = await window.launcher.checkDocker()
      
      if (result.installed && result.running) {
        step.log = `Docker ${result.version} détecté et en cours d'exécution`
        step.progress = 100
        step.status = 'Installé ✓'
      } else if (result.installed && !result.running) {
        step.log = `Docker ${result.version} détecté mais arrêté. Tentative de démarrage...`
        step.progress = 100
        step.status = 'Démarrage ✓'
      } else {
        step.log = `❌ Docker n'est pas installé. Veuillez l'installer manuellement.`
        step.progress = 0
        step.status = 'Erreur ✖'
        throw new Error('Docker non disponible')
      }
    } catch (err) {
      step.log = `❌ Erreur: ${err.message}`
      step.progress = 0
      step.status = 'Erreur ✖'
      throw err
    }
    return
  }
  
  // Étape API
  if (index === 1) {
    try {
      step.log = 'Téléchargement de l\'API...'
      step.progress = 20
      
      const apiResult = await window.launcher.apiDownloadLatest()
      step.progress = 60
      step.log += `<br>API téléchargée: ${apiResult.tag}`
      
      step.log += '<br>Lancement de docker compose...'
      const composeResult = await window.launcher.apiComposeUp()
      step.progress = 100
      
      if (composeResult.ok) {
        step.status = 'Complété ✓'
        step.log += '<br><span class="text-success">✔</span> API démarrée avec succès'
      } else {
        step.status = 'Erreur ✖'
        step.log += `<br>❌ Erreur compose: ${composeResult.error || 'Inconnu'}`
        throw new Error('Erreur docker compose')
      }
    } catch (err) {
      step.log += `<br>❌ Erreur: ${err.message}`
      step.progress = 0
      step.status = 'Erreur ✖'
      throw err
    }
    return
  }
  
  // Étape Jeu
  if (index === 2) {
    try {
      step.log = 'Téléchargement du jeu...'
      step.progress = 30
      
      const gameResult = await window.launcher.gameDownload()
      step.progress = 100
      
      step.status = 'Complété ✓'
      step.log += `<br>Jeu téléchargé: ${gameResult.tag}`
      step.log += '<br><span class="text-success">✔</span> Jeu installé avec succès'
    } catch (err) {
      step.log += `<br>❌ Erreur: ${err.message}`
      step.progress = 0
      step.status = 'Erreur ✖'
      throw err
    }
    return
  }
}

const toggleInputVisibility = (index) => {
  steps[index].showInput = !steps[index].showInput
  steps[index].inputType = steps[index].showInput ? 'text' : 'password'
}

const saveInput = async (index) => {
  const step = steps[index]
  const value = step.inputValue.trim()

  if (!value) {
    step.inputMessage = 'Veuillez entrer une valeur'
    step.inputMessageType = 'warning'
    return
  }

  // Validation simple pour les clés API
  if (value.length < 20) {
    step.inputMessage = 'Format inhabituel. Vérifiez que la valeur est correcte.'
    step.inputMessageType = 'warning'
    return
  }

  try {
    // Sauvegarde de la clé dans le keystore
    await window.launcher.setEnv({ CHATGPT_TOKEN: value })
    step.inputMessage = '✓ Clé enregistrée avec succès'
    step.inputMessageType = 'success'
    console.log('[App] Clé GPT sauvegardée')
  } catch (err) {
    step.inputMessage = '✖ Erreur lors de l\'enregistrement: ' + err.message
    step.inputMessageType = 'danger'
    console.error('[App] Erreur sauvegarde clé:', err)
  }
}

const openLauncher = () => {
  console.log('Ouvrir le Launcher')
  if (window.launcher) {
    window.launcher.navigate('launch')
  }
}

const getStatusClass = (status) => {
  if (status.includes('✓') || status.includes('succès')) return 'text-success'
  if (status.includes('✖') || status.includes('Erreur')) return 'text-danger'
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

.progress-bar {
  background-color: #0d6efd;
  transition: width 0.3s ease;
}
</style>
