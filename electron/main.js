'use strict'

const { app, BrowserWindow, Menu, shell, dialog } = require('electron')
const { spawn } = require('child_process')
const path = require('path')
const net  = require('net')

let mainWindow    = null
let backendProcess = null
let APP_PORT       = 5000

// ── Helpers ──────────────────────────────────────────────────────────────────

function getBackendExe() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'backend.exe')
  }
  // dev: run `electron .` from project root — backend.exe sits in dist/
  return path.join(__dirname, '..', 'dist', 'backend.exe')
}

function findFreePort(start) {
  return new Promise((resolve) => {
    let port = start
    const tryPort = () => {
      const s = net.createServer()
      s.listen(port, '127.0.0.1', () => {
        s.close(() => resolve(port))
      })
      s.on('error', () => {
        port += 1
        if (port > start + 20) resolve(start) // fallback
        else tryPort()
      })
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
  if (backendProcess) {
    try { backendProcess.kill() } catch (_) {}
    backendProcess = null
  }
}

// ── App lifecycle ─────────────────────────────────────────────────────────────

async function createWindow() {
  APP_PORT = await findFreePort(5000)

  const exePath = getBackendExe()
  backendProcess = spawn(exePath, [`--port=${APP_PORT}`], {
    windowsHide: true,
    stdio: 'ignore',
    detached: false,
  })
  backendProcess.on('error', (err) => {
    dialog.showErrorBox('Erro ao iniciar backend', err.message)
    app.quit()
  })

  try {
    await waitForFlask(APP_PORT)
  } catch {
    dialog.showErrorBox(
      'FiveM PvP Trainer',
      'Não foi possível iniciar o servidor. Tente abrir o app novamente.'
    )
    killBackend()
    app.quit()
    return
  }

  Menu.setApplicationMenu(null)

  mainWindow = new BrowserWindow({
    width:           1200,
    height:          800,
    minWidth:        900,
    minHeight:       600,
    icon:            path.join(__dirname, 'icon.ico'),
    title:           'FiveM PvP Trainer',
    backgroundColor: '#080810',
    show:            false,
    webPreferences: {
      nodeIntegration:  false,
      contextIsolation: true,
    },
  })

  mainWindow.loadURL(`http://localhost:${APP_PORT}`)

  mainWindow.once('ready-to-show', () => mainWindow.show())

  // Open all external links (Discord, Steam, fivem://, etc.) in system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(`http://localhost:${APP_PORT}`)) {
      event.preventDefault()
      shell.openExternal(url)
    }
  })

  mainWindow.on('closed', () => { mainWindow = null })
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  killBackend()
  app.quit()
})

app.on('before-quit', killBackend)
