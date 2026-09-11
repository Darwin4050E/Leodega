import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockApi = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
}));

vi.mock('../api/axios', () => ({
  default: mockApi,
}));

import {
  getLandlordReservations,
  getReservedDates,
  createReservation,
  cancelReservation,
  getCancellationRate,
} from './reservations';

describe('reservations service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getLandlordReservations calls GET /landlord/reservations', () => {
    getLandlordReservations();
    expect(mockApi.get).toHaveBeenCalledWith('/landlord/reservations');
  });

  it('getReservedDates calls GET /storeRooms/:id/reserved-dates', () => {
    getReservedDates(7);
    expect(mockApi.get).toHaveBeenCalledWith('/storeRooms/7/reserved-dates');
  });

  it('createReservation posts the payload without total_mount to /reservations', () => {
    const payload = {
      store_room_id: 3,
      start_date: '2026-08-10',
      end_date: '2026-08-15',
    };
    createReservation(payload);
    expect(mockApi.post).toHaveBeenCalledWith('/reservations', payload);
    // @ts-expect-error -- total_mount must not exist on the payload type
    expect(payload.total_mount).toBeUndefined();
  });

  it('cancelReservation patches the given reservation id with the reason', () => {
    mockApi.patch.mockResolvedValue({ data: { message: 'ok' } });
    cancelReservation(9, { reason: 'El almacen sufrio un incendio' });
    expect(mockApi.patch).toHaveBeenCalledWith('/landlord/reservations/9/cancel', {
      reason: 'El almacen sufrio un incendio',
    });
  });

  it('cancelReservation resolves on success (200)', async () => {
    mockApi.patch.mockResolvedValue({ data: { message: 'Reserva cancelada' } });
    await expect(cancelReservation(9, { reason: 'Motivo valido largo' })).resolves.toEqual({
      data: { message: 'Reserva cancelada' },
    });
  });

  it('cancelReservation rejects on 409/403/404 the same way axios does', async () => {
    const error = { response: { status: 409, data: { message: 'Ya no es cancelable' } } };
    mockApi.patch.mockRejectedValue(error);
    await expect(cancelReservation(9, { reason: 'Motivo valido largo' })).rejects.toEqual(error);
  });

  it('getCancellationRate calls GET /landlord/reservations/cancellation-rate', () => {
    getCancellationRate();
    expect(mockApi.get).toHaveBeenCalledWith('/landlord/reservations/cancellation-rate');
  });

  it('getCancellationRate rejects when the request fails', async () => {
    const error = { response: { status: 500 } };
    mockApi.get.mockRejectedValue(error);
    await expect(getCancellationRate()).rejects.toEqual(error);
  });
});
