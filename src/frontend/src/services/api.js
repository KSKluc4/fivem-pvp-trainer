import axios from 'axios'
import { secureStorage } from './storage'

// Resolve the backend origin once at module load.
// In Electron, use the explicit port from the main process so we always
// hit http://127.0.0.1:<port> — avoids localhost→::1 and relative-URL issues.
// In browser dev mode (no electronAPI), fall back to the current origin.
const _backendOrigin = (() => {
  try {
    if (typeof window !== 'undefined' && window.electronAPI?.getBackendPort) {
      return `http://127.0.0.1:${window.electronAPI.getBackendPort()}`
    }
  } catch (_) {}
  return ''  // relative URLs work fine in the Vite dev server
})()

const api = axios.create({
  baseURL: `${_backendOrigin}/api`,
  headers: { 'Content-Type': 'application/json' },
})

// Access token lives in memory only (never touches disk)
let _accessToken = null

export function setAccessToken(token) {
  _accessToken = token
}

export function clearAccessToken() {
  _accessToken = null
}

// ── Request interceptor: attach access token ──────────────────────────────────
api.interceptors.request.use((config) => {
  if (_accessToken) config.headers.Authorization = `Bearer ${_accessToken}`
  return config
})

// ── Response interceptor: auto-refresh on 401 ────────────────────────────────
let _isRefreshing   = false
let _refreshQueue   = []

function processQueue(error, token = null) {
  _refreshQueue.forEach((prom) => (error ? prom.reject(error) : prom.resolve(token)))
  _refreshQueue = []
}

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config
    if (err.response?.status === 401 && !original._retry) {
      if (_isRefreshing) {
        return new Promise((resolve, reject) => {
          _refreshQueue.push({ resolve, reject })
        }).then((token) => {
          original.headers.Authorization = `Bearer ${token}`
          return api(original)
        })
      }

      original._retry = true
      _isRefreshing   = true

      try {
        const refreshToken = await secureStorage.get('refresh_token')
        if (!refreshToken) throw new Error('No refresh token')

        const res = await axios.post('/api/auth/refresh', { refresh_token: refreshToken })
        const { access_token, refresh_token: newRefresh } = res.data

        setAccessToken(access_token)
        await secureStorage.set('refresh_token', newRefresh)

        processQueue(null, access_token)
        original.headers.Authorization = `Bearer ${access_token}`
        return api(original)
      } catch (refreshErr) {
        processQueue(refreshErr, null)
        clearAccessToken()
        await secureStorage.remove('refresh_token')
        window.dispatchEvent(new Event('pvp:logout'))
        return Promise.reject(refreshErr)
      } finally {
        _isRefreshing = false
      }
    }
    return Promise.reject(err)
  },
)

// ── Auth ──────────────────────────────────────────────────────────────────────
export const register      = (data) => api.post('/auth/register', data)
export const login         = (data) => api.post('/auth/login', data)
export const refreshTokenApi = (refreshToken) =>
  axios.post(`${_backendOrigin}/api/auth/refresh`, { refresh_token: refreshToken })
export const getMe         = ()     => api.get('/auth/me')
export const updateProfile = (data) => api.put('/auth/profile', data)
export const logoutApi     = (refreshToken) =>
  api.post('/auth/logout', { refresh_token: refreshToken })

// ── Training ──────────────────────────────────────────────────────────────────
export const submitQuestionnaire = (data)   => api.post('/questionnaire', data)
export const getTraining         = (userId) => api.get(`/training/${userId}`)
export const getProgress         = (userId) => api.get(`/progress/${userId}`)
export const saveProgress        = (data)   => api.post('/progress', data)

export default api
