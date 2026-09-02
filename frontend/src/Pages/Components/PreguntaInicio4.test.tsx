import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';

if (typeof localStorage === 'undefined') {
  const store: Record<string, string> = {};
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; },
      clear: () => { for (const k in store) delete store[k]; },
    },
    writable: true,
  });
}
import PreguntaInicio4 from './PreguntaInicio4';

// Mock react-router-dom.
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

// Mock react-leaflet and leaflet — not needed for location save test.
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TileLayer: () => null,
  Marker: () => null,
  useMap: () => ({ flyTo: vi.fn() }),
  useMapEvents: () => null,
}));

vi.mock('leaflet', () => ({
  default: { Icon: class {} },
}));

vi.mock('./ProgressBar', () => ({ default: () => null }));
vi.mock('./FooterNav', () => ({
  default: ({ onNext }: { onNext: () => void }) => (
    <button data-testid="next-btn" onClick={onNext}>Siguiente</button>
  ),
}));

// Mock axios (used for nominatim calls inside the component).
vi.mock('axios', () => ({
  default: { get: vi.fn() },
}));

describe('PreguntaInicio4 — geographical_zone absent from saved location', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('saves location data WITHOUT a geographical_zone key', () => {
    // Seed optionData with a direction to enable the "city" input path.
    localStorage.setItem('optionData', JSON.stringify({
      location: { direction: 'Av. Test 1', city: 'Quito', position: [-0.18, -78.46] },
    }));

    render(<PreguntaInicio4 />);

    // The city input onChange triggers saveLocationData — fire a change event.
    const cityInput = document.querySelector('input#city') as HTMLInputElement;
    fireEvent.change(cityInput, { target: { value: 'Guayaquil' } });

    const stored = JSON.parse(localStorage.getItem('optionData') ?? '{}');
    expect(stored.location).toBeDefined();
    expect(Object.prototype.hasOwnProperty.call(stored.location, 'geographical_zone')).toBe(false);
  });
});
