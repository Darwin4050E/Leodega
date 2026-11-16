import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '../../auth/AuthContext'
import { writeSession } from '../../auth/session'
import { ActiveContextProvider } from '../../context/ActiveContextProvider'
import { useActiveContext } from '../../context/useActiveContext'
import { listOrganizations } from '../../services/organizations'
import { listTenantReservations, type TenantReservation } from '../../services/reservations'
import ReservationsScreen from './ReservationsScreen'

vi.mock('../../services/organizations', () => ({
  listOrganizations: vi.fn(),
}))
vi.mock('../../services/reservations', () => ({
  listTenantReservations: vi.fn(),
}))

const listMock = vi.mocked(listTenantReservations)
const organizationsMock = vi.mocked(listOrganizations)

const TENANT = {
  id: 7,
  name: 'Ana',
  lastname: 'Perez',
  email: 'ana@example.com',
  role: 'tenant' as const,
}

function reservation(overrides: Partial<TenantReservation> = {}): TenantReservation {
  return {
    id: 1,
    status: 'confirmed',
    start_date: '2099-01-01',
    end_date: '2099-12-31',
    store_room_id: 3,
    total_mount: '150',
    photo_url: null,
    store_rooms: { title: 'Bodega Norte', direction: 'Km 11', city: 'Guayaquil', size: 45 },
    ...overrides,
  }
}

const ACTIVE = reservation({ id: 1 })
const FINISHED = reservation({ id: 2, end_date: '2020-01-01', store_rooms: { title: 'Bodega Vieja' } })
const CANCELED = reservation({
  id: 3,
  status: 'canceled',
  refund_amount: '50',
  store_rooms: { title: 'Bodega Cancelada' },
})

function ContextSwitcher() {
  const { selectOrganization } = useActiveContext()
  return <button onClick={() => selectOrganization(12)}>Cambiar contexto</button>
}

function renderScreen() {
  return render(
    <AuthProvider>
      <ActiveContextProvider>
        <ContextSwitcher />
        <MemoryRouter initialEntries={['/reservas']}>
          <Routes>
            <Route path="/reservas" element={<ReservationsScreen />} />
            <Route path="/bodegas" element={<p>Catálogo abierto</p>} />
          </Routes>
        </MemoryRouter>
      </ActiveContextProvider>
    </AuthProvider>,
  )
}

describe('ReservationsScreen', () => {
  beforeEach(() => {
    listMock.mockReset()
    organizationsMock.mockReset()
    organizationsMock.mockResolvedValue([])
    writeSession('tok', TENANT)
  })

  it('shows a loading state, then the active reservations by default', async () => {
    listMock.mockResolvedValueOnce([ACTIVE, FINISHED, CANCELED])
    renderScreen()

    expect(screen.getByText('Cargando reservas…')).toBeInTheDocument()
    expect(await screen.findByText('Bodega Norte')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Reservas' })).toBeInTheDocument()
    expect(screen.queryByText('Bodega Vieja')).not.toBeInTheDocument()
    expect(screen.queryByText('Bodega Cancelada')).not.toBeInTheDocument()
  })

  it('renders the card fields', async () => {
    listMock.mockResolvedValueOnce([ACTIVE])
    renderScreen()

    const card = (await screen.findByText('Bodega Norte')).closest('article') as HTMLElement
    expect(within(card).getByText('Activa')).toBeInTheDocument()
    expect(within(card).getByText('Km 11, Guayaquil · 45 m²')).toBeInTheDocument()
    expect(within(card).getByText('2099-01-01 → 2099-12-31')).toBeInTheDocument()
    expect(within(card).getByText('$150.00')).toBeInTheDocument()
    expect(within(card).getByText('LEO-000001')).toBeInTheDocument()
  })

  it('counts each tab and switches between them', async () => {
    listMock.mockResolvedValueOnce([ACTIVE, FINISHED, CANCELED])
    renderScreen()
    await screen.findByText('Bodega Norte')

    expect(screen.getByRole('tab', { name: 'Activas 1' })).toHaveAttribute('aria-selected', 'true')
    const user = userEvent.setup()

    await user.click(screen.getByRole('tab', { name: 'Finalizadas 1' }))
    expect(screen.getByText('Bodega Vieja')).toBeInTheDocument()
    expect(screen.queryByText('Bodega Norte')).not.toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Canceladas 1' }))
    expect(screen.getByText('Bodega Cancelada')).toBeInTheDocument()
    expect(screen.getByText('Reembolso')).toBeInTheDocument()
    expect(screen.getByText('$50.00')).toBeInTheDocument()
  })

  it('shows the organization and its creator on an organization reservation', async () => {
    listMock.mockResolvedValueOnce([
      reservation({ organization: { id: 12, name: 'Importadora Andina', ruc: '1' }, creator_name: 'Luis Mora' }),
    ])
    renderScreen()

    expect(await screen.findByText('Importadora Andina')).toBeInTheDocument()
    expect(screen.getByText('Reservada por Luis Mora')).toBeInTheDocument()
  })

  it('shows the empty state with a way back to the catalog', async () => {
    listMock.mockResolvedValueOnce([])
    renderScreen()

    expect(await screen.findByText('Aún no tienes reservas')).toBeInTheDocument()

    await userEvent.setup().click(screen.getByRole('button', { name: 'Explorar catálogo' }))

    expect(screen.getByText('Catálogo abierto')).toBeInTheDocument()
  })

  it('names the empty tab', async () => {
    listMock.mockResolvedValueOnce([ACTIVE])
    renderScreen()
    await screen.findByText('Bodega Norte')

    await userEvent.setup().click(screen.getByRole('tab', { name: 'Canceladas 0' }))

    expect(screen.getByText('Aún no tienes reservas canceladas')).toBeInTheDocument()
  })

  it('shows an error and retries', async () => {
    listMock.mockRejectedValueOnce(new Error('boom'))
    listMock.mockResolvedValueOnce([ACTIVE])
    renderScreen()

    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos cargar tus reservas')

    await userEvent.setup().click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(await screen.findByText('Bodega Norte')).toBeInTheDocument()
    expect(listMock).toHaveBeenCalledTimes(2)
  })

  it('reloads the list when the active organization changes', async () => {
    listMock.mockResolvedValue([ACTIVE])
    renderScreen()
    await screen.findByText('Bodega Norte')
    expect(listMock).toHaveBeenCalledTimes(1)

    await userEvent.setup().click(screen.getByRole('button', { name: 'Cambiar contexto' }))

    await vi.waitFor(() => expect(listMock).toHaveBeenCalledTimes(2))
  })

  it('shows the tab bar with Reservas current', async () => {
    listMock.mockResolvedValueOnce([])
    renderScreen()
    await screen.findByText('Aún no tienes reservas')

    expect(screen.getByRole('link', { name: 'Reservas' })).toHaveAttribute('aria-current', 'page')
  })
})
