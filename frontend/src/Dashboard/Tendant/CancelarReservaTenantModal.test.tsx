import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockGetCancellationPreview = vi.hoisted(() => vi.fn());
const mockCancelReservationAsTenant = vi.hoisted(() => vi.fn());

vi.mock('../../services/reservations', () => ({
  getCancellationPreview: mockGetCancellationPreview,
  cancelReservationAsTenant: mockCancelReservationAsTenant,
}));

import CancelarReservaTenantModal from './CancelarReservaTenantModal';
import type { TenantReservation } from '../../services/reservations';

const reservation: TenantReservation = {
  id: 7,
  status: 'confirmed',
  start_date: '2026-07-01',
  end_date: '2026-10-01',
  store_room_id: 3,
  total_mount: '1850.00',
  can_be_cancelled: true,
  photo_url: null,
  store_rooms: { id: 3, title: 'Galpón Logístico Centro' },
};

function renderModal(overrides: Partial<Parameters<typeof CancelarReservaTenantModal>[0]> = {}) {
  const onClose = vi.fn();
  const onCancelled = vi.fn();
  const onNeedsRefresh = vi.fn();
  const utils = render(
    <CancelarReservaTenantModal
      reservation={reservation}
      onClose={onClose}
      onCancelled={onCancelled}
      onNeedsRefresh={onNeedsRefresh}
      {...overrides}
    />
  );
  return { ...utils, onClose, onCancelled, onNeedsRefresh };
}

describe('CancelarReservaTenantModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // [SPANISH COPY] Verbatim prototype copy, ResCancelModal
  // (PrototipoLeodega-main/js/TenantReservasPage.jsx:85-98).
  it('shows the verbatim prototype copy: title, body with title/code, and both buttons', async () => {
    mockGetCancellationPreview.mockResolvedValue({ data: { can_be_cancelled: true, refund_amount: '1850.00' } });
    renderModal();

    expect(screen.getByText('Cancelar reserva')).toBeInTheDocument();
    expect(
      screen.getByText(
        (_, node) =>
          node?.textContent ===
          '¿Seguro que deseas cancelar tu reserva de Galpón Logístico Centro (LEO-000007)? Esta acción no se puede deshacer.'
      )
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Volver' })).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Sí, cancelar' })).toBeInTheDocument()
    );
  });

  it('fetches the refund preview on mount and shows the amount, enabling confirm', async () => {
    mockGetCancellationPreview.mockResolvedValue({ data: { can_be_cancelled: true, refund_amount: '1850.00' } });
    renderModal();

    await waitFor(() => expect(screen.getByText(/\$1,850 USD/)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Sí, cancelar' })).not.toBeDisabled();
  });

  it('shows an inline error and keeps confirm disabled when the preview call fails generically', async () => {
    mockGetCancellationPreview.mockRejectedValue({ response: { status: 500 } });
    renderModal();

    await waitFor(() =>
      expect(screen.getByText(/No se pudo calcular el reembolso/i)).toBeInTheDocument()
    );
    expect(screen.getByRole('button', { name: 'Sí, cancelar' })).toBeDisabled();
  });

  it('shows a stale-reservation message and does not enable confirm when preview returns 409', async () => {
    mockGetCancellationPreview.mockRejectedValue({
      response: { status: 409, data: { message: 'Esta reserva ya no puede cancelarse.' } },
    });
    const { onNeedsRefresh } = renderModal();

    await waitFor(() =>
      expect(screen.getByText('Esta reserva ya no puede cancelarse.')).toBeInTheDocument()
    );
    expect(screen.queryByRole('button', { name: 'Sí, cancelar' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Actualizar' }));
    expect(onNeedsRefresh).toHaveBeenCalled();
  });

  it('confirm success calls onCancelled with the recorded refund amount and closes', async () => {
    mockGetCancellationPreview.mockResolvedValue({ data: { can_be_cancelled: true, refund_amount: '1850.00' } });
    mockCancelReservationAsTenant.mockResolvedValue({
      data: { message: 'Reserva cancelada', reservation: { ...reservation, status: 'canceled', refund_amount: '1850.00' } },
    });
    const { onCancelled, onClose } = renderModal();

    await waitFor(() => screen.getByRole('button', { name: 'Sí, cancelar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sí, cancelar' }));

    await waitFor(() => expect(onCancelled).toHaveBeenCalledWith('1850.00'));
    expect(onClose).toHaveBeenCalled();
  });

  it('confirm 409 shows the stale message and offers Actualizar, no blind retry', async () => {
    mockGetCancellationPreview.mockResolvedValue({ data: { can_be_cancelled: true, refund_amount: '1850.00' } });
    mockCancelReservationAsTenant.mockRejectedValue({
      response: { status: 409, data: { message: 'Esta reserva ya no puede cancelarse.' } },
    });
    const { onCancelled, onNeedsRefresh } = renderModal();

    await waitFor(() => screen.getByRole('button', { name: 'Sí, cancelar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sí, cancelar' }));

    await waitFor(() =>
      expect(screen.getByText('Esta reserva ya no puede cancelarse.')).toBeInTheDocument()
    );
    expect(onCancelled).not.toHaveBeenCalled();
    expect(mockCancelReservationAsTenant).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Actualizar' }));
    expect(onNeedsRefresh).toHaveBeenCalled();
    // No automatic re-invocation of the cancel call itself.
    expect(mockCancelReservationAsTenant).toHaveBeenCalledTimes(1);
  });

  it('confirm 403 shows a generic error and keeps the modal open', async () => {
    mockGetCancellationPreview.mockResolvedValue({ data: { can_be_cancelled: true, refund_amount: '1850.00' } });
    mockCancelReservationAsTenant.mockRejectedValue({
      response: { status: 403, data: { message: 'No autorizado' } },
    });
    const { onCancelled, onClose } = renderModal();

    await waitFor(() => screen.getByRole('button', { name: 'Sí, cancelar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sí, cancelar' }));

    await waitFor(() => expect(screen.getByText('No autorizado')).toBeInTheDocument());
    expect(onCancelled).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('confirm 404 closes the modal and triggers a refresh, without a blind retry', async () => {
    mockGetCancellationPreview.mockResolvedValue({ data: { can_be_cancelled: true, refund_amount: '1850.00' } });
    mockCancelReservationAsTenant.mockRejectedValue({
      response: { status: 404, data: { message: 'Reserva no encontrada' } },
    });
    const { onNeedsRefresh, onCancelled } = renderModal();

    await waitFor(() => screen.getByRole('button', { name: 'Sí, cancelar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sí, cancelar' }));

    await waitFor(() => expect(onNeedsRefresh).toHaveBeenCalled());
    expect(onCancelled).not.toHaveBeenCalled();
  });
});
