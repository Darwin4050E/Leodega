import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import ReservationCard from './ReservationCard';
import type { TenantReservation } from '../../services/reservations';

function reservation(overrides: Partial<TenantReservation> = {}): TenantReservation {
  return {
    id: 1,
    status: 'confirmed',
    start_date: '2026-07-01',
    end_date: '2026-10-01',
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
    render(<ReservationCard reservation={reservation()} onCancelClick={vi.fn()} />);

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
      <ReservationCard reservation={reservation({ can_be_cancelled: false })} onCancelClick={vi.fn()} />
    );

    expect(screen.queryByRole('button', { name: /Cancelar reserva/i })).not.toBeInTheDocument();
  });

  // GIVEN a card with estado=activa, can_be_cancelled=true THEN the cancel
  // button renders, labeled "Cancelar reserva".
  it('renders a "Cancelar reserva" button when can_be_cancelled is true', () => {
    const onCancelClick = vi.fn();
    render(
      <ReservationCard reservation={reservation({ can_be_cancelled: true })} onCancelClick={onCancelClick} />
    );

    const button = screen.getByRole('button', { name: 'Cancelar reserva' });
    button.click();
    expect(onCancelClick).toHaveBeenCalledWith(reservation({ can_be_cancelled: true }));
  });

  it('renders the status badge for each state', () => {
    const { rerender } = render(
      <ReservationCard reservation={reservation({ status: 'confirmed' })} onCancelClick={vi.fn()} />
    );
    expect(screen.getByText('Activa')).toBeInTheDocument();

    rerender(
      <ReservationCard
        reservation={reservation({ status: 'confirmed', end_date: '2020-01-01' })}
        onCancelClick={vi.fn()}
      />
    );
    expect(screen.getByText('Finalizada')).toBeInTheDocument();

    rerender(
      <ReservationCard reservation={reservation({ status: 'canceled' })} onCancelClick={vi.fn()} />
    );
    expect(screen.getByText('Cancelada')).toBeInTheDocument();
  });

  // Spec "Post-cancel outcome": the card MUST display the refund amount
  // actually recorded, never a re-derived one.
  it('shows the recorded refund amount for a canceled reservation', () => {
    render(
      <ReservationCard
        reservation={reservation({ status: 'canceled', total_mount: '1850.00', refund_amount: '925.00' })}
        onCancelClick={vi.fn()}
      />
    );

    expect(screen.getByText('Reembolso')).toBeInTheDocument();
    expect(screen.getByText('$925')).toBeInTheDocument();
  });

  it('does not show a refund row for a non-canceled reservation', () => {
    render(<ReservationCard reservation={reservation({ status: 'confirmed' })} onCancelClick={vi.fn()} />);

    expect(screen.queryByText('Reembolso')).not.toBeInTheDocument();
  });

  // Prototype parity (PrototipoLeodega-main/js/TenantReservasPage.jsx:176):
  // the direction/city/size line carries a map pin icon.
  it('renders a map pin icon on the direction/city/size line', () => {
    const { container } = render(
      <ReservationCard reservation={reservation()} onCancelClick={vi.fn()} />
    );

    expect(container.querySelector('svg.lucide-map-pin')).not.toBeNull();
  });

  // Prototype parity (PrototipoLeodega-main/js/TenantReservasPage.jsx:143):
  // the cancel button carries a close (X) icon next to its label.
  it('renders a close icon on the cancel button when can_be_cancelled is true', () => {
    render(
      <ReservationCard reservation={reservation({ can_be_cancelled: true })} onCancelClick={vi.fn()} />
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
      <ReservationCard reservation={reservation({ photo_url: undefined })} onCancelClick={vi.fn()} />
    );

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(container.querySelector('svg.lucide-image-off')).not.toBeNull();
  });

  it('renders the real thumbnail and no placeholder when photo_url is present', () => {
    const { container } = render(
      <ReservationCard reservation={reservation()} onCancelClick={vi.fn()} />
    );

    expect(screen.getByRole('img', { name: 'Galpón Logístico Centro' })).toBeInTheDocument();
    expect(container.querySelector('svg.lucide-image-off')).toBeNull();
  });
});
