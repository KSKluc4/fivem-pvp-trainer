'use strict'

const { app, BrowserWindow, Menu, shell, dialog, ipcMain, safeStorage, session } = require('electron')
const { spawn } = require('child_process')
const path = require('path')
const net  = require('net')
const http = require('http')
const fs   = require('fs')

let mainWindow      = null
let backendProcess  = null
let APP_PORT        = 5000
let _quitting       = false   // true when we intentionally kill the backend

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

// Renderer calls this synchronously to get the backend port
ipcMain.on('get-port', (event) => { event.returnValue = APP_PORT })

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

// Poll /api/health via real HTTP — more reliable than raw TCP
function waitForFlask(port, timeoutMs = 45000) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs
    const attempt = () => {
      const req = http.get(
        { hostname: '127.0.0.1', port, path: '/api/health', timeout: 1500 },
        (res) => {
          res.resume()
          if (res.statusCode === 200) resolve()
          else retry()
        }
      )
      req.on('error', () => retry())
      req.on('timeout', () => { req.destroy(); retry() })
    }
    const retry = () => {
      if (Date.now() >= deadline) return reject(new Error('Flask startup timeout'))
      setTimeout(attempt, 500)
    }
    attempt()
  })
}

function killBackend() {
  _quitting = true
  if (backendProcess) { try { backendProcess.kill() } catch (_) {}; backendProcess = null }
}

// ── Content Security Policy ───────────────────────────────────────────────────

function applyCSP() {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          `default-src 'self' http://127.0.0.1:${APP_PORT};` +
          `script-src 'self' 'unsafe-inline' 'unsafe-eval';` +
          `style-src 'self' 'unsafe-inline';` +
          `img-src 'self' data: https:;` +
          `connect-src 'self' http://127.0.0.1:${APP_PORT} https://*.supabase.co;` +
          `font-src 'self' data:;`
        ],
      },
    })
  })
}

// ── App lifecycle ─────────────────────────────────────────────────────────────

const SPLASH_HTML = `data:text/html;charset=utf-8,<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:%23080810;display:flex;flex-direction:column;align-items:center;
justify-content:center;min-height:100vh;font-family:'Segoe UI',system-ui,sans-serif;color:%237a839a}
.spinner{width:64px;height:64px;position:relative;margin-bottom:1.5rem}
.ring{position:absolute;top:50%;left:50%;border-radius:50%;border:2px solid transparent}
.r1{width:56px;height:56px;border-top-color:%2300d4ff;border-right-color:%2300d4ff;
transform:translate(-50%,-50%);animation:spin 1s linear infinite}
.r2{width:36px;height:36px;border-bottom-color:%237b2fd4;border-left-color:%237b2fd4;
transform:translate(-50%,-50%);animation:spin .7s linear infinite reverse}
.dot{position:absolute;top:50%;left:50%;width:8px;height:8px;background:%2300d4ff;
border-radius:50%;transform:translate(-50%,-50%)}
p{font-size:.8rem;letter-spacing:.12em;text-transform:uppercase;opacity:.8}
@keyframes spin{to{transform:translate(-50%,-50%) rotate(360deg)}}
</style></head><body>
<div class="spinner"><div class="ring r1"></div><div class="ring r2"></div><div class="dot"></div></div>
<p>Iniciando servidor...</p>
</body></html>`

async function createWindow() {
  APP_PORT = await findFreePort(5000)

  backendProcess = spawn(getBackendExe(), [`--port=${APP_PORT}`], {
    windowsHide: true, stdio: 'ignore', detached: false,
  })
  backendProcess.on('error', (err) => {
    dialog.showErrorBox('Erro ao iniciar backend', err.message)
    app.quit()
  })
  backendProcess.on('exit', (code) => {
    if (_quitting) return
    if (code !== 0 && mainWindow && !mainWindow.isDestroyed()) {
      dialog.showErrorBox(
        'Servidor encerrado',
        `O servidor interno fechou inesperadamente (código ${code ?? '?'}).\nReinicie o aplicativo.`
      )
    }
  })

  Menu.setApplicationMenu(null)
  applyCSP()

  // Show loading splash immediately — don't make user stare at nothing
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

  mainWindow.loadURL(SPLASH_HTML)
  mainWindow.once('ready-to-show', () => mainWindow.show())
  mainWindow.on('closed', () => { mainWindow = null })

  // Wait for Flask to be fully ready (polls /api/health via HTTP)
  try {
    await waitForFlask(APP_PORT)
  } catch {
    dialog.showErrorBox('FiveM PvP Trainer', 'Não foi possível iniciar o servidor. Tente novamente.')
    killBackend(); app.quit(); return
  }

  // Use 127.0.0.1 explicitly — avoids localhost → ::1 (IPv6) resolution on
  // Windows 11, where Chromium XHR does not fall back to IPv4 after IPv6 fails.
  mainWindow.loadURL(`http://127.0.0.1:${APP_PORT}`)

  // External links open in system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' } })
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(`http://127.0.0.1:${APP_PORT}`)) { event.preventDefault(); shell.openExternal(url) }
  })
}

app.whenReady().then(createWindow)
app.on('window-all-closed', () => { killBackend(); app.quit() })
app.on('before-quit', killBackend)
