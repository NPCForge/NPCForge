# 🧠 NPCForge

> Installation automatisée de l'écosystème NPCForge : API IA + Jeu

## 🎯 Qu'est-ce que c'est ?

NPCForge est un système complet qui permet de créer et gérer des PNJ intelligents via IA. Ce projet inclut :

- **API Backend** : API REST avec intégration GPT pour générer des dialogues et comportements de PNJ
- **Plugin Unreal** : Extension pour intégrer les PNJ dans vos projets Unreal Engine
- **Installeur Windows** : Application Electron qui automatise l'installation complète

## 🚀 Installation rapide

1. **Téléchargez** l'installeur depuis `build/NPCForge Setup.exe`
2. **Lancez** l'installeur
3. **Suivez** les étapes guidées :
   - Vérification de Docker
   - Configuration de votre clé API GPT
   - Installation automatique de l'API et du plugin

## 📋 Prérequis

- **Windows 10/11** (64-bit)
- **Docker Desktop** (sera installé automatiquement si absent)
- **Clé API OpenAI** (GPT-3.5 ou supérieur)

## 🎮 Utilisation

L'installeur vous guide à travers :
1. Installation de Docker si nécessaire
2. Configuration de votre clé API GPT
3. Téléchargement et démarrage de l'API
4. Installation du plugin Unreal Engine

Une fois installé, utilisez le **Launcher** pour :
- Démarrer/Arrêter l'API
- Lancer le plugin Unreal
- Réinitialiser l'installation si nécessaire

## 🛠️ Développement

Le projet est organisé en plusieurs dépôts :
- `installeur/` : Application Electron pour l'installation
- API : Repo séparé [`NPCForge/API_AI`](https://github.com/NPCForge/API_AI)
- Plugin : Repo séparé [`NPCForge/Plugin`](https://github.com/NPCForge/Plugin)

### Build l'installeur

```bash
cd installeur
npm install
npm run build      # Build frontend
npm run dist:win   # Génère l'installeur dans build/
```

## 📄 Licence

MIT License - Libre d'utilisation et modification

---

**Développé avec ❤️ par l'équipe NPCForge**


