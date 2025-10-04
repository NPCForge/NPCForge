// preload.cjs — CommonJS pur
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

const api = {
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
	checkDocker: () => ipcRenderer.invoke("check-docker"),
	installDocker: () => ipcRenderer.invoke("install-docker"),
	apiDownloadLatest: () => ipcRenderer.invoke("api:download-latest"),
	apiComposeUp:    () => ipcRenderer.invoke("api:compose-up"),
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

contextBridge.exposeInMainWorld("launcher", Object.freeze(api))
