import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockGetStoreRoomDetail = vi.hoisted(() => vi.fn());
const mockGetStoreRoomQuote = vi.hoisted(() => vi.fn());
const mockGetReservedDates = vi.hoisted(() => vi.fn());
const mockCreateReservation = vi.hoisted(() => vi.fn());
const mockCreatePayment = vi.hoisted(() => vi.fn());
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
  getStoreRoomQuote: mockGetStoreRoomQuote,
}));

vi.mock('../services/reservations', () => ({
  getReservedDates: mockGetReservedDates,
  createReservation: mockCreateReservation,
  createPayment: mockCreatePayment,
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

describe('LeodegaUI checkout step flow (replaces the dead-end alert())', () => {
  const createdReservation = {
    id: 42,
    start_date: '2030-01-10',
    end_date: '2030-04-10',
    total_mount: '4180.00',
    rent_subtotal: '3800.00',
  };

  async function openReserveAndSubmit() {
    render(<LeodegaUI />);
    await waitFor(() => screen.getByText('Bodega Norte'));

    fireEvent.click(screen.getByRole('button', { name: 'Reservar' }));
    await waitFor(() => expect(screen.queryByText('Cargando disponibilidad...')).not.toBeInTheDocument());

    const dateInputs = screen.getAllByDisplayValue('');
    fireEvent.change(dateInputs[0], { target: { value: '2030-01-10' } });
    fireEvent.change(dateInputs[1], { target: { value: '2030-02-10' } });

    const submitButtons = screen.getAllByRole('button', { name: 'Enviar solicitud' });
    fireEvent.click(submitButtons[submitButtons.length - 1]);
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('alert', mockAlert);
    mockUseAuth.mockReturnValue({ user: { role: 'tenant' } });
    mockGetStoreRoomDetail.mockResolvedValue({ data: storeRoomDetail });
    mockGetReservedDates.mockResolvedValue({ data: [] });
    mockGetStoreRoomQuote.mockResolvedValue({
      data: { rent_subtotal: '450.00', service_fee: '27.00', deposit: '0.00', total_mount: '450.00' },
    });
  });

  it('on successful createReservation(), never calls alert() and transitions to the pago step carrying the reservation', async () => {
    mockCreateReservation.mockResolvedValue({ data: { message: 'ok', reservation: createdReservation } });

    // Step header must not render at 'detail'.
    render(<LeodegaUI />);
    await waitFor(() => screen.getByText('Bodega Norte'));
    expect(screen.queryByText('Comprobante')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Reservar' }));
    await waitFor(() => expect(screen.queryByText('Cargando disponibilidad...')).not.toBeInTheDocument());

    const dateInputs = screen.getAllByDisplayValue('');
    fireEvent.change(dateInputs[0], { target: { value: '2030-01-10' } });
    fireEvent.change(dateInputs[1], { target: { value: '2030-02-10' } });

    const submitButtons = screen.getAllByRole('button', { name: 'Enviar solicitud' });
    fireEvent.click(submitButtons[submitButtons.length - 1]);

    await waitFor(() => expect(mockCreateReservation).toHaveBeenCalledTimes(1));

    expect(mockAlert).not.toHaveBeenCalled();

    // BookingStepHeader now renders (step === 'pago') with "Pago" current.
    await waitFor(() => expect(screen.getByText('Comprobante')).toBeInTheDocument());
    // BookingCheckout renders too — its CTA is a decisive signal.
    expect(screen.getByRole('button', { name: /Confirmar y pagar/ })).toBeInTheDocument();
  });

  it('on successful createPayment() from BookingCheckout, advances to comprobante with the same reservation', async () => {
    mockCreateReservation.mockResolvedValue({ data: { message: 'ok', reservation: createdReservation } });
    mockCreatePayment.mockResolvedValue({ data: { message: 'ok', payment: { id: 1 } } });

    await openReserveAndSubmit();
    await waitFor(() => expect(screen.getByRole('button', { name: /Confirmar y pagar/ })).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Número de tarjeta'), { target: { value: '4242 4242 4242 4242' } });
    fireEvent.change(screen.getByLabelText('Titular de la tarjeta'), { target: { value: 'María López' } });
    fireEvent.change(screen.getByLabelText('Vencimiento'), { target: { value: '1225' } });
    fireEvent.change(screen.getByLabelText('CVV'), { target: { value: '123' } });

    fireEvent.click(screen.getByRole('button', { name: /Confirmar y pagar/ }));

    await waitFor(() => expect(mockCreatePayment).toHaveBeenCalledTimes(1));
    expect(mockCreatePayment.mock.calls[0][0]).toMatchObject({ reservation_id: 42 });

    // Payment step machine state moved past 'pago': the checkout CTA is gone.
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /Confirmar y pagar/ })).not.toBeInTheDocument()
    );
  });

  it('calls createReservation exactly once across a payment-failure-then-retry cycle (no duplicate reservation)', async () => {
    mockCreateReservation.mockResolvedValue({ data: { message: 'ok', reservation: createdReservation } });
    mockCreatePayment.mockRejectedValueOnce({ response: { status: 500 } });
    mockCreatePayment.mockResolvedValueOnce({ data: { message: 'ok', payment: { id: 1 } } });

    await openReserveAndSubmit();
    await waitFor(() => expect(screen.getByRole('button', { name: /Confirmar y pagar/ })).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Número de tarjeta'), { target: { value: '4242 4242 4242 4242' } });
    fireEvent.change(screen.getByLabelText('Titular de la tarjeta'), { target: { value: 'María López' } });
    fireEvent.change(screen.getByLabelText('Vencimiento'), { target: { value: '1225' } });
    fireEvent.change(screen.getByLabelText('CVV'), { target: { value: '123' } });

    const payButton = () => screen.getByRole('button', { name: /Confirmar y pagar/ });
    fireEvent.click(payButton());

    await waitFor(() => expect(mockCreatePayment).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(payButton()).not.toBeDisabled());

    fireEvent.click(payButton());

    await waitFor(() => expect(mockCreatePayment).toHaveBeenCalledTimes(2));
    expect(mockCreateReservation).toHaveBeenCalledTimes(1);
  });

  it('renders BookingReceipt at comprobante with the correct storeRoom/reservation and completed step header', async () => {
    mockCreateReservation.mockResolvedValue({ data: { message: 'ok', reservation: createdReservation } });
    mockCreatePayment.mockResolvedValue({ data: { message: 'ok', payment: { id: 1 } } });

    await openReserveAndSubmit();
    await waitFor(() => expect(screen.getByRole('button', { name: /Confirmar y pagar/ })).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Número de tarjeta'), { target: { value: '4242 4242 4242 4242' } });
    fireEvent.change(screen.getByLabelText('Titular de la tarjeta'), { target: { value: 'María López' } });
    fireEvent.change(screen.getByLabelText('Vencimiento'), { target: { value: '1225' } });
    fireEvent.change(screen.getByLabelText('CVV'), { target: { value: '123' } });

    fireEvent.click(screen.getByRole('button', { name: /Confirmar y pagar/ }));

    await waitFor(() => expect(screen.getByText('LEO-000042')).toBeInTheDocument());
    // Step header still renders at comprobante, with "Detalle" and "Pago" completed.
    expect(screen.getAllByText('✓')).toHaveLength(2);
  });

  it('clicking "Salir" from BookingStepHeader while at pago returns to detail', async () => {
    mockCreateReservation.mockResolvedValue({ data: { message: 'ok', reservation: createdReservation } });

    await openReserveAndSubmit();
    await waitFor(() => expect(screen.getByRole('button', { name: /Confirmar y pagar/ })).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Salir' }));

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /Confirmar y pagar/ })).not.toBeInTheDocument()
    );
    expect(screen.getByRole('button', { name: 'Reservar' })).toBeInTheDocument();
  });
});

describe('LeodegaUI availability badge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: { role: 'tenant' } });
    mockGetReservedDates.mockResolvedValue({ data: [] });
    mockGetStoreRoomQuote.mockResolvedValue({
      data: { rent_subtotal: '450.00', service_fee: '27.00', deposit: '0.00', total_mount: '450.00' },
    });
  });

  it('keeps exactly 2 empty-value inputs after the price panel renders (regression guard: a new <input> would shift the date-input indices)', async () => {
    mockGetStoreRoomDetail.mockResolvedValue({ data: storeRoomDetail });

    render(<LeodegaUI />);
    await waitFor(() => screen.getByText('Bodega Norte'));
    await waitFor(() => expect(screen.getByText('Total')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Reservar' }));
    await waitFor(() => expect(screen.queryByText('Cargando disponibilidad...')).not.toBeInTheDocument());

    expect(screen.getAllByDisplayValue('')).toHaveLength(2);
  });

  it('shows "Ocupada ahora" while keeping the date picker and Reservar button active, AND still renders the populated inline calendar', async () => {
    mockGetStoreRoomDetail.mockResolvedValue({
      data: { ...storeRoomDetail, is_available_now: false },
    });
    const today = new Date();
    const occupiedISO = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
    mockGetReservedDates.mockResolvedValue({
      data: [{ start_date: occupiedISO, end_date: occupiedISO }],
    });

    render(<LeodegaUI />);
    await waitFor(() => screen.getByText('Bodega Norte'));

    expect(screen.getByText('Ocupada ahora')).toBeInTheDocument();

    const reservarButton = screen.getByRole('button', { name: 'Reservar' });
    expect(reservarButton).not.toBeDisabled();

    fireEvent.click(reservarButton);
    await waitFor(() => expect(screen.queryAllByText('Cargando disponibilidad...')).toHaveLength(0));

    const dateInputs = screen.getAllByDisplayValue('') as HTMLInputElement[];
    expect(dateInputs[0]).not.toBeDisabled();
    expect(dateInputs[1]).not.toBeDisabled();

    const submitButtons = screen.getAllByRole('button', { name: 'Enviar solicitud' });
    expect(submitButtons[submitButtons.length - 1]).not.toBeDisabled();

    // Decisive assertion: the inline "Disponibilidad" calendar renders AND is
    // populated from `reservedRanges` regardless of `is_available_now`.
    expect(screen.getByRole('heading', { name: 'Disponibilidad' })).toBeInTheDocument();
    await waitFor(() => {
      const occupiedDay = screen.getAllByRole('button').find((btn) => btn.disabled);
      expect(occupiedDay).toBeDefined();
    });
  });

  it('shows no loading message in the modal when the shared fetch already resolved before opening it', async () => {
    mockGetStoreRoomDetail.mockResolvedValue({ data: storeRoomDetail });
    mockGetReservedDates.mockResolvedValue({ data: [] });

    render(<LeodegaUI />);
    await waitFor(() => screen.getByText('Bodega Norte'));
    // Let the shared reserved-dates fetch settle before the modal opens.
    await waitFor(() => expect(mockGetReservedDates).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('button', { name: 'Reservar' }));

    expect(screen.queryByText('Cargando disponibilidad...')).not.toBeInTheDocument();
  });

  it('still shows "Cargando disponibilidad..." in the modal when opened before the shared fetch settles', async () => {
    mockGetStoreRoomDetail.mockResolvedValue({ data: storeRoomDetail });
    let resolveFetch: (value: { data: never[] }) => void = () => {};
    mockGetReservedDates.mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve;
      })
    );

    render(<LeodegaUI />);
    await waitFor(() => screen.getByText('Bodega Norte'));

    // Before opening the modal, the inline calendar alone shows the loading copy.
    expect(screen.getAllByText('Cargando disponibilidad...')).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Reservar' }));

    // With the modal open too, both surfaces show it while the fetch is in flight.
    expect(screen.getAllByText('Cargando disponibilidad...')).toHaveLength(2);

    resolveFetch({ data: [] });
    await waitFor(() => expect(screen.queryAllByText('Cargando disponibilidad...')).toHaveLength(0));
  });

  it('renders the inline calendar fail-open (all days available) when the reserved-dates fetch rejects', async () => {
    mockGetStoreRoomDetail.mockResolvedValue({ data: storeRoomDetail });
    mockGetReservedDates.mockRejectedValue(new Error('network error'));

    render(<LeodegaUI />);
    await waitFor(() => screen.getByText('Bodega Norte'));

    await waitFor(() => expect(screen.queryAllByText('Cargando disponibilidad...')).toHaveLength(0));
    expect(screen.getByRole('heading', { name: 'Disponibilidad' })).toBeInTheDocument();

    const dayButtons = screen.getAllByRole('button').filter((btn) => /^\d+$/.test(btn.textContent || ''));
    expect(dayButtons.length).toBeGreaterThan(0);
    dayButtons.forEach((btn) => expect(btn).not.toBeDisabled());
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

  it('shows the instant-reservation disclosure line in the reservation panel when available (fidelity: BookingFlow.jsx:229)', async () => {
    mockGetStoreRoomDetail.mockResolvedValue({
      data: { ...storeRoomDetail, is_available_now: true },
    });

    render(<LeodegaUI />);
    await waitFor(() => screen.getByText('Bodega Norte'));
    await waitFor(() => expect(screen.getByText('Total')).toBeInTheDocument());

    expect(
      screen.getByText('Reserva instantánea — el pago confirma el alquiler sin aprobación del gestor.')
    ).toBeInTheDocument();
  });

  it('hides the instant-reservation disclosure line when the storeroom is NOT available now', async () => {
    mockGetStoreRoomDetail.mockResolvedValue({
      data: { ...storeRoomDetail, is_available_now: false },
    });

    render(<LeodegaUI />);
    await waitFor(() => screen.getByText('Bodega Norte'));
    await waitFor(() => expect(screen.getByText('Total')).toBeInTheDocument());

    expect(
      screen.queryByText('Reserva instantánea — el pago confirma el alquiler sin aprobación del gestor.')
    ).not.toBeInTheDocument();
  });
});

describe('LeodegaUI rating display', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: { role: 'tenant' } });
    mockGetReservedDates.mockResolvedValue({ data: [] });
    mockGetStoreRoomQuote.mockResolvedValue({
      data: { rent_subtotal: '450.00', service_fee: '27.00', deposit: '0.00', total_mount: '450.00' },
    });
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
    mockGetStoreRoomQuote.mockResolvedValue({
      data: { rent_subtotal: '450.00', service_fee: '27.00', deposit: '0.00', total_mount: '450.00' },
    });
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

describe('LeodegaUI top gallery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: { role: 'tenant' } });
    mockGetReservedDates.mockResolvedValue({ data: [] });
    mockGetStoreRoomQuote.mockResolvedValue({
      data: { rent_subtotal: '450.00', service_fee: '27.00', deposit: '0.00', total_mount: '450.00' },
    });
  });

  it('renders a placeholder box and no thumbnail strip when there are zero photos', async () => {
    mockGetStoreRoomDetail.mockResolvedValue({ data: { ...storeRoomDetail, photos: [] } });

    render(<LeodegaUI />);
    await waitFor(() => screen.getByText('Bodega Norte'));

    expect(screen.getByTestId('gallery-placeholder')).toBeInTheDocument();
    expect(screen.queryAllByRole('img')).toHaveLength(0);
  });

  it('renders only the main image and no thumbnail strip when there is exactly 1 photo', async () => {
    mockGetStoreRoomDetail.mockResolvedValue({
      data: { ...storeRoomDetail, photos: ['photo-0.jpg'] },
    });

    render(<LeodegaUI />);
    await waitFor(() => screen.getByText('Bodega Norte'));

    const images = screen.getAllByRole('img');
    expect(images).toHaveLength(1);
    expect(images[0]).toHaveAttribute('src', 'photo-0.jpg');
  });

  it('renders the main image plus 2 thumbnails when there are 3 photos, all 3 visible', async () => {
    mockGetStoreRoomDetail.mockResolvedValue({
      data: { ...storeRoomDetail, photos: ['photo-0.jpg', 'photo-1.jpg', 'photo-2.jpg'] },
    });

    render(<LeodegaUI />);
    await waitFor(() => screen.getByText('Bodega Norte'));

    const images = screen.getAllByRole('img');
    expect(images).toHaveLength(3);
    expect(images.map((img) => img.getAttribute('src'))).toEqual([
      'photo-0.jpg',
      'photo-1.jpg',
      'photo-2.jpg',
    ]);
  });

  it('renders all 5 thumbnails (none dropped) when there are 6 photos', async () => {
    const photos = Array.from({ length: 6 }, (_, i) => `photo-${i}.jpg`);
    mockGetStoreRoomDetail.mockResolvedValue({ data: { ...storeRoomDetail, photos } });

    render(<LeodegaUI />);
    await waitFor(() => screen.getByText('Bodega Norte'));

    const images = screen.getAllByRole('img');
    expect(images).toHaveLength(6);
    expect(images.map((img) => img.getAttribute('src'))).toEqual(photos);
  });

  it('never renders the deleted "Imágenes adicionales" section, regardless of photo count', async () => {
    mockGetStoreRoomDetail.mockResolvedValue({
      data: { ...storeRoomDetail, photos: ['photo-0.jpg', 'photo-1.jpg', 'photo-2.jpg', 'photo-3.jpg'] },
    });

    render(<LeodegaUI />);
    await waitFor(() => screen.getByText('Bodega Norte'));

    expect(screen.queryByText('Imágenes adicionales')).not.toBeInTheDocument();
    expect(screen.queryByAltText(/^Extra /)).not.toBeInTheDocument();
  });
});

describe('LeodegaUI price panel visibility (gated on ownership, not role)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetReservedDates.mockResolvedValue({ data: [] });
    mockGetStoreRoomQuote.mockResolvedValue({
      data: { rent_subtotal: '450.00', service_fee: '27.00', deposit: '0.00', total_mount: '450.00' },
    });
    // storeRoomDetail's landlord.user_id is 2 — the storeroom's real owner.
    mockGetStoreRoomDetail.mockResolvedValue({ data: storeRoomDetail });
  });

  it('shows the price panel for an unauthenticated visitor', async () => {
    mockUseAuth.mockReturnValue({ user: null });

    render(<LeodegaUI />);
    await waitFor(() => screen.getByText('Bodega Norte'));

    expect(screen.getByRole('button', { name: 'Enviar solicitud' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Total')).toBeInTheDocument());
  });

  it('shows the price panel for a logged-in user who does NOT own the storeroom', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 999, role: 'tenant' } });

    render(<LeodegaUI />);
    await waitFor(() => screen.getByText('Bodega Norte'));

    expect(screen.getByRole('button', { name: 'Enviar solicitud' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Total')).toBeInTheDocument());
  });

  it("hides the price panel from the storeroom's own landlord (matching landlord.user_id)", async () => {
    mockUseAuth.mockReturnValue({ user: { id: 2, role: 'landlord' } });

    render(<LeodegaUI />);
    await waitFor(() => screen.getByText('Bodega Norte'));

    expect(screen.queryByRole('button', { name: 'Enviar solicitud' })).not.toBeInTheDocument();
    expect(screen.queryByText('Total')).not.toBeInTheDocument();
    expect(screen.queryByText('Calculando...')).not.toBeInTheDocument();
    expect(mockGetStoreRoomQuote).not.toHaveBeenCalled();
  });

  // A DOM-position/layout assertion is intentionally omitted here: JSDOM
  // does not apply CSS Grid, so "right sidebar" vs. "main column" is not
  // observable from rendered DOM order (both columns are siblings in the
  // same source order regardless of visual placement), and asserting the
  // Tailwind classes that drive the grid (`col-span-1`/`col-span-2`) would
  // be an implementation-detail assertion the strict-tdd rules explicitly
  // ban. The prototype's main-column position for "Tu gestor" was instead
  // verified by direct source read (BookingFlow.jsx:536) before placing it.
});

describe('LeodegaUI fabricated content regression guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: { role: 'tenant' } });
    mockGetReservedDates.mockResolvedValue({ data: [] });
    mockGetStoreRoomQuote.mockResolvedValue({
      data: { rent_subtotal: '450.00', service_fee: '27.00', deposit: '0.00', total_mount: '450.00' },
    });
  });

  it('never renders the fabricated specs table or business-hours strings, with or without security', async () => {
    mockGetStoreRoomDetail.mockResolvedValue({
      data: { ...storeRoomDetail, security: JSON.stringify({ camara: true, ruido: true, control: true, acceso: true }) },
    });

    render(<LeodegaUI />);
    await waitFor(() => screen.getByText('Bodega Norte'));

    expect(screen.queryByText('20m x 15m')).not.toBeInTheDocument();
    expect(screen.queryByText('Concreto industrial')).not.toBeInTheDocument();
    expect(screen.queryByText('CCTV')).not.toBeInTheDocument();
    expect(screen.queryByText('Lunes a Viernes: 08h00 - 17h00')).not.toBeInTheDocument();
    expect(screen.queryByText('Especificaciones técnicas')).not.toBeInTheDocument();
    expect(screen.queryByText('Horario de atención')).not.toBeInTheDocument();
  });

  it('never renders the fabricated content when security is absent', async () => {
    mockGetStoreRoomDetail.mockResolvedValue({ data: storeRoomDetail });

    render(<LeodegaUI />);
    await waitFor(() => screen.getByText('Bodega Norte'));

    expect(screen.queryByText('20m x 15m')).not.toBeInTheDocument();
    expect(screen.queryByText('Concreto industrial')).not.toBeInTheDocument();
    expect(screen.queryByText('CCTV')).not.toBeInTheDocument();
    expect(screen.queryByText('Lunes a Viernes: 08h00 - 17h00')).not.toBeInTheDocument();
  });
});

describe('LeodegaUI Características real data', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: { role: 'tenant' } });
    mockGetReservedDates.mockResolvedValue({ data: [] });
    mockGetStoreRoomQuote.mockResolvedValue({
      data: { rent_subtotal: '450.00', service_fee: '27.00', deposit: '0.00', total_mount: '450.00' },
    });
  });

  it('renders one chip per true security key, plus the size chip, when all four are true', async () => {
    mockGetStoreRoomDetail.mockResolvedValue({
      data: {
        ...storeRoomDetail,
        security: JSON.stringify({ camara: true, ruido: true, control: true, acceso: true }),
      },
    });

    render(<LeodegaUI />);
    await waitFor(() => screen.getByText('Bodega Norte'));

    expect(screen.getByText('20 m²')).toBeInTheDocument();
    expect(screen.getByText('Cámara de seguridad exterior')).toBeInTheDocument();
    expect(screen.getByText('Monitor de ruido')).toBeInTheDocument();
    expect(screen.getByText('Control de plagas y humedad')).toBeInTheDocument();
    expect(screen.getByText('Acceso restringido 24/7')).toBeInTheDocument();
  });

  it('renders no chip for a false security key, only chips for true ones', async () => {
    mockGetStoreRoomDetail.mockResolvedValue({
      data: {
        ...storeRoomDetail,
        security: JSON.stringify({ camara: true, ruido: false, control: false, acceso: false }),
      },
    });

    render(<LeodegaUI />);
    await waitFor(() => screen.getByText('Bodega Norte'));

    expect(screen.getByText('Cámara de seguridad exterior')).toBeInTheDocument();
    expect(screen.queryByText('Monitor de ruido')).not.toBeInTheDocument();
    expect(screen.queryByText('Control de plagas y humedad')).not.toBeInTheDocument();
    expect(screen.queryByText('Acceso restringido 24/7')).not.toBeInTheDocument();
  });

  it('renders only the size chip, no crash, when security is absent', async () => {
    mockGetStoreRoomDetail.mockResolvedValue({ data: storeRoomDetail });

    render(<LeodegaUI />);
    await waitFor(() => screen.getByText('Bodega Norte'));

    expect(screen.getByText('20 m²')).toBeInTheDocument();
    expect(screen.queryByText('Cámara de seguridad exterior')).not.toBeInTheDocument();
    expect(screen.queryByText('Monitor de ruido')).not.toBeInTheDocument();
    expect(screen.queryByText('Control de plagas y humedad')).not.toBeInTheDocument();
    expect(screen.queryByText('Acceso restringido 24/7')).not.toBeInTheDocument();
  });

  it('renders only the size chip, no crash, when security is an empty string', async () => {
    mockGetStoreRoomDetail.mockResolvedValue({
      data: { ...storeRoomDetail, security: '' },
    });

    render(<LeodegaUI />);
    await waitFor(() => screen.getByText('Bodega Norte'));

    expect(screen.getByText('20 m²')).toBeInTheDocument();
    expect(screen.queryByText('Cámara de seguridad exterior')).not.toBeInTheDocument();
  });

  it('renders only the size chip, no crash, when security is malformed JSON', async () => {
    mockGetStoreRoomDetail.mockResolvedValue({
      data: { ...storeRoomDetail, security: '{not json' },
    });

    render(<LeodegaUI />);
    await waitFor(() => screen.getByText('Bodega Norte'));

    expect(screen.getByText('20 m²')).toBeInTheDocument();
    expect(screen.queryByText('Cámara de seguridad exterior')).not.toBeInTheDocument();
  });
});

describe('LeodegaUI renamed headings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: { role: 'tenant' } });
    mockGetReservedDates.mockResolvedValue({ data: [] });
    mockGetStoreRoomQuote.mockResolvedValue({
      data: { rent_subtotal: '450.00', service_fee: '27.00', deposit: '0.00', total_mount: '450.00' },
    });
  });

  it('renders "Sobre esta bodega" and "Tu gestor", not the old headings', async () => {
    mockGetStoreRoomDetail.mockResolvedValue({ data: storeRoomDetail });

    render(<LeodegaUI />);
    await waitFor(() => screen.getByText('Bodega Norte'));

    expect(screen.getByRole('heading', { name: 'Sobre esta bodega' })).toBeInTheDocument();
    expect(screen.getByText('Tu gestor')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Descripción' })).not.toBeInTheDocument();
    expect(screen.queryByText('Arrendador')).not.toBeInTheDocument();
  });
});

describe('LeodegaUI "Tu gestor" card', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: { role: 'tenant' } });
    mockGetReservedDates.mockResolvedValue({ data: [] });
    mockGetStoreRoomQuote.mockResolvedValue({
      data: { rent_subtotal: '450.00', service_fee: '27.00', deposit: '0.00', total_mount: '450.00' },
    });
  });

  it('renders "Miembro desde <month year>" in Spanish when start_date is present', async () => {
    mockGetStoreRoomDetail.mockResolvedValue({
      data: { ...storeRoomDetail, landlord: { ...storeRoomDetail.landlord, start_date: '2026-09-15' } },
    });

    render(<LeodegaUI />);
    await waitFor(() => screen.getByText('Bodega Norte'));

    expect(screen.getByText('Miembro desde septiembre 2026')).toBeInTheDocument();
  });

  it('renders no "Miembro desde" line when start_date is null/absent, and the card still renders', async () => {
    mockGetStoreRoomDetail.mockResolvedValue({ data: storeRoomDetail });

    render(<LeodegaUI />);
    await waitFor(() => screen.getByText('Bodega Norte'));

    expect(screen.queryByText(/Miembro desde/)).not.toBeInTheDocument();
    expect(screen.getByText('Laura')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Contactar' })).toBeInTheDocument();
  });

  it('never renders "Verificado" or "Responde en", with or without start_date (no real source for either)', async () => {
    mockGetStoreRoomDetail.mockResolvedValue({
      data: { ...storeRoomDetail, landlord: { ...storeRoomDetail.landlord, start_date: '2026-09-15' } },
    });

    render(<LeodegaUI />);
    await waitFor(() => screen.getByText('Bodega Norte'));

    expect(screen.queryByText(/Verificado/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Responde en/)).not.toBeInTheDocument();
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
