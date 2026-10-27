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

    // Default sort is newest first, so the room with reservations (id 2) leads.
    const buttons = screen.getAllByRole('button', { name: /eliminar/i });
    expect(buttons[1]).not.toBeDisabled();
    expect(buttons[0]).toBeDisabled();
    expect(buttons[0]).toHaveAttribute(
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

    fireEvent.click(screen.getAllByRole('button', { name: /eliminar/i })[1]);
    const dialog = screen.getByRole('dialog', { name: 'Eliminar bodega' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Eliminar' }));

    await waitFor(() => expect(mockDeleteStoreRoom).toHaveBeenCalledWith(1));
    await waitFor(() => expect(screen.queryByText('Bodega Sin Reservas')).not.toBeInTheDocument());
    expect(screen.getByText('Bodega Con Reservas')).toBeInTheDocument();
  });
});

describe('BodegasArrendador list header and filters', () => {
  const mixed = {
    data: [
      { id: 1, title: 'Alfa', city: 'Quito', size: '1', publication_status: 'approved', storage_type: 's', room_type: 'r', active_reservations_count: 0, store_prices: [{ price: 1 }] },
      { id: 2, title: 'Beta', city: 'Quito', size: '1', publication_status: 'approved', storage_type: 's', room_type: 'r', active_reservations_count: 2, store_prices: [{ price: 1 }] },
      { id: 3, title: 'Gamma', city: 'Cuenca', size: '1', publication_status: 'pending', storage_type: 's', room_type: 'r', active_reservations_count: 0, store_prices: [{ price: 1 }] },
      { id: 4, title: 'Delta', city: 'Loja', size: '1', publication_status: 'rejected', storage_type: 's', room_type: 'r', active_reservations_count: 0, store_prices: [{ price: 1 }] },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: { landlord: { id: 9 } } });
    mockGetStoreRoomsByLandlord.mockResolvedValue(mixed);
  });

  const renderList = async () => {
    render(
      <MemoryRouter>
        <BodegasArrendador />
      </MemoryRouter>
    );
    await waitFor(() => screen.getByText('Alfa'));
  };

  it('shows the prototype title, subtitle and search placeholder', async () => {
    await renderList();
    expect(screen.getByRole('heading', { name: 'Mis bodegas' })).toBeInTheDocument();
    expect(screen.getByText('Gestiona tus espacios publicados y su estado de verificación.')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Buscar por nombre o sector')).toBeInTheDocument();
  });

  it('shows status chips with client-side counts and no Inactivas chip', async () => {
    await renderList();
    expect(screen.getByRole('button', { name: /^Todas\s*4$/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Aprobadas\s*1$/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Pendientes\s*1$/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Ocupadas\s*1$/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Rechazadas\s*1$/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Inactivas/ })).not.toBeInTheDocument();
  });

  it('filters the cards when a chip is selected', async () => {
    await renderList();
    fireEvent.click(screen.getByRole('button', { name: /^Pendientes/ }));
    expect(screen.getByText('Gamma')).toBeInTheDocument();
    expect(screen.queryByText('Alfa')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Ocupadas/ }));
    expect(screen.getByText('Beta')).toBeInTheDocument();
    expect(screen.queryByText('Alfa')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Todas/ }));
    expect(screen.getByText('Delta')).toBeInTheDocument();
  });

  it('applies the search term to the rendered cards', async () => {
    await renderList();
    fireEvent.change(screen.getByPlaceholderText('Buscar por nombre o sector'), { target: { value: 'cuenca' } });
    expect(screen.getByText('Gamma')).toBeInTheDocument();
    expect(screen.queryByText('Alfa')).not.toBeInTheDocument();
  });

  it('labels the card detail button "Ver detalle"', async () => {
    await renderList();
    expect(screen.getAllByRole('button', { name: 'Ver detalle' })).toHaveLength(4);
    expect(screen.queryByRole('button', { name: 'Ver Bodega' })).not.toBeInTheDocument();
  });
});
