import { useNavigate } from 'react-router-dom'
import { logout as logoutRequest } from '../services/auth'
import { useAuth } from './useAuth'

/** Ends the session: best-effort server logout, then always drop the local one. */
export function useLogout() {
  const navigate = useNavigate()
  const { clear } = useAuth()

  return async function logout() {
    try {
      await logoutRequest()
    } catch {
      // Even if the network call fails, drop the local session.
    }
    clear()
    navigate('/login', { replace: true })
  }
}
