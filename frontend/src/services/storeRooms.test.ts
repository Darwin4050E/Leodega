import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockApi = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
}));

vi.mock('../api/axios', () => ({
  default: mockApi,
}));

import {
  getStoreRooms,
  getStoreRoomDetail,
  createStoreRoom,
  updateStoreRoom,
  getStoreRoomsByLandlord,
  uploadStoreRoomPhotos,
} from './storeRooms';

describe('storeRooms service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getStoreRooms calls GET /storeRooms', () => {
    getStoreRooms();
    expect(mockApi.get).toHaveBeenCalledWith('/storeRooms');
  });

  it('getStoreRoomDetail calls GET /store-rooms/:id/detail', () => {
    getStoreRoomDetail(2);
    expect(mockApi.get).toHaveBeenCalledWith('/store-rooms/2/detail');
  });

  it('createStoreRoom posts FormData with multipart headers to /storeRooms', () => {
    const formData = new FormData();
    formData.append('title', 'Bodega A');
    formData.append('firefighter_permit', new Blob([], { type: 'application/pdf' }));
    createStoreRoom(formData);
    expect(mockApi.post).toHaveBeenCalledWith('/storeRooms', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  });

  it('updateStoreRoom puts the payload to /storeRooms/:id', () => {
    const payload = { title: 'Bodega B' };
    updateStoreRoom(6, payload);
    expect(mockApi.put).toHaveBeenCalledWith('/storeRooms/6', payload);
  });

  it('getStoreRoomsByLandlord calls GET landlords/:id/storeRooms (no leading slash, matches current behavior)', () => {
    getStoreRoomsByLandlord(8);
    expect(mockApi.get).toHaveBeenCalledWith('landlords/8/storeRooms');
  });

  it('uploadStoreRoomPhotos posts FormData with multipart headers', () => {
    const formData = new FormData();
    formData.append('photo', new Blob());
    uploadStoreRoomPhotos(3, formData);
    expect(mockApi.post).toHaveBeenCalledWith('/store-rooms/3/photos', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  });
});
