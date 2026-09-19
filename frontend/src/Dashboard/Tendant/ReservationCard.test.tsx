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
});
