import axios from 'axios'
import { tokenStore } from './storage'

// All requests use relative URLs — works both on Vercel (same origin)
// and in Electron (which loads the Vercel URL directly).
const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

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
let _isRefreshing = false
let _refreshQueue = []

function processQueue(error, token = null) {
  _refreshQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token)))
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
        const refreshToken = await tokenStore.getRefreshToken()
        if (!refreshToken) throw new Error('No refresh token')

        const res = await axios.post('/api/auth/refresh', { refresh_token: refreshToken })
        const { access_token, refresh_token: newRefresh } = res.data

        setAccessToken(access_token)
        await tokenStore.updateRefreshToken(newRefresh)

        processQueue(null, access_token)
        original.headers.Authorization = `Bearer ${access_token}`
        return api(original)
      } catch (refreshErr) {
        processQueue(refreshErr, null)
        clearAccessToken()
        await tokenStore.clear()
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
export const register        = (data)         => api.post('/auth/register', data)
export const login           = (data)         => api.post('/auth/login', data)
export const refreshTokenApi = (refreshToken) => axios.post('/api/auth/refresh', { refresh_token: refreshToken })
export const getMe           = ()             => api.get('/auth/me')
export const updateProfile   = (data)         => api.put('/auth/profile', data)
export const logoutApi       = (refreshToken) => api.post('/auth/logout', { refresh_token: refreshToken })
export const addEmailApi     = (email)        => api.post('/auth/email', { email })
export const forgotPassword  = (email)        => axios.post('/api/auth/forgot-password', { email })

// ── Training ──────────────────────────────────────────────────────────────────
export const submitQuestionnaire = (data)   => api.post('/questionnaire', data)
export const getTraining         = (userId) => api.get(`/training/${userId}`)
export const getProgress         = (userId) => api.get(`/progress/${userId}`)
export const saveProgress        = (data)   => api.post('/progress', data)

// ── Sensitivity — single profile-wide source, shared with the trainer ────────
export const updateSensitivity = (data) => api.put('/sensitivity', data)

// ── Profile ───────────────────────────────────────────────────────────────────
export const updateBio    = (bio) => api.patch('/profile', { bio })
export const deleteAvatar = ()    => api.delete('/profile/avatar')
export const deleteBanner = ()    => api.delete('/profile/banner')

function uploadProfileImage(kind, file, onProgress) {
  const form = new FormData()
  form.append(kind, file)
  return api.post(`/profile/${kind}`, form, {
    // The shared `api` instance defaults Content-Type to application/json —
    // clearing it here lets the browser set multipart/form-data itself,
    // including the boundary param axios/XHR can't add if we set it by hand.
    headers: { 'Content-Type': undefined },
    onUploadProgress: (e) => onProgress?.(e.total ? Math.round((e.loaded / e.total) * 100) : 0),
  })
}
export const uploadAvatar = (file, onProgress) => uploadProfileImage('avatar', file, onProgress)
export const uploadBanner = (file, onProgress) => uploadProfileImage('banner', file, onProgress)

// ── Admin ─────────────────────────────────────────────────────────────────────
export const getAdminStats = () => api.get('/admin/stats')
export const getAdminUsers = () => api.get('/admin/users')

// ── Aim trainer scores ────────────────────────────────────────────────────────
export const postTrainerScore = (data) => api.post('/trainer/scores', data)
export const getTrainerScores = (exercise) => api.get('/trainer/scores', { params: { exercise } })

export default api
