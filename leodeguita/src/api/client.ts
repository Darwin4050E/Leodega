import axios from 'axios'
import { readToken } from '../auth/session'

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

export default client
