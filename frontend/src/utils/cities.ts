export interface CityOption {
  name: string;
  lat: number;
  lng: number;
}

export const ALL_CITIES_LABEL = "Todas las ciudades";

export const CITIES: readonly CityOption[] = [
  { name: "Quito", lat: -0.18, lng: -78.48 },
  { name: "Guayaquil", lat: -2.18, lng: -79.9 },
  { name: "Cuenca", lat: -2.89, lng: -78.99 },
  { name: "Ambato", lat: -1.27, lng: -78.63 },
  { name: "Manta", lat: -0.95, lng: -80.72 },
  { name: "Machala", lat: -3.26, lng: -79.96 },
  { name: "Loja", lat: -3.99, lng: -79.2 },
  { name: "Santo Domingo", lat: -0.25, lng: -79.17 },
];

export function findCity(name: string): CityOption | undefined {
  return CITIES.find((city) => city.name === name);
}
