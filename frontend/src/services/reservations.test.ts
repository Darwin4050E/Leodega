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
  createPayment,
  getTenantReservations,
  getCancellationPreview,
  cancelReservationAsTenant,
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

  it('createPayment posts exactly the payment shape to /payments, no card fields', () => {
    const payload = {
      reservation_id: 42,
      payment_method: 'credit card' as const,
      payment_state: 'paid' as const,
      payment_date: '2026-09-17',
    };
    createPayment(payload);
    expect(mockApi.post).toHaveBeenCalledWith('/payments', payload);

    const [, sentBody] = mockApi.post.mock.calls[0];
    expect(Object.keys(sentBody).sort()).toEqual(
      ['payment_date', 'payment_method', 'payment_state', 'reservation_id'].sort()
    );
    expect(sentBody).not.toHaveProperty('card_number');
    expect(sentBody).not.toHaveProperty('card_holder');
    expect(sentBody).not.toHaveProperty('expiry');
    expect(sentBody).not.toHaveProperty('cvv');
  });

  it('createPayment resolves with the backend payment shape', async () => {
    mockApi.post.mockResolvedValue({
      data: { message: 'Pago registrado', payment: { id: 1, reservation_id: 42, payment_method: 'credit card', payment_state: 'paid', payment_date: '2026-09-17' } },
    });

    await expect(
      createPayment({
        reservation_id: 42,
        payment_method: 'credit card',
        payment_state: 'paid',
        payment_date: '2026-09-17',
      })
    ).resolves.toEqual({
      data: { message: 'Pago registrado', payment: { id: 1, reservation_id: 42, payment_method: 'credit card', payment_state: 'paid', payment_date: '2026-09-17' } },
    });
  });

  // -- sdd/tenant-reservations-screen ------------------------------------

  it('getTenantReservations calls GET /tenant/reservations', () => {
    getTenantReservations();
    expect(mockApi.get).toHaveBeenCalledWith('/tenant/reservations');
  });

  it('getTenantReservations resolves with the tenant reservation shape', async () => {
    const reservation = {
      id: 5,
      status: 'confirmed',
      start_date: '2026-09-01',
      end_date: '2026-09-10',
      store_room_id: 3,
      total_mount: '100.00',
      can_be_cancelled: true,
      photo_url: 'https://example.test/storage/store_photos/a.jpg',
      store_rooms: { id: 3, title: 'Bodega Centro', direction: 'Av. Siempre Viva', city: 'Quito', size: 20 },
    };
    mockApi.get.mockResolvedValue({ data: [reservation] });

    await expect(getTenantReservations()).resolves.toEqual({ data: [reservation] });
  });

  it('getCancellationPreview calls GET /tenant/reservations/:id/cancellation-preview', () => {
    getCancellationPreview(11);
    expect(mockApi.get).toHaveBeenCalledWith('/tenant/reservations/11/cancellation-preview');
  });

  it('getCancellationPreview resolves with can_be_cancelled and refund_amount', async () => {
    mockApi.get.mockResolvedValue({ data: { can_be_cancelled: true, refund_amount: '50.00' } });

    await expect(getCancellationPreview(11)).resolves.toEqual({
      data: { can_be_cancelled: true, refund_amount: '50.00' },
    });
  });

  it('getCancellationPreview rejects with a 409 when the reservation is no longer cancellable', async () => {
    const error = { response: { status: 409, data: { message: 'Esta reserva ya no puede cancelarse.' } } };
    mockApi.get.mockRejectedValue(error);

    await expect(getCancellationPreview(11)).rejects.toEqual(error);
  });

  it('cancelReservationAsTenant patches /tenant/reservations/:id/cancel with no body', () => {
    mockApi.patch.mockResolvedValue({ data: { message: 'Reserva cancelada' } });
    cancelReservationAsTenant(9);
    expect(mockApi.patch).toHaveBeenCalledWith('/tenant/reservations/9/cancel', {});
  });

  it('cancelReservationAsTenant resolves on success (200)', async () => {
    mockApi.patch.mockResolvedValue({ data: { message: 'Reserva cancelada' } });

    await expect(cancelReservationAsTenant(9)).resolves.toEqual({
      data: { message: 'Reserva cancelada' },
    });
  });

  it('cancelReservationAsTenant rejects on 409/403/404 the same way axios does', async () => {
    const error = { response: { status: 409, data: { message: 'Ya no es cancelable' } } };
    mockApi.patch.mockRejectedValue(error);

    await expect(cancelReservationAsTenant(9)).rejects.toEqual(error);
  });
});
