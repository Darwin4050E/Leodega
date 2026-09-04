import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockGetLandlordReservations = vi.hoisted(() => vi.fn());
const mockCancelReservation = vi.hoisted(() => vi.fn());
const mockGetCancellationRate = vi.hoisted(() => vi.fn());

vi.mock('../../services/reservations', () => ({
  getLandlordReservations: mockGetLandlordReservations,
  cancelReservation: mockCancelReservation,
  getCancellationRate: mockGetCancellationRate,
}));

import GestorReservas from './GestorReservas';

const reservations = [
  {
    id: 1,
    status: 'confirmed',
    start_date: '2030-01-10',
    end_date: '2030-02-10',
    store_room_id: 1,
    rent_subtotal: 3000,
    total_mount: 4180,
    cancelation_reason: null,
    payment_status: 'paid',
    can_be_cancelled: true,
    has_refund_obligation: false,
    storeRooms: { title: 'Bodega Norte' },
    tenants: { user: { name: 'Ana', lastname: 'Torres', email: 'ana@example.com' } },
  },
  {
    id: 2,
    status: 'pending',
    start_date: '2030-03-01',
    end_date: '2030-03-10',
    store_room_id: 2,
    rent_subtotal: 1000,
    total_mount: 1200,
    cancelation_reason: null,
    payment_status: 'pending',
    can_be_cancelled: false,
    has_refund_obligation: false,
    storeRooms: { title: 'Bodega Sur' },
    tenants: { user: { name: 'Luis', lastname: 'Perez', email: 'luis@example.com' } },
  },
  {
    id: 3,
    status: 'canceled',
    start_date: '2020-01-10',
    end_date: '2020-02-10',
    store_room_id: 1,
    rent_subtotal: 500,
    total_mount: 700,
    cancelation_reason: 'El almacen sufrio un incendio',
    payment_status: 'paid',
    can_be_cancelled: false,
    has_refund_obligation: true,
    storeRooms: { title: 'Bodega Norte' },
    tenants: { user: { name: 'Marta', lastname: 'Ruiz', email: 'marta@example.com' } },
  },
  {
    id: 4,
    status: 'canceled',
    start_date: '2020-05-01',
    end_date: '2020-05-15',
    store_room_id: 2,
    rent_subtotal: null,
    total_mount: 0,
    cancelation_reason: 'Blocked by confirmed reservation',
    payment_status: 'pending',
    can_be_cancelled: false,
    has_refund_obligation: false,
    storeRooms: { title: 'Bodega Sur' },
    tenants: { user: { name: 'Carlos', lastname: 'Diaz', email: 'carlos@example.com' } },
  },
];

describe('GestorReservas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetLandlordReservations.mockResolvedValue({ data: reservations });
  });

  it('renders all four PAGO labels', async () => {
    render(<GestorReservas />);
    await waitFor(() => screen.getAllByText('Bodega Norte'));

    expect(screen.getAllByText('Pagado').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Pago pendiente').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Reembolsado').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Sin cobro').length).toBeGreaterThan(0);
  });

  it('computes KPI tiles (Reservas/Activas/Futuras/Cobrado) excluding cancelled from Cobrado', async () => {
    render(<GestorReservas />);
    await waitFor(() => screen.getAllByText('Bodega Norte'));

    expect(screen.getByText('Reservas')).toBeInTheDocument();
    // Cobrado excludes cancelled (ids 3, 4): 4180 + 1200 = 5380
    expect(screen.getByText('$5,380')).toBeInTheDocument();
  });

  it('"↺ Reiniciar" clears every filter and restores the full list', async () => {
    render(<GestorReservas />);
    await waitFor(() => screen.getAllByText('Bodega Norte'));

    fireEvent.change(screen.getByPlaceholderText('Buscar cliente'), { target: { value: 'Ana' } });
    expect(screen.queryByText('Bodega Sur')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('↺ Reiniciar'));

    await waitFor(() => expect(screen.getByPlaceholderText('Buscar cliente')).toHaveValue(''));
    expect(screen.getAllByText('Bodega Sur').length).toBeGreaterThan(0);
  });

  it('swaps to an in-page detail view on row click, no route change', async () => {
    render(<GestorReservas />);
    await waitFor(() => screen.getAllByText('Bodega Norte'));

    fireEvent.click(screen.getByText('Ana Torres'));

    expect(screen.getByText('Reserva #1')).toBeInTheDocument();
    expect(screen.getByText('← Volver a Reservas')).toBeInTheDocument();

    fireEvent.click(screen.getByText('← Volver a Reservas'));
    expect(screen.queryByText('Reserva #1')).not.toBeInTheDocument();
  });

  it('decorative buttons (Mensaje al cliente / Descargar comprobante) produce no side effects', async () => {
    render(<GestorReservas />);
    await waitFor(() => screen.getAllByText('Bodega Norte'));

    fireEvent.click(screen.getByText('Ana Torres'));

    const mensajeBtn = screen.getByText('Mensaje al cliente');
    const comprobanteBtn = screen.getByText('Descargar comprobante');

    fireEvent.click(mensajeBtn);
    fireEvent.click(comprobanteBtn);

    // No navigation, no additional API calls beyond the initial list load.
    expect(mockGetLandlordReservations).toHaveBeenCalledTimes(1);
    expect(mockCancelReservation).not.toHaveBeenCalled();
  });

  it('shows the cancel button only for the eligible reservation (confirmed, paid, strictly future)', async () => {
    render(<GestorReservas />);
    await waitFor(() => screen.getAllByText('Bodega Norte'));

    fireEvent.click(screen.getByText('Ana Torres'));
    expect(screen.getByText('Cancelar reserva')).toBeInTheDocument();
    fireEvent.click(screen.getByText('← Volver a Reservas'));

    fireEvent.click(screen.getByText('Marta Ruiz'));
    expect(screen.queryByText('Cancelar reserva')).not.toBeInTheDocument();
  });

  /**
   * The server's `can_be_cancelled` governs the control, not the local date
   * math. Here the reservation looks perfectly cancellable from the client's
   * side — confirmed, paid, starting in 2030 — but the server says no. That
   * is the real timezone case: a viewer whose local date lags the server's
   * would otherwise be shown a button that fails with 409.
   */
  it('hides the cancel button when the server says the reservation is not cancellable', async () => {
    mockGetLandlordReservations.mockResolvedValueOnce({
      data: [{ ...reservations[0], can_be_cancelled: false }],
    });

    render(<GestorReservas />);
    await waitFor(() => screen.getAllByText('Bodega Norte'));

    fireEvent.click(screen.getByText('Ana Torres'));
    expect(screen.queryByText('Cancelar reserva')).not.toBeInTheDocument();
  });
});
