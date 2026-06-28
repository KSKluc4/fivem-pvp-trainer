import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

export const submitQuestionnaire = (data) => api.post('/questionnaire', data)
export const getTraining = (userId) => api.get(`/training/${userId}`)
export const getProgress = (userId) => api.get(`/progress/${userId}`)
export const saveProgress = (data) => api.post('/progress', data)

export default api
