import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockDeleteStoreRoom = vi.hoisted(() => vi.fn());

vi.mock('../services/storeRooms', () => ({
  deleteStoreRoom: mockDeleteStoreRoom,
}));

import BodegaCard from './BodegaCard';

const baseProps = {
  id: 1,
  title: 'Bodega Norte',
  direction: 'Av. Siempre Viva 123',
  city: 'Quito',
  size: '20',
  publication_status: 'approved',
  storage_type: 'seco',
  room_type: 'individual',
};

function renderCard(props: Partial<React.ComponentProps<typeof BodegaCard>> = {}) {
  return render(
    <MemoryRouter>
      <BodegaCard {...baseProps} {...props} />
    </MemoryRouter>
  );
}

describe('BodegaCard delete action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('enables the delete action when active_reservations_count is 0', () => {
    renderCard({ active_reservations_count: 0 });
    expect(screen.getByRole('button', { name: /eliminar/i })).not.toBeDisabled();
  });

  it('disables the delete action with a padlock tooltip when there are active reservations', () => {
    renderCard({ active_reservations_count: 3 });
    const button = screen.getByRole('button', { name: /eliminar/i });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute(
      'title',
      'No se puede eliminar: tiene 3 reserva(s) activa(s) o futura(s).'
    );
  });

  it('opens the confirmation modal and sends no request until confirmed', () => {
    renderCard({ active_reservations_count: 0 });
    fireEvent.click(screen.getByRole('button', { name: /eliminar/i }));
    expect(screen.getByRole('dialog', { name: 'Eliminar bodega' })).toBeInTheDocument();
    expect(mockDeleteStoreRoom).not.toHaveBeenCalled();
  });

  it('dismissing the modal (Cancelar) sends no request', () => {
    renderCard({ active_reservations_count: 0 });
    fireEvent.click(screen.getByRole('button', { name: /eliminar/i }));
    fireEvent.click(screen.getByRole('button', { name: /cancelar/i }));
    expect(mockDeleteStoreRoom).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('confirming deletion calls deleteStoreRoom and notifies onDeleted on 200', async () => {
    mockDeleteStoreRoom.mockResolvedValue({ data: { message: 'Bodega eliminada correctamente' } });
    const onDeleted = vi.fn();
    renderCard({ active_reservations_count: 0, onDeleted });

    fireEvent.click(screen.getByRole('button', { name: /eliminar/i }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Eliminar' }));

    await waitFor(() => expect(mockDeleteStoreRoom).toHaveBeenCalledWith(1));
    await waitFor(() => expect(onDeleted).toHaveBeenCalledWith(1, 'deleted'));
  });

  it('keeps the storeroom listed and shows the server message on 409', async () => {
    mockDeleteStoreRoom.mockRejectedValue({
      response: { status: 409, data: { message: 'Tiene reservas activas' } },
    });
    const onDeleted = vi.fn();
    renderCard({ active_reservations_count: 0, onDeleted });

    fireEvent.click(screen.getByRole('button', { name: /eliminar/i }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Eliminar' }));

    await waitFor(() => expect(screen.getByText('Tiene reservas activas')).toBeInTheDocument());
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it('shows the server message on 403 without removing the storeroom', async () => {
    mockDeleteStoreRoom.mockRejectedValue({
      response: { status: 403, data: { message: 'No autorizado' } },
    });
    const onDeleted = vi.fn();
    renderCard({ active_reservations_count: 0, onDeleted });

    fireEvent.click(screen.getByRole('button', { name: /eliminar/i }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Eliminar' }));

    await waitFor(() => expect(screen.getByText('No autorizado')).toBeInTheDocument());
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it('removes the storeroom from the list on 404 (already deleted)', async () => {
    mockDeleteStoreRoom.mockRejectedValue({
      response: { status: 404, data: { message: 'Bodega no encontrada' } },
    });
    const onDeleted = vi.fn();
    renderCard({ active_reservations_count: 0, onDeleted });

    fireEvent.click(screen.getByRole('button', { name: /eliminar/i }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Eliminar' }));

    await waitFor(() => expect(onDeleted).toHaveBeenCalledWith(1, 'not_found'));
  });
});
