import client from '../api/client'
import type { AuthUser } from '../auth/authContextBase'

interface LoginResponse {
  status: string
  message: string
  user: AuthUser
  token: string
  token_type: string
}

/**
 * HUL-01: log in with the same Leodega credentials used on the web.
 *
 * `device_name` marks the session as coming from the mobile companion. The
 * backend currently issues every token as 'auth_token' (AuthService::
 * issueTokenFor), so this field is forward-compatible: it lets the backend
 * label mobile sessions later without a frontend change (see sequence
 * diagram 32 in the design docs).
 */
export async function login(email: string, password: string): Promise<LoginResponse> {
  const { data } = await client.post<LoginResponse>('/login', {
    email,
    password,
    device_name: 'leodeguita_mobile',
  })
  return data
}

export async function logout(): Promise<void> {
  await client.post('/logout', {})
}
