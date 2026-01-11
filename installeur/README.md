# NPCForge Installer

Installateur Electron pour NPCForge (API + Jeu)

## Structure du projet

```
installeur/
├── src/
│   ├── main/              # Process principal Electron
│   │   ├── main.js        # Point d'entrée principal
│   │   ├── dockerInstaller.js  # Gestion Docker
│   │   └── releaseManager.js   # Téléchargement releases GitHub
│   ├── renderer/          # Interface utilisateur
│   │   ├── index.html     # Page principale
│   │   ├── interface.html # Interface d'installation
│   │   ├── interface.vue  # Composant Vue
│   │   ├── interface-app.js
│   │   ├── main-app.js
│   │   ├── launch.html
│   │   └── App.vue
│   └── preload/           # Scripts preload
│       └── preload.cjs    # Bridge IPC
├── assets/                # Ressources (icônes, etc.)
├── dist/                  # Build de production
├── docs/                  # Documentation
├── package.json           # Configuration npm
└── vite.config.js         # Configuration Vite

```

## Prérequis

- Node.js 18+
- Docker Desktop (Windows uniquement)

## Installation

```bash
npm install
```

## Développement

```bash
npm run dev
```

Lance Vite en mode dev + Electron avec hot reload

## Build

```bash
# Build Vite
npm run build

# Créer l'installeur Windows
npm run dist:win
```

## Fonctionnalités

- ✅ Installation automatique de Docker Desktop
- ✅ Téléchargement de la dernière release API (NPCForge/API_AI)
- ✅ Téléchargement de la dernière release Jeu (NPCForge/Plugin)
- ✅ Gestion du cache pour éviter les re-téléchargements
- ✅ Suppression automatique des anciennes versions
- ✅ Configuration automatique des variables d'environnement
- ✅ Lancement automatique de Docker Compose
- ✅ Interface Vue 3 moderne

## Support

**Plateforme supportée :** Windows uniquement
