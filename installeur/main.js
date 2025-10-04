// main.js (ESM) — fenêtre fixe + navigation entre index.html / interface.html

import { app, BrowserWindow, Menu, globalShortcut, ipcMain } from "electron"
import { fileURLToPath } from "url"
import { dirname, join } from "path"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

let win = null

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
			sandbox: true,
			nodeIntegration: false,
			spellcheck: false,
			preload: join(__dirname, "preload.cjs") // ← au lieu de preload.js
		}
	})

	Menu.setApplicationMenu(null)
	win.setMenuBarVisibility(false)

	await win.loadFile(join(__dirname, "index.html"))

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

// ---- Navigation dans la même fenêtre
ipcMain.handle("navigate", async (event, page) => {
	const w = BrowserWindow.fromWebContents(event.sender)
	if (!w) return

	if (page === "index") {
		await w.loadFile(join(__dirname, "index.html"))
	} else if (page === "interface") {
		await w.loadFile(join(__dirname, "interface.html"))
	} else {
		throw new Error(`Page inconnue: ${page}`)
	}
})
