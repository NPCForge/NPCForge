// dockerInstaller.js
import { ipcMain, dialog, shell, BrowserWindow } from "electron"
import { exec } from "child_process"
import os from "os"
import path from "path"
import fs from "fs"

// --- Vérifie si docker est installé + lancé
async function checkDockerStatus() {
	return new Promise((resolve) => {
		exec("docker --version", (err, vStdout, vStderr) => {
			if (err) {
				const msg = ((vStderr || "") + " " + (err.message || "")).toLowerCase()
				if (err.code === "ENOENT" || /not recognized|not found|no such file/i.test(msg)) {
					return resolve({ installed: false, running: false, error: (vStderr || err.message || "").trim() })
				}
				// La commande existe peut-être mais renvoie une autre erreur
				// On considère "non installé" si on ne trouve pas la version
				return resolve({ installed: false, running: false, error: (vStderr || err.message || "").trim() })
			}

			const version = (vStdout || "").match(/version\s+([\w.\-+]+)/i)?.[1] || (vStdout || "").trim() || null
			exec("docker info", (err2, stdout2) => {
				if (err2) return resolve({ installed: true, running: false, version })
				return resolve({ installed: true, running: true, version, info: (stdout2 || "").trim() })
			})
		})
	})
}

// --- Démarre Docker Desktop sur Windows
async function startDocker() {
	exec(`start "" "C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe"`)
	return new Promise((resolve) => setTimeout(resolve, 8000))
}

// --- Handlers principaux
export function registerDockerHandlers() {
	// Vérifier Docker - afficher un message si absent
	ipcMain.handle("check-docker", async (e) => {
		let status = await checkDockerStatus()

		// Si Docker n'est pas installé, afficher un message et demander confirmation
		if (!status.installed) {
			const win = BrowserWindow.fromWebContents(e.sender)
			
			const instructions = `
📥 INSTALLATION DOCKER:
1. Téléchargez Docker Desktop: https://www.docker.com/products/docker-desktop
2. Exécutez l'installeur et suivez les instructions
3. Une fois l'installation terminée, lancez Docker Desktop
4. Attendez que l'icône Docker apparaisse dans la barre des tâches
5. Revenez ici et cliquez sur "Réessayer"
`

			const { response } = await dialog.showMessageBox(win ?? null, {
				type: "warning",
				buttons: ["Ouvrir le guide", "Réessayer", "Annuler"],
				defaultId: 0,
				cancelId: 2,
				title: "Docker non détecté",
				message: "Docker n'est pas installé sur votre système.",
				detail: instructions
			})
			
			if (response === 2) {
				// Annuler
				return { installed: false, running: false, userCancelled: true, error: "Docker non installé et installation annulée" }
			}

			if (response === 0) {
				// Ouvrir le guide
				const guidUrl = "https://www.docker.com/products/docker-desktop"

				await shell.openExternal(guidUrl)
				
				// Demander de réessayer
				const { response: retryResponse } = await dialog.showMessageBox(win ?? null, {
					type: "question",
					buttons: ["Réessayer", "Annuler"],
					defaultId: 0,
					cancelId: 1,
					title: "Installation de Docker",
					message: "Avez-vous installé et lancé Docker ?",
					detail: "Assurez-vous que Docker est complètement lancé et en cours d'exécution avant de continuer."
				})

				if (retryResponse !== 0) {
					return { installed: false, running: false, userCancelled: true, error: "Utilisateur a annulé après l'installation" }
				}

				// Re-vérifier le statut
				status = await checkDockerStatus()
			} else if (response === 1) {
				// Réessayer directement
				status = await checkDockerStatus()
			}
			
			if (!status.installed) {
				return { installed: false, running: false, error: "Docker toujours non détecté" }
			}
		}

		// Docker est installé mais peut-être pas lancé
		if (!status.running) {
			console.log("[dockerInstaller] Docker trouvé mais arrêté → démarrage...")
			await startDocker()
			status = await checkDockerStatus()
		}

		return status
	})
}
