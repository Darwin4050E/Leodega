import axios from 'axios'
import { readToken } from '../auth/session'
import { handleUnauthorized } from '../auth/sessionExpiry'

/**
 * HTTP client for the shared Leodega REST API. Leodeguita is just another
 * client of the same backend as the web app — same endpoints, same Sanctum
 * bearer tokens. Business rules live in the backend, never here.
 */
const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
})

client.interceptors.request.use((config) => {
  const token = readToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// A 401 here is wrong credentials, and /logout is already handled by its caller.
const SESSION_EXEMPT_PATHS = ['/login', '/logout']

function isSessionExempt(url: string | undefined): boolean {
  const path = (url ?? '').split('?')[0].replace(/\/+$/, '')
  return SESSION_EXEMPT_PATHS.includes(path)
}

client.interceptors.response.use(undefined, (error: unknown) => {
  if (
    axios.isAxiosError(error) &&
    error.response?.status === 401 &&
    !isSessionExempt(error.config?.url)
  ) {
    handleUnauthorized(error.config?.headers?.Authorization)
  }
  return Promise.reject(error)
})

export default client
