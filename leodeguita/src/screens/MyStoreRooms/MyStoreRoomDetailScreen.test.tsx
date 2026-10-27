import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ReactNode } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '../../auth/AuthContext'
import MyStoreRoomDetailScreen from './MyStoreRoomDetailScreen'
import {
  getStoreRoomDetail,
  listMyStoreRooms,
  StoreRoomNotFoundError,
  type MyStoreRoom,
  type StoreRoomDetail,
} from '../../services/storeRooms'

vi.mock('../../services/storeRooms', async () => {
  const actual = await vi.importActual<typeof import('../../services/storeRooms')>(
    '../../services/storeRooms',
  )
  return { ...actual, getStoreRoomDetail: vi.fn(), listMyStoreRooms: vi.fn() }
})

// react-leaflet cannot lay out in jsdom; stub it like the other map tests.
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: ReactNode }) => (
    <div data-testid="map">{children}</div>
  ),
  TileLayer: () => null,
  Marker: () => <div data-testid="map-marker" />,
}))
vi.mock('leaflet', () => ({ default: { icon: () => ({}) } }))

const detailMock = vi.mocked(getStoreRoomDetail)
const listMock = vi.mocked(listMyStoreRooms)

function seedSession(role: 'landlord' | 'tenant' = 'landlord') {
  localStorage.setItem('leodeguita_token', 'tok-123')
  localStorage.setItem(
    'leodeguita_user',
    JSON.stringify({
      id: 1,
      name: 'Johao',
      lastname: 'Dorado',
      email: 'johao@example.com',
      role,
      landlord: role === 'landlord' ? { id: 7 } : null,
    }),
  )
}

function mine(overrides: Partial<MyStoreRoom> = {}): MyStoreRoom {
  return {
    id: 1,
    title: 'Bodega Norte',
    direction: 'Km 11.5 Vía a Daule',
    city: 'Guayaquil',
    size: 45,
    publication_status: 'approved',
    storage_type: 'completa',
    room_type: 'bodega',
    active_reservations_count: 0,
    image: null,
    storePrices: [{ mode: 'month', price: 150, disponibility: true }],
    rejection: null,
    ...overrides,
  }
}

function detail(overrides: Partial<StoreRoomDetail> = {}): StoreRoomDetail {
  return {
    id: 1,
    title: 'Bodega Norte',
    description: 'Espacio amplio y seco',
    direction: 'Km 11.5 Vía a Daule',
    city: 'Guayaquil',
    size: 45,
    room_type: 'bodega',
    storage_type: 'completa',
    security: null,
    prices: [{ mode: 'month', price: 150, disponibility: true }],
    photos: ['https://example.com/foto.jpg'],
    landlord: { id: 7, user_id: 1, name: 'Johao', email: 'j@x.com', phone: null },
    latitude: -2.15,
    longitude: -79.9,
    rating_avg: 0,
    rating_count: 0,
    active_reservations_count: 0,
    is_available_now: true,
    ...overrides,
  }
}

function renderScreen(path = '/mis-bodegas/1') {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/mis-bodegas" element={<div>Lista de bodegas</div>} />
          <Route path="/mis-bodegas/:id" element={<MyStoreRoomDetailScreen />} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  )
}

describe('MyStoreRoomDetailScreen', () => {
  beforeEach(() => {
    detailMock.mockReset()
    listMock.mockReset()
    seedSession('landlord')
    detailMock.mockResolvedValue(detail())
    listMock.mockResolvedValue([mine()])
  })

  it('shows the hero, status chip, stats, description and documentation', async () => {
    listMock.mockResolvedValue([mine({ active_reservations_count: 2 })])
    renderScreen()

    expect(await screen.findByRole('heading', { name: 'Bodega Norte' })).toBeInTheDocument()
    expect(detailMock).toHaveBeenCalledWith(1)
    expect(listMock).toHaveBeenCalledWith(7)
    expect(screen.getByText('Ocupada')).toBeInTheDocument()
    expect(screen.getByText('Tamaño')).toBeInTheDocument()
    expect(screen.getByText('45 m²')).toBeInTheDocument()
    expect(screen.getByText('Tipo')).toBeInTheDocument()
    expect(screen.getByText('Bodega independiente')).toBeInTheDocument()
    expect(screen.getByText('Reservas')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('Descripción')).toBeInTheDocument()
    expect(screen.getByText('Espacio amplio y seco')).toBeInTheDocument()
    expect(screen.getByText('Documentación')).toBeInTheDocument()
    expect(screen.getByText('Permiso de bomberos')).toBeInTheDocument()
    expect(screen.getByText('Km 11.5 Vía a Daule, Guayaquil')).toBeInTheDocument()
  })

  it('shows the rejection banner with the admin reason', async () => {
    listMock.mockResolvedValue([
      mine({
        publication_status: 'rejected',
        rejection: { reason_code: 'fotos', reason: 'Las fotos están borrosas' },
      }),
    ])
    renderScreen()

    expect(await screen.findByText('Rechazada por el administrador')).toBeInTheDocument()
    expect(screen.getByText('Las fotos están borrosas')).toBeInTheDocument()
  })

  it('shows the review banner for a pending room', async () => {
    listMock.mockResolvedValue([mine({ publication_status: 'pending' })])
    renderScreen()

    expect(await screen.findByText('En revisión del administrador')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Tu bodega aparecerá en el catálogo una vez aprobada. La verificación se hace una sola vez por bodega.',
      ),
    ).toBeInTheDocument()
    expect(screen.queryByText('Rechazada por el administrador')).not.toBeInTheDocument()
  })

  it('renders no banner for an approved room', async () => {
    renderScreen()
    await screen.findByRole('heading', { name: 'Bodega Norte' })
    expect(screen.queryByText('En revisión del administrador')).not.toBeInTheDocument()
    expect(screen.queryByText('Rechazada por el administrador')).not.toBeInTheDocument()
  })

  it('renders the read-only map only when the room has coordinates', async () => {
    renderScreen()
    await screen.findByRole('heading', { name: 'Bodega Norte' })
    expect(screen.getByTestId('map')).toBeInTheDocument()
  })

  it('falls back to the address text when there are no coordinates', async () => {
    detailMock.mockResolvedValue(detail({ latitude: null, longitude: null }))
    renderScreen()
    await screen.findByRole('heading', { name: 'Bodega Norte' })
    expect(screen.queryByTestId('map')).not.toBeInTheDocument()
    expect(screen.getByText('Ubicación')).toBeInTheDocument()
  })

  it('does not show the bottom tab bar', async () => {
    renderScreen()
    await screen.findByRole('heading', { name: 'Bodega Norte' })
    expect(screen.queryByRole('navigation', { name: 'Navegación principal' })).not.toBeInTheDocument()
  })

  it('goes back to Mis bodegas', async () => {
    const user = userEvent.setup()
    renderScreen()
    await screen.findByRole('heading', { name: 'Bodega Norte' })

    await user.click(screen.getByRole('button', { name: 'Volver' }))
    expect(screen.getByText('Lista de bodegas')).toBeInTheDocument()
  })

  it('shows an error state whose "Reintentar" refetches', async () => {
    detailMock.mockRejectedValueOnce(new Error('network'))
    const user = userEvent.setup()
    renderScreen()

    await user.click(await screen.findByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByRole('heading', { name: 'Bodega Norte' })).toBeInTheDocument()
    expect(detailMock).toHaveBeenCalledTimes(2)
  })

  it('shows not-found when the API answers 404', async () => {
    detailMock.mockRejectedValueOnce(new StoreRoomNotFoundError(1))
    renderScreen()
    expect(await screen.findByText('Esta bodega ya no existe.')).toBeInTheDocument()
  })

  it('shows not-found when the room is not among the gestor\'s own rooms', async () => {
    listMock.mockResolvedValue([mine({ id: 99 })])
    renderScreen()
    expect(await screen.findByText('Esta bodega ya no existe.')).toBeInTheDocument()
  })

  it('shows not-found for a non-numeric id without calling the API', async () => {
    renderScreen('/mis-bodegas/abc')
    expect(await screen.findByText('Esta bodega ya no existe.')).toBeInTheDocument()
    expect(detailMock).not.toHaveBeenCalled()
  })
})
