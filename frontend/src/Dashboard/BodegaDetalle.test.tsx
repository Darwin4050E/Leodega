import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

const mockGetStoreRoomDetail = vi.hoisted(() => vi.fn());

vi.mock('../services/storeRooms', () => ({
  getStoreRoomDetail: mockGetStoreRoomDetail,
  updateStoreRoom: vi.fn(),
}));

import BodegaDetalle from './BodegaDetalle';

/**
 * Contract regression guard for GET /store-rooms/:id/detail.
 *
 * This component JSON.parse()s `detalle.security`, so the endpoint must keep
 * serving that field as a raw JSON string. When the SecurityFeatures cast was
 * added to the StoreRooms model it briefly turned `security` into an object,
 * which makes JSON.parse throw inside the render body and crashes this screen.
 * The typed object is served only by /store-rooms/:id/moderation-detail.
 */
const detailResponse = {
  id: 1,
  title: 'Bodega Norte',
  description: 'Amplia y seca',
  direction: 'Av. Siempre Viva 123',
  city: 'Guayaquil',
  size: 40,
  room_type: 'bodega',
  storage_type: 'completa',
  photos: ['https://example.test/photo.jpg'],
  prices: [{ price: 250 }],
  security: JSON.stringify({
    camara: true,
    ruido: false,
    control: true,
    objetos: false,
  }),
};

function renderDetalle() {
  return render(<BodegaDetalle bodega={{ id: 1 }} onVolver={() => {}} />);
}

describe('BodegaDetalle security contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetStoreRoomDetail.mockResolvedValue({ data: detailResponse });
  });

  it('renders the storeroom when security arrives as a JSON string', async () => {
    renderDetalle();

    expect(await screen.findByText('Bodega Norte')).toBeInTheDocument();
  });

  it('lists only the security features flagged true', async () => {
    renderDetalle();

    expect(
      await screen.findByText('Cámara de seguridad exterior')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Control de plagas y humedad')
    ).toBeInTheDocument();
    expect(screen.queryByText('Monitor de ruido')).not.toBeInTheDocument();
  });

  it('does not crash when security is absent', async () => {
    mockGetStoreRoomDetail.mockResolvedValue({
      data: { ...detailResponse, security: undefined },
    });

    renderDetalle();

    expect(await screen.findByText('Bodega Norte')).toBeInTheDocument();
  });
});
