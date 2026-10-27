import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from './App'
import { writeSession } from './auth/session'
import { listOrganizations } from './services/organizations'
import { listMyStoreRooms, listStoreRooms } from './services/storeRooms'
import { listLandlordReservations, listTenantReservations } from './services/reservations'

vi.mock('./services/organizations', () => ({
  listOrganizations: vi.fn(),
}))
vi.mock('./services/reservations', () => ({
  listTenantReservations: vi.fn(),
  listLandlordReservations: vi.fn(),
}))
vi.mock('./services/storeRooms', () => ({
  listStoreRooms: vi.fn(),
  listMyStoreRooms: vi.fn(),
}))
vi.mock('./services/auth', () => ({
  login: vi.fn(),
  logout: vi.fn(),
}))

const listMock = vi.mocked(listOrganizations)
const roomsMock = vi.mocked(listStoreRooms)
const myRoomsMock = vi.mocked(listMyStoreRooms)

const LANDLORD = { ...{
  id: 7,
  name: 'Ana',
  lastname: 'Perez',
  email: 'ana@example.com',
}, role: 'landlord' as const, landlord: { id: 3 } }

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
    myRoomsMock.mockReset()
    myRoomsMock.mockResolvedValue([])
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

  it('keeps a landlord out of /empresa', async () => {
    writeSession('tok', LANDLORD)
    renderAt('/empresa')

    expect(await screen.findByRole('heading', { name: 'Mis bodegas' })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/mis-bodegas')
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

  it('renders the reservations for a tenant at /reservas', async () => {
    vi.mocked(listTenantReservations).mockResolvedValue([])
    writeSession('tok', TENANT)
    renderAt('/reservas')

    expect(screen.getByRole('heading', { level: 1, name: 'Reservas' })).toBeInTheDocument()
    expect(await screen.findByText('Aún no tienes reservas')).toBeInTheDocument()
  })

  it('renders the received reservations for a landlord at /reservas', async () => {
    vi.mocked(listLandlordReservations).mockResolvedValue([])
    writeSession('tok', LANDLORD)
    renderAt('/reservas')

    expect(screen.getByText('Reservas de tus bodegas')).toBeInTheDocument()
    expect(await screen.findByText('Aún no has recibido reservas')).toBeInTheDocument()
    expect(window.location.pathname).toBe('/reservas')
  })

  it('keeps an admin out of /reservas', () => {
    writeSession('tok', { ...TENANT, role: 'admin' })
    renderAt('/reservas')

    expect(screen.getByText('Hola, Ana')).toBeInTheDocument()
    expect(window.location.pathname).toBe('/')
  })

  it('renders the profile for a landlord at /perfil', () => {
    writeSession('tok', LANDLORD)
    renderAt('/perfil')

    expect(screen.getByRole('heading', { level: 1, name: 'Perfil' })).toBeInTheDocument()
    expect(screen.getByText('Gestor de bodega')).toBeInTheDocument()
    expect(window.location.pathname).toBe('/perfil')
  })

  it('keeps an admin out of /perfil', () => {
    writeSession('tok', { ...TENANT, role: 'admin' })
    renderAt('/perfil')

    expect(screen.getByText('Hola, Ana')).toBeInTheDocument()
    expect(window.location.pathname).toBe('/')
  })

  it('lands a landlord on Mis bodegas from /, not the placeholder Home', async () => {
    writeSession('tok', LANDLORD)
    renderAt('/')

    expect(await screen.findByRole('heading', { name: 'Mis bodegas' })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/mis-bodegas')
    expect(screen.queryByText('Hola, Ana')).not.toBeInTheDocument()
  })

  it('keeps the placeholder Home at / for an admin', () => {
    writeSession('tok', { ...TENANT, role: 'admin' })
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

  it('redirects an unknown path to Mis bodegas for a landlord', async () => {
    writeSession('tok', LANDLORD)
    renderAt('/no-existe')

    expect(await screen.findByRole('heading', { name: 'Mis bodegas' })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/mis-bodegas')
  })
})
