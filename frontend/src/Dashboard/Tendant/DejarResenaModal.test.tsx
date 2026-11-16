import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockRateStoreRoom = vi.hoisted(() => vi.fn());

vi.mock('../../services/ratings', () => ({ rateStoreRoom: mockRateStoreRoom }));

import DejarResenaModal from './DejarResenaModal';
import type { TenantReservation } from '../../services/reservations';

const reservation = {
  id: 5,
  status: 'confirmed',
  start_date: '2026-01-01',
  end_date: '2026-02-01',
  store_room_id: 9,
  total_mount: '100.00',
  can_be_cancelled: false,
  photo_url: null,
  store_rooms: { id: 9, title: 'Bodega Norte' },
} as TenantReservation;

function setup() {
  const onClose = vi.fn();
  const onReviewed = vi.fn();
  render(<DejarResenaModal reservation={reservation} onClose={onClose} onReviewed={onReviewed} />);
  return { onClose, onReviewed };
}

const submit = () => screen.getByRole('button', { name: 'Publicar reseña' });

describe('DejarResenaModal', () => {
  beforeEach(() => vi.clearAllMocks());

  it('asks for stars and text and keeps submit disabled until both are filled', () => {
    setup();

    expect(screen.getByText('¿Cómo fue tu experiencia?')).toBeInTheDocument();
    expect(submit()).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: '4 estrellas' }));
    expect(submit()).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Tu reseña'), { target: { value: 'Muy buena' } });
    expect(submit()).toBeEnabled();
  });

  it('posts the rating for the reservation storeroom and reports success', async () => {
    mockRateStoreRoom.mockResolvedValue({ data: {} });
    const { onReviewed } = setup();

    fireEvent.click(screen.getByRole('button', { name: '4 estrellas' }));
    fireEvent.change(screen.getByLabelText('Tu reseña'), { target: { value: 'Muy buena' } });
    fireEvent.click(submit());

    await waitFor(() => expect(onReviewed).toHaveBeenCalledTimes(1));
    expect(mockRateStoreRoom).toHaveBeenCalledWith({ store_id: 9, stars: 4, comment: 'Muy buena' });
  });

  it('explains a duplicate review (409) and stays open', async () => {
    mockRateStoreRoom.mockRejectedValue({ response: { status: 409, data: { message: 'Ya calificaste esta bodega' } } });
    const { onReviewed } = setup();

    fireEvent.click(screen.getByRole('button', { name: '5 estrellas' }));
    fireEvent.change(screen.getByLabelText('Tu reseña'), { target: { value: 'Genial' } });
    fireEvent.click(submit());

    expect(await screen.findByText('Ya calificaste esta bodega')).toBeInTheDocument();
    expect(onReviewed).not.toHaveBeenCalled();
  });

  it('Cancelar closes without posting', () => {
    const { onClose } = setup();

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(onClose).toHaveBeenCalled();
    expect(mockRateStoreRoom).not.toHaveBeenCalled();
  });
});
