'use strict'

const { contextBridge, ipcRenderer } = require('electron')

// Expose a safe, minimal API to the renderer (no full Node.js access)
contextBridge.exposeInMainWorld('electronAPI', {
  secureStorage: {
    set:    (key, value) => ipcRenderer.invoke('ss:set',    key, value),
    get:    (key)        => ipcRenderer.invoke('ss:get',    key),
    remove: (key)        => ipcRenderer.invoke('ss:remove', key),
  },
})
