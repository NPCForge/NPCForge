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

	// Docker / Releases
	checkDocker: () => ipcRenderer.invoke("check-docker"),
	installDocker: () => ipcRenderer.invoke("install-docker"),
	startDocker: () => ipcRenderer.invoke("start-docker"),

	// Accepte des options ex: { force:true }
	apiDownloadLatest: (opts = {}) => ipcRenderer.invoke("api:download-latest", opts),
	apiComposeUp: () => ipcRenderer.invoke("api:compose-up"),

	gameDownload: () => ipcRenderer.invoke("game:download"),
	gameRun: () => ipcRenderer.invoke("game:run"),

	// ENV keystore (main)
	setEnv: (kv) => ipcRenderer.invoke("env:set", kv),
	getEnv: (key) => ipcRenderer.invoke("env:get", key),
	hasEnvKey: async (key) => {
		const val = await ipcRenderer.invoke("env:get", key)
		return !!val
	},

	// Progress events (download…)
	onProgress(cb) {
		if (typeof cb !== "function") throw new TypeError("[preload] onProgress: cb doit être une fonction")
		const listener = (_e, payload) => cb(payload)
		ipcRenderer.on("installer:progress", listener)
		return () => ipcRenderer.removeListener("installer:progress", listener)
	},

	// Event bus générique (optionnel)
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
