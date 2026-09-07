import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '../../auth/AuthContext'
import MyStoreRoomsScreen from './MyStoreRoomsScreen'
import { listMyStoreRooms, type MyStoreRoom } from '../../services/storeRooms'

vi.mock('../../services/storeRooms', () => ({
  listMyStoreRooms: vi.fn(),
}))

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

function room(overrides: Partial<MyStoreRoom> = {}): MyStoreRoom {
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
    ...overrides,
  }
}

function renderScreen() {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/mis-bodegas']}>
        <Routes>
          <Route path="/mis-bodegas" element={<MyStoreRoomsScreen />} />
          <Route path="/" element={<div>Inicio</div>} />
          <Route path="/publicar" element={<div>Publicar</div>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  )
}

describe('MyStoreRoomsScreen (HUL-04)', () => {
  beforeEach(() => {
    listMock.mockReset()
    seedSession('landlord')
  })

  it('AC-1: renders one card per owned room with title, location and status', async () => {
    listMock.mockResolvedValueOnce([room()])
    renderScreen()

    expect(await screen.findByText('Bodega Norte')).toBeInTheDocument()
    expect(
      screen.getByText('Km 11.5 Vía a Daule · Guayaquil'),
    ).toBeInTheDocument()
    expect(screen.getByText('Disponible')).toBeInTheDocument()
    expect(listMock).toHaveBeenCalledWith(7)
  })

  it('AC-2: an empty result shows the publish CTA and hides the filter row', async () => {
    listMock.mockResolvedValueOnce([])
    const user = userEvent.setup()
    renderScreen()

    expect(
      await screen.findByText('Aún no has publicado ninguna bodega.'),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /^Todas/ }),
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Publicar una nueva' }))
    expect(screen.getByText('Publicar')).toBeInTheDocument()
  })

  it('AC-2: a residual 404 swallowed to [] lands on the same empty state', async () => {
    listMock.mockResolvedValueOnce([])
    renderScreen()

    expect(
      await screen.findByText('Aún no has publicado ninguna bodega.'),
    ).toBeInTheDocument()
    expect(screen.queryByText(/No pudimos cargar/)).not.toBeInTheDocument()
  })

  it('AC-3: status chips carry counts and narrow the list', async () => {
    listMock.mockResolvedValueOnce([
      room({ id: 1, title: 'Libre A', active_reservations_count: 0 }),
      room({ id: 2, title: 'Libre B', active_reservations_count: 0 }),
      room({ id: 3, title: 'Ocupada C', active_reservations_count: 2 }),
      room({ id: 4, title: 'Rechazada D', publication_status: 'rejected' }),
    ])
    const user = userEvent.setup()
    renderScreen()

    expect(await screen.findByText('Libre A')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Todas (4)' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Disponibles (2)' }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Ocupadas (1)' }))
    expect(screen.getByText('Ocupada C')).toBeInTheDocument()
    expect(screen.queryByText('Libre A')).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Ocupadas (1)' }),
    ).toHaveAttribute('aria-pressed', 'true')

    await user.click(screen.getByRole('button', { name: 'Todas (4)' }))
    expect(screen.getByText('Libre A')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Pendientes (0)' }))
    expect(
      screen.getByText('Ninguna bodega coincide con este filtro.'),
    ).toBeInTheDocument()
    expect(
      screen.queryByText('Aún no has publicado ninguna bodega.'),
    ).not.toBeInTheDocument()
  })

  it('blocks a non-landlord and never calls the service', () => {
    seedSession('tenant')
    renderScreen()

    expect(
      screen.getByText(
        'Solo un gestor de almacenamiento puede ver sus bodegas.',
      ),
    ).toBeInTheDocument()
    expect(listMock).not.toHaveBeenCalled()
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
})
