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

// --- Démarre Docker selon l'OS
async function startDocker() {
	if (process.platform === "win32") {
		exec(`start "" "C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe"`)
	} else if (process.platform === "darwin") {
		exec(`open -a Docker`)
	} else {
		// Linux
		exec(`which pkexec >/dev/null 2>&1 && pkexec systemctl start docker || sudo -n systemctl start docker`, (e) => {
			if (e) console.warn("[dockerInstaller] start docker needs elevation, run manually: sudo systemctl start docker")
		})
	}
	return new Promise((resolve) => setTimeout(resolve, 8000))
}

// --- Handlers principaux
export function registerDockerHandlers() {
	// Vérifier / démarrer Docker
	ipcMain.handle("check-docker", async () => {
		let status = await checkDockerStatus()

		// Tentative de démarrage si Docker est installé mais éteint
		if (status.installed && !status.running) {
			console.log("[dockerInstaller] Docker trouvé mais arrêté → démarrage...")
			await startDocker()
			status = await checkDockerStatus()
		}

		return status
	})

	// Installation complète de Docker (comme avant)
	ipcMain.handle("install-docker", async (e) => {
		const platform = process.platform
		const win = BrowserWindow.fromWebContents(e.sender)

		// confirmation
		const { response } = await dialog.showMessageBox(win ?? null, {
			type: "question",
			buttons: ["Installer", "Annuler"],
			defaultId: 0,
			cancelId: 1,
			title: "Installer Docker",
			message: "Docker n'est pas installé. Voulez-vous lancer l'installation maintenant ?"
		})
		if (response !== 0) return { started: false, note: "user-cancelled" }

		if (platform === "win32") return installDockerWindows()
		if (platform === "darwin") return installDockerMac()

		const distro = await detectLinuxDistro()
		if (/(arch|manjaro)/i.test(distro)) return installDockerArch()
		if (/(ubuntu|debian|mint|pop|raspbian)/i.test(distro)) return installDockerDebian()

		await shell.openExternal("https://docs.docker.com/get-docker/")
		return { started: true, note: "opened-docs" }
	})
}

// --- Installateurs OS -----

function installDockerWindows() {
	return new Promise((resolve) => {
		const tmp = os.tmpdir()
		const installer = path.join(tmp, "DockerDesktopInstaller.exe")
		const url = "https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe"

		const dl = `powershell -NoProfile -ExecutionPolicy Bypass -Command "$ProgressPreference='SilentlyContinue'; try { Invoke-WebRequest -UseBasicParsing -Uri '${url}' -OutFile '${installer}' } catch { exit 87 }"`
		exec(dl, (err) => {
			if (err) {
				// Fallback WINGET si disponible
				const winget = `powershell -NoProfile -Command "winget install -e --id Docker.DockerDesktop --accept-package-agreements --accept-source-agreements"`
				return exec(winget, (e2, so2, se2) => {
					if (e2) return resolve({ started: false, error: "winget-install-failed: " + (se2 || e2.message) })
					return resolve({ started: true, result: so2?.trim(), note: "winget-install" })
				})
			}

			const cmd = `powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '${installer}' -ArgumentList 'install --quiet --accept-license' -Verb RunAs -Wait -PassThru | Format-List *"`
			exec(cmd, (err2, stdout2, stderr2) => {
				if (err2) return resolve({ started: false, error: "install-failed: " + (stderr2 || err2.message) })
				// Post-install: tenter de démarrer Docker Desktop
				exec(`start "" "C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe"`, () => {
					resolve({ started: true, result: (stdout2 || "").trim(), note: "installer-run" })
				})
			})
		})
	})
}

function installDockerMac() {
	return new Promise((resolve) => {
		const cmd = `/bin/bash -lc "which brew >/dev/null 2>&1 || /bin/bash -c \\\"$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\\\"; brew install --cask docker"`
		exec(cmd, { shell: "/bin/bash" }, (err, stdout, stderr) => {
			if (err) return resolve({ started: false, error: (stderr || err.message).trim() })
			resolve({ started: true, result: stdout.trim(), note: "Open Docker.app after install" })
		})
	})
}

function installDockerArch() {
	const user = os.userInfo().username
	const script = `
		set -e
		sudo pacman -Sy --noconfirm docker docker-compose
		sudo systemctl enable --now docker
		sudo usermod -aG docker ${user}
		echo "OK"
	`
	return runScript(script, "bash", "arch")
}

function installDockerDebian() {
	const user = os.userInfo().username
	const script = `
		set -e
		sudo apt-get update
		sudo apt-get install -y ca-certificates curl gnupg
		install -m 0755 -d /etc/apt/keyrings
		curl -fsSL https://download.docker.com/linux/$(. /etc/os-release; echo "$ID")/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
		echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/$(. /etc/os-release; echo "$ID") $(. /etc/os-release; echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
		sudo apt-get update
		sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
		sudo usermod -aG docker ${user}
		sudo systemctl enable --now docker
		echo "OK"
	`
	return runScript(script, "bash", "debian")
}

// --- Helpers internes ---

function runScript(script, shell, label) {
	return new Promise((resolve) => {
		exec(script, { shell: `/${shell}` }, (err, stdout, stderr) => {
			if (err) return resolve({ started: false, error: (stderr || err.message).trim() })
			resolve({ started: true, result: stdout.trim(), note: `${label}-install-done` })
		})
	})
}

async function detectLinuxDistro() {
	try {
		const text = fs.readFileSync("/etc/os-release", "utf8")
		return /ID="?([a-zA-Z0-9_-]+)"?/i.exec(text)?.[1] ?? ""
	} catch {
		return ""
	}
}
