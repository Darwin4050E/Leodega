import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '../../auth/AuthContext'
import { writeSession } from '../../auth/session'
import { listLandlordReservations, type LandlordReservation } from '../../services/reservations'
import LandlordReservationsScreen from './LandlordReservationsScreen'

vi.mock('../../services/reservations', () => ({
  listLandlordReservations: vi.fn(),
}))

const listMock = vi.mocked(listLandlordReservations)

const LANDLORD = {
  id: 7,
  name: 'Ana',
  lastname: 'Perez',
  email: 'ana@example.com',
  role: 'landlord' as const,
  landlord: { id: 3 },
}

function reservation(overrides: Partial<LandlordReservation> = {}): LandlordReservation {
  return {
    id: 1,
    status: 'confirmed',
    start_date: '2099-01-01',
    end_date: '2099-12-31',
    store_room_id: 3,
    total_mount: '150',
    store_rooms: { id: 3, title: 'Bodega Norte' },
    tenants: { user: { name: 'Luis', lastname: 'Mora' } },
    ...overrides,
  } as LandlordReservation
}

const ACTIVE = reservation({ id: 1 })
const FINISHED = reservation({ id: 2, end_date: '2020-01-01', store_rooms: { title: 'Bodega Vieja' } })
const CANCELED = reservation({ id: 3, status: 'canceled', store_rooms: { title: 'Bodega Cancelada' } })

function renderScreen() {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/reservas']}>
        <Routes>
          <Route path="/reservas" element={<LandlordReservationsScreen />} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  )
}

describe('LandlordReservationsScreen', () => {
  beforeEach(() => {
    listMock.mockReset()
    writeSession('tok', LANDLORD)
  })

  it('shows the header, a loading state, then the active reservations by default', async () => {
    listMock.mockResolvedValueOnce([ACTIVE, FINISHED, CANCELED])
    renderScreen()

    expect(screen.getByText('Cargando reservas…')).toBeInTheDocument()
    expect(await screen.findByText('Bodega Norte')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Reservas' })).toBeInTheDocument()
    expect(screen.getByText('Reservas de tus bodegas')).toBeInTheDocument()
    expect(screen.queryByText('Bodega Vieja')).not.toBeInTheDocument()
    expect(screen.queryByText('Bodega Cancelada')).not.toBeInTheDocument()
  })

  it('renders the storeroom, client, dates and amount of a row', async () => {
    listMock.mockResolvedValueOnce([ACTIVE])
    renderScreen()

    const row = (await screen.findByText('Bodega Norte')).closest('article') as HTMLElement
    expect(row).toHaveTextContent('Luis Mora')
    expect(row).toHaveTextContent('2099-01-01 — 2099-12-31')
    expect(row).toHaveTextContent('$150.00')
  })

  it('counts both tabs and switches to the finished ones', async () => {
    listMock.mockResolvedValueOnce([ACTIVE, FINISHED, CANCELED])
    renderScreen()
    await screen.findByText('Bodega Norte')

    expect(screen.getAllByRole('tab')).toHaveLength(2)
    expect(screen.getByRole('tab', { name: 'Activas 1' })).toHaveAttribute('aria-selected', 'true')

    await userEvent.setup().click(screen.getByRole('tab', { name: 'Finalizadas 1' }))
    expect(screen.getByText('Bodega Vieja')).toBeInTheDocument()
    expect(screen.queryByText('Bodega Norte')).not.toBeInTheDocument()
  })

  it('mounts the gestor bottom navigation with Reservas current', async () => {
    listMock.mockResolvedValueOnce([])
    renderScreen()
    await screen.findByText('Aún no has recibido reservas')

    expect(screen.getByRole('link', { name: 'Mis bodegas' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Reservas' })).toHaveAttribute('aria-current', 'page')
  })

  it('offers no cancel or receipt actions', async () => {
    listMock.mockResolvedValueOnce([ACTIVE])
    renderScreen()
    await screen.findByText('Bodega Norte')

    expect(screen.queryByRole('button', { name: /cancelar|comprobante/i })).not.toBeInTheDocument()
  })

  it('shows an empty state per tab', async () => {
    listMock.mockResolvedValueOnce([])
    renderScreen()

    expect(await screen.findByText('Aún no has recibido reservas')).toBeInTheDocument()

    await userEvent.setup().click(screen.getByRole('tab', { name: 'Finalizadas 0' }))
    expect(screen.getByText('Aún no tienes reservas finalizadas')).toBeInTheDocument()
  })

  it('shows an error whose "Reintentar" refetches', async () => {
    listMock.mockRejectedValueOnce(new Error('network'))
    renderScreen()

    const retry = await screen.findByRole('button', { name: 'Reintentar' })
    expect(screen.getByRole('alert')).toHaveTextContent('No pudimos cargar las reservas')

    listMock.mockResolvedValueOnce([ACTIVE])
    await userEvent.setup().click(retry)

    await waitFor(() => expect(screen.getByText('Bodega Norte')).toBeInTheDocument())
    expect(listMock).toHaveBeenCalledTimes(2)
  })
})
