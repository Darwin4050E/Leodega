import axios from 'axios'
import { readToken } from '../auth/session'
import { handleUnauthorized } from '../auth/sessionExpiry'
import {
  ORGANIZATION_FORBIDDEN_MESSAGE,
  ORGANIZATION_HEADER,
  forcePersonalContext,
  readRequestOrganizationId,
} from '../context/activeContextStorage'

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
  const organizationId = readRequestOrganizationId()
  if (organizationId !== null) {
    config.headers.set(ORGANIZATION_HEADER, String(organizationId))
  }
  return config
})

// A 401 here is wrong credentials, and /logout is already handled by its caller.
const SESSION_EXEMPT_PATHS = ['/login', '/logout']

function isSessionExempt(url: string | undefined): boolean {
  const path = (url ?? '').split('?')[0].replace(/\/+$/, '')
  return SESSION_EXEMPT_PATHS.includes(path)
}

// A late 403 for a superseded choice must not wipe the newer one, so the sent id must still be current.
function isOrganizationForbidden(error: unknown): boolean {
  if (!axios.isAxiosError(error)) return false
  if (error.response?.status !== 403) return false
  const body = error.response.data as { message?: unknown } | null
  if (body?.message !== ORGANIZATION_FORBIDDEN_MESSAGE) return false
  const sent = error.config?.headers?.get(ORGANIZATION_HEADER)
  const current = readRequestOrganizationId()
  return sent != null && current !== null && String(sent) === String(current)
}

client.interceptors.response.use(undefined, (error: unknown) => {
  if (isOrganizationForbidden(error)) {
    forcePersonalContext()
  }
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
