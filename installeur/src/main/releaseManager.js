// releaseManager.js — GitHub releases + download + extraction + compose + cache
// ESM
import { app, ipcMain, BrowserWindow } from "electron"
import https from "https"
import fs from "fs"
import path from "path"
import os from "os"
import { exec } from "child_process"

const UA = "NPCForge-Installer/1.0 (+https://github.com/NPCForge)"

// ---------------- Keystore (clé GPT locale) ----------------

const STORE_DIR = path.join(app.getPath("userData"), "npcforge")
const ENV_STORE = path.join(STORE_DIR, "installer-env.json")
const API_CACHE_FILE = path.join(STORE_DIR, "api-release.json") // { tag, name, composeDir }
const GAME_CACHE_FILE = path.join(STORE_DIR, "game-release.json") // { tag, name }

// helper pour éviter les doublons d'enregistrements IPC
function handleOnce(channel, fn) {
	try { ipcMain.removeHandler(channel) } catch {}
	ipcMain.handle(channel, fn)
}

function loadJsonSafe(p) {
	try { return JSON.parse(fs.readFileSync(p, "utf8")) } catch { return null }
}
function saveJsonSafe(p, obj) {
	try { fs.mkdirSync(path.dirname(p), { recursive: true }) } catch {}
	fs.writeFileSync(p, JSON.stringify(obj, null, 2), "utf8")
}

function loadEnvStore() { return loadJsonSafe(ENV_STORE) || {} }
function saveEnvStore(obj) { saveJsonSafe(ENV_STORE, obj) }

// ---------------- Utilities ----------------

function sendProgress(step, received, total) {
	const win = BrowserWindow.getAllWindows()[0]
	win?.webContents.send("installer:progress", { step, received, total })
}

/** Download URL -> file (handles redirects) + progress */
function downloadToFile(url, dest, onProgress) {
	return new Promise((resolve, reject) => {
		const out = fs.createWriteStream(dest)

		const request = (u) => {
			let accept = "application/octet-stream"
			if (u.includes("/zipball")) accept = "application/zip"
			else if (u.includes("/tarball")) accept = "application/x-gzip"

			const opts = { headers: { "User-Agent": UA, "Accept": accept } }

			https.get(u, opts, (res) => {
				// redirections
				if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
					res.destroy()
					return request(res.headers.location)
				}
				if (res.statusCode !== 200) {
					out.close(); fs.rmSync(dest, { force: true })
					return reject(new Error(`HTTP ${res.statusCode} for ${u}`))
				}
				const total = parseInt(res.headers["content-length"] || "0", 10)
				let received = 0
				res.on("data", (chunk) => {
					received += chunk.length
					if (onProgress && total) onProgress(received, total)
				})
				res.pipe(out)
				out.on("finish", () => out.close(() => resolve(dest)))
			}).on("error", (e) => {
				out.close(); fs.rmSync(dest, { force: true }); reject(e)
			})
		}

		request(url)
	})
}

/** GET JSON from GitHub */
function ghJson(url) {
	return new Promise((resolve, reject) => {
		https.get(url, { headers: { "User-Agent": UA, "Accept": "application/vnd.github+json" } }, (res) => {
			let data = ""
			res.on("data", (c) => (data += c))
			res.on("end", () => {
				if (res.statusCode !== 200) return reject(new Error(`GitHub HTTP ${res.statusCode}: ${data.slice(0, 200)}`))
				try { resolve(JSON.parse(data)) } catch (e) { reject(e) }
			})
		}).on("error", reject)
	})
}

async function getRelease(owner, repo, tag = null) {
	const base = `https://api.github.com/repos/${owner}/${repo}/releases`
	const url = tag ? `${base}/tags/${encodeURIComponent(tag)}` : `${base}/latest`
	return ghJson(url)
}

/** Pick uploaded asset or fallback to zipball/tarball */
function pickReleaseDownload(rel, prefer = /\.zip$/i) {
	const assets = Array.isArray(rel.assets) ? rel.assets : []
	let asset = assets.find(a => prefer.test(a.name))
	          || assets.find(a => /\.tar\.(gz|bz2|xz)$/i.test(a.name))
	          || assets[0]
	if (asset) return { kind: "asset", name: asset.name, url: asset.browser_download_url }
	if (rel.zipball_url) return { kind: "zipball", name: `${rel.tag_name || "source"}.zip`, url: rel.zipball_url }
	if (rel.tarball_url) return { kind: "tarball", name: `${rel.tag_name || "source"}.tar.gz`, url: rel.tarball_url }
	return null
}

const COMPOSE_FILES = ["docker-compose.yml", "docker-compose.yaml", "compose.yml", "compose.yaml"]

function hasComposeFile(dir) {
	try {
		const entries = fs.readdirSync(dir)
		return COMPOSE_FILES.some(f => entries.includes(f))
	} catch { return false }
}

/** find directory containing a compose file (depth-limited) */
function findComposeDir(root, maxDepth = 3) {
	function walk(dir, depth) {
		if (depth > maxDepth) return null
		if (hasComposeFile(dir)) return dir
		let subdirs
		try {
			subdirs = fs.readdirSync(dir, { withFileTypes: true })
				.filter(d => d.isDirectory())
				.filter(d => ![".git", ".github", "node_modules", "dist", "build"].includes(d.name))
		} catch { return null }
		for (const d of subdirs) {
			const found = walk(path.join(dir, d.name), depth + 1)
			if (found) return found
		}
		return null
	}
	return walk(root, 0)
}

/**
 * Crée/merge un .env API avec les variables demandées.
 * - Si le fichier n'existe pas, on écrit le template complet.
 * - S'il existe, on met à jour/ajoute les clés manquantes.
 * - CHATGPT_TOKEN est remplacé par la valeur du keystore si dispo.
 */
function ensureEnvFile(dir, savedChatGptToken = null) {
	const envPath = path.join(dir, ".env")
	const base = {
		API_KEY_REGISTER: "VDCAjPZ8jhDmXfsSufW2oZyU8SFZi48dRhA8zyKUjSRU3T1aBZ7E8FFIjdEM2X1d",
		JWT_SECRET_KEY: "secretKey",
		CHATGPT_TOKEN: savedChatGptToken || "Provided by epitech",
		PATH_WS_HANDLER: "./internal/handlers/websocket/",
		PATH_HTTP_HANDLER: "./internal/handlers/http/",
		PATH_MODEL: "./internal/models/shared/",
		PATH_SERVICE: "./internal/services/shared/",
		PATH_EXEMPLE: "./exemples/",
		POSTGRES_HOST: "127.0.0.1",
		POSTGRES_PORT: "5432",
		POSTGRES_DB: "api_db",
		POSTGRES_PASSWORD: "password",
		POSTGRES_USER: "API",
	}

	if (!fs.existsSync(envPath)) {
		const content = Object.entries(base)
			.map(([k, v]) => `${k}=${(typeof v === "string" && (v.includes(" ") || v.includes("#") || v.includes('"'))) ? JSON.stringify(v) : v}`)
			.join("\n") + "\n"
		fs.writeFileSync(envPath, content, "utf8")
		return envPath
	}

	// Merge si le fichier existe
	let text = fs.readFileSync(envPath, "utf8")
	const lines = text.split(/\r?\n/)

	const map = {}
	for (const line of lines) {
		const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/)
		if (!m) continue
		const k = m[1]
		let v = m[2]
		const q = v.match(/^"(.*)"$/)
		if (q) v = q[1]
		map[k] = v
	}

	for (const [k, v] of Object.entries(base)) {
		if (k === "CHATGPT_TOKEN") {
			if (savedChatGptToken) {
				map[k] = savedChatGptToken
			} else if (!map[k]) {
				map[k] = v
			}
			continue
		}
		if (!map[k]) map[k] = v
	}

	const out = Object.entries(map)
		.map(([k, v]) => `${k}=${(typeof v === "string" && (v.includes(" ") || v.includes("#") || v.includes('"'))) ? JSON.stringify(v) : v}`)
		.join("\n") + "\n"
	fs.writeFileSync(envPath, out, "utf8")
	return envPath
}

// ---------------- Extraction helpers ----------------

async function extractZip(zipPath, destDir) {
	await new Promise((res, rej) => {
		const ps = `powershell -NoProfile -Command "Expand-Archive -Force '${zipPath}' '${destDir}'`
		exec(ps, (e) => e ? rej(e) : res())
	})
	try { fs.rmSync(zipPath, { force: true }) } catch {}
}

// ---------------- Docker compose ----------------

function runComposeUp(dir) {
	return new Promise((resolve) => {
		// Étape 1: docker compose build
		const buildCmd = `cmd /c "cd /d "${dir}" && docker compose build"`
		
		exec(buildCmd, (buildErr, buildStdout, buildStderr) => {
			if (buildErr) {
				return resolve({
					ok: false, 
					phase: "build",
					stdout: buildStdout?.trim(), 
					stderr: buildStderr?.trim(), 
					error: buildErr?.message
				})
			}

			// Étape 2: docker compose up -d
			const upCmd = `cmd /c "cd /d "${dir}" && docker compose up -d"`
			
			exec(upCmd, (upErr, upStdout, upStderr) => {
				resolve({
					ok: !upErr,
					phase: "up",
					stdout: upStdout?.trim(), 
					stderr: upStderr?.trim(), 
					error: upErr?.message
				})
			})
		})
	})
}

function runComposeDown(dir) {
	return new Promise((resolve) => {
		// Commande complète pour tout arrêter et supprimer
		const downCmd = `cmd /c "cd /d "${dir}" && docker compose down -v --rmi all --remove-orphans"`
		
		exec(downCmd, (err, stdout, stderr) => {
			resolve({
				ok: !err,
				stdout: stdout?.trim(),
				stderr: stderr?.trim(),
				error: err?.message
			})
		})
	})
}

// ---------------- IPC Handlers ----------------

export function registerReleaseHandlers() {
	// Install folders (under userData)
	const baseDir = path.join(app.getPath("userData"), "npcforge")
	const apiDir  = path.join(baseDir, "api")
	const gameDir = path.join(baseDir, "game")
	if (!fs.existsSync(baseDir)) fs.mkdirSync(baseDir, { recursive: true })
	if (!fs.existsSync(apiDir))  fs.mkdirSync(apiDir, { recursive: true })
	if (!fs.existsSync(gameDir)) fs.mkdirSync(gameDir, { recursive: true })

	// ---- ENV keystore
	handleOnce("env:set", async (_evt, kv) => {
		const store = loadEnvStore()
		for (const [k, v] of Object.entries(kv || {})) {
			store[k] = v
		}
		saveEnvStore(store)
		return { ok: true }
	})

	handleOnce("env:get", async (_evt, key) => {
		const store = loadEnvStore()
		return key ? (store[key] ?? null) : store
	})

	// ---- API: download latest (avec cache), extract, ensure .env, detect compose dir
	handleOnce("api:download-latest", async (_evt, opts = {}) => {
		const force = !!opts.force
		const rel = await getRelease("NPCForge", "API_AI") // latest
		const latestTag = rel.tag_name

		// Vérifie le cache
		const cache = loadJsonSafe(API_CACHE_FILE) || {}
		const cacheValid = !force
			&& cache.tag === latestTag
			&& fs.existsSync(apiDir)

		// Si cache valide et compose présent → skip download
		if (cacheValid) {
			const composeDirCached = cache.composeDir && fs.existsSync(cache.composeDir) ? cache.composeDir : (findComposeDir(apiDir) || apiDir)
			if (hasComposeFile(composeDirCached)) {
				const store = loadEnvStore()
				const savedToken = store.CHATGPT_TOKEN || store.OPENAI_API_KEY || null
				const envPath = ensureEnvFile(composeDirCached, savedToken)
				return {
					ok: true,
					cacheHit: true,
					destDir: apiDir,
					composeDir: composeDirCached,
					envPath,
					tag: rel.tag_name,
					name: rel.name,
					downloadKind: "cache"
				}
			}
		}

		// Sinon on télécharge
		const choice = pickReleaseDownload(rel)
		if (!choice) throw new Error("Aucun asset ni archive source détecté sur la release API.")

		const tmpFile = path.join(os.tmpdir(), choice.name)
		await downloadToFile(choice.url, tmpFile, (r, t) => sendProgress("api-download", r, t))

		if (/\.zip$/i.test(choice.name)) {
			await extractZip(tmpFile, apiDir)
		} else {
			const out = path.join(apiDir, choice.name)
			fs.renameSync(tmpFile, out)
		}

		// find compose directory inside extracted tree
		const composeDir = findComposeDir(apiDir) || apiDir

		// Injecte la clé GPT si présente dans le keystore et génère/merge le .env
		const store = loadEnvStore()
		const savedToken = store.CHATGPT_TOKEN || store.OPENAI_API_KEY || null
		const envPath = ensureEnvFile(composeDir, savedToken)

		// Met à jour le cache
		saveJsonSafe(API_CACHE_FILE, { tag: latestTag, name: rel.name, composeDir })

		return {
			ok: true,
			cacheHit: false,
			destDir: apiDir,
			composeDir,
			envPath,
			tag: rel.tag_name,
			name: rel.name,
			downloadKind: choice.kind
		}
	})

	// ---- API: docker compose up (auto-detect compose dir every time)
	handleOnce("api:compose-up", async () => {
		const composeDir = findComposeDir(apiDir) || apiDir
		if (!hasComposeFile(composeDir)) {
			return { ok: false, error: `Aucun fichier compose trouvé sous ${apiDir}` }
		}
		const result = await runComposeUp(composeDir)
		return { ...result, composeDir }
	})

	// ---- API: docker compose down
	handleOnce("api:compose-down", async () => {
		const composeDir = findComposeDir(apiDir) || apiDir
		if (!hasComposeFile(composeDir)) {
			return { ok: false, error: `Aucun fichier compose trouvé sous ${apiDir}` }
		}
		const result = await runComposeDown(composeDir)
		return { ...result, composeDir }
	})

	// ---- API: cleanup (supprime tout)
	handleOnce("api:cleanup", async () => {
		try {
			// Arrête docker compose d'abord
			const composeDir = findComposeDir(apiDir)
			if (composeDir && hasComposeFile(composeDir)) {
				await runComposeDown(composeDir)
			}

			// Supprime le dossier API
			if (fs.existsSync(apiDir)) {
				fs.rmSync(apiDir, { recursive: true, force: true })
			}

			// Supprime le cache
			if (fs.existsSync(API_CACHE_FILE)) {
				fs.rmSync(API_CACHE_FILE, { force: true })
			}

			console.log("[api:cleanup] API nettoyée avec succès")
			return { ok: true, message: "API et cache supprimés" }
		} catch (e) {
			console.error("[api:cleanup] Erreur:", e)
			return { ok: false, error: e?.message || String(e) }
		}
	})

	// ---- GAME: download latest (avec cache), extract, suppression anciennes versions
	handleOnce("game:download", async (_evt, opts = {}) => {
		const force = !!opts.force
		const rel = await getRelease("NPCForge", "Plugin") // latest
		const latestTag = rel.tag_name
		
		console.log(`[game:download] Dernière release disponible: ${latestTag} (${rel.name})`)

		// Vérifie le cache
		const cache = loadJsonSafe(GAME_CACHE_FILE) || {}
		console.log(`[game:download] Cache actuel: ${cache.tag || 'aucun'}`)
		
		const cacheValid = !force
			&& cache.tag === latestTag
			&& fs.existsSync(gameDir)

		// Si cache valide et fichiers présents → skip download
		if (cacheValid) {
			try {
				const entries = fs.readdirSync(gameDir)
				if (entries.length > 0) {
					console.log(`[game:download] Cache valide, pas de téléchargement nécessaire`)
					return {
						ok: true,
						cacheHit: true,
						destDir: gameDir,
						tag: cache.tag,
						name: cache.name,
						downloadKind: "cache"
					}
				}
			} catch {}
		}

		console.log(`[game:download] Téléchargement de la nouvelle version ${latestTag}...`)

		// Supprime les anciennes versions avant de télécharger la nouvelle
		if (fs.existsSync(gameDir)) {
			try {
				console.log(`[game:download] Suppression de l'ancienne version...`)
				fs.rmSync(gameDir, { recursive: true, force: true })
				fs.mkdirSync(gameDir, { recursive: true })
			} catch (e) {
				console.warn("[game:download] Erreur lors de la suppression de l'ancienne version:", e)
			}
		}

		// Télécharge la dernière version
		const assets = Array.isArray(rel.assets) ? rel.assets : []
		let asset = assets.find(a => /\.exe$/i.test(a.name)) || assets[0]

		let choice
		if (asset) {
			choice = { kind: "asset", name: asset.name, url: asset.browser_download_url }
		} else if (rel.zipball_url) {
			choice = { kind: "zipball", name: `${rel.tag_name}.zip`, url: rel.zipball_url }
		} else {
			throw new Error("Aucun binaire ni archive source détecté sur la release Jeu.")
		}

		console.log(`[game:download] Téléchargement: ${choice.name}`)
		const tmpFile = path.join(os.tmpdir(), choice.name)
		await downloadToFile(choice.url, tmpFile, (r, t) => sendProgress("game-download", r, t))

		if (/\.zip$/i.test(choice.name)) {
			await extractZip(tmpFile, gameDir)
		} else {
			fs.renameSync(tmpFile, path.join(gameDir, choice.name))
		}

		// Met à jour le cache
		saveJsonSafe(GAME_CACHE_FILE, { tag: latestTag, name: rel.name })
		console.log(`[game:download] Installation terminée: ${latestTag}`)

		return { ok: true, cacheHit: false, destDir: gameDir, tag: rel.tag_name, name: rel.name, downloadKind: choice.kind }
	})

	// ---- Paths helper
	handleOnce("paths:get", async () => ({ baseDir, apiDir, gameDir }))

	// ---- GAME: cleanup (supprime tout)
	handleOnce("game:cleanup", async () => {
		try {
			// Supprime le dossier du jeu
			if (fs.existsSync(gameDir)) {
				fs.rmSync(gameDir, { recursive: true, force: true })
			}

			// Supprime le cache
			if (fs.existsSync(GAME_CACHE_FILE)) {
				fs.rmSync(GAME_CACHE_FILE, { force: true })
			}

			console.log("[game:cleanup] Jeu nettoyé avec succès")
			return { ok: true, message: "Jeu et cache supprimés" }
		} catch (e) {
			console.error("[game:cleanup] Erreur:", e)
			return { ok: false, error: e?.message || String(e) }
		}
	})

	// ---- GAME: run (ouvre le binaire du jeu sur Windows)
	handleOnce("game:run", async () => {
		try {
			const baseDirLocal = path.join(app.getPath("userData"), "npcforge")
			const gameDirLocal = path.join(baseDirLocal, "game")

			if (!fs.existsSync(gameDirLocal)) {
				return { ok: false, error: `Dossier jeu introuvable: ${gameDirLocal}` }
			}

			// Cherche un .exe (2 niveaux)
			const candidates = []
			function walk(dir, depth = 0) {
				if (depth > 2) return
				let entries = []
				try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return }
				for (const e of entries) {
					const p = path.join(dir, e.name)
					if (e.isDirectory()) {
						walk(p, depth + 1)
					} else if (e.isFile() && /\.exe$/i.test(e.name)) {
						candidates.push(p)
					}
				}
			}
			walk(gameDirLocal, 0)

			let target = candidates[0]

			if (!target) return { ok: false, error: "Aucun binaire .exe trouvé dans le dossier du jeu." }

			exec(`start "" "${target.replace(/"/g, '\\"')}"`)

			return { ok: true, file: target }
		} catch (e) {
			return { ok: false, error: e?.message || String(e) }
		}
	})
}
