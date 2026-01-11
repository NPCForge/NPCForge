// main.js (ESM) — NPCForge Installer
// Indentation: tabulations

import { app, BrowserWindow, Menu, globalShortcut, ipcMain } from "electron"
import { fileURLToPath } from "url"
import { dirname, join } from "path"

// modules internes
import { registerDockerHandlers } from "./dockerInstaller.js"
import { registerReleaseHandlers } from "./releaseManager.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

let win = null

// lock: une seule instance
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
	app.quit()
} else {
	app.on("second-instance", () => {
		if (win) {
			if (win.isMinimized()) win.restore()
			win.focus()
		}
	})
}

async function createWindow() {
	win = new BrowserWindow({
		width: 1300,
		height: 700,
		resizable: false,
		backgroundColor: "#121212",
		show: false,
		autoHideMenuBar: true,
		icon: join(__dirname, "..", "..", "assets", "Logo_enclume.ico"),
		webPreferences: {
			contextIsolation: true,
			sandbox: false, // nécessaire si preload.cjs utilise require()
			nodeIntegration: false,
			spellcheck: false,
			preload: join(__dirname, "..", "preload", "preload.cjs")
		}
	})

	Menu.setApplicationMenu(null)
	win.setMenuBarVisibility(false)

	win.webContents.on("did-fail-load", (_e, code, desc, url) => {
		console.error(`[electron] did-fail-load ${code} ${desc} -> ${url}`)
	})

	try {
		// En développement, charger depuis le serveur Vite; en production, charger le HTML compilé
		if (!app.isPackaged) {
			await loadWithRetry("http://localhost:5173", win)
		} else {
			// En production: utiliser process.resourcesPath pour accéder aux fichiers dans l'asar
			const htmlPath = join(process.resourcesPath, "app.asar", "dist", "index.html")
			console.log("[electron] Loading from:", htmlPath)
			console.log("[electron] __dirname:", __dirname)
			console.log("[electron] process.resourcesPath:", process.resourcesPath)
			await win.loadFile(htmlPath)
		}
	} catch (err) {
		console.error("[electron] loadFile/loadURL failed:", err)
	}

	win.once("ready-to-show", () => win?.show())

	if (!app.isPackaged) {
		win.webContents.openDevTools({ mode: "detach" })
	}
}

// Helper pour attendre que Vite soit prêt
async function loadWithRetry(url, win, maxRetries = 30, delayMs = 500) {
	for (let i = 0; i < maxRetries; i++) {
		try {
			console.log(`[electron] Tentative de connexion à ${url} (${i + 1}/${maxRetries})`)
			await win.loadURL(url)
			console.log(`[electron] Vite est prêt et chargé`)
			return
		} catch (err) {
			if (i < maxRetries - 1) {
				console.log(`[electron] Attente de Vite... (tentative ${i + 1}/${maxRetries})`)
				await new Promise(resolve => setTimeout(resolve, delayMs))
			} else {
				throw err
			}
		}
	}
}

function registerShortcuts() {
	const isMac = process.platform === "darwin"
	globalShortcut.register(isMac ? "Command+R" : "Control+R", () => {
		BrowserWindow.getFocusedWindow()?.webContents.reload()
	})
	globalShortcut.register(isMac ? "Command+Alt+I" : "Control+Shift+I", () => {
		BrowserWindow.getFocusedWindow()?.webContents.openDevTools({ mode: "detach" })
	})
}

app.whenReady().then(async () => {
	// Enregistrer les handlers spécialisés
	registerDockerHandlers()
	registerReleaseHandlers()

	// Petite pause pour laisser Vite le temps de démarrer
	if (!app.isPackaged) {
		await new Promise(resolve => setTimeout(resolve, 2000))
	}

	// Créer la fenêtre principale
	createWindow()
	registerShortcuts()
})

app.on("activate", () => {
	if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

app.on("will-quit", () => globalShortcut.unregisterAll())

app.on("window-all-closed", () => {
	if (process.platform !== "darwin") app.quit()
})

// ---- Navigation entre pages dans la même fenêtre
ipcMain.handle("navigate", async (event, page) => {
	const w = BrowserWindow.fromWebContents(event.sender)
	if (!w) return

	try {
		if (!app.isPackaged) {
			// En développement: charger depuis Vite
			const validPages = ["index", "interface", "launch"]
			if (!validPages.includes(page)) {
				throw new Error(`Page inconnue: ${page}`)
			}
			return await w.loadURL(`http://localhost:5173/${page}.html`)
		} else {
			// En production: charger les fichiers compilés depuis l'asar
			const validPages = ["index", "interface", "launch"]
			if (!validPages.includes(page)) {
				throw new Error(`Page inconnue: ${page}`)
			}
			
			const htmlPath = join(process.resourcesPath, "app.asar", "dist", `${page}.html`)
			console.log(`[electron] Navigation vers: ${htmlPath}`)
			return await w.loadFile(htmlPath)
		}
	} catch (err) {
		console.error("[electron] Navigation error:", err)
	}
})
