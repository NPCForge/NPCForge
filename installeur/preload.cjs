// preload.js (ESM) — API sécurisée pour le renderer
// Indentation: tabulations (4 espaces visibles)

import { contextBridge, ipcRenderer } from "electron"

function assertString(name, v) {
	if (typeof v !== "string" || v.length === 0) {
		throw new TypeError(`[preload] "${name}" doit être une chaîne non vide`)
	}
}

function assertArray(name, v) {
	if (!Array.isArray(v)) {
		throw new TypeError(`[preload] "${name}" doit être un tableau`)
	}
}

const launcherApi = {
	/**
	 * Vérifie si un binaire existe et/ou retourne sa version.
	 * @param {string} bin
	 * @param {string[]} args
	 * @returns {Promise<any>}
	 */
	checkBin: (bin, args = []) => {
		assertString("bin", bin)
		assertArray("args", args)
		return ipcRenderer.invoke("check-bin", { bin, args })
	},

	/**
	 * Installe les prérequis (Linux, etc.).
	 * @returns {Promise<any>}
	 */
	installPrereqs: () => ipcRenderer.invoke("install-prereqs"),

	/**
	 * Clone / pull un repo dans un dossier cible.
	 * @param {string} repoUrl
	 * @param {string} targetDir
	 * @param {string} [branch]
	 * @returns {Promise<any>}
	 */
	syncRepo: (repoUrl, targetDir, branch) => {
		assertString("repoUrl", repoUrl)
		assertString("targetDir", targetDir)
		if (branch != null) assertString("branch", branch)
		return ipcRenderer.invoke("sync-repo", { repoUrl, targetDir, branch })
	},

	/**
	 * Lance docker compose up dans un dossier donné.
	 * @param {string} dir
	 * @returns {Promise<any>}
	 */
	composeUp: (dir) => {
		assertString("dir", dir)
	return ipcRenderer.invoke("compose-up", { dir })
	},

	/**
	 * (Optionnel) Navigation de pages dans la même fenêtre.
	 * @param {"index"|"settings"|string} page
	 * @returns {Promise<void>}
	 */
	navigate: (page) => {
		assertString("page", page)
		return ipcRenderer.invoke("navigate", page)
	},// preload.cjs — CommonJS (compatible sandbox)
// Indentation: tabulations

const { contextBridge, ipcRenderer } = require("electron")

function assertString(name, v) {
	if (typeof v !== "string" || v.length === 0) {
		throw new TypeError(`[preload] "${name}" doit être une chaîne non vide`)
	}
}
function assertArray(name, v) {
	if (!Array.isArray(v)) {
		throw new TypeError(`[preload] "${name}" doit être un tableau`)
	}
}

const launcherApi = {
	checkBin: (bin, args = []) => {
		assertString("bin", bin)
		assertArray("args", args)
		return ipcRenderer.invoke("check-bin", { bin, args })
	},
	installPrereqs: () => ipcRenderer.invoke("install-prereqs"),
	syncRepo: (repoUrl, targetDir, branch) => {
		assertString("repoUrl", repoUrl)
		assertString("targetDir", targetDir)
		if (branch != null) assertString("branch", branch)
		return ipcRenderer.invoke("sync-repo", { repoUrl, targetDir, branch })
	},
	composeUp: (dir) => {
		assertString("dir", dir)
		return ipcRenderer.invoke("compose-up", { dir })
	},
	navigate: (page) => {
		assertString("page", page)
		return ipcRenderer.invoke("navigate", page)
	},
	on(event, handler) {
		const allowed = new Set(["progress", "log", "error"])
		if (!allowed.has(event)) throw new Error(`[preload] Event non autorisé: ${event}`)
		if (typeof handler !== "function") throw new TypeError("[preload] handler doit être une fonction")
		const channel = `launcher:${event}`
		const listener = (_e, payload) => handler(payload)
		ipcRenderer.on(channel, listener)
		return () => ipcRenderer.removeListener(channel, listener)
	}
}

contextBridge.exposeInMainWorld("launcher", Object.freeze(launcherApi))


	/**
	 * (Optionnel) Souscription à des événements émis par le main (progress, logs…).
	 * Retourne une fonction d'unsubscribe.
	 * @param {"progress"|"log"|"error"} event
	 * @param {(payload:any)=>void} handler
	 * @returns {() => void}
	 */
	on(event, handler) {
		const allowed = new Set(["progress", "log", "error"])
		if (!allowed.has(event)) {
			throw new Error(`[preload] Event non autorisé: ${event}`)
		}
		if (typeof handler !== "function") {
			throw new TypeError("[preload] handler doit être une fonction")
		}
		const channel = `launcher:${event}`
		const listener = (_e, payload) => handler(payload)
		ipcRenderer.on(channel, listener)
		return () => ipcRenderer.removeListener(channel, listener)
	}
}

contextBridge.exposeInMainWorld("launcher", Object.freeze(launcherApi))
