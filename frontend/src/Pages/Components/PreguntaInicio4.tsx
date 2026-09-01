import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import ProgressBar from "./ProgressBar";
import FooterNav from "./FooterNav";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
// @ts-expect-error - leaflet ships no type declarations in this project
import L from "leaflet";
import axios from "axios";
import leodegalogo from '../../img/LOGO_LEODEGAISO.png';

const AnyMapContainer = MapContainer;
const AnyTileLayer = TileLayer;
const AnyMarker = Marker;

const markerIcon = new L.Icon({
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  iconSize: [30, 45],
  iconAnchor: [15, 45],
});

interface NominatimAddress {
  city?: string;
  town?: string;
  village?: string;
  county?: string;
  state?: string;
  region?: string;
  state_district?: string;
  province?: string;
  suburb?: string;
}

interface NominatimSuggestion {
  place_id: number;
  lat: string;
  lon: string;
  display_name: string;
  address?: NominatimAddress;
}

interface FlyToProps {
  position: [number, number];
}

function FlyToLocation({ position }: FlyToProps) {
  const map = useMap();
  useEffect(() => {
    if (position) map.flyTo(position, 15, { duration: 1.2 });
  }, [position, map]);
  return null;
}

interface LocationMarkerProps {
  position: [number, number];
  setPosition: (pos: [number, number]) => void;
  onLocationSelected: (lat: number, lon: number) => void;
}

function LocationMarker({ position, setPosition, onLocationSelected }: Readonly<LocationMarkerProps>) {
  useMapEvents({
    click: (e: { latlng: { lat: number; lng: number } }) => {
      const { lat, lng } = e.latlng;
      setPosition([lat, lng]);
      onLocationSelected(lat, lng);
    },
  });
  return <AnyMarker position={position} icon={markerIcon} />;
}

const PreguntaInicio4: React.FC = () => {
  const navigate = useNavigate();
  const [position, setPosition] = useState<[number, number]>([-0.1807, -78.4678]); // Quito
  const [search, setSearch] = useState("");
  const [city, setCity] = useState("");
  const [suggestions, setSuggestions] = useState<NominatimSuggestion[]>([]);


  useEffect(() => {
    const storedData = localStorage.getItem("optionData");
    if (storedData) {
      const parsed = JSON.parse(storedData);
      if (parsed.location) {
        const { direction, city: storedCity } = parsed.location;
        setSearch(direction || "");
        setCity(storedCity || "");
        if (parsed.location.position) {
          setPosition(parsed.location.position);
        }
      }
    }
  }, []);


  const saveLocationData = (direction: string, cityValue: string, geographical_zone: string, positionCoords?: [number, number]) => {
    const existingData = JSON.parse(localStorage.getItem("optionData") || "{}");
    const updatedData = {
      ...existingData,
      location: {
        direction,
        city: cityValue,
        geographical_zone,
        position: positionCoords || position
      },
    };

    localStorage.setItem("optionData", JSON.stringify(updatedData));
    setCity(cityValue);
  };


  // Buscar direcciones
  const handleSearch = async (query: string) => {
    setSearch(query);
    if (query.length < 3) return setSuggestions([]);

    try {
      const res = await axios.get<NominatimSuggestion[]>(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=5&countrycodes=ec&q=${encodeURIComponent(query)}`
      );
      setSuggestions(res.data);
    } catch (err) {
      console.error("Error al buscar ubicación:", err);
    }
  };



  // usuario selecciona desde el buscador
  const handleSelect = (lat: string, lon: string, name: string) => {
    const latNum = Number.parseFloat(lat);
    const lonNum = Number.parseFloat(lon);

    if (Number.isNaN(latNum) || Number.isNaN(lonNum)) {
      console.error("Coordenadas inválidas:", { lat, lon });
      return;
    }

    setPosition([latNum, lonNum]);
    setSearch(name);
    setSuggestions([]);

    const selected = suggestions.find((s) => s.lat === lat && s.lon === lon);

    if (selected?.address) {
      const address = selected.address;
      const direction = name || "";
      const city =
        address.city || address.town || address.village || address.county || "";
      const geographical_zone =
        address.state ||
        address.region ||
        address.state_district ||
        address.province ||
        address.suburb ||
        "";

      saveLocationData(direction, city, geographical_zone, [latNum, lonNum]);
    }
  };

  const handleClickMap = async (lat: number, lon: number) => {
    try {
      const res = await axios.get(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&addressdetails=1`
      );

      const data = res.data;
      const direction = data.display_name || "";
      const address = data.address || {};
      const city =
        address.city || address.town || address.village || address.county || "";
      const geographical_zone =
        address.state || address.region || address.suburb || "";

      setSearch(direction);
      saveLocationData(direction, city, geographical_zone, [lat, lon]);
    } catch (err) {
      console.error("Error al obtener dirección desde coordenadas:", err);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <header className="flex justify-end items-center gap-3 p-6">
        <img src={leodegalogo} alt="Logo Leodega" className="h-10" />
        <img src='/LOGO_LEODEGA TEXTO-19.png' alt="Leodega" className="h-8" />
      </header>

      <main className="flex flex-col items-center flex-1 px-6 pb-10">
        <div className="w-full max-w-4xl text-center">
          <h1 className="text-2xl sm:text-3xl font-semibold mb-3 text-[#1a1a1a]">
            ¿Dónde se encuentra tu espacio?
          </h1>
          <p className="text-gray-500 mb-3 text-sm sm:text-base">
            Solo compartiremos la dirección con usuarios que hayan realizado una reserva confirmada.
          </p>

          <div className="relative w-full mb-3">
            <input
              type="text"
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Buscar dirección..."
              className="w-full p-3 border-2 border-gray-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-800 placeholder-gray-400 transition-all"
            />
            {suggestions.length > 0 && (
              <ul className="absolute z-[1000] w-full bg-white border rounded-xl shadow-md max-h-60 overflow-auto mt-1">
                {suggestions.map((s) => (
                  <li key={s.place_id}>
                    <button
                      type="button"
                      onClick={() => handleSelect(s.lat, s.lon, s.display_name)} // ✅ aquí está corregido
                      className="w-full text-left px-4 py-2 hover:bg-purple-50 cursor-pointer text-sm text-gray-700 transition-colors"
                    >
                      {s.display_name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="w-full mb-3 text-left">
            <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-1">
              Ciudad
            </label>
            <input
              id="city"
              type="text"
              value={city}
              onChange={(e) => saveLocationData(search, e.target.value, "")}
              placeholder="Se completa al elegir una sugerencia o marcar el mapa, o escríbela aquí"
              className="w-full p-3 border-2 border-gray-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-800 placeholder-gray-400 transition-all"
            />
          </div>

          <div className="w-full h-[300px] rounded-2xl overflow-hidden shadow-md mb-10 border border-gray-100">
            <AnyMapContainer center={position} zoom={13} className="w-full h-full">
              <AnyTileLayer
                attribution='&copy; OpenStreetMap contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <FlyToLocation position={position} />
              <LocationMarker position={position} setPosition={setPosition} onLocationSelected={handleClickMap} />
            </AnyMapContainer>
          </div>

          <ProgressBar totalSteps={7} activeIndex={3} />

          <FooterNav
            onBack={() => navigate("/preguntainicio3")}
            onNext={() => navigate("/preguntainicio5")}
            nextDisabled={!search.trim() || !city.trim()}
          />
        </div>
      </main>
    </div>
  );
};

export default PreguntaInicio4;
