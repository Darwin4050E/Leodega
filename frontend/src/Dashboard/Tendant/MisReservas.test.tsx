import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

const mockGetTenantReservations = vi.hoisted(() => vi.fn());

vi.mock('../../services/reservations', () => ({
  getTenantReservations: mockGetTenantReservations,
}));

vi.mock('../../Components/HeaderTendant', () => ({
  default: () => <div data-testid="header-tendant" />,
}));

// The cancel modal is exercised in its own dedicated test file (Commit 4);
// here it is stubbed so MisReservas' own responsibilities (fetch, tabs,
// empty/loading/error states) stay isolated.
vi.mock('./CancelarReservaTenantModal', () => ({
  default: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="cancel-modal">
      <button onClick={onClose}>close-modal</button>
    </div>
  ),
}));

import MisReservas from './MisReservas';

function reservation(overrides = {}) {
  return {
    id: 1,
    status: 'confirmed',
    start_date: '2026-07-01',
    end_date: '2026-10-01',
    store_room_id: 3,
    total_mount: '1850.00',
    can_be_cancelled: true,
    photo_url: null,
    store_rooms: { id: 3, title: 'Galpón Logístico Centro', direction: 'Centro', city: 'Guayaquil', size: 260 },
    ...overrides,
  };
}

describe('MisReservas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows a loading state while the list request is in flight', () => {
    mockGetTenantReservations.mockReturnValue(new Promise(() => {}));

    render(<MisReservas />);

    expect(screen.getByText(/Cargando/i)).toBeInTheDocument();
  });

  it('shows an error with a retry action when the list fetch fails, without rendering stale/partial data', async () => {
    mockGetTenantReservations.mockRejectedValueOnce({
      response: { data: { message: 'No se pudieron cargar las reservas.' } },
    });

    render(<MisReservas />);

    await waitFor(() => {
      expect(screen.getByText('No se pudieron cargar las reservas.')).toBeInTheDocument();
    });
    expect(screen.queryByText('Galpón Logístico Centro')).not.toBeInTheDocument();

    const retryButton = screen.getByRole('button', { name: /Reintentar/i });
    mockGetTenantReservations.mockResolvedValueOnce({ data: [reservation()] });
    fireEvent.click(retryButton);

    await waitFor(() => {
      expect(screen.getByText('Galpón Logístico Centro')).toBeInTheDocument();
    });
  });

  it('renders three tabs with count badges and filters the list', async () => {
    mockGetTenantReservations.mockResolvedValue({
      data: [
        reservation({ id: 1, status: 'confirmed', end_date: '2026-10-01' }),
        reservation({ id: 2, status: 'confirmed', end_date: '2020-01-01', can_be_cancelled: false }),
        reservation({ id: 3, status: 'canceled', can_be_cancelled: false }),
      ],
    });

    render(<MisReservas />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Activas/i })).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /Finalizadas/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Canceladas/i })).toBeInTheDocument();
    // Activas tab active by default: exactly reservation #1 shown.
    expect(screen.getAllByText('LEO-000001')).toHaveLength(1);
    expect(screen.queryByText('LEO-000002')).not.toBeInTheDocument();
    expect(screen.queryByText('LEO-000003')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Finalizadas/i }));
    expect(screen.getByText('LEO-000002')).toBeInTheDocument();
    expect(screen.queryByText('LEO-000001')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Canceladas/i }));
    expect(screen.getByText('LEO-000003')).toBeInTheDocument();
  });

  it('shows the empty-tab state when a tab has zero reservations', async () => {
    mockGetTenantReservations.mockResolvedValue({ data: [] });

    render(<MisReservas />);

    await waitFor(() => {
      expect(screen.getByText(/Aún no tienes reservas/i)).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /Explorar catálogo/i })).toBeInTheDocument();
  });

  it('opens the cancel modal when a card cancel button is clicked', async () => {
    mockGetTenantReservations.mockResolvedValue({ data: [reservation()] });

    render(<MisReservas />);

    await waitFor(() => {
      expect(screen.getByText('Galpón Logístico Centro')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar reserva' }));

    expect(screen.getByTestId('cancel-modal')).toBeInTheDocument();
  });
});
