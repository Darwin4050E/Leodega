import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from './App'
import { writeSession } from './auth/session'
import { listOrganizations } from './services/organizations'
import { listStoreRooms } from './services/storeRooms'

vi.mock('./services/organizations', () => ({
  listOrganizations: vi.fn(),
}))
vi.mock('./services/storeRooms', () => ({
  listStoreRooms: vi.fn(),
}))
vi.mock('./services/auth', () => ({
  login: vi.fn(),
  logout: vi.fn(),
}))

const listMock = vi.mocked(listOrganizations)
const roomsMock = vi.mocked(listStoreRooms)

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

function renderAt(path: string) {
  window.history.pushState({}, '', path)
  return render(<App />)
}

describe('App routes (HUL-02)', () => {
  beforeEach(() => {
    listMock.mockReset()
    listMock.mockResolvedValue([ORGANIZATION])
    roomsMock.mockReset()
    roomsMock.mockResolvedValue([])
  })

  it('sends a visitor without a session from /empresa to /login', () => {
    renderAt('/empresa')

    expect(screen.getByText('Inicia sesión con tu cuenta de Leodega')).toBeInTheDocument()
    expect(window.location.pathname).toBe('/login')
  })

  it('renders the picker for a tenant at /empresa', async () => {
    writeSession('tok', TENANT)
    renderAt('/empresa')

    expect(
      screen.getByRole('heading', { level: 1, name: '¿Cómo quieres operar?' }),
    ).toBeInTheDocument()
    expect(await screen.findByText('Importadora Andina')).toBeInTheDocument()
  })

  it('keeps a landlord out of /empresa', () => {
    writeSession('tok', { ...TENANT, role: 'landlord' })
    renderAt('/empresa')

    expect(screen.getByText('Hola, Ana')).toBeInTheDocument()
    expect(window.location.pathname).toBe('/')
    expect(listMock).not.toHaveBeenCalled()
  })

  it('lands a tenant who reloads on / on Explorar, not the picker or Home', async () => {
    writeSession('tok', TENANT)
    renderAt('/')

    expect(await screen.findByRole('heading', { name: 'Explorar' })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/bodegas')
    expect(screen.queryByText('Hola, Ana')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: '¿Cómo quieres operar?' }),
    ).not.toBeInTheDocument()
  })

  it('renders the profile for a tenant at /perfil', () => {
    writeSession('tok', TENANT)
    renderAt('/perfil')

    expect(screen.getByRole('heading', { level: 1, name: 'Perfil' })).toBeInTheDocument()
  })

  it('keeps a landlord out of /perfil', () => {
    writeSession('tok', { ...TENANT, role: 'landlord' })
    renderAt('/perfil')

    expect(screen.getByText('Hola, Ana')).toBeInTheDocument()
    expect(window.location.pathname).toBe('/')
  })

  it('keeps the landlord Home at /', () => {
    writeSession('tok', { ...TENANT, role: 'landlord' })
    renderAt('/')

    expect(screen.getByText('Hola, Ana')).toBeInTheDocument()
    expect(window.location.pathname).toBe('/')
  })

  it('redirects an unknown path to Explorar for a tenant', async () => {
    writeSession('tok', TENANT)
    renderAt('/no-existe')

    expect(await screen.findByRole('heading', { name: 'Explorar' })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/bodegas')
  })

  it('redirects an unknown path to Home for a landlord', () => {
    writeSession('tok', { ...TENANT, role: 'landlord' })
    renderAt('/no-existe')

    expect(screen.getByText('Hola, Ana')).toBeInTheDocument()
    expect(window.location.pathname).toBe('/')
  })
})
