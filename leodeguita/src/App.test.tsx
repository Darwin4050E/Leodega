import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from './App'
import { writeSession } from './auth/session'
import { listOrganizations } from './services/organizations'

vi.mock('./services/organizations', () => ({
  listOrganizations: vi.fn(),
}))
vi.mock('./services/auth', () => ({
  login: vi.fn(),
  logout: vi.fn(),
}))

const listMock = vi.mocked(listOrganizations)

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

  it('shows Home, not the picker, for a tenant who reloads on /', async () => {
    writeSession('tok', TENANT)
    renderAt('/')

    expect(screen.getByText('Hola, Ana')).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: '¿Cómo quieres operar?' }),
    ).not.toBeInTheDocument()
    await vi.waitFor(() => expect(listMock).toHaveBeenCalledTimes(1))
  })

  it.each(['/perfil', '/no-existe'])('redirects the unknown path %s to /', (path) => {
    writeSession('tok', TENANT)
    renderAt(path)

    expect(screen.getByText('Hola, Ana')).toBeInTheDocument()
    expect(window.location.pathname).toBe('/')
  })
})
