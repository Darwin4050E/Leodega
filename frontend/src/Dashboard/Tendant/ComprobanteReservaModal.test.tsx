import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

const mockDownloadReservationReceipt = vi.hoisted(() => vi.fn());

vi.mock('../../utils/receiptDownload', () => ({
  downloadReservationReceipt: mockDownloadReservationReceipt,
}));

import ComprobanteReservaModal from './ComprobanteReservaModal';
import type { TenantReceipt, TenantReservation } from '../../services/reservations';

const ERROR_MESSAGE = 'No se pudo descargar el comprobante. Inténtalo de nuevo.';

function receipt(overrides: Partial<TenantReceipt> = {}): TenantReceipt {
  return {
    code: 'LEO-000007',
    status_label: 'CONFIRMADA',
    store_room_title: 'Galpón Logístico Centro',
    gestor_name: 'Laura Gómez',
    start_date: '2026-07-01',
    end_date: '2026-10-01',
    total_paid: '1850.00',
    payment_id: 11,
    payment_method: 'credit card',
    payment_method_label: 'Tarjeta de crédito',
    paid_at: '2026-10-01T22:30:00-05:00',
    paid_at_label: '1 oct 2026, 22:30',
    ...overrides,
  };
}

function reservation(receiptOverrides: Partial<TenantReceipt> | null = {}): TenantReservation {
  return {
    id: 7,
    status: 'confirmed',
    start_date: '2026-07-01',
    end_date: '2026-10-01',
    store_room_id: 3,
    total_mount: '1850.00',
    can_be_cancelled: false,
    photo_url: null,
    receipt: receiptOverrides === null ? null : receipt(receiptOverrides),
  };
}

function renderModal(res: TenantReservation = reservation()) {
  const onClose = vi.fn();
  render(<ComprobanteReservaModal reservation={res} onClose={onClose} />);
  return { onClose };
}

function field(label: string) {
  return within(screen.getByText(label).parentElement as HTMLElement);
}

describe('ComprobanteReservaModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders every receipt field, printing paid_at_label verbatim', () => {
    renderModal();

    expect(screen.getByRole('dialog', { name: /LEO-000007/ })).toBeInTheDocument();
    expect(field('Número de reserva').getByText('LEO-000007')).toBeInTheDocument();
    expect(field('Bodega').getByText('Galpón Logístico Centro')).toBeInTheDocument();
    expect(field('Gestor').getByText('Laura Gómez')).toBeInTheDocument();
    expect(field('Fecha de inicio').getByText('2026-07-01')).toBeInTheDocument();
    expect(field('Fecha de fin').getByText('2026-10-01')).toBeInTheDocument();
    expect(field('Monto total pagado').getByText('$1,850 USD')).toBeInTheDocument();
    expect(field('Fecha y hora de pago').getByText('1 oct 2026, 22:30')).toBeInTheDocument();
    expect(field('Estado').getByText('CONFIRMADA')).toBeInTheDocument();
    expect(field('Método de pago').getByText('Tarjeta de crédito')).toBeInTheDocument();
  });

  it('does not reformat the label from the raw timestamp', () => {
    renderModal(reservation({ paid_at: '2030-01-01T00:00:00-05:00', paid_at_label: 'etiqueta del servidor' }));

    expect(screen.getByText('etiqueta del servidor')).toBeInTheDocument();
    expect(screen.queryByText(/2030/)).not.toBeInTheDocument();
  });

  it('shows an em dash when the gestor is unknown', () => {
    renderModal(reservation({ gestor_name: null }));

    expect(field('Gestor').getByText('—')).toBeInTheDocument();
  });

  it('omits the payment method row when there is no method', () => {
    renderModal(reservation({ payment_method: null, payment_method_label: null }));

    expect(screen.queryByText('Método de pago')).not.toBeInTheDocument();
  });

  it('renders nothing when the reservation has no receipt', () => {
    renderModal(reservation(null));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('downloads the PDF for the reservation id, with a disabled in-flight state and no toast', async () => {
    let resolveDownload: () => void = () => {};
    mockDownloadReservationReceipt.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveDownload = resolve;
      })
    );
    renderModal();

    fireEvent.click(screen.getByRole('button', { name: 'Descargar PDF' }));

    expect(mockDownloadReservationReceipt).toHaveBeenCalledWith(7);
    const busy = screen.getByRole('button', { name: 'Descargando...' });
    expect(busy).toBeDisabled();

    resolveDownload();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Descargar PDF' })).toBeEnabled();
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByText(/demo/i)).not.toBeInTheDocument();
  });

  it('shows the generic error on failure, stays open, and allows a retry', async () => {
    mockDownloadReservationReceipt.mockRejectedValueOnce(new Error(ERROR_MESSAGE));
    const { onClose } = renderModal();

    fireEvent.click(screen.getByRole('button', { name: 'Descargar PDF' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(ERROR_MESSAGE);
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    mockDownloadReservationReceipt.mockResolvedValueOnce(undefined);
    fireEvent.click(screen.getByRole('button', { name: 'Descargar PDF' }));

    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
    expect(mockDownloadReservationReceipt).toHaveBeenCalledTimes(2);
  });

  it('Cerrar calls onClose', () => {
    const { onClose } = renderModal();

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // HUE-05 OR-WS6/WS7
  it('shows the organization name and RUC when the receipt carries one', () => {
    renderModal(reservation({ organization_name: 'Andina', organization_ruc: '1792146739001' }));

    expect(field('Organización').getByText(/Andina/)).toBeInTheDocument();
    expect(screen.getByText(/1792146739001/)).toBeInTheDocument();
  });

  it('shows no organization field for a personal reservation', () => {
    renderModal();

    expect(screen.queryByText('Organización')).not.toBeInTheDocument();
  });
});
