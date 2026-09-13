import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ReactNode } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '../../auth/AuthContext'
import StoreRoomDetailScreen from './StoreRoomDetailScreen'
import {
  getStoreRoomDetail,
  StoreRoomNotFoundError,
  type StoreRoomDetail,
} from '../../services/storeRooms'

vi.mock('../../services/storeRooms', async () => {
  const actual = await vi.importActual<typeof import('../../services/storeRooms')>(
    '../../services/storeRooms',
  )
  return { ...actual, getStoreRoomDetail: vi.fn() }
})

// react-leaflet renders a real map jsdom cannot lay out; stub it exactly as
// `PublishStoreRoomScreen.test.tsx` already does.
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: ReactNode }) => (
    <div data-testid="map">{children}</div>
  ),
  TileLayer: () => null,
  Marker: () => <div data-testid="map-marker" />,
}))

vi.mock('leaflet', () => ({ default: { icon: () => ({}) } }))

const getMock = vi.mocked(getStoreRoomDetail)

function seedSession() {
  localStorage.setItem('leodeguita_token', 'tok-123')
  localStorage.setItem(
    'leodeguita_user',
    JSON.stringify({
      id: 1,
      name: 'Maria',
      lastname: 'Lopez',
      email: 'maria@example.com',
      role: 'tenant',
      landlord: null,
    }),
  )
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
    landlord: {
      id: 1,
      user_id: 2,
      name: 'Roberto Andrade',
      email: 'roberto@leodega.com',
      phone: '0991234567',
    },
    latitude: -2.15,
    longitude: -79.9,
    rating_avg: 4.5,
    rating_count: 12,
    active_reservations_count: 0,
    is_available_now: true,
    ...overrides,
  }
}

function renderScreen() {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/bodegas/1']}>
        <Routes>
          <Route path="/bodegas/:id" element={<StoreRoomDetailScreen />} />
          <Route path="/bodegas" element={<div>Catálogo</div>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  )
}

describe('StoreRoomDetailScreen', () => {
  beforeEach(() => {
    getMock.mockReset()
    seedSession()
  })

  it('renders the full profile including the gestor phone (AC1)', async () => {
    getMock.mockResolvedValueOnce(detail())
    renderScreen()

    expect(await screen.findByText('Bodega Norte')).toBeInTheDocument()
    expect(screen.getByText('Espacio amplio y seco')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '0991234567' })).toHaveAttribute(
      'href',
      'tel:0991234567',
    )
    expect(
      screen.getByRole('link', { name: 'roberto@leodega.com' }),
    ).toHaveAttribute('href', 'mailto:roberto@leodega.com')
    expect(screen.getByText('$150 /mes')).toBeInTheDocument()
    expect(screen.getByTestId('map')).toBeInTheDocument()
  })

  it('omits photos, prices, security, and the map when those fields are empty (AC2)', async () => {
    getMock.mockResolvedValueOnce(
      detail({
        photos: [],
        prices: [],
        security: null,
        latitude: null,
        longitude: null,
      }),
    )
    renderScreen()

    expect(await screen.findByText('Bodega Norte')).toBeInTheDocument()
    expect(screen.getByText('Sin foto')).toBeInTheDocument()
    expect(screen.getByText('Precio no publicado')).toBeInTheDocument()
    expect(screen.queryByText('Seguridad')).not.toBeInTheDocument()
    expect(screen.queryByTestId('map')).not.toBeInTheDocument()
  })

  it('shows an amber unavailability banner when the room is no longer available', async () => {
    getMock.mockResolvedValueOnce(detail({ is_available_now: false }))
    renderScreen()

    expect(
      await screen.findByText('Este espacio ya no está disponible.'),
    ).toBeInTheDocument()
    expect(screen.getByText('No disponible')).toBeInTheDocument()
  })

  it('shows a not-found state distinct from the unavailability notice', async () => {
    getMock.mockRejectedValueOnce(new StoreRoomNotFoundError(1))
    renderScreen()

    expect(
      await screen.findByText('Este espacio ya no existe.'),
    ).toBeInTheDocument()
    expect(
      screen.queryByText('Este espacio ya no está disponible.'),
    ).not.toBeInTheDocument()
  })

  it('shows an error state whose "Reintentar" refetches', async () => {
    getMock.mockRejectedValueOnce(new Error('network'))
    const user = userEvent.setup()
    renderScreen()

    const retry = await screen.findByRole('button', { name: 'Reintentar' })
    getMock.mockResolvedValueOnce(detail())
    await user.click(retry)

    await waitFor(() =>
      expect(screen.getByText('Bodega Norte')).toBeInTheDocument(),
    )
    expect(getMock).toHaveBeenCalledTimes(2)
  })

  it('propagates the unavailable id back to the catalog on back navigation (AC3)', async () => {
    getMock.mockResolvedValueOnce(detail({ is_available_now: false }))
    const user = userEvent.setup()
    renderScreen()

    await screen.findByText('Bodega Norte')
    await user.click(screen.getByRole('button', { name: 'Volver' }))
    expect(await screen.findByText('Catálogo')).toBeInTheDocument()
  })
})
