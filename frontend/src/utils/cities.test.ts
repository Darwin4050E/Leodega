import { describe, it, expect } from 'vitest';
import { ALL_CITIES_LABEL, CITIES, findCity } from './cities';

describe('cities', () => {
  it('lists the 8 supported cities in catalog order', () => {
    expect(CITIES.map((c) => c.name)).toEqual([
      'Quito',
      'Guayaquil',
      'Cuenca',
      'Ambato',
      'Manta',
      'Machala',
      'Loja',
      'Santo Domingo',
    ]);
    expect(ALL_CITIES_LABEL).toBe('Todas las ciudades');
  });

  it('keeps every city center inside Ecuador', () => {
    for (const city of CITIES) {
      expect(city.lat).toBeGreaterThan(-5);
      expect(city.lat).toBeLessThan(2);
      expect(city.lng).toBeGreaterThan(-82);
      expect(city.lng).toBeLessThan(-75);
    }
  });

  it('findCity returns the matching option, and undefined for unknown or empty names', () => {
    expect(findCity('Quito')).toEqual({ name: 'Quito', lat: -0.18, lng: -78.48 });
    expect(findCity('Santo Domingo')).toEqual({ name: 'Santo Domingo', lat: -0.25, lng: -79.17 });
    expect(findCity('Atlantis')).toBeUndefined();
    expect(findCity('')).toBeUndefined();
  });
});
