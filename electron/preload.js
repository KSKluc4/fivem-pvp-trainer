'use strict'

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  secureStorage: {
    set:    (key, value) => ipcRenderer.invoke('ss:set',    key, value),
    get:    (key)        => ipcRenderer.invoke('ss:get',    key),
    remove: (key)        => ipcRenderer.invoke('ss:remove', key),
  },
  // Auto-updater bridge
  onUpdateReady:   (cb)  => ipcRenderer.on('update:ready', (_event, info) => cb(info)),
  restartNow:      ()    => ipcRenderer.send('update:restart'),
  // Connects to a FiveM server by its cfx.re join code, with a fallback chain
  // (direct spawn → protocol → browser). Main validates the code and builds
  // the fivem:// / cfx.re URLs itself — the renderer never passes a raw URL.
  // Returns { ok, method: 'registry'|'path'|'protocol'|'browser', error? }
  connectFivem:    (cfxCode) => ipcRenderer.invoke('fivem:connect', cfxCode),
})
