// dockerInstaller.js
import { ipcMain, dialog, shell, BrowserWindow } from "electron"
import { exec } from "child_process"
import os from "os"
import path from "path"
import fs from "fs"

export function registerDockerHandlers() {
	// Vérifier si docker est installé
	ipcMain.handle("check-docker", async () => {
		return new Promise((resolve) => {
			exec("docker --version", (err, stdout, stderr) => {
				if (err) return resolve({ installed: false, error: (stderr || err.message).trim() })
				resolve({ installed: true, version: stdout.trim() })
			})
		})
	})

	// Installer docker selon l'OS
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

// --- Helpers OS -----

function installDockerWindows() {
	return new Promise((resolve) => {
		const tmp = os.tmpdir()
		const installer = path.join(tmp, "DockerDesktopInstaller.exe")
		const url = "https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe"

		const ps = [
			`$ProgressPreference='SilentlyContinue';`,
			`Invoke-WebRequest -UseBasicParsing -Uri "${url}" -OutFile "${installer}"`
		].join(" ")

		exec(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${ps}"`, (err) => {
			if (err) return resolve({ started: false, error: "download-failed: " + err.message })

			const args = ["install", "--quiet", "--accept-license"]
			const cmd = `Start-Process -FilePath "${installer}" -ArgumentList "${args.join(" ")}" -Verb RunAs -Wait; echo done`
			exec(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${cmd}"`, (err2, stdout) => {
				if (err2) return resolve({ started: false, error: "install-failed: " + err2.message })
				resolve({ started: true, result: (stdout || "").trim() })
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
