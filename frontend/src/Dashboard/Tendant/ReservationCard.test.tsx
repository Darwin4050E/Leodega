import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import ReservationCard from './ReservationCard';
import { ActiveContext, type ActiveContextValue } from '../../context/activeContextBase';
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

    it('OR-WS11: shows an enabled cancel but hides the receipt on an org row the caller did not create', () => {
      const onCancelClick = vi.fn();
      render(
        <ReservationCard
          reservation={reservation({
            organization: { id: 5, name: 'Andina', ruc: '1792146739001' },
            is_creator: false,
            creator_name: 'Ana Torres',
            can_be_cancelled: true,
            receipt,
          })}
          onCancelClick={onCancelClick}
          onReceiptClick={vi.fn()}
        />
      );

      const cancel = screen.getByRole('button', { name: 'Cancelar reserva' });
      expect(cancel).not.toHaveAttribute('aria-disabled', 'true');
      fireEvent.click(cancel);
      expect(onCancelClick).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole('button', { name: 'Ver comprobante' })).not.toBeInTheDocument();
    });

    it('OR-WS12: the receipt is creator-only while cancel follows the server flags, not is_creator', () => {
      render(
        <ReservationCard
          reservation={reservation({
            organization: { id: 5, name: 'Andina', ruc: '1792146739001' },
            is_creator: true,
            creator_name: 'Ana Torres',
            can_be_cancelled: false,
            receipt,
          })}
          onCancelClick={vi.fn()}
          onReceiptClick={vi.fn()}
        />
      );

      expect(screen.getByRole('button', { name: 'Ver comprobante' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Cancelar reserva' })).not.toBeInTheDocument();
    });

    it('OR-WS16: renders an enabled cancel button that opens the modal for an admin on another member row', () => {
      const onCancelClick = vi.fn();
      const row = reservation({
        organization: { id: 5, name: 'Andina', ruc: '1792146739001' },
        is_creator: false,
        creator_name: 'Ana Torres',
        can_be_cancelled: true,
        cancel_requires_admin: false,
      });
      render(<ReservationCard reservation={row} onCancelClick={onCancelClick} onReceiptClick={vi.fn()} />);

      fireEvent.click(screen.getByRole('button', { name: 'Cancelar reserva' }));

      expect(onCancelClick).toHaveBeenCalledWith(row);
      expect(screen.queryByRole('tooltip', { hidden: true })).not.toBeInTheDocument();
    });

    it('OR-WS17: renders an aria-disabled cancel button with the admin-only tooltip when cancel_requires_admin is true', () => {
      const onCancelClick = vi.fn();
      render(
        <ReservationCard
          reservation={reservation({
            organization: { id: 5, name: 'Andina', ruc: '1792146739001' },
            is_creator: true,
            creator_name: 'Ana Torres',
            can_be_cancelled: false,
            cancel_requires_admin: true,
          })}
          onCancelClick={onCancelClick}
          onReceiptClick={vi.fn()}
        />
      );

      const button = screen.getByRole('button', { name: 'Cancelar reserva' });
      expect(button).toHaveAttribute('aria-disabled', 'true');
      expect(button).not.toBeDisabled();

      const tooltip = screen.getByRole('tooltip', { hidden: true });
      expect(tooltip).toHaveTextContent('Solo el administrador puede cancelar reservas de la organización');
      expect(button).toHaveAttribute('aria-describedby', tooltip.id);
      expect(tooltip).not.toBeVisible();

      fireEvent.mouseEnter(button);
      expect(tooltip).toBeVisible();
      fireEvent.mouseLeave(button);
      expect(tooltip).not.toBeVisible();

      fireEvent.focus(button);
      expect(tooltip).toBeVisible();
      fireEvent.keyDown(button, { key: 'Escape' });
      expect(tooltip).not.toBeVisible();
      fireEvent.blur(button);

      fireEvent.click(button);
      expect(onCancelClick).not.toHaveBeenCalled();
    });

    it('OR-WS18: renders no cancel button when both server flags are false', () => {
      render(
        <ReservationCard
          reservation={reservation({
            organization: { id: 5, name: 'Andina', ruc: '1792146739001' },
            is_creator: false,
            can_be_cancelled: false,
            cancel_requires_admin: false,
          })}
          onCancelClick={vi.fn()}
          onReceiptClick={vi.fn()}
        />
      );

      expect(screen.queryByRole('button', { name: 'Cancelar reserva' })).not.toBeInTheDocument();
      expect(screen.queryByRole('tooltip', { hidden: true })).not.toBeInTheDocument();
    });

    it('OR-WS19: the row flag wins over a stale cached admin role', () => {
      const staleAdminContext: ActiveContextValue = {
        context: { kind: 'organization', organizationId: 5 },
        activeOrganization: {
          id: 5,
          name: 'Andina',
          ruc: '1792146739001',
          email: 'a@andina.test',
          logo: null,
          status: 'active',
          role: 'admin',
        },
        organizations: [],
        status: 'ready',
        enabled: true,
        selectOrganization: vi.fn(),
        selectPersonal: vi.fn(),
        activateOrganization: vi.fn(),
        reloadOrganizations: vi.fn(),
      };
      render(
        <ActiveContext.Provider value={staleAdminContext}>
          <ReservationCard
            reservation={reservation({
              organization: { id: 5, name: 'Andina', ruc: '1792146739001' },
              is_creator: true,
              can_be_cancelled: false,
              cancel_requires_admin: true,
            })}
            onCancelClick={vi.fn()}
            onReceiptClick={vi.fn()}
          />
        </ActiveContext.Provider>
      );

      expect(screen.getByRole('button', { name: 'Cancelar reserva' })).toHaveAttribute('aria-disabled', 'true');
    });

    it('OR-WS20: a personal row keeps its cancel label, gating and no tooltip', () => {
      const onCancelClick = vi.fn();
      render(
        <ReservationCard
          reservation={reservation({ can_be_cancelled: true })}
          onCancelClick={onCancelClick}
          onReceiptClick={vi.fn()}
        />
      );

      const button = screen.getByRole('button', { name: 'Cancelar reserva' });
      expect(button).not.toHaveAttribute('aria-disabled');
      fireEvent.click(button);
      expect(onCancelClick).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole('tooltip', { hidden: true })).not.toBeInTheDocument();
    });

    it('OR-WS12: offers no pay action on a paid organization row (payment happens at creation)', () => {
      render(
        <ReservationCard
          reservation={reservation({
            organization: { id: 5, name: 'Andina', ruc: '1792146739001' },
            is_creator: true,
            status: 'confirmed',
            can_be_cancelled: true,
            receipt,
          })}
          onCancelClick={vi.fn()}
          onReceiptClick={vi.fn()}
        />
      );

      expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual([
        'Ver comprobante',
        'Cancelar reserva',
      ]);
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

  describe('review and report actions', () => {
    const PAST = '2020-01-01';

    function renderCard(overrides: Partial<TenantReservation>, handlers = {}) {
      const props = { onReviewClick: vi.fn(), onReportClick: vi.fn(), ...handlers };
      render(
        <ReservationCard
          reservation={reservation(overrides)}
          onCancelClick={vi.fn()}
          onReceiptClick={vi.fn()}
          {...props}
        />
      );
      return props;
    }

    it('active: offers "Reportar un problema" but not "Dejar reseña"', () => {
      const { onReportClick } = renderCard({});

      expect(screen.queryByRole('button', { name: /Dejar reseña/ })).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /Reportar un problema/ }));
      expect(onReportClick).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
    });

    it('finished: offers both actions', () => {
      const { onReviewClick, onReportClick } = renderCard({ end_date: PAST });

      fireEvent.click(screen.getByRole('button', { name: /Dejar reseña/ }));
      expect(onReviewClick).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
      expect(screen.getByRole('button', { name: /Reportar un problema/ })).toBeInTheDocument();
      expect(onReportClick).not.toHaveBeenCalled();
    });

    it('canceled: offers neither action', () => {
      renderCard({ status: 'canceled' });

      expect(screen.queryByRole('button', { name: /Dejar reseña/ })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Reportar un problema/ })).not.toBeInTheDocument();
    });
  });
});
