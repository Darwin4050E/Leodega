import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

const mockGetStoreRooms = vi.hoisted(() => vi.fn());
const mockRateStoreRoom = vi.hoisted(() => vi.fn());
const mockUseAuth = vi.hoisted(() => vi.fn());
const mockNavigate = vi.hoisted(() => vi.fn());
const mockAxiosGet = vi.hoisted(() => vi.fn());

vi.mock('../../services/storeRooms', () => ({
  getStoreRooms: mockGetStoreRooms,
}));

vi.mock('../../services/ratings', () => ({
  rateStoreRoom: mockRateStoreRoom,
}));

vi.mock('../../context/useAuth', () => ({
  useAuth: mockUseAuth,
}));

vi.mock('../../Components/HeaderTendant', () => ({
  default: () => <div data-testid="header-tendant" />,
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  Link: ({ to, children, ...rest }: { to: string; children: React.ReactNode }) => (
    <a href={to} {...rest}>{children}</a>
  ),
}));

// StorageMap renders react-leaflet, which needs a real browser DOM that jsdom
// doesn't provide — mocked exactly like MiniMap.test.tsx mocks it.
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="map-container">{children}</div>
  ),
  TileLayer: () => null,
  Marker: ({ children, position }: { children: React.ReactNode; position: [number, number] }) => (
    <div data-testid="marker" data-lat={position[0]} data-lng={position[1]}>
      {children}
    </div>
  ),
  Popup: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="popup">{children}</div>
  ),
}));

vi.mock('leaflet', () => ({
  default: { Icon: class {} },
}));

// Storage.tsx geocodes the typed location via the bare `axios` package
// (Nominatim), same pattern as PreguntaInicio4.tsx / its test.
vi.mock('axios', () => ({
  default: { get: mockAxiosGet },
}));

import Storage from './Storage';

const roomWithCoords = {
  id: 1,
  title: 'Bodega Centro',
  city: 'Guayaquil',
  size: 20,
  publication_status: 'approved' as const,
  monthly_price: 120,
  distance_km: 3.4,
  latitude: -2.170998,
  longitude: -79.922359,
  store_prices: [{ price: 999 }], // must NOT be used for display (price-bug fix)
  rating_avg: 4,
  rating_count: 2,
  image: null,
};

const roomWithoutCoords = {
  id: 2,
  title: 'Bodega Norte',
  city: 'Guayaquil',
  size: 15,
  publication_status: 'approved' as const,
  monthly_price: 80,
  distance_km: null,
  latitude: null,
  longitude: null,
  store_prices: [{ price: 500 }],
  rating_avg: 0,
  rating_count: 0,
  image: null,
};

describe('Storage (catalog container)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ token: null });
    mockGetStoreRooms.mockResolvedValue({ data: [roomWithCoords, roomWithoutCoords] });
  });

  it('AC-1: applies min-size/price filters and renders name, monthly price (not store_prices[0]), size, distance and a detail button', async () => {
    render(<Storage />);

    await waitFor(() => expect(mockGetStoreRooms).toHaveBeenCalledWith(undefined));

    fireEvent.change(screen.getByPlaceholderText('Ej. 10'), { target: { value: '10' } });
    fireEvent.change(screen.getByPlaceholderText('Mín.'), { target: { value: '50' } });
    fireEvent.change(screen.getByPlaceholderText('Máx.'), { target: { value: '200' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));

    await waitFor(() =>
      expect(mockGetStoreRooms).toHaveBeenLastCalledWith({
        min_size: 10,
        min_price: 50,
        max_price: 200,
      })
    );

    expect(await screen.findByText('Bodega Centro')).toBeInTheDocument();
    expect(screen.getByText('$120/mes')).toBeInTheDocument(); // monthly_price, not store_prices[0] (999)
    expect(screen.queryByText('$999')).not.toBeInTheDocument();
    expect(screen.getByText(/20 m²/)).toBeInTheDocument();
    expect(screen.getByText(/3\.4 km/)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Ver bodega/ }).length).toBeGreaterThan(0);
  });

  it('AC-2: a zero-match search shows the empty-state message and a working clear-filters action', async () => {
    mockGetStoreRooms.mockResolvedValueOnce({ data: [roomWithCoords, roomWithoutCoords] });
    render(<Storage />);
    await waitFor(() => expect(mockGetStoreRooms).toHaveBeenCalledTimes(1));

    mockGetStoreRooms.mockResolvedValueOnce({ data: [] });
    fireEvent.change(screen.getByPlaceholderText('Ej. 10'), { target: { value: '9999' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));

    expect(
      await screen.findByText(
        'No encontramos bodegas disponibles con esos criterios. Intenta ampliar tu búsqueda'
      )
    ).toBeInTheDocument();
    expect(screen.queryByText(/^No autorizado$/)).not.toBeInTheDocument();

    mockGetStoreRooms.mockResolvedValueOnce({ data: [roomWithCoords, roomWithoutCoords] });
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }));

    await waitFor(() => expect(mockGetStoreRooms).toHaveBeenLastCalledWith(undefined));
    expect(await screen.findByText('Bodega Centro')).toBeInTheDocument();
  });

  it('AC-3: the map view renders a marker only for the room with coordinates, with name, monthly price and a detail link', async () => {
    render(<Storage />);
    await screen.findByText('Bodega Centro');

    fireEvent.click(screen.getByRole('button', { name: /Mapa/ }));

    const markers = screen.getAllByTestId('marker');
    expect(markers).toHaveLength(1); // roomWithoutCoords must NOT get a marker
    expect(markers[0]).toHaveAttribute('data-lat', String(roomWithCoords.latitude));
    expect(markers[0]).toHaveAttribute('data-lng', String(roomWithCoords.longitude));

    const popup = within(markers[0]).getByTestId('popup');
    expect(within(popup).getByText('Bodega Centro')).toBeInTheDocument();
    expect(within(popup).getByText('$120/mes')).toBeInTheDocument();
    expect(within(popup).getByRole('link', { name: 'Ver detalles' })).toHaveAttribute(
      'href',
      '/detalles/1'
    );
  });

  it('degrades gracefully when Nominatim geocoding fails: the search still runs with only size/price filters', async () => {
    mockAxiosGet.mockRejectedValueOnce(new Error('network error'));
    render(<Storage />);
    await waitFor(() => expect(mockGetStoreRooms).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByPlaceholderText('Busca según tu ubicación'), {
      target: { value: 'Ubicación inexistente' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));

    await waitFor(() => expect(mockAxiosGet).toHaveBeenCalled());
    await waitFor(() => expect(mockGetStoreRooms).toHaveBeenCalledTimes(2));

    const lastCallArgs = mockGetStoreRooms.mock.calls[1][0];
    expect(lastCallArgs).not.toHaveProperty('lat');
    expect(lastCallArgs).not.toHaveProperty('lng');
    // No crash: the catalog is still on screen.
    expect(await screen.findByText('Bodega Centro')).toBeInTheDocument();
  });

  it('keeps the existing rating widget and "Ver bodega" navigation intact and additive', async () => {
    mockUseAuth.mockReturnValue({ token: 'fake-token' });
    mockRateStoreRoom.mockResolvedValue({ data: {} });
    render(<Storage />);
    await screen.findByText('Bodega Centro');

    const card = screen.getByText('Bodega Centro').closest('.rounded-2xl') as HTMLElement;
    const starsContainer = card.querySelector('.mt-3.gap-1') as HTMLElement;
    const stars = Array.from(starsContainer.querySelectorAll('svg.lucide-star'));
    expect(stars.length).toBe(5);

    fireEvent.click(stars[3]); // 4th star
    fireEvent.click(within(card).getByRole('button', { name: 'Calificar' }));

    await waitFor(() =>
      expect(mockRateStoreRoom).toHaveBeenCalledWith(
        expect.objectContaining({ store_id: 1, stars: 4 })
      )
    );

    fireEvent.click(within(card).getByRole('button', { name: /Ver bodega/ }));
    expect(mockNavigate).toHaveBeenCalledWith('/detalles/1');
  });
});
