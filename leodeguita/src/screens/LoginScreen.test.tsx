import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { AxiosError } from 'axios'
import { AuthProvider } from '../auth/AuthContext'
import LoginScreen from './LoginScreen'
import { login } from '../services/auth'

vi.mock('../services/auth', () => ({
  login: vi.fn(),
  logout: vi.fn(),
}))

const loginMock = vi.mocked(login)

function renderLogin() {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<LoginScreen />} />
          <Route path="/" element={<div>Pantalla principal</div>} />
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
