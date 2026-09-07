import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockGetStoreRoomsByLandlord = vi.hoisted(() => vi.fn());
const mockDeleteStoreRoom = vi.hoisted(() => vi.fn());
const mockUseAuth = vi.hoisted(() => vi.fn());

vi.mock('../services/storeRooms', () => ({
  getStoreRoomsByLandlord: mockGetStoreRoomsByLandlord,
  deleteStoreRoom: mockDeleteStoreRoom,
}));

vi.mock('../context/useAuth', () => ({
  useAuth: mockUseAuth,
}));

import BodegasArrendador from './BodegasArrendador';

const bodegasResponse = {
  data: [
    {
      id: 1,
      title: 'Bodega Sin Reservas',
      city: 'Quito',
      size: '20',
      publication_status: 'approved',
      storage_type: 'seco',
      room_type: 'individual',
      active_reservations_count: 0,
      store_prices: [{ price: 100 }],
    },
    {
      id: 2,
      title: 'Bodega Con Reservas',
      city: 'Quito',
      size: '30',
      publication_status: 'approved',
      storage_type: 'seco',
      room_type: 'individual',
      active_reservations_count: 2,
      store_prices: [{ price: 200 }],
    },
  ],
};

describe('BodegasArrendador delete flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: { landlord: { id: 9 } } });
    mockGetStoreRoomsByLandlord.mockResolvedValue(bodegasResponse);
  });

  it('threads active_reservations_count into each BodegaCard so the blocked one is disabled', async () => {
    render(
      <MemoryRouter>
        <BodegasArrendador />
      </MemoryRouter>
    );

    await waitFor(() => screen.getByText('Bodega Sin Reservas'));

    const buttons = screen.getAllByRole('button', { name: /eliminar/i });
    expect(buttons[0]).not.toBeDisabled();
    expect(buttons[1]).toBeDisabled();
    expect(buttons[1]).toHaveAttribute(
      'title',
      'No se puede eliminar: tiene 2 reserva(s) activa(s) o futura(s).'
    );
  });

  it('removes a storeroom from the list after a confirmed delete (200)', async () => {
    mockDeleteStoreRoom.mockResolvedValue({ data: { message: 'Bodega eliminada correctamente' } });

    render(
      <MemoryRouter>
        <BodegasArrendador />
      </MemoryRouter>
    );

    await waitFor(() => screen.getByText('Bodega Sin Reservas'));

    fireEvent.click(screen.getAllByRole('button', { name: /eliminar/i })[0]);
    const dialog = screen.getByRole('dialog', { name: 'Eliminar bodega' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Eliminar' }));

    await waitFor(() => expect(mockDeleteStoreRoom).toHaveBeenCalledWith(1));
    await waitFor(() => expect(screen.queryByText('Bodega Sin Reservas')).not.toBeInTheDocument());
    expect(screen.getByText('Bodega Con Reservas')).toBeInTheDocument();
  });
});
