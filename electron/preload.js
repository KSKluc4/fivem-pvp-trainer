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
  // Connects to a FiveM server with a fallback chain (direct spawn → protocol → browser).
  // Returns { ok, method: 'registry'|'path'|'protocol'|'browser', error? }
  connectFivem:    (fivemUrl, webUrl) => ipcRenderer.invoke('fivem:connect', fivemUrl, webUrl),
})
