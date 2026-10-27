import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '../../auth/AuthContext'
import { readToken, writeSession } from '../../auth/session'
import { ActiveContextProvider } from '../../context/ActiveContextProvider'
import { listOrganizations } from '../../services/organizations'
import { logout } from '../../services/auth'
import ProfileScreen from './ProfileScreen'

vi.mock('../../services/organizations', () => ({
  listOrganizations: vi.fn(),
}))
vi.mock('../../services/auth', () => ({
  login: vi.fn(),
  logout: vi.fn(),
}))

const listMock = vi.mocked(listOrganizations)
const logoutMock = vi.mocked(logout)

const TENANT = {
  id: 7,
  name: 'Ana',
  lastname: 'Perez',
  email: 'ana@example.com',
  role: 'tenant' as const,
}

const ORGANIZATION = {
  id: 12,
  name: 'Importadora Andina',
  ruc: '0999999999001',
  email: 'org@example.com',
  logo: null,
  status: 'active',
  role: 'admin' as const,
}

function renderScreen() {
  return render(
    <AuthProvider>
      <ActiveContextProvider>
        <MemoryRouter initialEntries={['/perfil']}>
          <Routes>
            <Route path="/perfil" element={<ProfileScreen />} />
            <Route path="/empresa" element={<p>Selector abierto</p>} />
            <Route path="/login" element={<p>Pantalla de ingreso</p>} />
          </Routes>
        </MemoryRouter>
      </ActiveContextProvider>
    </AuthProvider>,
  )
}

describe('ProfileScreen', () => {
  beforeEach(() => {
    listMock.mockReset()
    listMock.mockResolvedValue([ORGANIZATION])
    logoutMock.mockReset()
    logoutMock.mockResolvedValue(undefined as never)
    writeSession('tok', TENANT)
  })

  it('shows the account identity and role', () => {
    renderScreen()

    expect(screen.getByRole('heading', { level: 1, name: 'Perfil' })).toBeInTheDocument()
    expect(screen.getByText('Ana Perez')).toBeInTheDocument()
    expect(screen.getByText('ana@example.com')).toBeInTheDocument()
    expect(screen.getByText('Cliente')).toBeInTheDocument()
  })

  it('shows the operating context and opens the picker from it', async () => {
    renderScreen()

    expect(screen.getByText('Organización')).toBeInTheDocument()
    expect(await screen.findByText('Operando como Modo personal')).toBeInTheDocument()

    await userEvent.setup().click(screen.getByRole('button', { name: 'Cambiar de organización' }))

    expect(screen.getByText('Selector abierto')).toBeInTheDocument()
  })

  it('hides the organization section when the user has no organizations', async () => {
    listMock.mockResolvedValue([])
    renderScreen()

    await vi.waitFor(() => expect(screen.queryByText('Organización')).not.toBeInTheDocument())
    expect(screen.queryByText(/Operando como/)).not.toBeInTheDocument()
  })

  it('offers no entries without a destination', () => {
    renderScreen()

    for (const label of ['Panel de la empresa', 'Invitaciones recibidas', 'Crear organización', 'Configuración', 'Ayuda y soporte']) {
      expect(screen.queryByText(label)).not.toBeInTheDocument()
    }
  })

  it('logs out, drops the session and goes to the login', async () => {
    renderScreen()

    await userEvent.setup().click(screen.getByRole('button', { name: 'Cerrar sesión' }))

    expect(logoutMock).toHaveBeenCalledTimes(1)
    expect(await screen.findByText('Pantalla de ingreso')).toBeInTheDocument()
    expect(readToken()).toBeNull()
  })

  it('drops the local session even when the logout request fails', async () => {
    logoutMock.mockRejectedValue(new Error('offline'))
    renderScreen()

    await userEvent.setup().click(screen.getByRole('button', { name: 'Cerrar sesión' }))

    expect(await screen.findByText('Pantalla de ingreso')).toBeInTheDocument()
    expect(readToken()).toBeNull()
  })

  it('shows the tab bar with Perfil current', () => {
    renderScreen()

    expect(screen.getByRole('link', { name: 'Perfil' })).toHaveAttribute('aria-current', 'page')
  })

  describe('as a landlord', () => {
    beforeEach(() => {
      writeSession('tok', { ...TENANT, role: 'landlord' as const })
    })

    it('shows the identity with the Gestor de bodega badge', () => {
      renderScreen()

      expect(screen.getByText('Ana Perez')).toBeInTheDocument()
      expect(screen.getByText('ana@example.com')).toBeInTheDocument()
      expect(screen.getByText('Gestor de bodega')).toBeInTheDocument()
      expect(screen.queryByText('Cliente')).not.toBeInTheDocument()
    })

    it('never shows the organization section or requests organizations', () => {
      renderScreen()

      expect(screen.queryByText('Organización')).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /Operando como/ })).not.toBeInTheDocument()
      expect(listMock).not.toHaveBeenCalled()
    })

    it('logs out from the account entry', async () => {
      renderScreen()

      await userEvent.setup().click(screen.getByRole('button', { name: 'Cerrar sesión' }))

      expect(await screen.findByText('Pantalla de ingreso')).toBeInTheDocument()
      expect(readToken()).toBeNull()
    })
  })
})
