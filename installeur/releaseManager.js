// releaseManager.js — GitHub releases + download + extraction + compose
// ESM
import { app, ipcMain, BrowserWindow } from "electron"
import https from "https"
import fs from "fs"
import path from "path"
import os from "os"
import { exec } from "child_process"

const UA = "NPCForge-Installer/1.0 (+https://github.com/NPCForge)"

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
			// Choix d'entêtes selon le type d'URL (zipball/tarball/asset)
			let accept = "application/octet-stream"
			if (u.includes("/zipball")) accept = "application/zip"
			else if (u.includes("/tarball")) accept = "application/x-gzip"  // ou application/tar+gzip

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

/** Create a minimal .env if missing */
function ensureEnvFile(dir) {
	const envPath = path.join(dir, ".env")
	if (!fs.existsSync(envPath)) {
		const sample = [
			"# NPCForge API .env (exemple — adaptez ces valeurs)",
			"POSTGRES_USER=npcforge",
			"POSTGRES_PASSWORD=changeme",
			"POSTGRES_DB=npcforge",
			"POSTGRES_HOST=db",
			"POSTGRES_PORT=5432",
			"#OPENAI_API_KEY=",
			"#API_PORT=8080",
			""
		].join("\n")
		fs.writeFileSync(envPath, sample, "utf8")
	}
	return envPath
}

// ---------------- Extraction helpers ----------------

async function extractZip(zipPath, destDir) {
	if (process.platform === "win32") {
		await new Promise((res, rej) => {
			// PowerShell Expand-Archive
			const ps = `powershell -NoProfile -Command "Expand-Archive -Force '${zipPath}' '${destDir}'"`
			exec(ps, (e) => e ? rej(e) : res())
		})
	} else {
		await new Promise((res, rej) => exec(`unzip -o "${zipPath}" -d "${destDir}"`, (e) => e ? rej(e) : res()))
	}
	try { fs.rmSync(zipPath, { force: true }) } catch {}
}

async function extractTar(tarPath, destDir) {
	await new Promise((res, rej) => exec(`tar -xf "${tarPath}" -C "${destDir}"`, (e) => e ? rej(e) : res()))
	try { fs.rmSync(tarPath, { force: true }) } catch {}
}

// ---------------- Docker compose ----------------

function runComposeUp(dir) {
	const cmd = process.platform === "win32"
		? `cmd /c "cd /d "${dir}" && docker compose up -d"`
		: `bash -lc 'cd "${dir}" && docker compose up -d'`
	return new Promise((resolve) => {
		exec(cmd, (err, stdout, stderr) => resolve({
			ok: !err, stdout: stdout?.trim(), stderr: stderr?.trim(), error: err?.message
		}))
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

	// ---- API: download latest, extract, ensure .env, detect compose dir
	ipcMain.handle("api:download-latest", async () => {
		const rel = await getRelease("NPCForge", "API_AI") // latest
		const choice = pickReleaseDownload(rel)
		if (!choice) throw new Error("Aucun asset ni archive source détecté sur la release API.")

		const tmpFile = path.join(os.tmpdir(), choice.name)

		await downloadToFile(choice.url, tmpFile, (r, t) => sendProgress("api-download", r, t))

		if (/\.zip$/i.test(choice.name)) {
			await extractZip(tmpFile, apiDir)
		} else if (/\.tar\.(gz|bz2|xz)$/i.test(choice.name)) {
			await extractTar(tmpFile, apiDir)
		} else {
			// Rare: keep file as is
			const out = path.join(apiDir, choice.name)
			fs.renameSync(tmpFile, out)
		}

		// find compose directory inside extracted tree
		const composeDir = findComposeDir(apiDir) || apiDir
		const envPath = ensureEnvFile(composeDir)

		return {
			ok: true,
			destDir: apiDir,
			composeDir,
			envPath,
			tag: rel.tag_name,
			name: rel.name,
			downloadKind: choice.kind
		}
	})

	// ---- API: docker compose up (auto-detect compose dir every time)
	ipcMain.handle("api:compose-up", async () => {
		const composeDir = findComposeDir(apiDir) || apiDir
		if (!hasComposeFile(composeDir)) {
			return { ok: false, error: `Aucun fichier compose trouvé sous ${apiDir}` }
		}
		const result = await runComposeUp(composeDir)
		return { ...result, composeDir }
	})

	// ---- GAME: download v1.1 (prefer .exe, fallback zip/tar)
	ipcMain.handle("game:download", async () => {
		const rel = await getRelease("NPCForge", "Plugin", "v1.1")
		const assets = Array.isArray(rel.assets) ? rel.assets : []
		let asset = assets.find(a => /\.exe$/i.test(a.name)) || assets[0]

		let choice
		if (asset) {
			choice = { kind: "asset", name: asset.name, url: asset.browser_download_url }
		} else if (rel.zipball_url) {
			choice = { kind: "zipball", name: `${rel.tag_name}.zip`, url: rel.zipball_url }
		} else if (rel.tarball_url) {
			choice = { kind: "tarball", name: `${rel.tag_name}.tar.gz`, url: rel.tarball_url }
		} else {
			throw new Error("Aucun binaire ni archive source détecté sur la release Jeu.")
		}

		const tmpFile = path.join(os.tmpdir(), choice.name)
		await downloadToFile(choice.url, tmpFile, (r, t) => sendProgress("game-download", r, t))

		if (/\.zip$/i.test(choice.name)) {
			await extractZip(tmpFile, gameDir)
		} else if (/\.tar\.(gz|bz2|xz)$/i.test(choice.name)) {
			await extractTar(tmpFile, gameDir)
		} else {
			fs.renameSync(tmpFile, path.join(gameDir, choice.name))
		}

		return { ok: true, destDir: gameDir, tag: rel.tag_name, name: rel.name, downloadKind: choice.kind }
	})

	// ---- GAME: run (open best guess .exe or first file)
	ipcMain.handle("game:run", async () => {
		const files = fs.readdirSync(gameDir)
		const exe = files.find(f => /\.exe$/i.test(f)) || files[0]
		if (!exe) return { ok: false, error: "Aucun binaire trouvé." }

		// open with OS (start / open / xdg-open)
		if (process.platform === "win32") {
			exec(`start "" "${path.join(gameDir, exe)}"`)
		} else if (process.platform === "darwin") {
			exec(`open "${path.join(gameDir, exe)}"`)
		} else {
			exec(`xdg-open "${path.join(gameDir, exe)}"`)
		}
		return { ok: true, file: path.join(gameDir, exe) }
	})

	// ---- Paths helper
	ipcMain.handle("paths:get", async () => ({ baseDir, apiDir, gameDir }))
}
