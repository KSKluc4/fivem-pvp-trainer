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
  // External links — renderer only ever sends a known identifier, never a URL
  openLink:        (key) => ipcRenderer.invoke('links:open', key),
  // Custom frame (BrowserWindow created with frame:false) — TopBar/WindowControls
  // drive the window through these instead of native min/max/close buttons.
  window: {
    minimize:          () => ipcRenderer.invoke('window:minimize'),
    toggleMaximize:    () => ipcRenderer.invoke('window:toggleMaximize'),
    close:             () => ipcRenderer.invoke('window:close'),
    isMaximized:       () => ipcRenderer.invoke('window:isMaximized'),
    onMaximizedChanged: (cb) => {
      const listener = (_event, isMaximized) => cb(isMaximized)
      ipcRenderer.on('window:maximized-changed', listener)
      return () => ipcRenderer.removeListener('window:maximized-changed', listener)
    },
  },
})
