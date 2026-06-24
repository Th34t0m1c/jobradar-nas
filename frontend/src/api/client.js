import axios from 'axios'

export const TOKEN_KEY = 'access_token'

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

// Inject Bearer token on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Guard against multiple concurrent 401s all triggering a redirect
let isRedirecting = false

// On 401: clear token and redirect to login (skip for auth endpoints — let them throw)
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const url = err.config?.url ?? ''
    const isAuthEndpoint =
      url.includes('/auth/login') ||
      url.includes('/auth/register') ||
      url.includes('/auth/forgot-password') ||
      url.includes('/auth/reset-password')
    if (err.response?.status === 401 && !isAuthEndpoint) {
      if (!isRedirecting) {
        isRedirecting = true
        localStorage.removeItem(TOKEN_KEY)
        window.location.href = '/login'
      }
      return new Promise(() => {}) // suppress onError toast — page is navigating away
    }
    return Promise.reject(err)
  }
)

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authApi = {
  register: (full_name, email, password, confirm_password) =>
    api.post('/auth/register', { full_name, email, password, confirm_password }),
  login: (email, password) =>
    api.post('/auth/login', { email, password }),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
  updateProfile: (data) => api.patch('/auth/profile', data),
  changePassword: (data) => api.post('/auth/change-password', data),
  forgotPassword: (email) =>
    api.post('/auth/forgot-password', { email }),
  resetPassword: (token, new_password, confirm_password) =>
    api.post('/auth/reset-password', { token, new_password, confirm_password }),
}

// ── Jobs ──────────────────────────────────────────────────────────────────────
export const jobsApi = {
  list: (params) => api.get('/jobs', { params }),
  get: (id) => api.get(`/jobs/${id}`),
  updateStatus: (id, status) => api.patch(`/jobs/${id}/status`, { status }),
  saveScore: (id, data) => api.patch(`/jobs/${id}/score`, data),
  match: (id) => api.post(`/jobs/${id}/match`),
  delete: (id) => api.delete(`/jobs/${id}`),
  deleteAll: () => api.delete('/jobs'),
  trigger: () => api.post('/jobs/trigger'),
  taskStatus: (taskId) => api.get(`/jobs/task/${taskId}`),
}

// ── CV ────────────────────────────────────────────────────────────────────────
export const cvApi = {
  list: () => api.get('/cv'),
  getActive: () => api.get('/cv/active'),
  upload: (file) => {
    const form = new FormData()
    form.append('file', file)
    return api.post('/cv/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  activate: (id) => api.post(`/cv/${id}/activate`),
  setSummary: (id, summary) => api.patch(`/cv/${id}/summary`, { summary }),
  delete: (id) => api.delete(`/cv/${id}`),
  getSuggestions: () => api.get('/cv/suggestions'),
}

// ── Filters ───────────────────────────────────────────────────────────────────
export const filtersApi = {
  get: () => api.get('/filters'),
  save: (data) => api.put('/filters', data),
}

// ── Platforms ─────────────────────────────────────────────────────────────────
export const platformsApi = {
  list: () => api.get('/platforms'),
}

export default api
