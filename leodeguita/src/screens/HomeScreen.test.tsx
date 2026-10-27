import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '../auth/AuthContext'
import { writeSession } from '../auth/session'
import { ActiveContextProvider } from '../context/ActiveContextProvider'
import { listOrganizations } from '../services/organizations'
import HomeScreen from './HomeScreen'

vi.mock('../services/organizations', () => ({
  listOrganizations: vi.fn(),
}))
vi.mock('../services/auth', () => ({
  login: vi.fn(),
  logout: vi.fn(),
}))

const listMock = vi.mocked(listOrganizations)

const USER = {
  id: 7,
  name: 'Ana',
  lastname: 'Perez',
  email: 'ana@example.com',
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

function renderHome() {
  return render(
    <AuthProvider>
      <ActiveContextProvider>
        <MemoryRouter initialEntries={['/']}>
          <Routes>
            <Route path="/" element={<HomeScreen />} />
            <Route path="/empresa" element={<p>Selector abierto</p>} />
          </Routes>
        </MemoryRouter>
      </ActiveContextProvider>
    </AuthProvider>,
  )
}

describe('HomeScreen', () => {
  beforeEach(() => {
    listMock.mockReset()
    listMock.mockResolvedValue([ORGANIZATION])
  })

  it('shows the admin Home without the organization context', () => {
    const [role, label] = ['admin', 'Administrador'] as const
    writeSession('tok', { ...USER, role })
    renderHome()

    expect(screen.getByText(`Rol: ${label}`)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeInTheDocument()
    expect(screen.queryByText(/Operando como/)).not.toBeInTheDocument()
    expect(listMock).not.toHaveBeenCalled()
  })

  it('offers no landlord actions', () => {
    writeSession('tok', { ...USER, role: 'admin' })
    renderHome()

    expect(screen.queryByRole('button', { name: 'Publicar un espacio' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Mis bodegas' })).not.toBeInTheDocument()
  })
})
