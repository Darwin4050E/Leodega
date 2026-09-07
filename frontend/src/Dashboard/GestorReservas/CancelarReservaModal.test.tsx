import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockCancelReservation = vi.hoisted(() => vi.fn());
const mockGetCancellationRate = vi.hoisted(() => vi.fn());

vi.mock('../../services/reservations', () => ({
  cancelReservation: mockCancelReservation,
  getCancellationRate: mockGetCancellationRate,
}));

import CancelarReservaModal from './CancelarReservaModal';

const reservation = {
  id: 1,
  status: 'confirmed',
  start_date: '2030-01-10',
  end_date: '2030-02-10',
  store_room_id: 1,
  rent_subtotal: 3000,
  total_mount: 4180,
  cancelation_reason: null,
  payment_status: 'paid' as const,
  has_refund_obligation: false,
};

function renderModal(overrides: Partial<Parameters<typeof CancelarReservaModal>[0]> = {}) {
  const onClose = vi.fn();
  const onCancelled = vi.fn();
  const utils = render(
    <CancelarReservaModal
      reservation={reservation}
      clienteNombre="Ana Torres"
      bodegaTitulo="Bodega Norte"
      onClose={onClose}
      onCancelled={onCancelled}
      {...overrides}
    />
  );
  return { ...utils, onClose, onCancelled };
}

describe('CancelarReservaModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('computes the penalty from the fetched rate and shows the cost breakdown', async () => {
    mockGetCancellationRate.mockResolvedValue({ data: { gestor_cancellation_penalty_rate: 0.15 } });
    renderModal();

    // penalty = round(0.15 * 3000) = 450; refund = 4180; total = 4630
    await waitFor(() => expect(screen.getByText('$450')).toBeInTheDocument());
    expect(screen.getByText('$4,180')).toBeInTheDocument();
    expect(screen.getByText('$4,630 USD')).toBeInTheDocument();
  });

  it('blocks confirmation and shows no fabricated number when the rate fetch fails', async () => {
    mockGetCancellationRate.mockRejectedValue(new Error('network error'));
    renderModal();

    await waitFor(() =>
      expect(
        screen.getByText('No se pudo calcular el costo de la cancelación. Intenta nuevamente más tarde.')
      ).toBeInTheDocument()
    );

    expect(screen.queryByText(/\$450/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /confirmar cancelación/i })).toBeDisabled();
  });

  it('disables submit when the reason is under 10 characters', async () => {
    mockGetCancellationRate.mockResolvedValue({ data: { gestor_cancellation_penalty_rate: 0.15 } });
    renderModal();
    await waitFor(() => screen.getByText('$4,180'));

    fireEvent.change(screen.getByPlaceholderText(/explica al cliente/i), {
      target: { value: 'corto' },
    });
    fireEvent.click(screen.getByRole('checkbox'));

    expect(screen.getByRole('button', { name: /confirmar cancelación/i })).toBeDisabled();
  });

  it('disables submit when the acceptance checkbox is unchecked', async () => {
    mockGetCancellationRate.mockResolvedValue({ data: { gestor_cancellation_penalty_rate: 0.15 } });
    renderModal();
    await waitFor(() => screen.getByText('$4,180'));

    fireEvent.change(screen.getByPlaceholderText(/explica al cliente/i), {
      target: { value: 'Motivo suficientemente largo' },
    });

    expect(screen.getByRole('button', { name: /confirmar cancelación/i })).toBeDisabled();
  });

  it('on success calls onCancelled with the updated reservation and closes', async () => {
    mockGetCancellationRate.mockResolvedValue({ data: { gestor_cancellation_penalty_rate: 0.15 } });
    mockCancelReservation.mockResolvedValue({
      data: { message: 'Reserva cancelada', reservation: { ...reservation, status: 'canceled' } },
    });
    const { onCancelled, onClose } = renderModal();
    await waitFor(() => screen.getByText('$4,180'));

    fireEvent.change(screen.getByPlaceholderText(/explica al cliente/i), {
      target: { value: 'Motivo suficientemente largo' },
    });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: /confirmar cancelación/i }));

    await waitFor(() =>
      expect(onCancelled).toHaveBeenCalledWith(
        expect.objectContaining({ id: 1, status: 'canceled' })
      )
    );
    expect(onClose).toHaveBeenCalled();
  });

  it('shows the server message on 409 without closing or mutating local state', async () => {
    mockGetCancellationRate.mockResolvedValue({ data: { gestor_cancellation_penalty_rate: 0.15 } });
    mockCancelReservation.mockRejectedValue({
      response: { status: 409, data: { message: 'Esta reserva no puede cancelarse' } },
    });
    const { onCancelled, onClose } = renderModal();
    await waitFor(() => screen.getByText('$4,180'));

    fireEvent.change(screen.getByPlaceholderText(/explica al cliente/i), {
      target: { value: 'Motivo suficientemente largo' },
    });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: /confirmar cancelación/i }));

    await waitFor(() => expect(screen.getByText('Esta reserva no puede cancelarse')).toBeInTheDocument());
    expect(onCancelled).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('shows the server message on 403 without closing or mutating local state', async () => {
    mockGetCancellationRate.mockResolvedValue({ data: { gestor_cancellation_penalty_rate: 0.15 } });
    mockCancelReservation.mockRejectedValue({
      response: { status: 403, data: { message: 'No autorizado' } },
    });
    const { onCancelled } = renderModal();
    await waitFor(() => screen.getByText('$4,180'));

    fireEvent.change(screen.getByPlaceholderText(/explica al cliente/i), {
      target: { value: 'Motivo suficientemente largo' },
    });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: /confirmar cancelación/i }));

    await waitFor(() => expect(screen.getByText('No autorizado')).toBeInTheDocument());
    expect(onCancelled).not.toHaveBeenCalled();
  });

  it('shows the server message on 404 without closing or mutating local state', async () => {
    mockGetCancellationRate.mockResolvedValue({ data: { gestor_cancellation_penalty_rate: 0.15 } });
    mockCancelReservation.mockRejectedValue({
      response: { status: 404, data: { message: 'Reserva no encontrada' } },
    });
    const { onCancelled } = renderModal();
    await waitFor(() => screen.getByText('$4,180'));

    fireEvent.change(screen.getByPlaceholderText(/explica al cliente/i), {
      target: { value: 'Motivo suficientemente largo' },
    });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: /confirmar cancelación/i }));

    await waitFor(() => expect(screen.getByText('Reserva no encontrada')).toBeInTheDocument());
    expect(onCancelled).not.toHaveBeenCalled();
  });
});
