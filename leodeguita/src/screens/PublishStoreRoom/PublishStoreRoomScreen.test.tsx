import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { AxiosError } from 'axios'
import { AuthProvider } from '../../auth/AuthContext'
import PublishStoreRoomScreen from './PublishStoreRoomScreen'
import { createStoreRoom, uploadStoreRoomPhotos } from '../../services/storeRooms'

vi.mock('../../services/storeRooms', () => ({
  createStoreRoom: vi.fn(),
  uploadStoreRoomPhotos: vi.fn(),
}))

// react-leaflet renders a real map that jsdom cannot lay out; stub it and
// expose the map-click handler so a test can simulate dropping a pin.
const leaflet = vi.hoisted(() => ({
  onMapClick: null as
    | ((e: { latlng: { lat: number; lng: number } }) => void)
    | null,
}))

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="map">{children}</div>
  ),
  TileLayer: () => null,
  Marker: () => <div data-testid="map-marker" />,
  useMap: () => ({ invalidateSize: vi.fn() }),
  useMapEvents: (handlers: {
    click: (e: { latlng: { lat: number; lng: number } }) => void
  }) => {
    leaflet.onMapClick = handlers.click
    return null
  },
}))

vi.mock('leaflet', () => ({ default: { icon: () => ({}) } }))

const createMock = vi.mocked(createStoreRoom)
const uploadMock = vi.mocked(uploadStoreRoomPhotos)

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

function renderScreen() {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/publicar']}>
        <Routes>
          <Route path="/publicar" element={<PublishStoreRoomScreen />} />
          <Route path="/" element={<div>Inicio</div>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  )
}

const next = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole('button', { name: 'Continuar' }))

const jpg = () => new File(['x'], 'foto.jpg', { type: 'image/jpeg' })
const pdf = () => new File(['%PDF-1.4'], 'permiso.pdf', { type: 'application/pdf' })

async function walkToLastStep(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Bodega independiente' }))
  await next(user)
  await user.click(screen.getByRole('button', { name: /Una bodega completa/ }))
  await next(user)
  fireEvent.change(screen.getByLabelText('Agregar fotos'), {
    target: { files: [jpg(), jpg(), jpg()] },
  })
  await next(user)
  await user.type(screen.getByLabelText('Dirección'), 'Km 11.5 Vía a Daule')
  await user.type(screen.getByLabelText('Ciudad'), 'Guayaquil')
  await next(user)
  await user.type(screen.getByLabelText('Título'), 'Bodega Norte')
  await user.type(screen.getByLabelText('Descripción'), 'Espacio amplio y seco')
  await next(user)
  await user.type(screen.getByLabelText('Tarifa mensual (USD)'), '150')
  await user.type(screen.getByLabelText('Tamaño (m²)'), '45')
  await next(user)
  await user.selectOptions(
    screen.getByLabelText('Política de cancelación'),
    'flexible',
  )
  fireEvent.change(screen.getByLabelText(/Permiso del cuerpo de bomberos/), {
    target: { files: [pdf()] },
  })
}

describe('PublishStoreRoomScreen (HUL-03)', () => {
  beforeEach(() => {
    createMock.mockReset()
    uploadMock.mockReset()
    seedSession('landlord')
  })

  it('scenario 1: completes the 7 steps, sends to review and uploads photos', async () => {
    const user = userEvent.setup()
    createMock.mockResolvedValueOnce({
      item: { id: 10, title: 'Bodega Norte', publication_status: 'pending' },
      message: 'Item created successfully',
      status: 201,
    })
    uploadMock.mockResolvedValueOnce()
    renderScreen()

    await walkToLastStep(user)
    await user.click(screen.getByRole('button', { name: 'Enviar a verificación' }))

    expect(
      await screen.findByText('Tu espacio quedó pendiente de verificación'),
    ).toBeInTheDocument()
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        room_type: 'bodega',
        storage_type: 'completa',
        title: 'Bodega Norte',
        city: 'Guayaquil',
        monthly_price: '150',
        size: '45',
      }),
    )
    expect(uploadMock).toHaveBeenCalledWith(10, expect.arrayContaining([expect.any(File)]))
  })

  it('scenario 2: each step gates "Continuar" until its fields are complete', async () => {
    const user = userEvent.setup()
    renderScreen()

    expect(screen.getByRole('button', { name: 'Continuar' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Bodega independiente' }))
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeEnabled()

    await walkToLastStep(user)
    // On the last step the submit only unlocks once permit + policy are set.
    expect(
      screen.getByRole('button', { name: 'Enviar a verificación' }),
    ).toBeEnabled()
    expect(createMock).not.toHaveBeenCalled()
  })

  it('rejects a non-PDF permit before submit and keeps the flow blocked', async () => {
    const user = userEvent.setup()
    renderScreen()

    await walkToLastStep(user)
    // walkToLastStep leaves a valid PDF attached — drop it, then try a JPG.
    await user.click(screen.getByRole('button', { name: 'Quitar permiso' }))
    fireEvent.change(screen.getByLabelText(/Permiso del cuerpo de bomberos/), {
      target: { files: [jpg()] },
    })

    expect(
      await screen.findByText('El permiso debe ser un archivo PDF.'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Enviar a verificación' }),
    ).toBeDisabled()
    expect(createMock).not.toHaveBeenCalled()
  })

  it('photo step stays blocked until at least three photos are added', async () => {
    const user = userEvent.setup()
    renderScreen()

    await user.click(screen.getByRole('button', { name: 'Bodega independiente' }))
    await next(user)
    await user.click(screen.getByRole('button', { name: /Una bodega completa/ }))
    await next(user)

    fireEvent.change(screen.getByLabelText('Agregar fotos'), {
      target: { files: [jpg(), jpg()] },
    })
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeDisabled()

    fireEvent.change(screen.getByLabelText('Agregar fotos'), {
      target: { files: [jpg()] },
    })
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeEnabled()
  })

  it('sends latitude/longitude when the gestor drops a pin on the map', async () => {
    const user = userEvent.setup()
    createMock.mockResolvedValueOnce({
      item: { id: 12, title: 'Bodega Norte', publication_status: 'pending' },
      message: 'ok',
      status: 201,
    })
    uploadMock.mockResolvedValueOnce()
    renderScreen()

    await user.click(screen.getByRole('button', { name: 'Bodega independiente' }))
    await next(user)
    await user.click(screen.getByRole('button', { name: /Una bodega completa/ }))
    await next(user)
    fireEvent.change(screen.getByLabelText('Agregar fotos'), {
      target: { files: [jpg(), jpg(), jpg()] },
    })
    await next(user)

    // Step 3: address plus a map pin.
    await user.type(screen.getByLabelText('Dirección'), 'Km 11.5 Vía a Daule')
    await user.type(screen.getByLabelText('Ciudad'), 'Guayaquil')
    act(() => {
      leaflet.onMapClick?.({ latlng: { lat: -2.15, lng: -79.9 } })
    })
    expect(
      await screen.findByText('Marcado: -2.15000, -79.90000'),
    ).toBeInTheDocument()
    await next(user)

    await user.type(screen.getByLabelText('Título'), 'Bodega Norte')
    await user.type(screen.getByLabelText('Descripción'), 'Espacio amplio y seco')
    await next(user)
    await user.type(screen.getByLabelText('Tarifa mensual (USD)'), '150')
    await user.type(screen.getByLabelText('Tamaño (m²)'), '45')
    await next(user)
    await user.selectOptions(
      screen.getByLabelText('Política de cancelación'),
      'flexible',
    )
    fireEvent.change(screen.getByLabelText(/Permiso del cuerpo de bomberos/), {
      target: { files: [pdf()] },
    })
    await user.click(screen.getByRole('button', { name: 'Enviar a verificación' }))

    await screen.findByText('Tu espacio quedó pendiente de verificación')
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({ latitude: -2.15, longitude: -79.9 }),
    )
  })

  it('scenario 3: a duplicate title sends the gestor back to the title step with the warning', async () => {
    const user = userEvent.setup()
    createMock.mockRejectedValueOnce(
      new AxiosError('bad request', undefined, undefined, undefined, {
        status: 400,
        data: {
          message: 'Validation Error',
          errors: {
            title: [
              'Ya tienes una bodega publicada con ese nombre. Elige otro nombre para continuar.',
            ],
          },
        },
      } as never),
    )
    renderScreen()

    await walkToLastStep(user)
    await user.click(screen.getByRole('button', { name: 'Enviar a verificación' }))

    expect(await screen.findByText('Título y descripción')).toBeInTheDocument()
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Ya tienes una bodega publicada con ese nombre. Elige otro nombre para continuar.',
    )
    expect(uploadMock).not.toHaveBeenCalled()
    expect(
      screen.queryByText('Tu espacio quedó pendiente de verificación'),
    ).toBeNull()
  })

  it('shows a notice when the listing is created but photo upload fails', async () => {
    const user = userEvent.setup()
    createMock.mockResolvedValueOnce({
      item: { id: 11, title: 'Bodega Norte', publication_status: 'pending' },
      message: 'ok',
      status: 201,
    })
    uploadMock.mockRejectedValueOnce(new Error('network'))
    renderScreen()

    await walkToLastStep(user)
    await user.click(screen.getByRole('button', { name: 'Enviar a verificación' }))

    expect(
      await screen.findByText('Tu espacio quedó pendiente de verificación'),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/No pudimos subir las fotos/),
    ).toBeInTheDocument()
  })

  it('blocks a non-landlord from the publish flow', () => {
    seedSession('tenant')
    renderScreen()

    expect(
      screen.getByText(
        'Solo un gestor de almacenamiento puede publicar espacios.',
      ),
    ).toBeInTheDocument()
  })
})
