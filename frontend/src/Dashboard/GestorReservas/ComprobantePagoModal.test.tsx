import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import ComprobantePagoModal from './ComprobantePagoModal';
import type { LandlordReservation } from '../../services/reservations';

function reservation(overrides: Partial<LandlordReservation> = {}): LandlordReservation {
  return {
    id: 7,
    status: 'confirmed',
    start_date: '2030-01-10',
    end_date: '2030-04-10',
    total_mount: '4180.00',
    payment_status: 'paid',
    payment_id: 11,
    payment_method: 'credit card',
    ...overrides,
  } as LandlordReservation;
}

function renderModal(res: LandlordReservation) {
  render(
    <ComprobantePagoModal
      reservation={res}
      clienteNombre="Ana Pérez"
      clienteEmail="ana@example.com"
      bodegaTitulo="Bodega Norte"
      onClose={vi.fn()}
    />
  );
}

describe('ComprobantePagoModal payment method label', () => {
  it('keeps the card label for a card payment', () => {
    renderModal(reservation());

    expect(screen.getByText('Tarjeta de crédito')).toBeInTheDocument();
  });

  it('names the organization wallet for a wallet payment instead of printing the raw value', () => {
    renderModal(
      reservation({ payment_method: 'wallet', organization: { id: 5, name: 'Andina', ruc: '1792146739001' } })
    );

    expect(screen.getByText('Saldo de Andina')).toBeInTheDocument();
    expect(screen.queryByText('wallet')).not.toBeInTheDocument();
  });

  it('falls back to a generic wallet label when the organization is absent', () => {
    renderModal(reservation({ payment_method: 'wallet', organization: null }));

    expect(screen.getByText('Saldo de la organización')).toBeInTheDocument();
  });
});
