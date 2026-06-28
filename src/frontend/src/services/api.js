import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

// Attach token on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('pvp_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// On 401, clear token and notify App
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('pvp_token')
      window.dispatchEvent(new Event('pvp:logout'))
    }
    return Promise.reject(err)
  },
)

// ── Auth ──────────────────────────────────────────────────────────────────────
export const register      = (data) => api.post('/auth/register', data)
export const login         = (data) => api.post('/auth/login', data)
export const getMe         = ()     => api.get('/auth/me')
export const updateProfile = (data) => api.put('/auth/profile', data)
export const logoutApi     = ()     => api.post('/auth/logout')

// ── Training ──────────────────────────────────────────────────────────────────
export const submitQuestionnaire = (data)   => api.post('/questionnaire', data)
export const getTraining         = (userId) => api.get(`/training/${userId}`)
export const getProgress         = (userId) => api.get(`/progress/${userId}`)
export const saveProgress        = (data)   => api.post('/progress', data)

export default api
