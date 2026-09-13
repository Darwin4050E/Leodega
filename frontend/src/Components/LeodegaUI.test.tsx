import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockGetStoreRoomDetail = vi.hoisted(() => vi.fn());
const mockGetReservedDates = vi.hoisted(() => vi.fn());
const mockCreateReservation = vi.hoisted(() => vi.fn());
const mockUseAuth = vi.hoisted(() => vi.fn());
const mockAlert = vi.hoisted(() => vi.fn());
const mockNavigate = vi.hoisted(() => vi.fn());

vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: '7' }),
  useNavigate: () => mockNavigate,
}));

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="map-container">{children}</div>
  ),
  TileLayer: () => null,
  Marker: () => null,
}));

vi.mock('leaflet', () => ({
  default: { Icon: class {} },
}));

vi.mock('../services/storeRooms', () => ({
  getStoreRoomDetail: mockGetStoreRoomDetail,
}));

vi.mock('../services/reservations', () => ({
  getReservedDates: mockGetReservedDates,
  createReservation: mockCreateReservation,
}));

vi.mock('../context/useAuth', () => ({
  useAuth: mockUseAuth,
}));

import LeodegaUI from './LeodegaUI';

const storeRoomDetail = {
  title: 'Bodega Norte',
  description: 'Amplia bodega',
  direction: 'Av. Siempre Viva 123',
  city: 'Quito',
  size: 20,
  room_type: 'individual',
  photos: [],
  prices: [{ price: 150 }],
  landlord: { id: 1, user_id: 2, name: 'Laura', lastname: 'Gomez', email: 'laura@example.com' },
  latitude: -2.118,
  longitude: -79.955,
  rating_avg: 4.2,
  rating_count: 8,
  is_available_now: true,
};

describe('LeodegaUI booking payload and total display', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('alert', mockAlert);
    mockUseAuth.mockReturnValue({ user: { role: 'tenant' } });
    mockGetStoreRoomDetail.mockResolvedValue({ data: storeRoomDetail });
    mockGetReservedDates.mockResolvedValue({ data: [] });
  });

  it('sends the booking payload WITHOUT total_mount and shows the server-computed total', async () => {
    mockCreateReservation.mockResolvedValue({
      data: { message: 'Solicitud enviada', reservation: { id: 1, total_mount: '4180.00' } },
    });

    render(<LeodegaUI />);

    await waitFor(() => screen.getByText('Bodega Norte'));

    fireEvent.click(screen.getByRole('button', { name: 'Reservar' }));

    await waitFor(() => expect(screen.queryByText('Cargando disponibilidad...')).not.toBeInTheDocument());

    const dateInputs = screen.getAllByDisplayValue('');
    fireEvent.change(dateInputs[0], { target: { value: '2030-01-10' } });
    fireEvent.change(dateInputs[1], { target: { value: '2030-02-10' } });

    const submitButtons = screen.getAllByRole('button', { name: 'Enviar solicitud' });
    fireEvent.click(submitButtons[submitButtons.length - 1]);

    await waitFor(() => expect(mockCreateReservation).toHaveBeenCalledTimes(1));

    const [payload] = mockCreateReservation.mock.calls[0];
    expect(payload).toEqual({
      store_room_id: 7,
      start_date: '2030-01-10',
      end_date: '2030-02-10',
    });
    expect(payload.total_mount).toBeUndefined();

    await waitFor(() =>
      expect(mockAlert).toHaveBeenCalledWith('Solicitud enviada. Total: $4,180 USD')
    );
  });

  it('falls back to a plain success message when the server omits the total', async () => {
    mockCreateReservation.mockResolvedValue({
      data: { message: 'Solicitud enviada', reservation: { id: 1 } },
    });

    render(<LeodegaUI />);
    await waitFor(() => screen.getByText('Bodega Norte'));

    fireEvent.click(screen.getByRole('button', { name: 'Reservar' }));

    await waitFor(() => expect(screen.queryByText('Cargando disponibilidad...')).not.toBeInTheDocument());

    const dateInputs = screen.getAllByDisplayValue('');
    fireEvent.change(dateInputs[0], { target: { value: '2030-01-10' } });
    fireEvent.change(dateInputs[1], { target: { value: '2030-02-10' } });

    const submitButtons = screen.getAllByRole('button', { name: 'Enviar solicitud' });
    fireEvent.click(submitButtons[submitButtons.length - 1]);

    await waitFor(() => expect(mockAlert).toHaveBeenCalledWith('Solicitud enviada'));
  });
});

describe('LeodegaUI availability badge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: { role: 'tenant' } });
    mockGetReservedDates.mockResolvedValue({ data: [] });
  });

  it('shows "Ocupada ahora" while keeping the date picker and Reservar button active', async () => {
    mockGetStoreRoomDetail.mockResolvedValue({
      data: { ...storeRoomDetail, is_available_now: false },
    });

    render(<LeodegaUI />);
    await waitFor(() => screen.getByText('Bodega Norte'));

    expect(screen.getByText('Ocupada ahora')).toBeInTheDocument();

    const reservarButton = screen.getByRole('button', { name: 'Reservar' });
    expect(reservarButton).not.toBeDisabled();

    fireEvent.click(reservarButton);
    await waitFor(() => expect(screen.queryByText('Cargando disponibilidad...')).not.toBeInTheDocument());

    const dateInputs = screen.getAllByDisplayValue('') as HTMLInputElement[];
    expect(dateInputs[0]).not.toBeDisabled();
    expect(dateInputs[1]).not.toBeDisabled();

    const submitButtons = screen.getAllByRole('button', { name: 'Enviar solicitud' });
    expect(submitButtons[submitButtons.length - 1]).not.toBeDisabled();
  });

  it('shows "Disponible ahora" when is_available_now is true', async () => {
    mockGetStoreRoomDetail.mockResolvedValue({
      data: { ...storeRoomDetail, is_available_now: true },
    });

    render(<LeodegaUI />);
    await waitFor(() => screen.getByText('Bodega Norte'));

    expect(screen.getByText('Disponible ahora')).toBeInTheDocument();
    expect(screen.queryByText('Ocupada ahora')).not.toBeInTheDocument();
  });
});

describe('LeodegaUI rating display', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: { role: 'tenant' } });
    mockGetReservedDates.mockResolvedValue({ data: [] });
  });

  it('renders 4 filled stars and (8) for a 4.2 average', async () => {
    mockGetStoreRoomDetail.mockResolvedValue({ data: storeRoomDetail });

    const { container } = render(<LeodegaUI />);
    await waitFor(() => screen.getByText('Bodega Norte'));

    expect(container.querySelectorAll('.fill-current')).toHaveLength(4);
    expect(screen.getByText('(8)')).toBeInTheDocument();
  });

  it('renders 0 filled stars and (0) for a zero-rating room', async () => {
    mockGetStoreRoomDetail.mockResolvedValue({
      data: { ...storeRoomDetail, rating_avg: 0, rating_count: 0 },
    });

    const { container } = render(<LeodegaUI />);
    await waitFor(() => screen.getByText('Bodega Norte'));

    expect(container.querySelectorAll('.fill-current')).toHaveLength(0);
    expect(screen.getByText('(0)')).toBeInTheDocument();
  });
});

describe('LeodegaUI location', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: { role: 'tenant' } });
    mockGetReservedDates.mockResolvedValue({ data: [] });
  });

  it('renders the map when coordinates are present', async () => {
    mockGetStoreRoomDetail.mockResolvedValue({ data: storeRoomDetail });

    render(<LeodegaUI />);
    await waitFor(() => screen.getByText('Bodega Norte'));

    expect(screen.getByTestId('map-container')).toBeInTheDocument();
    expect(screen.getByText(/Av\. Siempre Viva 123/)).toBeInTheDocument();
  });

  it('renders no map and shows the address as plain text when coordinates are null', async () => {
    mockGetStoreRoomDetail.mockResolvedValue({
      data: { ...storeRoomDetail, latitude: null, longitude: null },
    });

    render(<LeodegaUI />);
    await waitFor(() => screen.getByText('Bodega Norte'));

    expect(screen.queryByTestId('map-container')).not.toBeInTheDocument();
    expect(screen.getByText(/Av\. Siempre Viva 123/)).toBeInTheDocument();
  });
});

describe('LeodegaUI not-found and error states', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the not-found copy on a 404 response', async () => {
    mockUseAuth.mockReturnValue({ user: { role: 'tenant' } });
    mockGetStoreRoomDetail.mockRejectedValue({ response: { status: 404 } });

    render(<LeodegaUI />);

    await waitFor(() =>
      expect(
        screen.getByText('Esta bodega no existe o ya no está disponible')
      ).toBeInTheDocument()
    );
  });

  it('renders a distinct copy for a non-404 failure', async () => {
    mockUseAuth.mockReturnValue({ user: { role: 'tenant' } });
    mockGetStoreRoomDetail.mockRejectedValue({ response: { status: 500 } });

    render(<LeodegaUI />);

    await waitFor(() =>
      expect(
        screen.getByText(
          'No se pudo cargar la información de esta bodega. Verifica tu conexión e inténtalo de nuevo.'
        )
      ).toBeInTheDocument()
    );

    expect(
      screen.queryByText('Esta bodega no existe o ya no está disponible')
    ).not.toBeInTheDocument();
  });

  it('sends a landlord back to /arrendador/bodegas from the error state', async () => {
    mockUseAuth.mockReturnValue({ user: { role: 'landlord' } });
    mockGetStoreRoomDetail.mockRejectedValue({ response: { status: 404 } });

    render(<LeodegaUI />);
    await waitFor(() => screen.getByRole('button', { name: /volver/i }));

    fireEvent.click(screen.getByRole('button', { name: /volver/i }));

    expect(mockNavigate).toHaveBeenCalledWith('/arrendador/bodegas');
  });

  it('sends a tenant back to /storage from the error state', async () => {
    mockUseAuth.mockReturnValue({ user: { role: 'tenant' } });
    mockGetStoreRoomDetail.mockRejectedValue({ response: { status: 404 } });

    render(<LeodegaUI />);
    await waitFor(() => screen.getByRole('button', { name: /volver/i }));

    fireEvent.click(screen.getByRole('button', { name: /volver/i }));

    expect(mockNavigate).toHaveBeenCalledWith('/storage');
  });

  it('sends an unauthenticated user back to /login from the error state', async () => {
    mockUseAuth.mockReturnValue({ user: null });
    mockGetStoreRoomDetail.mockRejectedValue({ response: { status: 404 } });

    render(<LeodegaUI />);
    await waitFor(() => screen.getByRole('button', { name: /volver/i }));

    fireEvent.click(screen.getByRole('button', { name: /volver/i }));

    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });
});
