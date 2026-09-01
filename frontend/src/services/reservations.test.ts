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
  updateReservationStatus,
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

  it('createReservation posts the payload as-is to /reservations', () => {
    const payload = {
      store_room_id: 3,
      start_date: '2026-08-10',
      end_date: '2026-08-15',
      total_mount: 150,
    };
    createReservation(payload);
    expect(mockApi.post).toHaveBeenCalledWith('/reservations', payload);
  });

  it('updateReservationStatus patches the given reservation id with the payload', () => {
    updateReservationStatus(9, { status: 'confirmed' });
    expect(mockApi.patch).toHaveBeenCalledWith('/landlord/reservations/9/status', {
      status: 'confirmed',
    });
  });
});
