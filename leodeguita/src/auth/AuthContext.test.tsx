import { describe, it, expect } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuthProvider } from './AuthContext'
import { useAuth } from './useAuth'
import { readToken, readUser, writeSession } from './session'
import { handleUnauthorized } from './sessionExpiry'
import {
  readRequestOrganizationId,
  readStoredOrganizationId,
  writeStoredOrganizationId,
} from '../context/activeContextStorage'

const TENANT = {
  id: 7,
  name: 'Ana',
  lastname: 'Perez',
  email: 'ana@example.com',
  role: 'tenant' as const,
}

function Probe() {
  const { clear } = useAuth()
  return <button onClick={clear}>cerrar sesión</button>
}

function renderProvider() {
  return render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  )
}

describe('AuthProvider logout and active context', () => {
  it('removes the departing tenant key together with token and user', async () => {
    const user = userEvent.setup()
    writeSession('tok-1', TENANT)
    writeStoredOrganizationId(7, 12)
    renderProvider()

    await user.click(screen.getByRole('button', { name: 'cerrar sesión' }))

    expect(readStoredOrganizationId(7)).toBeNull()
    expect(readToken()).toBeNull()
    expect(readUser()).toBeNull()
  })

  it("leaves another user's key unchanged", async () => {
    const user = userEvent.setup()
    writeSession('tok-1', TENANT)
    writeStoredOrganizationId(7, 12)
    writeStoredOrganizationId(8, 30)
    renderProvider()

    await user.click(screen.getByRole('button', { name: 'cerrar sesión' }))

    expect(readStoredOrganizationId(8)).toBe(30)
  })

  it('does not throw and still clears the session when the stored user is unreadable', async () => {
    const user = userEvent.setup()
    localStorage.setItem('leodeguita_token', 'tok-1')
    localStorage.setItem('leodeguita_user', '{not json')
    writeStoredOrganizationId(7, 12)
    renderProvider()

    await user.click(screen.getByRole('button', { name: 'cerrar sesión' }))

    expect(readToken()).toBeNull()
    expect(localStorage.getItem('leodeguita_user')).toBeNull()
  })

  it('keeps the key on a 401 expiry while the header stops being sent', () => {
    writeSession('tok-1', TENANT)
    writeStoredOrganizationId(7, 12)
    renderProvider()
    expect(readRequestOrganizationId()).toBe(12)

    act(() => handleUnauthorized('Bearer tok-1'))

    expect(readToken()).toBeNull()
    expect(readUser()).toBeNull()
    expect(readStoredOrganizationId(7)).toBe(12)
    expect(readRequestOrganizationId()).toBeNull()
  })
})
