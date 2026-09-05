import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockGetStoreRoomDetail = vi.hoisted(() => vi.fn());
const mockGetReservedDates = vi.hoisted(() => vi.fn());
const mockCreateReservation = vi.hoisted(() => vi.fn());
const mockUseAuth = vi.hoisted(() => vi.fn());
const mockAlert = vi.hoisted(() => vi.fn());

vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: '7' }),
  useNavigate: () => vi.fn(),
}));

vi.mock('../services/storeRooms', () => ({
  getStoreRoomDetail: mockGetStoreRoomDetail,
}));

vi.mock('../services/reservations', () => ({
  getReservedDates: mockGetReservedDates,
  createReservation: mockCreateReservation,
}));

vi.mock('../context/useAuth', () => ({
  useAuth: mockUseAuth,
}));

import LeodegaUI from './LeodegaUI';

const storeRoomDetail = {
  title: 'Bodega Norte',
  description: 'Amplia bodega',
  direction: 'Av. Siempre Viva 123',
  city: 'Quito',
  size: 20,
  room_type: 'individual',
  photos: [],
  prices: [{ price: 150 }],
  landlord: { id: 1, user_id: 2, name: 'Laura', lastname: 'Gomez', email: 'laura@example.com' },
};

describe('LeodegaUI booking payload and total display', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('alert', mockAlert);
    mockUseAuth.mockReturnValue({ user: { role: 'tenant' } });
    mockGetStoreRoomDetail.mockResolvedValue({ data: storeRoomDetail });
    mockGetReservedDates.mockResolvedValue({ data: [] });
  });

  it('sends the booking payload WITHOUT total_mount and shows the server-computed total', async () => {
    mockCreateReservation.mockResolvedValue({
      data: { message: 'Solicitud enviada', reservation: { id: 1, total_mount: '4180.00' } },
    });

    render(<LeodegaUI />);

    await waitFor(() => screen.getByText('Bodega Norte'));

    fireEvent.click(screen.getByRole('button', { name: 'Reservar' }));

    await waitFor(() => expect(screen.queryByText('Cargando disponibilidad...')).not.toBeInTheDocument());

    const dateInputs = screen.getAllByDisplayValue('');
    fireEvent.change(dateInputs[0], { target: { value: '2030-01-10' } });
    fireEvent.change(dateInputs[1], { target: { value: '2030-02-10' } });

    const submitButtons = screen.getAllByRole('button', { name: 'Enviar solicitud' });
    fireEvent.click(submitButtons[submitButtons.length - 1]);

    await waitFor(() => expect(mockCreateReservation).toHaveBeenCalledTimes(1));

    const [payload] = mockCreateReservation.mock.calls[0];
    expect(payload).toEqual({
      store_room_id: 7,
      start_date: '2030-01-10',
      end_date: '2030-02-10',
    });
    expect(payload.total_mount).toBeUndefined();

    await waitFor(() =>
      expect(mockAlert).toHaveBeenCalledWith('Solicitud enviada. Total: $4,180 USD')
    );
  });

  it('falls back to a plain success message when the server omits the total', async () => {
    mockCreateReservation.mockResolvedValue({
      data: { message: 'Solicitud enviada', reservation: { id: 1 } },
    });

    render(<LeodegaUI />);
    await waitFor(() => screen.getByText('Bodega Norte'));

    fireEvent.click(screen.getByRole('button', { name: 'Reservar' }));

    await waitFor(() => expect(screen.queryByText('Cargando disponibilidad...')).not.toBeInTheDocument());

    const dateInputs = screen.getAllByDisplayValue('');
    fireEvent.change(dateInputs[0], { target: { value: '2030-01-10' } });
    fireEvent.change(dateInputs[1], { target: { value: '2030-02-10' } });

    const submitButtons = screen.getAllByRole('button', { name: 'Enviar solicitud' });
    fireEvent.click(submitButtons[submitButtons.length - 1]);

    await waitFor(() => expect(mockAlert).toHaveBeenCalledWith('Solicitud enviada'));
  });
});
