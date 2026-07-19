'use strict'

const { app, BrowserWindow, Menu, shell, ipcMain, safeStorage, session } = require('electron')
const { autoUpdater } = require('electron-updater')
const path = require('path')
const fs   = require('fs')

// ── Vercel URL ────────────────────────────────────────────────────────────────
const VERCEL_URL = 'https://fivem-pvp-trainer.vercel.app'

// ── External link allowlist ───────────────────────────────────────────────────
//
// The renderer never sends URLs to the main process — only an identifier from
// this map. This keeps shell.openExternal() (a privileged OS-level call) from
// ever being reachable with an attacker- or renderer-controlled URL.
const EXTERNAL_LINKS = {
  'discord-goat': 'https://discord.gg/goatgg',
  'discord-plf':  'https://discord.gg/plfpvp',
}

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

// ── External links ────────────────────────────────────────────────────────────

ipcMain.handle('links:open', (_event, key) => {
  const url = EXTERNAL_LINKS[key]
  if (!url) {
    log.warn('links:open — unknown key:', key)
    return { ok: false }
  }
  shell.openExternal(url).catch((e) => log.error('links:open failed:', e?.message || e))
  return { ok: true }
})

// ── Window controls (custom frame) ──────────────────────────────────────────
//
// frame:false means Windows draws no min/max/close buttons at all — the
// renderer's TopBar renders its own and drives the window through these.
// Handlers read `mainWindow` at call time, so declaring them before the
// variable is assigned in createWindow() is safe.

ipcMain.handle('window:minimize', () => {
  mainWindow?.minimize()
})

ipcMain.handle('window:toggleMaximize', () => {
  if (!mainWindow) return
  if (mainWindow.isMaximized()) mainWindow.unmaximize()
  else mainWindow.maximize()
})

ipcMain.handle('window:close', () => {
  mainWindow?.close()
})

ipcMain.handle('window:isMaximized', () => mainWindow?.isMaximized() ?? false)

// ── App lifecycle ─────────────────────────────────────────────────────────────

let mainWindow = null

async function createWindow() {
  // No native application menu — the app draws its own drag-region title bar.
  Menu.setApplicationMenu(null)

  mainWindow = new BrowserWindow({
    width: 1200, height: 800, minWidth: 900, minHeight: 600,
    icon:            path.join(__dirname, 'icon.ico'),
    title:           'FiveM PvP Trainer',
    backgroundColor: '#080810',
    show:            false,
    // No native frame at all — the renderer draws its own single-line top
    // bar (logo, language switcher, user menu, window controls) and reports
    // window state back over IPC. Replaces the old titleBarStyle:'hidden' +
    // titleBarOverlay approach, which drew native min/max/close buttons that
    // could sit on top of web content in the same reserved strip.
    frame: false,
    webPreferences: {
      nodeIntegration:  false,
      contextIsolation: true,
      preload:          path.join(__dirname, 'preload.js'),
    },
  })

  // DevTools stay reachable in development builds only (Ctrl+Shift+I) — no
  // menu item exists for it anymore since the application menu is gone.
  if (!app.isPackaged) {
    mainWindow.webContents.on('before-input-event', (_event, input) => {
      if (input.type === 'keyDown' && input.control && input.shift && input.key.toLowerCase() === 'i') {
        mainWindow.webContents.toggleDevTools()
      }
    })
  }

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
  mainWindow.on('maximize',   () => mainWindow?.webContents.send('window:maximized-changed', true))
  mainWindow.on('unmaximize', () => mainWindow?.webContents.send('window:maximized-changed', false))

  mainWindow.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' } })
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(VERCEL_URL)) { event.preventDefault(); shell.openExternal(url) }
  })

  log.info(`Loading: ${VERCEL_URL}`)
  mainWindow.loadURL(VERCEL_URL)
}

app.whenReady().then(createWindow)
app.on('window-all-closed', () => app.quit())
