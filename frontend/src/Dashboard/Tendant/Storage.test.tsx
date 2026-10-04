import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';

const mockGetStoreRooms = vi.hoisted(() => vi.fn());
const mockRateStoreRoom = vi.hoisted(() => vi.fn());
const mockUseAuth = vi.hoisted(() => vi.fn());
const mockNavigate = vi.hoisted(() => vi.fn());

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

  describe('city filter', () => {
    const renderLoaded = async () => {
      render(<Storage />);
      await screen.findByText('Bodega Centro');
    };
    const selectCity = (name: string) =>
      fireEvent.change(screen.getByLabelText('Ubicación'), { target: { value: name } });
    const clickSearch = () => fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));

    it('S15: changing the select does not fetch; Buscar fetches exactly once', async () => {
      await renderLoaded();
      expect(mockGetStoreRooms).toHaveBeenCalledTimes(1);

      selectCity('Quito');
      expect(mockGetStoreRooms).toHaveBeenCalledTimes(1);

      clickSearch();
      await waitFor(() => expect(mockGetStoreRooms).toHaveBeenCalledTimes(2));
    });

    it('S16/S20: a city search sends the city with its center and shows the estimated distance', async () => {
      await renderLoaded();

      selectCity('Quito');
      clickSearch();

      await waitFor(() =>
        expect(mockGetStoreRooms).toHaveBeenLastCalledWith({
          city: 'Quito',
          lat: -0.18,
          lng: -78.48,
        })
      );
      expect(await screen.findByText(/3\.4 km/)).toBeInTheDocument();
    });

    it('S17/S21: "Todas las ciudades" sends no city, lat or lng and shows no distance', async () => {
      await renderLoaded();

      mockGetStoreRooms.mockResolvedValueOnce({ data: [roomWithoutCoords] });
      clickSearch();

      await waitFor(() => expect(mockGetStoreRooms).toHaveBeenCalledTimes(2));
      const params = mockGetStoreRooms.mock.calls[1][0];
      expect(Object.keys(params)).toEqual([]);
      expect(params).not.toHaveProperty('city');
      expect(await screen.findByText('Bodega Norte')).toBeInTheDocument();
      expect(screen.queryByText(/ km/)).not.toBeInTheDocument();
    });

    it('S18: city composes with size and price filters', async () => {
      await renderLoaded();

      selectCity('Guayaquil');
      fireEvent.change(screen.getByPlaceholderText('Ej. 10'), { target: { value: '20' } });
      fireEvent.change(screen.getByPlaceholderText('Máx.'), { target: { value: '80' } });
      clickSearch();

      await waitFor(() =>
        expect(mockGetStoreRooms).toHaveBeenLastCalledWith({
          city: 'Guayaquil',
          lat: -2.18,
          lng: -79.9,
          min_size: 20,
          max_price: 80,
        })
      );
    });

    const deferred = <T,>() => {
      let resolve!: (value: T) => void;
      const promise = new Promise<T>((res) => {
        resolve = res;
      });
      return { promise, resolve };
    };

    it('S23: the initial load shows the search bar and the loading indicator together', async () => {
      const initial = deferred<{ data: unknown[] }>();
      mockGetStoreRooms.mockReturnValueOnce(initial.promise);
      render(<Storage />);

      expect(screen.getByLabelText('Ubicación')).toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveTextContent('Cargando bodegas...');

      initial.resolve({ data: [roomWithCoords] });
      expect(await screen.findByText('Bodega Centro')).toBeInTheDocument();
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('S22: the search bar stays mounted and keeps the applied values while searching', async () => {
      await renderLoaded();
      const select = screen.getByLabelText('Ubicación') as HTMLSelectElement;

      const pending = deferred<{ data: unknown[] }>();
      mockGetStoreRooms.mockReturnValueOnce(pending.promise);
      selectCity('Guayaquil');
      fireEvent.change(screen.getByPlaceholderText('Mín.'), { target: { value: '50' } });
      clickSearch();

      expect(await screen.findByRole('status')).toHaveTextContent('Cargando bodegas...');
      expect(screen.getByLabelText('Ubicación')).toBe(select);
      expect(select.value).toBe('Guayaquil');
      expect((screen.getByPlaceholderText('Mín.') as HTMLInputElement).value).toBe('50');

      await act(async () => {
        pending.resolve({ data: [roomWithCoords] });
      });

      expect(await screen.findByText('Bodega Centro')).toBeInTheDocument();
      expect(screen.getByLabelText('Ubicación')).toBe(select);
      expect(select.value).toBe('Guayaquil');
      expect((screen.getByPlaceholderText('Mín.') as HTMLInputElement).value).toBe('50');
    });

    const NO_RESULTS =
      'No encontramos bodegas disponibles con esos criterios. Intenta ampliar tu búsqueda';

    it('S24: a city with no rooms shows the empty-state message and a clear-filters action', async () => {
      await renderLoaded();

      mockGetStoreRooms.mockResolvedValueOnce({ data: [] });
      selectCity('Cuenca');
      clickSearch();

      expect(await screen.findByText(NO_RESULTS)).toBeInTheDocument();
      expect(screen.queryByText('Bodega Centro')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Ver bodega/ })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Limpiar filtros' })).toBeInTheDocument();
    });

    it('S25: a city plus an unmatched price shows the same empty state', async () => {
      await renderLoaded();

      mockGetStoreRooms.mockResolvedValueOnce({ data: [] });
      selectCity('Quito');
      fireEvent.change(screen.getByPlaceholderText('Máx.'), { target: { value: '5' } });
      clickSearch();

      expect(await screen.findByText(NO_RESULTS)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Limpiar filtros' })).toBeInTheDocument();
    });

    it('S26: clearing resets the select and inputs and refetches without params', async () => {
      await renderLoaded();

      mockGetStoreRooms.mockResolvedValueOnce({ data: [] });
      selectCity('Quito');
      fireEvent.change(screen.getByPlaceholderText('Ej. 10'), { target: { value: '20' } });
      clickSearch();
      await screen.findByText(NO_RESULTS);

      fireEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }));

      await waitFor(() => expect(mockGetStoreRooms).toHaveBeenLastCalledWith(undefined));
      expect(await screen.findByText('Bodega Centro')).toBeInTheDocument();
      expect((screen.getByLabelText('Ubicación') as HTMLSelectElement).value).toBe('');
      expect((screen.getByPlaceholderText('Ej. 10') as HTMLInputElement).value).toBe('');
    });

    it('S27: with no filters applied, an empty catalog shows the message without a clear action', async () => {
      mockGetStoreRooms.mockResolvedValueOnce({ data: [] });
      render(<Storage />);

      expect(await screen.findByText(NO_RESULTS)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Limpiar filtros' })).not.toBeInTheDocument();
    });

    it('F7: a slower earlier response never overwrites the latest search result', async () => {
      await renderLoaded();

      const first = deferred<{ data: unknown[] }>();
      const second = deferred<{ data: unknown[] }>();
      mockGetStoreRooms.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

      selectCity('Quito');
      clickSearch();
      selectCity('Guayaquil');
      clickSearch();
      await waitFor(() => expect(mockGetStoreRooms).toHaveBeenCalledTimes(3));

      await act(async () => {
        second.resolve({ data: [roomWithoutCoords] });
      });
      expect(await screen.findByText('Bodega Norte')).toBeInTheDocument();

      await act(async () => {
        first.resolve({ data: [roomWithCoords] });
      });
      expect(screen.getByText('Bodega Norte')).toBeInTheDocument();
      expect(screen.queryByText('Bodega Centro')).not.toBeInTheDocument();
    });

    it('F7: a stale response does not clear the loading state of the newer request', async () => {
      await renderLoaded();

      const first = deferred<{ data: unknown[] }>();
      const second = deferred<{ data: unknown[] }>();
      mockGetStoreRooms.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

      selectCity('Quito');
      clickSearch();
      clickSearch();
      await waitFor(() => expect(mockGetStoreRooms).toHaveBeenCalledTimes(3));

      await act(async () => {
        first.resolve({ data: [roomWithCoords] });
      });
      expect(screen.getByRole('status')).toHaveTextContent('Cargando bodegas...');
      expect(screen.queryByText('Bodega Centro')).not.toBeInTheDocument();
    });

    it('S28: only approved rooms render, each with title, monthly price, size and a detail button', async () => {
      const pendingRoom = {
        ...roomWithCoords,
        id: 3,
        title: 'Bodega Pendiente',
        publication_status: 'pending' as const,
      };
      mockGetStoreRooms.mockResolvedValueOnce({ data: [roomWithCoords, pendingRoom] });
      render(<Storage />);

      const card = (await screen.findByText('Bodega Centro')).closest('.rounded-2xl') as HTMLElement;
      expect(screen.queryByText('Bodega Pendiente')).not.toBeInTheDocument();
      expect(within(card).getByText('$120/mes')).toBeInTheDocument();
      expect(within(card).getByText(/20 m²/)).toBeInTheDocument();
      expect(within(card).getByRole('button', { name: /Ver bodega/ })).toBeInTheDocument();
      expect(screen.getAllByRole('button', { name: /Ver bodega/ })).toHaveLength(1);
    });
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
