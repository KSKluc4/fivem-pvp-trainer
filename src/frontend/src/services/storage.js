// Secure token storage.
// In Electron: uses safeStorage via preload IPC (DPAPI-encrypted on Windows).
// In browser (dev): falls back to localStorage.

const isElectron = typeof window !== 'undefined' && !!window.electronAPI

export const secureStorage = {
  async set(key, value) {
    if (isElectron) return window.electronAPI.secureStorage.set(key, value)
    localStorage.setItem(key, value)
  },
  async get(key) {
    if (isElectron) return window.electronAPI.secureStorage.get(key)
    return localStorage.getItem(key)
  },
  async remove(key) {
    if (isElectron) return window.electronAPI.secureStorage.remove(key)
    localStorage.removeItem(key)
  },
}
