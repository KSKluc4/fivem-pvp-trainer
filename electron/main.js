'use strict'

const { app, BrowserWindow, Menu, shell, ipcMain, safeStorage, session } = require('electron')
const { spawn } = require('child_process')
const { autoUpdater } = require('electron-updater')
const path = require('path')
const fs   = require('fs')
const { resolveFivemExePath } = require('./fivemLocator')

// ── Vercel URL ────────────────────────────────────────────────────────────────
const VERCEL_URL = 'https://fivem-pvp-trainer.vercel.app'

// ── File logger ───────────────────────────────────────────────────────────────

const LOG_DIR  = path.join(app.getPath('appData'), '..', 'Local', 'FiveM-PvP-Trainer', 'logs')
const LOG_FILE = path.join(LOG_DIR, 'app.log')

function ensureLogDir() {
  try { fs.mkdirSync(LOG_DIR, { recursive: true }) } catch (_) {}
}

function writeLog(level, ...args) {
  ensureLogDir()
  const ts  = new Date().toISOString()
  const msg = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ')
  const line = `[${ts}] [${level}] ${msg}\n`
  try { fs.appendFileSync(LOG_FILE, line, 'utf8') } catch (_) {}
}

const log = {
  info:  (...a) => writeLog('INFO',  ...a),
  warn:  (...a) => writeLog('WARN',  ...a),
  error: (...a) => writeLog('ERROR', ...a),
}

process.on('uncaughtException',  (err) => log.error('UncaughtException:', err.stack || err))
process.on('unhandledRejection', (err) => log.error('UnhandledRejection:', err?.stack || err))

log.info(`App starting — version ${app.getVersion()} — url: ${VERCEL_URL}`)

// ── Auto-updater ──────────────────────────────────────────────────────────────

autoUpdater.logger = {
  info:  (...a) => log.info('[AutoUpdater]', ...a),
  warn:  (...a) => log.warn('[AutoUpdater]', ...a),
  error: (...a) => log.error('[AutoUpdater]', ...a),
  debug: () => {},
  transports: { file: { level: false }, console: { level: false } },
}
autoUpdater.autoDownload        = true   // download silently in background
autoUpdater.autoInstallOnAppQuit = true  // install when user closes app normally

autoUpdater.on('update-available', (info) => {
  log.info(`Update available: v${info.version} — downloading in background`)
})

autoUpdater.on('update-downloaded', (info) => {
  log.info(`Update downloaded: v${info.version} — notifying renderer`)
  mainWindow?.webContents.send('update:ready', { version: info.version })
})

autoUpdater.on('error', (err) => {
  log.error('Auto-update error:', err?.message || err)
})

ipcMain.on('update:restart', () => {
  log.info('User requested restart to apply update')
  autoUpdater.quitAndInstall(false, true) // isSilent=false, isForceRunAfter=true
})

// Allow renderer to connect to a FiveM server with a robust fallback chain:
//   1. Spawn FiveM.exe directly (path found via Windows registry, or fixed install paths)
//   2. shell.openExternal(fivem://...) — relies on the protocol being registered
//   3. Open the server's cfx.re page in the default browser
// This exists because shell.openExternal fails silently on machines where the
// fivem:// protocol handler in the Windows registry is incomplete (URL Protocol
// key exists but shell\open\command is missing or broken).
//
// SECURITY: the renderer never supplies a URL — only a short cfx.re join code
// (as used by user-added custom servers too), validated here against the same
// regex as the API. Main builds both the fivem:// and https://cfx.re/ URLs
// itself, so there is no path for the renderer to make this process spawn or
// open an arbitrary URL.
const CFX_CODE_RE = /^[a-z0-9]{4,10}$/

ipcMain.handle('fivem:connect', async (_event, cfxCode) => {
  if (typeof cfxCode !== 'string' || !CFX_CODE_RE.test(cfxCode)) {
    log.warn('fivem:connect blocked — invalid cfx code:', cfxCode)
    return { ok: false, method: null, error: 'invalid-code' }
  }

  const fivemUrl = `fivem://connect/cfx.re/join/${cfxCode}`
  const webUrl   = `https://cfx.re/join/${cfxCode}`

  log.info('fivem:connect requested for cfx code:', cfxCode)

  // 1) Spawn FiveM.exe directly
  const resolved = await resolveFivemExePath(log)
  if (resolved) {
    try {
      log.info(`fivem:connect — spawning FiveM.exe (source=${resolved.source}):`, resolved.path)
      spawn(resolved.path, [fivemUrl], { detached: true, stdio: 'ignore' }).unref()
      return { ok: true, method: resolved.source }
    } catch (e) {
      log.error('fivem:connect — spawning FiveM.exe failed:', e?.message || e)
    }
  } else {
    log.warn('fivem:connect — FiveM.exe not found via registry or fixed paths')
  }

  // 2) shell.openExternal with the fivem:// protocol
  try {
    await shell.openExternal(fivemUrl)
    log.info('fivem:connect — opened via shell.openExternal (protocol)')
    return { ok: true, method: 'protocol' }
  } catch (e) {
    log.warn('fivem:connect — shell.openExternal(fivem://) failed:', e?.message || e)
  }

  // 3) Last resort — open the server's cfx.re page in the default browser
  try {
    await shell.openExternal(webUrl)
    log.info('fivem:connect — opened web fallback in browser:', webUrl)
    return { ok: true, method: 'browser' }
  } catch (e) {
    log.error('fivem:connect — shell.openExternal(webUrl) failed:', e?.message || e)
    return { ok: false, method: null, error: e?.message || 'browser-open-failed' }
  }
})

// ── Secure storage ────────────────────────────────────────────────────────────

function storePath() {
  return path.join(app.getPath('userData'), 'secure_store.json')
}
function readStore() {
  try { return JSON.parse(fs.readFileSync(storePath(), 'utf8')) } catch { return {} }
}
function writeStore(data) {
  fs.writeFileSync(storePath(), JSON.stringify(data), 'utf8')
}

ipcMain.handle('ss:set', (_, key, value) => {
  const store = readStore()
  store[key] = safeStorage.isEncryptionAvailable()
    ? safeStorage.encryptString(String(value)).toString('base64')
    : Buffer.from(String(value)).toString('base64')
  writeStore(store)
})

ipcMain.handle('ss:get', (_, key) => {
  const store = readStore()
  const raw = store[key]
  if (!raw) return null
  try {
    return safeStorage.isEncryptionAvailable()
      ? safeStorage.decryptString(Buffer.from(raw, 'base64'))
      : Buffer.from(raw, 'base64').toString('utf8')
  } catch { return null }
})

ipcMain.handle('ss:remove', (_, key) => {
  const store = readStore()
  delete store[key]
  writeStore(store)
})

// ── App lifecycle ─────────────────────────────────────────────────────────────

let mainWindow = null

async function createWindow() {
  const devMenu = Menu.buildFromTemplate([
    {
      label: 'Dev',
      submenu: [
        { label: 'Abrir DevTools', accelerator: 'F12', click: () => mainWindow?.webContents.openDevTools() },
        { label: 'Abrir pasta de logs', click: () => shell.openPath(LOG_DIR) },
        { type: 'separator' },
        { label: 'Recarregar', accelerator: 'F5', click: () => mainWindow?.webContents.reload() },
      ],
    },
  ])
  Menu.setApplicationMenu(devMenu)

  mainWindow = new BrowserWindow({
    width: 1200, height: 800, minWidth: 900, minHeight: 600,
    icon:            path.join(__dirname, 'icon.ico'),
    title:           'FiveM PvP Trainer',
    backgroundColor: '#080810',
    show:            false,
    webPreferences: {
      nodeIntegration:  false,
      contextIsolation: true,
      preload:          path.join(__dirname, 'preload.js'),
    },
  })

  mainWindow.webContents.on('console-message', (_e, level, message, line, sourceId) => {
    if (level >= 2) log.error(`[Renderer] ${message}  (${sourceId}:${line})`)
    else if (level === 1) log.warn(`[Renderer] ${message}`)
  })
  mainWindow.webContents.on('render-process-gone', (_e, details) => {
    log.error('[Renderer] process gone:', JSON.stringify(details))
  })
  mainWindow.webContents.on('did-fail-load', (_e, code, desc, url) => {
    log.error(`[Renderer] did-fail-load: ${desc} (${code}) url=${url}`)
  })

  session.defaultSession.webRequest.onCompleted((details) => {
    if (details.statusCode >= 400 && details.url.includes('/api/')) {
      log.error(`[Network] ${details.method} ${details.url} → ${details.statusCode}`)
    }
  })
  session.defaultSession.webRequest.onErrorOccurred((details) => {
    if (details.url.includes('/api/') || details.url.startsWith(VERCEL_URL)) {
      log.error(`[Network] FAILED ${details.method} ${details.url} — ${details.error}`)
    }
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
    // Check for updates 4 seconds after window appears — avoids blocking initial load
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch((e) => log.error('Update check failed:', e))
    }, 4000)
  })

  mainWindow.on('closed', () => { mainWindow = null })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' } })
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(VERCEL_URL)) { event.preventDefault(); shell.openExternal(url) }
  })

  log.info(`Loading: ${VERCEL_URL}`)
  mainWindow.loadURL(VERCEL_URL)
}

app.whenReady().then(createWindow)
app.on('window-all-closed', () => app.quit())
