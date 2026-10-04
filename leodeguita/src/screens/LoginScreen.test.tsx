import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { AxiosError } from 'axios'
import { AuthProvider } from '../auth/AuthContext'
import LoginScreen from './LoginScreen'
import { login } from '../services/auth'

vi.mock('../services/auth', () => ({
  login: vi.fn(),
  logout: vi.fn(),
}))

const loginMock = vi.mocked(login)

const LOGIN_RESPONSE = {
  status: 'success',
  message: 'ok',
  token: 'tok-123',
  token_type: 'Bearer',
  user: {
    id: 1,
    name: 'Ana',
    lastname: 'Pérez',
    email: 'ana@example.com',
    role: 'landlord' as const,
  },
}

function MisBodegasProbe() {
  const { pathname, search, hash } = useLocation()
  return <div>{`Destino: ${pathname}${search}${hash}`}</div>
}

async function submitCredentials() {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText('Correo'), 'ana@example.com')
  await user.type(screen.getByLabelText('Contraseña'), 'secret123')
  await user.click(screen.getByRole('button', { name: /iniciar sesión/i }))
}

function renderLogin(state?: unknown) {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[{ pathname: '/login', state }]}>
        <Routes>
          <Route path="/login" element={<LoginScreen />} />
          <Route path="/" element={<div>Pantalla principal</div>} />
          <Route path="/mis-bodegas" element={<MisBodegasProbe />} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  )
}

describe('LoginScreen (HUL-01)', () => {
  beforeEach(() => {
    loginMock.mockReset()
  })

  it('AC-3: shows required-field errors and does not call the API when fields are empty', async () => {
    const user = userEvent.setup()
    renderLogin()

    await user.click(screen.getByRole('button', { name: /iniciar sesión/i }))

    expect(screen.getByText('El correo es requerido.')).toBeInTheDocument()
    expect(screen.getByText('La contraseña es requerida.')).toBeInTheDocument()
    expect(loginMock).not.toHaveBeenCalled()
  })

  it('AC-2: shows an error message on wrong credentials and stays on login', async () => {
    const user = userEvent.setup()
    loginMock.mockRejectedValueOnce(
      new AxiosError('unauthorized', undefined, undefined, undefined, {
        status: 401,
        data: {},
      } as never),
    )
    renderLogin()

    await user.type(screen.getByLabelText('Correo'), 'ana@example.com')
    await user.type(screen.getByLabelText('Contraseña'), 'wrong-pass')
    await user.click(screen.getByRole('button', { name: /iniciar sesión/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Correo o contraseña incorrectos.',
    )
    expect(screen.queryByText('Pantalla principal')).not.toBeInTheDocument()
  })

  it('AC-1: stores the session and navigates home on success', async () => {
    const user = userEvent.setup()
    loginMock.mockResolvedValueOnce({
      status: 'success',
      message: 'ok',
      token: 'tok-123',
      token_type: 'Bearer',
      user: {
        id: 1,
        name: 'Ana',
        lastname: 'Pérez',
        email: 'ana@example.com',
        role: 'landlord',
      },
    })
    renderLogin()

    await user.type(screen.getByLabelText('Correo'), 'ana@example.com')
    await user.type(screen.getByLabelText('Contraseña'), 'secret123')
    await user.click(screen.getByRole('button', { name: /iniciar sesión/i }))

    expect(await screen.findByText('Pantalla principal')).toBeInTheDocument()
    expect(localStorage.getItem('leodeguita_token')).toBe('tok-123')
    expect(loginMock).toHaveBeenCalledWith('ana@example.com', 'secret123')
  })
})

describe('LoginScreen session expiry and return route', () => {
  beforeEach(() => {
    loginMock.mockReset()
  })

  it('shows the session-ended notice when redirected with the expiry reason', () => {
    renderLogin({ from: '/mis-bodegas', reason: 'session-expired' })

    expect(screen.getByRole('status')).toHaveTextContent(
      'Tu sesión terminó, inicia sesión de nuevo',
    )
  })

  it.each([
    ['a plain /login visit', undefined],
    ['state without the expiry reason', { from: '/mis-bodegas' }],
    ['an unknown reason', { from: '/mis-bodegas', reason: 'other' }],
  ])('hides the notice on %s', (_label, state) => {
    renderLogin(state)

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('returns to the original route, query and hash after a successful login', async () => {
    loginMock.mockResolvedValueOnce(LOGIN_RESPONSE)
    renderLogin({ from: '/mis-bodegas?x=1#a', reason: 'session-expired' })

    await submitCredentials()

    expect(await screen.findByText('Destino: /mis-bodegas?x=1#a')).toBeInTheDocument()
  })

  it.each([
    '//evil.com',
    'https://evil.com',
    '/\\evil.com',
    'javascript:alert(1)',
    '/login',
    '',
  ])('falls back to home when the stored return route is %j', async (from) => {
    loginMock.mockResolvedValueOnce(LOGIN_RESPONSE)
    renderLogin({ from, reason: 'session-expired' })

    await submitCredentials()

    expect(await screen.findByText('Pantalla principal')).toBeInTheDocument()
  })

  it('falls back to home when the return route is not a string', async () => {
    loginMock.mockResolvedValueOnce(LOGIN_RESPONSE)
    renderLogin({ from: { pathname: '/mis-bodegas' } })

    await submitCredentials()

    expect(await screen.findByText('Pantalla principal')).toBeInTheDocument()
  })

  it('goes home when there is no return route', async () => {
    loginMock.mockResolvedValueOnce(LOGIN_RESPONSE)
    renderLogin()

    await submitCredentials()

    expect(await screen.findByText('Pantalla principal')).toBeInTheDocument()
  })

  it('shows the credentials error without the expiry notice or navigation on a login 401', async () => {
    loginMock.mockRejectedValueOnce(
      new AxiosError('unauthorized', undefined, undefined, undefined, {
        status: 401,
        data: {},
      } as never),
    )
    renderLogin()

    await submitCredentials()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Correo o contraseña incorrectos.',
    )
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.queryByText('Pantalla principal')).not.toBeInTheDocument()
  })
})

describe('LoginScreen suspended account (403)', () => {
  const SUSPENDED_MESSAGE = 'Tu cuenta ha sido suspendida. Contacta al administrador.'

  function forbidden(data: unknown) {
    return new AxiosError('forbidden', undefined, undefined, undefined, {
      status: 403,
      data,
    } as never)
  }

  beforeEach(() => {
    loginMock.mockReset()
    localStorage.clear()
  })

  it('shows the backend suspension message and stores no session on a login 403', async () => {
    loginMock.mockRejectedValueOnce(forbidden({ message: SUSPENDED_MESSAGE }))
    renderLogin()

    await submitCredentials()

    expect(await screen.findByRole('alert')).toHaveTextContent(SUSPENDED_MESSAGE)
    expect(localStorage.getItem('leodeguita_token')).toBeNull()
    expect(localStorage.getItem('leodeguita_user')).toBeNull()
    expect(screen.queryByText('Pantalla principal')).not.toBeInTheDocument()
  })

  it('does not navigate to the return route on a login 403', async () => {
    loginMock.mockRejectedValueOnce(forbidden({ message: SUSPENDED_MESSAGE }))
    renderLogin({ from: '/mis-bodegas', reason: 'session-expired' })

    await submitCredentials()

    expect(await screen.findByRole('alert')).toHaveTextContent(SUSPENDED_MESSAGE)
    expect(screen.queryByText('Destino: /mis-bodegas')).not.toBeInTheDocument()
    expect(localStorage.getItem('leodeguita_token')).toBeNull()
  })

  it.each([
    ['an empty body', {}],
    ['no body', undefined],
  ])('falls back to the generic message on a login 403 with %s', async (_label, data) => {
    loginMock.mockRejectedValueOnce(forbidden(data))
    renderLogin()

    await submitCredentials()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Esta cuenta no puede iniciar sesión.',
    )
    expect(localStorage.getItem('leodeguita_token')).toBeNull()
    expect(screen.queryByText('Pantalla principal')).not.toBeInTheDocument()
  })
})
