import React from "react";
import { MapContainer, TileLayer, Marker } from "react-leaflet";
import "leaflet/dist/leaflet.css";
// @ts-expect-error - leaflet ships no type declarations in this project
import L from "leaflet";

const AnyMapContainer = MapContainer;
const AnyTileLayer = TileLayer;
const AnyMarker = Marker;

const markerIcon = new L.Icon({
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  iconSize: [30, 45],
  iconAnchor: [15, 45],
});

interface MiniMapProps {
  latitude: number | null;
  longitude: number | null;
}

/**
 * Read-only location preview for the moderation expediente. Renders nothing
 * when either coordinate is null — never invents or geocodes a position.
 * `ExpedienteCard` owns the direction/city text fallback for that case.
 *
 * The wrapper carries `isolate` (CSS `isolation: isolate`) on purpose.
 * leaflet.css assigns high z-indexes to its own layers — 600 for the marker
 * pane, 700 for popups, 1000 for controls — which would otherwise paint over
 * any overlay in this app, since the modals sit at z-50 and the lightbox at
 * z-90. Isolating creates a stacking context so those values stay contained
 * here instead of competing with siblings. Do NOT "fix" an overlay appearing
 * behind the map by raising that overlay's z-index; that only moves the
 * collision to the next component.
 */
const MiniMap: React.FC<MiniMapProps> = ({ latitude, longitude }) => {
  if (latitude === null || longitude === null) {
    return null;
  }

  const position: [number, number] = [latitude, longitude];

  return (
    <div className="isolate w-full aspect-4/3 rounded-xl overflow-hidden border border-gray-100">
      <AnyMapContainer
        center={position}
        zoom={15}
        scrollWheelZoom={false}
        dragging={false}
        doubleClickZoom={false}
        zoomControl={false}
        className="w-full h-full"
      >
        <AnyTileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <AnyMarker position={position} icon={markerIcon} />
      </AnyMapContainer>
    </div>
  );
};

export default MiniMap;
