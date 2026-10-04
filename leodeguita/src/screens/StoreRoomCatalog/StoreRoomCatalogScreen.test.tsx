import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '../../auth/AuthContext'
import StoreRoomCatalogScreen from './StoreRoomCatalogScreen'
import { listStoreRooms, type CatalogStoreRoom } from '../../services/storeRooms'

vi.mock('../../services/storeRooms', () => ({
  listStoreRooms: vi.fn(),
}))

const listMock = vi.mocked(listStoreRooms)

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

function room(overrides: Partial<CatalogStoreRoom> = {}): CatalogStoreRoom {
  return {
    id: 1,
    title: 'Bodega Norte',
    city: 'Guayaquil',
    size: 45,
    room_type: 'bodega',
    monthly_price: 150,
    rating_avg: 4.5,
    image: null,
    ...overrides,
  }
}

function renderScreen(
  initialEntries: ({ pathname: string; state?: unknown } | string)[] = [
    '/bodegas',
  ],
) {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route path="/bodegas" element={<StoreRoomCatalogScreen />} />
          <Route path="/bodegas/:id" element={<div>Detalle</div>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  )
}

describe('StoreRoomCatalogScreen', () => {
  beforeEach(() => {
    listMock.mockReset()
    seedSession()
  })

  it('renders one card per approved room', async () => {
    listMock.mockResolvedValueOnce([
      room(),
      room({ id: 2, title: 'Bodega Sur' }),
    ])
    renderScreen()

    expect(await screen.findByText('Bodega Norte')).toBeInTheDocument()
    expect(screen.getByText('Bodega Sur')).toBeInTheDocument()
  })

  it('shows an empty state when there are no rooms', async () => {
    listMock.mockResolvedValueOnce([])
    renderScreen()

    expect(
      await screen.findByText('No hay espacios disponibles por ahora.'),
    ).toBeInTheDocument()
  })

  it('shows an error state whose "Reintentar" refetches', async () => {
    listMock.mockRejectedValueOnce(new Error('network'))
    const user = userEvent.setup()
    renderScreen()

    const retry = await screen.findByRole('button', { name: 'Reintentar' })
    listMock.mockResolvedValueOnce([room({ title: 'Recuperada' })])
    await user.click(retry)

    await waitFor(() =>
      expect(screen.getByText('Recuperada')).toBeInTheDocument(),
    )
    expect(listMock).toHaveBeenCalledTimes(2)
  })

  it('navigates to the detail screen when a card is opened', async () => {
    listMock.mockResolvedValueOnce([room()])
    const user = userEvent.setup()
    renderScreen()

    await user.click(
      await screen.findByRole('button', { name: /Ver detalle/ }),
    )
    expect(await screen.findByText('Detalle')).toBeInTheDocument()
  })

  it('excludes a room flagged unavailable via navigation state (AC3)', async () => {
    listMock.mockResolvedValueOnce([
      room({ id: 1, title: 'Bodega Norte' }),
      room({ id: 2, title: 'Bodega Sur' }),
    ])
    renderScreen([{ pathname: '/bodegas', state: { unavailableId: 1 } }])

    expect(await screen.findByText('Bodega Sur')).toBeInTheDocument()
    expect(screen.queryByText('Bodega Norte')).not.toBeInTheDocument()
  })
})
