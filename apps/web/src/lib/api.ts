import axios from 'axios'

const TOKEN_STORAGE_KEY = 'piscokshop_token'
let accessToken: string | null = null
try {
  accessToken = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_STORAGE_KEY) : null
} catch {}

const resolvedBaseUrl = (() => {
  const raw = (import.meta.env.VITE_API_URL as string | undefined)?.trim()
  if (raw) return raw
  // Di production (single service di Railway) frontend diserve bareng API → cukup /api
  // Di dev tanpa VITE_API_URL, fallback ke localhost:3000 (Vite proxy /api tetap jalan)
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return '/api'
  }
  return 'http://localhost:3000/api'
})()

export const api = axios.create({
  baseURL: resolvedBaseUrl,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
  timeout: 10_000,
})

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`
  return config
})

let refreshPromise: Promise<string | null> | null = null

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error?.config as { _retry?: boolean; url?: string } | undefined
    const status = error?.response?.status as number | undefined
    const isAuthRoute = typeof original?.url === 'string' && original.url.includes('/auth/')
    if (status === 401 && original && !original._retry && !isAuthRoute) {
      original._retry = true
      try {
        if (!refreshPromise) {
          refreshPromise = api.post('/auth/refresh', null).then((res) => {
            const next = (res.data as { data?: { accessToken?: string } })?.data?.accessToken ?? null
            if (next) setAccessToken(next)
            return next as string | null
          }).catch(() => {
            setAccessToken(null)
            return null
          }).finally(() => {
            refreshPromise = null
          })
        }
        const nextToken = await refreshPromise
        if (nextToken && original) {
          (error.config.headers as Record<string, string>).Authorization = `Bearer ${nextToken}`
          return api.request(error.config)
        }
      } catch {}
    }
    return Promise.reject(error)
  },
)

export function setAccessToken(token: string | null) {
  accessToken = token
  try {
    if (typeof window !== 'undefined') {
      if (token) localStorage.setItem(TOKEN_STORAGE_KEY, token)
      else localStorage.removeItem(TOKEN_STORAGE_KEY)
    }
  } catch {}
}