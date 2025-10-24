# 🧠 NPCForge Launcher

> Le launcher officiel de **NPCForge**, conçu pour automatiser l’installation, la mise à jour et le lancement du projet avec la configuration la plus récente.

---

## 🚀 Objectif du launcher

Le **NPCForge Launcher** simplifie entièrement la gestion de ton environnement :

* Téléchargement automatique des dépendances et fichiers nécessaires
* Configuration automatique de la dernière version de **NPCForge**
* Mise à jour intégrée du projet
* Démarrage immédiat du serveur / outil selon la plateforme
* Configuration persistante (clé API GPT, paramètres locaux, etc.)

Ce launcher est **cross-platform** : il fonctionne sur **Windows**, **macOS** et **Linux**.

---

## 💡 Cas d’usage principal

* Pour les **développeurs** : installer et mettre à jour le projet NPCForge en un clic, sans manipulations manuelles.
* Pour les **testeurs** : exécuter la dernière build stable avec une configuration prête à l’emploi.
* Pour les **serveurs** : automatiser le déploiement ou la mise à jour du module NPCForge.

---

## 📦 Contenu du dossier `BUILD`

Le dossier `BUILD` contient les exécutables prêts à l’emploi pour chaque OS :

```
BUILD/
├── NPCForge-Launcher-Windows.exe
├── NPCForge-Launcher-Mac.dmg
└── NPCForge-Launcher-Linux.AppImage
```

> 🧩 **Chaque exécutable contient le launcher complet**, prêt à démarrer sans installation manuelle.

---

## ⚙️ Installation / Utilisation

### 1️⃣ Étape 1 — Choisir l’exécutable

Télécharge et lance le fichier correspondant à ton système d’exploitation :

| OS         | Fichier à lancer                   | Notes                                                |
| ---------- | ---------------------------------- | ---------------------------------------------------- |
| 🪟 Windows | `NPCForge-Launcher-Windows.exe`    | Compatible Windows 10/11                             |
| 🍎 macOS   | `NPCForge-Launcher-Mac.dmg`        | Signature Apple Developer (autorise dans “Sécurité”) |
| 🐧 Linux   | `NPCForge-Launcher-Linux.AppImage` | Donne les droits d’exécution : `chmod +x`            |

```bash
# Exemple Linux :
chmod +x NPCForge-Launcher-Linux.AppImage
./NPCForge-Launcher-Linux.AppImage
```

---

### 2️⃣ Étape 2 — Entrer ta clé API GPT

Lors du premier lancement, une fenêtre s’ouvre pour te demander ta **clé API GPT** :

```
Veuillez renseigner votre clé API GPT :
> sk-XXXXXXXXXXXXXXXXXXXXXXXX
```

> 💡 Cette clé sera stockée **localement** et **jamais partagée**.
> Elle permet d’activer les fonctionnalités d’IA intégrées à NPCForge.

---

### 3️⃣ Étape 3 — Lancer l’installation

Une fois la clé enregistrée, clique sur **“Installer”**.

Le launcher va :

1. Télécharger la dernière version stable de NPCForge depuis GitHub
2. Installer les dépendances nécessaires automatiquement
3. Configurer le projet selon ton OS
4. Lancer NPCForge à la fin du processus

> ⏳ L’opération ne prend que quelques minutes selon ta connexion.

---

### 4️⃣ Étape 4 — Redémarrer le launcher (optionnel)

Une fois installé, le launcher se souvient de ta configuration.
Tu peux le rouvrir à tout moment pour :

* **Mettre à jour** la version (auto-update)
* **Modifier la clé API**
* **Relancer NPCForge**

---

## 🧰 Exemple d’appel (CLI)

Le launcher peut aussi être appelé depuis une ligne de commande (terminal / PowerShell) :

```bash
# Vérifie la version installée
npcforge-launcher --version

# Relance l’installation complète
npcforge-launcher --install

# Supprime la configuration et relance depuis zéro
npcforge-launcher --reset
```

---

## 🛠️ Commandes disponibles

| Commande    | Description                                           |
| ----------- | ----------------------------------------------------- |
| `--install` | Télécharge et installe la dernière version stable     |
| `--update`  | Met à jour vers la dernière version                   |
| `--start`   | Lance directement NPCForge                            |
| `--reset`   | Supprime la configuration et réinitialise le launcher |
| `--version` | Affiche la version actuelle du launcher               |
| `--config`  | Ouvre le fichier de configuration local               |

---

## ⚡ Exemple de configuration générée

Un fichier `config.json` est créé après le premier lancement :

```json
{
    "gpt_api_key": "sk-xxxxxxxxxxxxxxxxxxxx",
    "install_path": "./npcforge",
    "auto_update": true,
    "last_version": "1.3.0"
}
```

> Ce fichier est automatiquement mis à jour lors des installations et mises à jour.

---

## 🔄 Mises à jour automatiques

Le launcher vérifie à chaque lancement :

* Si une **nouvelle version** de NPCForge est disponible
* Si une **nouvelle version du launcher** existe

S’il en détecte une, il te propose de l’installer automatiquement :

```
Nouvelle version disponible : 1.4.0 → Installer maintenant ? (Y/n)
```

---

## 🧩 Structure interne (résumé technique)

```
NPCForge-Launcher/
├── main.js            # Process principal (Electron)
├── preload.js         # Bridge sécurisé pour le renderer
├── renderer/          # UI graphique du launcher
├── config/            # Gestion des clés et settings
└── BUILD/             # Exécutables générés (.exe, .dmg, .AppImage)
```

---

## 🧑‍💻 Développement

Pour les développeurs souhaitant builder le launcher eux-mêmes :

```bash
# Installer les dépendances
npm install

# Lancer le mode dev
npm run dev

# Générer les builds
npm run build:mac
npm run build:win
npm run build:linux
```

Les fichiers finaux seront dans `dist/`.

---

## 📜 Licence

Ce projet est distribué sous licence **MIT**.
Tu es libre de l’utiliser, le modifier et le redistribuer, sous réserve de mentionner la licence d’origine.

---

## ❤️ Remerciements

Développé avec amour par l’équipe **NPCForge**.
Inspiré par une idée simple : *“Installer, configurer, jouer.”*

> 🦊 *PakeTekos inside.*


Souhaites-tu que je te génère aussi le **squelette du projet Electron** (avec `main.js`, `preload.js`, UI de saisie de clé GPT, gestion du téléchargement + extraction auto depuis GitHub) pour que ce README corresponde directement à ton code ?
