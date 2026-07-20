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

// Refresh-token store that honors "remember me". sessionStorage survives
// page reloads but — in both the browser and Electron's renderer — is wiped
// when the window/process ends, which is exactly the "don't persist after
// closing the app" behavior "remember me" unchecked should have.
const REFRESH_KEY = 'refresh_token'

export const tokenStore = {
  async setRefreshToken(token, remember) {
    if (remember) {
      await secureStorage.set(REFRESH_KEY, token)
      sessionStorage.removeItem(REFRESH_KEY)
    } else {
      sessionStorage.setItem(REFRESH_KEY, token)
      await secureStorage.remove(REFRESH_KEY)
    }
  },
  // Rotates the token in place, preserving whichever store (persistent or
  // session-only) currently holds it — used by silent refreshes, which don't
  // know the original "remember me" choice.
  async updateRefreshToken(token) {
    const persisted = await secureStorage.get(REFRESH_KEY)
    if (persisted) await secureStorage.set(REFRESH_KEY, token)
    else sessionStorage.setItem(REFRESH_KEY, token)
  },
  async getRefreshToken() {
    return (await secureStorage.get(REFRESH_KEY)) || sessionStorage.getItem(REFRESH_KEY)
  },
  async clear() {
    await secureStorage.remove(REFRESH_KEY)
    sessionStorage.removeItem(REFRESH_KEY)
  },
}
