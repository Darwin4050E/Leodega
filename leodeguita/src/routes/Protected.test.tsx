import { useEffect } from 'react'
import { describe, it, expect } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { AuthProvider } from '../auth/AuthContext'
import { useAuth } from '../auth/useAuth'
import { readToken, writeSession } from '../auth/session'
import { handleUnauthorized } from '../auth/sessionExpiry'
import Protected from './Protected'

const USER = {
  id: 1,
  name: 'Ana',
  lastname: 'Pérez',
  email: 'ana@example.com',
  role: 'landlord' as const,
}

// Every location the router rendered, in order, to detect redirect loops.
const visited: string[] = []

function LoginProbe() {
  const location = useLocation()
  const { setSession, sessionExpired } = useAuth()
  return (
    <div>
      <p>Pantalla de login</p>
      <output data-testid="state">{JSON.stringify(location.state)}</output>
      <output data-testid="expired">{String(sessionExpired)}</output>
      <button onClick={() => setSession('tok-2', USER)}>re-login</button>
    </div>
  )
}

function ProtectedPage() {
  const { clear } = useAuth()
  return (
    <div>
      <p>Mis bodegas</p>
      <button onClick={clear}>cerrar sesión</button>
    </div>
  )
}

function Tracker() {
  const location = useLocation()
  useEffect(() => {
    visited.push(location.pathname + location.search + location.hash)
  }, [location])
  return null
}

function renderAt(entry: string) {
  visited.length = 0
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[entry]}>
        <Tracker />
        <Routes>
          <Route path="/login" element={<LoginProbe />} />
          <Route element={<Protected />}>
            <Route path="/mis-bodegas" element={<ProtectedPage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  )
}

function loginState() {
  return JSON.parse(screen.getByTestId('state').textContent || 'null')
}

describe('Protected', () => {
  it('renders the protected screen while the session is valid', () => {
    writeSession('tok-1', USER)
    renderAt('/mis-bodegas')

    expect(screen.getByText('Mis bodegas')).toBeInTheDocument()
  })

  it('redirects to /login with the original route and reason when the session expires', () => {
    writeSession('tok-1', USER)
    renderAt('/mis-bodegas?x=1')

    act(() => handleUnauthorized('Bearer tok-1'))

    expect(screen.getByText('Pantalla de login')).toBeInTheDocument()
    expect(loginState()).toEqual({ from: '/mis-bodegas?x=1', reason: 'session-expired' })
    expect(readToken()).toBeNull()
  })

  it('keeps the hash in the return route', () => {
    writeSession('tok-1', USER)
    renderAt('/mis-bodegas?x=1#detalle')

    act(() => handleUnauthorized('Bearer tok-1'))

    expect(loginState()).toEqual({
      from: '/mis-bodegas?x=1#detalle',
      reason: 'session-expired',
    })
  })

  it('redirects a visitor without a session to /login with no state', () => {
    renderAt('/mis-bodegas')

    expect(screen.getByText('Pantalla de login')).toBeInTheDocument()
    expect(loginState()).toBeNull()
    expect(screen.getByTestId('expired')).toHaveTextContent('false')
  })

  it('redirects a manual logout to /login with no expiry reason', async () => {
    const user = userEvent.setup()
    writeSession('tok-1', USER)
    renderAt('/mis-bodegas')

    await user.click(screen.getByRole('button', { name: 'cerrar sesión' }))

    expect(screen.getByText('Pantalla de login')).toBeInTheDocument()
    expect(loginState()).toBeNull()
  })

  it('redirects once and keeps the first route when three 401s land together', () => {
    writeSession('tok-1', USER)
    renderAt('/mis-bodegas?x=1')

    act(() => {
      handleUnauthorized('Bearer tok-1')
      handleUnauthorized('Bearer tok-1')
      handleUnauthorized('Bearer tok-1')
    })

    expect(loginState()).toEqual({ from: '/mis-bodegas?x=1', reason: 'session-expired' })
    expect(visited).toEqual(['/mis-bodegas?x=1', '/login'])
  })

  it('does not navigate or store a /login return route on a late 401 while on /login', () => {
    writeSession('tok-1', USER)
    renderAt('/login')

    act(() => handleUnauthorized('Bearer tok-1'))

    expect(screen.getByText('Pantalla de login')).toBeInTheDocument()
    expect(loginState()).toBeNull()
    expect(visited).toEqual(['/login'])
    expect(readToken()).toBeNull()
  })

  it('clears the expired flag on the next login', async () => {
    const user = userEvent.setup()
    writeSession('tok-1', USER)
    renderAt('/mis-bodegas')

    act(() => handleUnauthorized('Bearer tok-1'))
    expect(screen.getByTestId('expired')).toHaveTextContent('true')

    await user.click(screen.getByRole('button', { name: 're-login' }))

    expect(screen.getByTestId('expired')).toHaveTextContent('false')
    expect(readToken()).toBe('tok-2')
  })
})
