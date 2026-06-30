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
  // Opens fivem:// protocol links via OS shell (bypasses Chromium's URL navigation)
  openExternal:    (url) => ipcRenderer.invoke('shell:openExternal', url),
})
