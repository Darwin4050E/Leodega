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
import { subscribeToWalletChanges } from '../../utils/walletEvents';

const orgReservation: TenantReservation = {
  ...baseReservation(),
  organization: { id: 5, name: 'Andina', ruc: '1792146739001' },
  is_creator: false,
  creator_name: 'Ana Torres',
};

const reservation: TenantReservation = baseReservation();

function baseReservation(): TenantReservation {
  return {
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
}

function preview(refund = '1850.00', total = '1850.00') {
  const penalty = (Number(total) - Number(refund)).toFixed(2);
  return { data: { can_be_cancelled: true, total_amount: total, refund_amount: refund, penalty_amount: penalty } };
}

const REASON_LABEL = 'Motivo de la cancelación *';

async function fillReason(text: string) {
  fireEvent.change(await screen.findByLabelText(REASON_LABEL), { target: { value: text } });
}

async function confirmOrg(text = 'motivo valido') {
  await screen.findByText('Total pagado');
  await fillReason(text);
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar reserva' }));
}

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
    mockGetCancellationPreview.mockResolvedValue(preview());
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
    mockGetCancellationPreview.mockResolvedValue(preview());
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
    mockGetCancellationPreview.mockResolvedValue(preview());
    mockCancelReservationAsTenant.mockResolvedValue({
      data: { message: 'Reserva cancelada', reservation: { ...reservation, status: 'canceled', refund_amount: '1850.00' } },
    });
    const { onCancelled, onClose } = renderModal();

    await waitFor(() => screen.getByRole('button', { name: 'Sí, cancelar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sí, cancelar' }));

    await waitFor(() => expect(onCancelled).toHaveBeenCalledWith('1850.00'));
    expect(onClose).toHaveBeenCalled();
  });

  it('OR-WS29/WS34: a personal row has no reason field, no refund box and sends no reason', async () => {
    mockGetCancellationPreview.mockResolvedValue(preview());
    mockCancelReservationAsTenant.mockResolvedValue({
      data: { message: 'Reserva cancelada', reservation: { ...reservation, status: 'canceled', refund_amount: '1850.00' } },
    });
    renderModal();

    await waitFor(() => screen.getByRole('button', { name: 'Sí, cancelar' }));
    expect(screen.queryByLabelText(REASON_LABEL)).not.toBeInTheDocument();
    expect(screen.queryByText('Total pagado')).not.toBeInTheDocument();
    expect(screen.queryByText('Penalización')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Sí, cancelar' }));

    await waitFor(() => expect(mockCancelReservationAsTenant).toHaveBeenCalledWith(7));
  });

  it('keeps the personal refund copy and announces no wallet change for a personal reservation', async () => {
    mockGetCancellationPreview.mockResolvedValue(preview());
    mockCancelReservationAsTenant.mockResolvedValue({
      data: { message: 'Reserva cancelada', reservation: { ...reservation, status: 'canceled', refund_amount: '1850.00' } },
    });
    const onWalletChanged = vi.fn();
    const unsubscribe = subscribeToWalletChanges(onWalletChanged);
    const { onCancelled } = renderModal();

    await waitFor(() => expect(screen.getByText(/Recibirás un reembolso de/)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Sí, cancelar' }));

    await waitFor(() => expect(onCancelled).toHaveBeenCalled());
    expect(onWalletChanged).not.toHaveBeenCalled();
    unsubscribe();
  });

  it('confirm 409 shows the stale message and offers Actualizar, no blind retry', async () => {
    mockGetCancellationPreview.mockResolvedValue(preview());
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
    mockGetCancellationPreview.mockResolvedValue(preview());
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
    mockGetCancellationPreview.mockResolvedValue(preview());
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

describe('CancelarReservaTenantModal on an organization reservation (HUE-06 OR-W8/OR-W9)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('OR-WS21: shows the org title, the sub with bodega/code/member and the two buttons', async () => {
    mockGetCancellationPreview.mockResolvedValue(preview('50.00', '100.00'));
    renderModal({ reservation: orgReservation });

    expect(screen.getByText('Cancelar reserva de la organización')).toBeInTheDocument();
    expect(
      screen.getByText(
        (_, node) =>
          node?.textContent ===
          'Vas a cancelar Galpón Logístico Centro (LEO-000007), reservada por Ana Torres. Esta acción no se puede deshacer.'
      )
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Volver' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancelar reserva' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sí, cancelar' })).not.toBeInTheDocument();
    await screen.findByText('Total pagado');
  });

  it('drops the "reservada por" clause when the row has no creator name', async () => {
    mockGetCancellationPreview.mockResolvedValue(preview('50.00', '100.00'));
    renderModal({ reservation: { ...orgReservation, creator_name: null } });

    expect(
      screen.getByText(
        (_, node) =>
          node?.textContent ===
          'Vas a cancelar Galpón Logístico Centro (LEO-000007). Esta acción no se puede deshacer.'
      )
    ).toBeInTheDocument();
    await screen.findByText('Total pagado');
  });

  it('OR-WS30/WS31: shows the three-line box and names the org wallet as destination', async () => {
    mockGetCancellationPreview.mockResolvedValue(preview('50.00', '100.00'));
    renderModal({ reservation: orgReservation });

    expect(await screen.findByText('Total pagado')).toBeInTheDocument();
    expect(screen.getByText('Penalización')).toBeInTheDocument();
    expect(screen.getByText('Reembolso')).toBeInTheDocument();
    expect(screen.getByText('$100.00')).toBeInTheDocument();
    const copy = await screen.findByText(/se acreditará al saldo de Andina\./);
    expect(copy).toHaveTextContent('El reembolso de $50 USD se acreditará al saldo de Andina.');
    expect(screen.queryByText(/Recibirás un reembolso/)).not.toBeInTheDocument();
  });

  it('OR-WS32: shows the zero-refund line for a zero refund', async () => {
    mockGetCancellationPreview.mockResolvedValue(preview('0.00', '100.00'));
    renderModal({ reservation: orgReservation });

    expect(await screen.findByText('Esta cancelación no genera reembolso.')).toBeInTheDocument();
    expect(screen.queryByText(/se acreditará al saldo/)).not.toBeInTheDocument();
  });

  it('OR-WS33: shows no amounts while the preview loads or when it fails', async () => {
    mockGetCancellationPreview.mockReturnValue(new Promise(() => {}));
    const { unmount } = renderModal({ reservation: orgReservation });

    expect(screen.getByText('Calculando el reembolso...')).toBeInTheDocument();
    expect(screen.queryByText('Total pagado')).not.toBeInTheDocument();
    unmount();

    mockGetCancellationPreview.mockRejectedValue({ response: { status: 500 } });
    renderModal({ reservation: orgReservation });

    await waitFor(() => expect(screen.getByText(/No se pudo calcular el reembolso/i)).toBeInTheDocument());
    expect(screen.queryByText('Total pagado')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancelar reserva' })).toBeDisabled();
  });

  it('OR-WS24: keeps confirm disabled below 10 trimmed characters and enables it at 10', async () => {
    mockGetCancellationPreview.mockResolvedValue(preview('50.00', '100.00'));
    renderModal({ reservation: orgReservation });
    await screen.findByText('Total pagado');

    const confirm = screen.getByRole('button', { name: 'Cancelar reserva' });
    expect(confirm).toBeDisabled();

    await fillReason('  123456789  ');
    expect(confirm).toBeDisabled();

    await fillReason('  1234567890  ');
    expect(confirm).toBeEnabled();
  });

  it('OR-WS25: shows the inline min error only after the field is blurred while invalid', async () => {
    mockGetCancellationPreview.mockResolvedValue(preview('50.00', '100.00'));
    renderModal({ reservation: orgReservation });
    await screen.findByText('Total pagado');

    await fillReason('corto');
    expect(screen.queryByText('El motivo debe tener al menos 10 caracteres.')).not.toBeInTheDocument();

    fireEvent.blur(screen.getByLabelText(REASON_LABEL));
    expect(screen.getByText('El motivo debe tener al menos 10 caracteres.')).toBeInTheDocument();
  });

  it('OR-WS26: cuts a pasted reason of 250 characters at 200', async () => {
    mockGetCancellationPreview.mockResolvedValue(preview('50.00', '100.00'));
    renderModal({ reservation: orgReservation });
    await screen.findByText('Total pagado');

    await fillReason('a'.repeat(250));

    expect(screen.getByLabelText(REASON_LABEL)).toHaveValue('a'.repeat(200));
  });

  it('OR-WS27: sends the trimmed reason', async () => {
    mockGetCancellationPreview.mockResolvedValue(preview('50.00', '100.00'));
    mockCancelReservationAsTenant.mockResolvedValue({
      data: { message: 'Reserva cancelada', reservation: { ...orgReservation, status: 'canceled', refund_amount: '50.00' } },
    });
    const { onCancelled, onClose } = renderModal({ reservation: orgReservation });

    await confirmOrg('  motivo valido  ');

    await waitFor(() => expect(onCancelled).toHaveBeenCalledWith('50.00'));
    expect(mockCancelReservationAsTenant).toHaveBeenCalledWith(7, 'motivo valido');
    expect(onClose).toHaveBeenCalled();
  });

  it('OR-WS28: shows a server 422 on reason inline, keeps the modal open and the input', async () => {
    mockGetCancellationPreview.mockResolvedValue(preview('50.00', '100.00'));
    mockCancelReservationAsTenant.mockRejectedValue({
      response: {
        status: 422,
        data: {
          message: 'El motivo no puede superar los 200 caracteres.',
          errors: { reason: ['El motivo no puede superar los 200 caracteres.'] },
        },
      },
    });
    const { onClose, onCancelled } = renderModal({ reservation: orgReservation });

    await confirmOrg('un motivo suficientemente largo');

    expect(await screen.findByText('El motivo no puede superar los 200 caracteres.')).toBeInTheDocument();
    expect(screen.getByLabelText(REASON_LABEL)).toHaveValue('un motivo suficientemente largo');
    expect(onClose).not.toHaveBeenCalled();
    expect(onCancelled).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Cancelar reserva' })).toBeEnabled();
  });

  it('OR-WS39: a second click while the request is in flight sends one request', async () => {
    mockGetCancellationPreview.mockResolvedValue(preview('50.00', '100.00'));
    mockCancelReservationAsTenant.mockReturnValue(new Promise(() => {}));
    renderModal({ reservation: orgReservation });
    await screen.findByText('Total pagado');
    await fillReason('motivo valido');

    const confirm = screen.getByRole('button', { name: 'Cancelar reserva' });
    fireEvent.click(confirm);
    fireEvent.click(confirm);

    expect(mockCancelReservationAsTenant).toHaveBeenCalledTimes(1);
  });

  it('OR-WS38: keeps the 409 stale handling for an org confirm', async () => {
    mockGetCancellationPreview.mockResolvedValue(preview('50.00', '100.00'));
    mockCancelReservationAsTenant.mockRejectedValue({
      response: { status: 409, data: { message: 'Esta reserva ya no puede cancelarse.' } },
    });
    const { onNeedsRefresh } = renderModal({ reservation: orgReservation });

    await confirmOrg();

    expect(await screen.findByText('Esta reserva ya no puede cancelarse.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar' }));
    expect(onNeedsRefresh).toHaveBeenCalled();
  });

  it('OR-WS38: a 403 on an org confirm shows the error and leaves the modal usable', async () => {
    mockGetCancellationPreview.mockResolvedValue(preview('50.00', '100.00'));
    mockCancelReservationAsTenant.mockRejectedValue({
      response: { status: 403, data: { message: 'No autorizado' } },
    });
    const { onClose, onCancelled, onNeedsRefresh } = renderModal({ reservation: orgReservation });

    await confirmOrg('un motivo suficientemente largo');

    expect(await screen.findByText('No autorizado')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(onCancelled).not.toHaveBeenCalled();
    expect(onNeedsRefresh).not.toHaveBeenCalled();
    expect(screen.getByLabelText(REASON_LABEL)).toHaveValue('un motivo suficientemente largo');

    const confirm = screen.getByRole('button', { name: 'Cancelar reserva' });
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);
    await waitFor(() => expect(mockCancelReservationAsTenant).toHaveBeenCalledTimes(2));
  });

  it('OR-WS38: a 404 on an org confirm asks the parent to refresh', async () => {
    mockGetCancellationPreview.mockResolvedValue(preview('50.00', '100.00'));
    mockCancelReservationAsTenant.mockRejectedValue({
      response: { status: 404, data: { message: 'Reserva no encontrada' } },
    });
    const { onNeedsRefresh, onCancelled } = renderModal({ reservation: orgReservation });

    await confirmOrg();

    await waitFor(() => expect(onNeedsRefresh).toHaveBeenCalled());
    expect(onCancelled).not.toHaveBeenCalled();
  });

  // org-wallet OW-8/OW-WS15
  it('announces a wallet change after cancelling an org reservation', async () => {
    mockGetCancellationPreview.mockResolvedValue(preview('50.00', '100.00'));
    mockCancelReservationAsTenant.mockResolvedValue({
      data: { message: 'Reserva cancelada', reservation: { ...orgReservation, status: 'canceled', refund_amount: '50.00' } },
    });
    const onWalletChanged = vi.fn();
    const unsubscribe = subscribeToWalletChanges(onWalletChanged);
    renderModal({ reservation: orgReservation });

    await confirmOrg();

    await waitFor(() => expect(onWalletChanged).toHaveBeenCalledTimes(1));
    unsubscribe();
  });

  it('does not announce a wallet change when an org cancellation fails', async () => {
    mockGetCancellationPreview.mockResolvedValue(preview('50.00', '100.00'));
    mockCancelReservationAsTenant.mockRejectedValue({ response: { status: 403, data: {} } });
    const onWalletChanged = vi.fn();
    const unsubscribe = subscribeToWalletChanges(onWalletChanged);
    renderModal({ reservation: orgReservation });

    await confirmOrg();

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(onWalletChanged).not.toHaveBeenCalled();
    unsubscribe();
  });
});
