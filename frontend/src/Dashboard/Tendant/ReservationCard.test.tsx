import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import ReservationCard from './ReservationCard';
import type { TenantReceipt, TenantReservation } from '../../services/reservations';

const receipt: TenantReceipt = {
  code: 'LEO-000001',
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
};

// Far-future end date keeps 'confirmed' fixtures active regardless of today's date.
const ACTIVE_END_DATE = '2999-12-31';

function reservation(overrides: Partial<TenantReservation> = {}): TenantReservation {
  return {
    id: 1,
    status: 'confirmed',
    start_date: '2026-07-01',
    end_date: ACTIVE_END_DATE,
    store_room_id: 3,
    total_mount: '1850.00',
    can_be_cancelled: false,
    photo_url: 'https://example.test/storage/store_photos/a.jpg',
    store_rooms: { id: 3, title: 'Galpón Logístico Centro', direction: 'Centro', city: 'Guayaquil', size: 260 },
    ...overrides,
  };
}

describe('ReservationCard', () => {
  it('renders thumbnail, title, direction/city/size line, and stat row', () => {
    render(<ReservationCard reservation={reservation()} onCancelClick={vi.fn()} onReceiptClick={vi.fn()} />);

    expect(screen.getByRole('img', { name: 'Galpón Logístico Centro' })).toHaveAttribute(
      'src',
      'https://example.test/storage/store_photos/a.jpg'
    );
    expect(screen.getByText('Galpón Logístico Centro')).toBeInTheDocument();
    expect(screen.getByText('Centro, Guayaquil · 260 m²')).toBeInTheDocument();
    expect(screen.getByText('LEO-000001')).toBeInTheDocument();
    expect(screen.getByText('$1,850')).toBeInTheDocument();
  });

  // GIVEN a card with estado=activa, start_date already passed,
  // can_be_cancelled=false THEN no cancel button renders.
  it('does not render a cancel button when can_be_cancelled is false', () => {
    render(
      <ReservationCard reservation={reservation({ can_be_cancelled: false })} onCancelClick={vi.fn()} onReceiptClick={vi.fn()} />
    );

    expect(screen.queryByRole('button', { name: /Cancelar reserva/i })).not.toBeInTheDocument();
  });

  // GIVEN a card with estado=activa, can_be_cancelled=true THEN the cancel
  // button renders, labeled "Cancelar reserva".
  it('renders a "Cancelar reserva" button when can_be_cancelled is true', () => {
    const onCancelClick = vi.fn();
    render(
      <ReservationCard reservation={reservation({ can_be_cancelled: true })} onCancelClick={onCancelClick} onReceiptClick={vi.fn()} />
    );

    const button = screen.getByRole('button', { name: 'Cancelar reserva' });
    button.click();
    expect(onCancelClick).toHaveBeenCalledWith(reservation({ can_be_cancelled: true }));
  });

  it('renders the status badge for each state', () => {
    const { rerender } = render(
      <ReservationCard reservation={reservation({ status: 'confirmed' })} onCancelClick={vi.fn()} onReceiptClick={vi.fn()} />
    );
    expect(screen.getByText('Activa')).toBeInTheDocument();

    rerender(
      <ReservationCard
        reservation={reservation({ status: 'confirmed', end_date: '2020-01-01' })}
        onCancelClick={vi.fn()} onReceiptClick={vi.fn()}
      />
    );
    expect(screen.getByText('Finalizada')).toBeInTheDocument();

    rerender(
      <ReservationCard reservation={reservation({ status: 'canceled' })} onCancelClick={vi.fn()} onReceiptClick={vi.fn()} />
    );
    expect(screen.getByText('Cancelada')).toBeInTheDocument();
  });

  // Spec "Post-cancel outcome": the card MUST display the refund amount
  // actually recorded, never a re-derived one.
  it('shows the recorded refund amount for a canceled reservation', () => {
    render(
      <ReservationCard
        reservation={reservation({ status: 'canceled', total_mount: '1850.00', refund_amount: '925.00' })}
        onCancelClick={vi.fn()} onReceiptClick={vi.fn()}
      />
    );

    expect(screen.getByText('Reembolso')).toBeInTheDocument();
    expect(screen.getByText('$925')).toBeInTheDocument();
  });

  it('does not show a refund row for a non-canceled reservation', () => {
    render(<ReservationCard reservation={reservation({ status: 'confirmed' })} onCancelClick={vi.fn()} onReceiptClick={vi.fn()} />);

    expect(screen.queryByText('Reembolso')).not.toBeInTheDocument();
  });

  // Prototype parity (PrototipoLeodega-main/js/TenantReservasPage.jsx:176):
  // the direction/city/size line carries a map pin icon.
  it('renders a map pin icon on the direction/city/size line', () => {
    const { container } = render(
      <ReservationCard reservation={reservation()} onCancelClick={vi.fn()} onReceiptClick={vi.fn()} />
    );

    expect(container.querySelector('svg.lucide-map-pin')).not.toBeNull();
  });

  // Prototype parity (PrototipoLeodega-main/js/TenantReservasPage.jsx:143):
  // the cancel button carries a close (X) icon next to its label.
  it('renders a close icon on the cancel button when can_be_cancelled is true', () => {
    render(
      <ReservationCard reservation={reservation({ can_be_cancelled: true })} onCancelClick={vi.fn()} onReceiptClick={vi.fn()} />
    );

    const button = screen.getByRole('button', { name: 'Cancelar reserva' });
    expect(button.querySelector('svg.lucide-x')).not.toBeNull();
  });

  // Every storeroom in production currently has zero photos (no `photos`
  // validation rule on publish), so this is the common path, not an edge
  // case: the card must keep its thumbnail slot occupied to avoid layout
  // shift when `photo_url` is absent.
  it('renders a placeholder thumbnail when photo_url is absent', () => {
    const { container } = render(
      <ReservationCard reservation={reservation({ photo_url: undefined })} onCancelClick={vi.fn()} onReceiptClick={vi.fn()} />
    );

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(container.querySelector('svg.lucide-image-off')).not.toBeNull();
  });

  it('renders the real thumbnail and no placeholder when photo_url is present', () => {
    const { container } = render(
      <ReservationCard reservation={reservation()} onCancelClick={vi.fn()} onReceiptClick={vi.fn()} />
    );

    expect(screen.getByRole('img', { name: 'Galpón Logístico Centro' })).toBeInTheDocument();
    expect(container.querySelector('svg.lucide-image-off')).toBeNull();
  });

  describe('receipt button', () => {
    it('shows "Ver comprobante" on an active card with a receipt and passes the reservation on click', () => {
      const onReceiptClick = vi.fn();
      const paid = reservation({ receipt });
      render(<ReservationCard reservation={paid} onCancelClick={vi.fn()} onReceiptClick={onReceiptClick} />);

      expect(screen.getByText('Activa')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Ver comprobante' }));

      expect(onReceiptClick).toHaveBeenCalledWith(paid);
    });

    it('shows "Ver comprobante" on a finished card with a receipt', () => {
      render(
        <ReservationCard
          reservation={reservation({ end_date: '2020-01-01', receipt })}
          onCancelClick={vi.fn()}
          onReceiptClick={vi.fn()}
        />
      );

      expect(screen.getByText('Finalizada')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Ver comprobante' })).toBeInTheDocument();
    });

    it.each([
      ['pending', { status: 'pending', receipt: null }],
      ['canceled after paying', { status: 'canceled', receipt: null }],
      ['without the field', { status: 'confirmed' }],
    ])('hides "Ver comprobante" for a %s reservation', (_label, overrides) => {
      render(<ReservationCard reservation={reservation(overrides)} onCancelClick={vi.fn()} onReceiptClick={vi.fn()} />);

      expect(screen.queryByRole('button', { name: 'Ver comprobante' })).not.toBeInTheDocument();
    });

    it('keeps the cancel button independent of the receipt button', () => {
      const { rerender } = render(
        <ReservationCard
          reservation={reservation({ receipt, can_be_cancelled: true })}
          onCancelClick={vi.fn()}
          onReceiptClick={vi.fn()}
        />
      );
      expect(screen.getByRole('button', { name: 'Ver comprobante' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cancelar reserva' })).toBeInTheDocument();

      rerender(
        <ReservationCard
          reservation={reservation({ receipt, can_be_cancelled: false })}
          onCancelClick={vi.fn()}
          onReceiptClick={vi.fn()}
        />
      );
      expect(screen.getByRole('button', { name: 'Ver comprobante' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Cancelar reserva' })).not.toBeInTheDocument();
    });
  });

  // HUE-05 OR-WS8/WS11/WS12
  describe('organization context (OR-W4/OR-W5)', () => {
    it('OR-WS8: shows an organization badge and the creator name for an org reservation', () => {
      render(
        <ReservationCard
          reservation={reservation({
            organization: { id: 5, name: 'Andina', ruc: '1792146739001' },
            is_creator: false,
            creator_name: 'Ana Torres',
          })}
          onCancelClick={vi.fn()}
          onReceiptClick={vi.fn()}
        />
      );

      expect(screen.getByText('Andina')).toBeInTheDocument();
      expect(screen.getByText('Reservada por Ana Torres')).toBeInTheDocument();
    });

    it('shows no organization badge or creator line for a personal reservation', () => {
      render(<ReservationCard reservation={reservation()} onCancelClick={vi.fn()} onReceiptClick={vi.fn()} />);

      expect(screen.queryByText(/Reservada por/)).not.toBeInTheDocument();
    });

    it('OR-WS11: hides both cancel and receipt actions when is_creator is false, even if the server also sent can_be_cancelled/receipt', () => {
      render(
        <ReservationCard
          reservation={reservation({
            organization: { id: 5, name: 'Andina', ruc: '1792146739001' },
            is_creator: false,
            creator_name: 'Ana Torres',
            can_be_cancelled: true,
            receipt,
          })}
          onCancelClick={vi.fn()}
          onReceiptClick={vi.fn()}
        />
      );

      expect(screen.queryByRole('button', { name: 'Cancelar reserva' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Ver comprobante' })).not.toBeInTheDocument();
    });

    it('OR-WS12: renders actions normally when is_creator is true', () => {
      render(
        <ReservationCard
          reservation={reservation({
            organization: { id: 5, name: 'Andina', ruc: '1792146739001' },
            is_creator: true,
            creator_name: 'Ana Torres',
            can_be_cancelled: true,
            receipt,
          })}
          onCancelClick={vi.fn()}
          onReceiptClick={vi.fn()}
        />
      );

      expect(screen.getByRole('button', { name: 'Cancelar reserva' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Ver comprobante' })).toBeInTheDocument();
    });

    it('renders actions normally when is_creator is absent (personal row)', () => {
      render(
        <ReservationCard
          reservation={reservation({ can_be_cancelled: true, receipt })}
          onCancelClick={vi.fn()}
          onReceiptClick={vi.fn()}
        />
      );

      expect(screen.getByRole('button', { name: 'Cancelar reserva' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Ver comprobante' })).toBeInTheDocument();
    });
  });
});
