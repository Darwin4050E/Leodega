import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { AxiosError } from 'axios'
import { AuthProvider } from '../../auth/AuthContext'
import PublishStoreRoomScreen from './PublishStoreRoomScreen'
import {
  getStoreRoomDetail,
  listMyStoreRooms,
  replaceStoreRoomPermit,
  resubmitStoreRoom,
  StoreRoomNotFoundError,
  updateStoreRoom,
  type MyStoreRoom,
  type StoreRoomDetail,
} from '../../services/storeRooms'

vi.mock('../../services/storeRooms', async () => {
  const actual = await vi.importActual<typeof import('../../services/storeRooms')>(
    '../../services/storeRooms',
  )
  return {
    ...actual,
    getStoreRoomDetail: vi.fn(),
    listMyStoreRooms: vi.fn(),
    updateStoreRoom: vi.fn(),
    replaceStoreRoomPermit: vi.fn(),
    resubmitStoreRoom: vi.fn(),
  }
})

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="map">{children}</div>
  ),
  TileLayer: () => null,
  Marker: () => <div data-testid="map-marker" />,
  useMap: () => ({ invalidateSize: vi.fn() }),
  useMapEvents: () => null,
}))
vi.mock('leaflet', () => ({ default: { icon: () => ({}) } }))

const detailMock = vi.mocked(getStoreRoomDetail)
const listMock = vi.mocked(listMyStoreRooms)
const updateMock = vi.mocked(updateStoreRoom)
const permitMock = vi.mocked(replaceStoreRoomPermit)
const resubmitMock = vi.mocked(resubmitStoreRoom)

function seedSession() {
  localStorage.setItem('leodeguita_token', 'tok-123')
  localStorage.setItem(
    'leodeguita_user',
    JSON.stringify({
      id: 1,
      name: 'Johao',
      lastname: 'Dorado',
      email: 'johao@example.com',
      role: 'landlord',
      landlord: { id: 7 },
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
    size: '45.00',
    room_type: 'bodega',
    storage_type: 'completa',
    security: null,
    prices: [{ mode: 'month', price: '150.00', disponibility: 1 }],
    photos: ['https://example.com/a.jpg', 'https://example.com/b.jpg', 'https://example.com/c.jpg'],
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

function renderScreen() {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/mis-bodegas/1/editar']}>
        <Routes>
          <Route path="/mis-bodegas/:id/editar" element={<PublishStoreRoomScreen />} />
          <Route path="/mis-bodegas/:id" element={<div>Detalle de bodega</div>} />
          <Route path="/mis-bodegas" element={<div>Mis bodegas abiertas</div>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  )
}

const next = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole('button', { name: 'Continuar' }))

async function walkTo(user: ReturnType<typeof userEvent.setup>, step: number) {
  for (let i = 0; i < step; i += 1) await next(user)
}

const pdf = () => new File(['%PDF-1.4'], 'permiso.pdf', { type: 'application/pdf' })

describe('PublishStoreRoomScreen in edit mode', () => {
  beforeEach(() => {
    for (const mock of [detailMock, listMock, updateMock, permitMock, resubmitMock]) {
      mock.mockReset()
    }
    seedSession()
    detailMock.mockResolvedValue(detail())
    listMock.mockResolvedValue([mine()])
    updateMock.mockResolvedValue({ message: 'ok', status: 200 })
    permitMock.mockResolvedValue(undefined)
    resubmitMock.mockResolvedValue(undefined)
  })

  it('loads the room and labels the header "Editar · Paso n de 7"', async () => {
    renderScreen()
    expect(await screen.findByText('Editar · Paso 1 de 7')).toBeInTheDocument()
    expect(detailMock).toHaveBeenCalledWith(1)
    expect(listMock).toHaveBeenCalledWith(7)
  })

  it('shows the non-editable steps read-only, letting the gestor move on', async () => {
    const user = userEvent.setup()
    renderScreen()
    await screen.findByText('Editar · Paso 1 de 7')

    expect(screen.getByRole('button', { name: 'Bodega independiente' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeEnabled()

    await walkTo(user, 2)
    expect(screen.getByText('Editar · Paso 3 de 7')).toBeInTheDocument()
    expect(screen.getAllByRole("img")).toHaveLength(3)
    expect(screen.queryByLabelText('Agregar fotos')).not.toBeInTheDocument()

    await next(user)
    expect(screen.getByLabelText('Dirección')).toBeDisabled()
    expect(screen.getByLabelText('Ciudad')).toBeDisabled()
    expect(screen.getByLabelText('Dirección')).toHaveValue('Km 11.5 Vía a Daule')
  })

  it('prefills title, description, price and size', async () => {
    const user = userEvent.setup()
    renderScreen()
    await screen.findByText('Editar · Paso 1 de 7')

    await walkTo(user, 4)
    expect(screen.getByLabelText('Título')).toHaveValue('Bodega Norte')
    expect(screen.getByLabelText('Descripción')).toHaveValue('Espacio amplio y seco')
    await next(user)
    expect(screen.getByLabelText('Tarifa mensual (USD)')).toHaveValue(150)
    expect(screen.getByLabelText('Tamaño (m²)')).toHaveValue(45)
  })

  it('ends with "Guardar y reenviar", the permit optional and no policy/security fields', async () => {
    const user = userEvent.setup()
    renderScreen()
    await screen.findByText('Editar · Paso 1 de 7')

    await walkTo(user, 6)
    expect(screen.getByRole('button', { name: 'Guardar y reenviar' })).toBeEnabled()
    expect(screen.queryByLabelText('Política de cancelación')).not.toBeInTheDocument()
    expect(screen.getByText(/Opcional/)).toBeInTheDocument()
  })

  it('sends only the changed fields and confirms with "Cambios enviados"', async () => {
    updateMock.mockResolvedValueOnce({ message: 'ok', status: 200, requires_review: true })
    const user = userEvent.setup()
    renderScreen()
    await screen.findByText('Editar · Paso 1 de 7')

    await walkTo(user, 4)
    await user.clear(screen.getByLabelText('Título'))
    await user.type(screen.getByLabelText('Título'), 'Bodega Sur')
    await walkTo(user, 2)
    await user.click(screen.getByRole('button', { name: 'Guardar y reenviar' }))

    expect(updateMock).toHaveBeenCalledWith(1, { title: 'Bodega Sur' })
    expect(permitMock).not.toHaveBeenCalled()
    expect(resubmitMock).not.toHaveBeenCalled()
    expect(await screen.findByText('Cambios enviados')).toBeInTheDocument()
    expect(screen.getByText(/pendiente de verificación/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Ir a mis bodegas' }))
    expect(screen.getByText('Mis bodegas abiertas')).toBeInTheDocument()
  })

  it('says the changes were saved when the room did not go back to review', async () => {
    const user = userEvent.setup()
    renderScreen()
    await screen.findByText('Editar · Paso 1 de 7')

    await walkTo(user, 5)
    await user.clear(screen.getByLabelText('Tamaño (m²)'))
    await user.type(screen.getByLabelText('Tamaño (m²)'), '60')
    await next(user)
    await user.click(screen.getByRole('button', { name: 'Guardar y reenviar' }))

    expect(updateMock).toHaveBeenCalledWith(1, { size: 60 })
    expect(await screen.findByText('Cambios enviados')).toBeInTheDocument()
    expect(screen.getByText(/se guardaron/i)).toBeInTheDocument()
    expect(screen.queryByText(/pendiente de verificación/i)).not.toBeInTheDocument()
  })

  it('replaces the permit only when a new one is picked', async () => {
    const user = userEvent.setup()
    renderScreen()
    await screen.findByText('Editar · Paso 1 de 7')

    await walkTo(user, 6)
    const file = pdf()
    fireEvent.change(screen.getByLabelText(/Permiso del cuerpo de bomberos/), {
      target: { files: [file] },
    })
    await user.click(screen.getByRole('button', { name: 'Guardar y reenviar' }))

    expect(permitMock).toHaveBeenCalledWith(1, file)
    expect(updateMock).not.toHaveBeenCalled()
    expect(await screen.findByText(/pendiente de verificación/i)).toBeInTheDocument()
  })

  it('resubmits a rejected room after saving', async () => {
    listMock.mockResolvedValue([
      mine({ publication_status: 'rejected', rejection: { reason_code: 'info', reason: null } }),
    ])
    const user = userEvent.setup()
    renderScreen()
    await screen.findByText('Editar · Paso 1 de 7')

    await walkTo(user, 4)
    await user.type(screen.getByLabelText('Descripción'), ' corregida')
    await walkTo(user, 2)
    await user.click(screen.getByRole('button', { name: 'Guardar y reenviar' }))

    expect(updateMock).toHaveBeenCalledWith(1, { description: 'Espacio amplio y seco corregida' })
    expect(resubmitMock).toHaveBeenCalledWith(1)
    expect(await screen.findByText(/pendiente de verificación/i)).toBeInTheDocument()
  })

  it('resubmits a rejected room even without field changes', async () => {
    listMock.mockResolvedValue([
      mine({ publication_status: 'rejected', rejection: { reason_code: 'fotos', reason: null } }),
    ])
    const user = userEvent.setup()
    renderScreen()
    await screen.findByText('Editar · Paso 1 de 7')

    await walkTo(user, 6)
    await user.click(screen.getByRole('button', { name: 'Guardar y reenviar' }))

    expect(updateMock).not.toHaveBeenCalled()
    expect(resubmitMock).toHaveBeenCalledWith(1)
    expect(await screen.findByText('Cambios enviados')).toBeInTheDocument()
  })

  it('does not call the API when nothing changed on a non-rejected room', async () => {
    const user = userEvent.setup()
    renderScreen()
    await screen.findByText('Editar · Paso 1 de 7')

    await walkTo(user, 6)
    await user.click(screen.getByRole('button', { name: 'Guardar y reenviar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('No hay cambios para guardar.')
    expect(updateMock).not.toHaveBeenCalled()
    expect(resubmitMock).not.toHaveBeenCalled()
  })

  it('sends the gestor back to the offending step on a 422', async () => {
    updateMock.mockRejectedValueOnce(
      new AxiosError('unprocessable', undefined, undefined, undefined, {
        status: 422,
        data: {
          message: 'Validation Error',
          errors: { title: ['Ya tienes una bodega publicada con ese nombre. Elige otro nombre para continuar.'] },
        },
      } as never),
    )
    const user = userEvent.setup()
    renderScreen()
    await screen.findByText('Editar · Paso 1 de 7')

    await walkTo(user, 4)
    await user.clear(screen.getByLabelText('Título'))
    await user.type(screen.getByLabelText('Título'), 'Repetida')
    await walkTo(user, 2)
    await user.click(screen.getByRole('button', { name: 'Guardar y reenviar' }))

    expect(await screen.findByText('Editar · Paso 5 de 7')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Ya tienes una bodega publicada')
  })

  it('shows the backend message for other failures and stays on the last step', async () => {
    resubmitMock.mockRejectedValueOnce(
      new AxiosError('conflict', undefined, undefined, undefined, {
        status: 409,
        data: { message: 'La bodega no está rechazada.' },
      } as never),
    )
    listMock.mockResolvedValue([mine({ publication_status: 'rejected' })])
    const user = userEvent.setup()
    renderScreen()
    await screen.findByText('Editar · Paso 1 de 7')

    await walkTo(user, 6)
    await user.click(screen.getByRole('button', { name: 'Guardar y reenviar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('La bodega no está rechazada.')
    expect(screen.getByText('Editar · Paso 7 de 7')).toBeInTheDocument()
  })

  it('goes back to the detail from the first step', async () => {
    const user = userEvent.setup()
    renderScreen()
    await screen.findByText('Editar · Paso 1 de 7')

    await user.click(screen.getByRole('button', { name: 'Volver' }))
    expect(screen.getByText('Detalle de bodega')).toBeInTheDocument()
  })

  it('shows not-found, and an error whose "Reintentar" reloads', async () => {
    detailMock.mockRejectedValueOnce(new StoreRoomNotFoundError(1))
    const first = renderScreen()
    expect(await screen.findByText('Esta bodega ya no existe.')).toBeInTheDocument()
    first.unmount()

    detailMock.mockRejectedValueOnce(new Error('network'))
    const user = userEvent.setup()
    renderScreen()
    await user.click(await screen.findByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText('Editar · Paso 1 de 7')).toBeInTheDocument()
  })

  it('treats a room outside the gestor\'s own list as not found', async () => {
    listMock.mockResolvedValue([mine({ id: 99 })])
    renderScreen()
    expect(await screen.findByText('Esta bodega ya no existe.')).toBeInTheDocument()
  })
})
