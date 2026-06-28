'use strict'

const { app, BrowserWindow, Menu, shell, dialog, ipcMain, safeStorage, session } = require('electron')
const { spawn } = require('child_process')
const path = require('path')
const net  = require('net')
const fs   = require('fs')

let mainWindow    = null
let backendProcess = null
let APP_PORT       = 5000

// ── Secure storage (safeStorage + local file) ─────────────────────────────────

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

// ── Backend helpers ───────────────────────────────────────────────────────────

function getBackendExe() {
  if (app.isPackaged) return path.join(process.resourcesPath, 'backend.exe')
  return path.join(__dirname, '..', 'dist', 'backend.exe')
}

function findFreePort(start) {
  return new Promise((resolve) => {
    let port = start
    const tryPort = () => {
      const s = net.createServer()
      s.listen(port, '127.0.0.1', () => { s.close(() => resolve(port)) })
      s.on('error', () => { port += 1; if (port > start + 20) resolve(start); else tryPort() })
    }
    tryPort()
  })
}

function waitForFlask(port, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs
    const attempt = () => {
      const sock = new net.Socket()
      sock.setTimeout(400)
      sock.on('connect', () => { sock.destroy(); resolve() })
      sock.on('timeout', () => { sock.destroy(); retry() })
      sock.on('error', () => retry())
      sock.connect(port, '127.0.0.1')
    }
    const retry = () => {
      if (Date.now() >= deadline) return reject(new Error('Flask startup timeout'))
      setTimeout(attempt, 400)
    }
    attempt()
  })
}

function killBackend() {
  if (backendProcess) { try { backendProcess.kill() } catch (_) {}; backendProcess = null }
}

// ── Content Security Policy ───────────────────────────────────────────────────

function applyCSP() {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          `default-src 'self' http://localhost:${APP_PORT};` +
          `script-src 'self' 'unsafe-inline' 'unsafe-eval';` +
          `style-src 'self' 'unsafe-inline';` +
          `img-src 'self' data: https:;` +
          `connect-src 'self' http://localhost:${APP_PORT} https://*.supabase.co;` +
          `font-src 'self' data:;`
        ],
      },
    })
  })
}

// ── App lifecycle ─────────────────────────────────────────────────────────────

async function createWindow() {
  APP_PORT = await findFreePort(5000)

  backendProcess = spawn(getBackendExe(), [`--port=${APP_PORT}`], {
    windowsHide: true, stdio: 'ignore', detached: false,
  })
  backendProcess.on('error', (err) => {
    dialog.showErrorBox('Erro ao iniciar backend', err.message)
    app.quit()
  })

  applyCSP()

  try {
    await waitForFlask(APP_PORT)
  } catch {
    dialog.showErrorBox('FiveM PvP Trainer', 'Não foi possível iniciar o servidor. Tente novamente.')
    killBackend(); app.quit(); return
  }

  Menu.setApplicationMenu(null)

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

  mainWindow.loadURL(`http://localhost:${APP_PORT}`)
  mainWindow.once('ready-to-show', () => mainWindow.show())

  // External links open in system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' } })
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(`http://localhost:${APP_PORT}`)) { event.preventDefault(); shell.openExternal(url) }
  })

  mainWindow.on('closed', () => { mainWindow = null })
}

app.whenReady().then(createWindow)
app.on('window-all-closed', () => { killBackend(); app.quit() })
app.on('before-quit', killBackend)
