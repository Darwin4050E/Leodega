import React from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import { Link } from "react-router-dom";
import "leaflet/dist/leaflet.css";
// @ts-expect-error - leaflet ships no type declarations in this project
import L from "leaflet";

const AnyMapContainer = MapContainer;
const AnyTileLayer = TileLayer;
const AnyMarker = Marker;
const AnyPopup = Popup;

const markerIcon = new L.Icon({
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  iconSize: [30, 45],
  iconAnchor: [15, 45],
});

export interface StorageMapRoom {
  id: number;
  title: string;
  monthly_price?: number | null;
  latitude: number | null;
  longitude: number | null;
}

interface StorageMapProps {
  rooms: StorageMapRoom[];
}

const DEFAULT_CENTER: [number, number] = [-2.1894, -79.8891]; // Guayaquil

/**
 * Multi-marker catalog map. Only rooms with both coordinates get a marker;
 * rooms with null latitude/longitude are silently skipped (never crash the
 * map, per storage-search spec's null-coordinate map scenario).
 *
 * Reuses `MiniMap.tsx`'s `isolate` + `L.Icon` z-index containment pattern:
 * leaflet.css assigns high z-indexes to its own panes/controls which would
 * otherwise paint over app overlays (modals at z-50, lightbox at z-90).
 * `MiniMap.tsx` itself stays untouched — it is a different, read-only,
 * single-marker component for the moderation expediente.
 */
const StorageMap: React.FC<StorageMapProps> = ({ rooms }) => {
  const roomsWithCoords = rooms.filter(
    (room): room is StorageMapRoom & { latitude: number; longitude: number } =>
      room.latitude !== null && room.longitude !== null
  );

  const center: [number, number] =
    roomsWithCoords.length > 0
      ? [roomsWithCoords[0].latitude, roomsWithCoords[0].longitude]
      : DEFAULT_CENTER;

  return (
    <div className="isolate w-full h-[500px] rounded-2xl overflow-hidden border border-gray-100">
      <AnyMapContainer center={center} zoom={12} className="w-full h-full">
        <AnyTileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {roomsWithCoords.map((room) => (
          <AnyMarker
            key={room.id}
            position={[room.latitude, room.longitude]}
            icon={markerIcon}
          >
            <AnyPopup>
              <div className="flex flex-col gap-1">
                <p className="font-semibold">{room.title}</p>
                <p className="text-[#3B82F6] font-bold">
                  {room.monthly_price != null ? `$${room.monthly_price}/mes` : "Precio no disponible"}
                </p>
                <Link to={`/detalles/${room.id}`} className="text-purple-600 underline">
                  Ver detalles
                </Link>
              </div>
            </AnyPopup>
          </AnyMarker>
        ))}
      </AnyMapContainer>
    </div>
  );
};

export default StorageMap;
