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
		webPreferences: {
			contextIsolation: true,
			sandbox: false, // nécessaire si preload.cjs utilise require()
			nodeIntegration: false,
			spellcheck: false,
			preload: join(__dirname, "preload.cjs")
		}
	})

	Menu.setApplicationMenu(null)
	win.setMenuBarVisibility(false)

	win.webContents.on("did-fail-load", (_e, code, desc, url) => {
		console.error(`[electron] did-fail-load ${code} ${desc} -> ${url}`)
	})

	try {
		await win.loadFile(join(__dirname, "index.html"))
	} catch (err) {
		console.error("[electron] loadFile(index.html) failed:", err)
	}

	win.once("ready-to-show", () => win?.show())

	if (!app.isPackaged) {
		win.webContents.openDevTools({ mode: "detach" })
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

app.whenReady().then(() => {
	// Enregistrer les handlers spécialisés
	registerDockerHandlers()
	registerReleaseHandlers()

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
		if (page === "index") {
			return w.loadFile(join(__dirname, "index.html"))
		}
		if (page === "interface") {
			return w.loadFile(join(__dirname, "interface.html"))
		}
		if (page === "launch") {
			return w.loadFile(join(__dirname, "launch.html"))
		}
		throw new Error(`Page inconnue: ${page}`)
	} catch (err) {
		console.error("[electron] Navigation error:", err)
	}
})
