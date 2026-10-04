import { MapContainer, Marker, TileLayer } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { ROOM_TYPES, SECURITY_OPTIONS } from '../../lib/storeRoomLabels'
import type { StoreRoomDetail } from '../../services/storeRooms'
import {
  availabilityStat,
  hasCoordinates,
  hasPhotos,
  monthlyPrice,
  parseSecurity,
} from './model'

/**
 * Presentational `LgDetalle` layout (hero, title+rating, location,
 * 3-stat row, description, mini-map, gestor card, price bar). Fetch-free —
 * `StoreRoomDetailScreen` owns loading and errors.
 *
 * Prototype deviations (design's "Prototype deviations" section):
 * - the "Disponible" stat is bound to `is_available_now` and gains an amber
 *   unavailability banner (the prototype has no unavailable state);
 * - the gestor card gains phone (`tel:`) and email — the prototype only
 *   shows name + "Gestor" + a chat button, which is out of scope here;
 * - favorite hearts, "Reservar", and "Preguntar antes de reservar" are
 *   dropped (reservation flow is out of scope for this change).
 */

// Same CDN fix as `PublishStoreRoom/steps.tsx` — Leaflet's default icon
// resolves its images from a path that breaks under a bundler.
const markerIcon = L.icon({
  iconUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  iconRetinaUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  shadowUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
})

const roomTypeLabel = (value: string): string =>
  ROOM_TYPES.find((type) => type.value === value)?.label ?? value

const securityLabel = (key: string): string =>
  SECURITY_OPTIONS.find((option) => option.key === key)?.label ?? key

function Stars({ rating }: { rating: number }) {
  const filled = Math.max(0, Math.min(5, Math.round(rating)))
  return (
    <span
      aria-label={`${rating} de 5 estrellas`}
      className="inline-flex shrink-0 items-center gap-0.5 text-xs font-semibold text-lg-ink"
    >
      {'★'.repeat(filled)}
      <span className="text-lg-t4">{'★'.repeat(5 - filled)}</span>
    </span>
  )
}

function StatBox({
  label,
  value,
  warn,
}: {
  label: string
  value: string
  warn?: boolean
}) {
  return (
    <div
      className={`flex-1 rounded-xl border p-2.5 text-center ${
        warn ? 'border-[#F4E3A0] bg-lg-warn-bg' : 'border-lg-line'
      }`}
    >
      <div
        className={`text-sm font-semibold ${warn ? 'text-lg-warn' : 'text-lg-ink'}`}
      >
        {value}
      </div>
      <div className="mt-0.5 text-[10px] text-lg-t4">{label}</div>
    </div>
  )
}

export default function StoreRoomDetailView({
  detail,
  onBack,
}: {
  detail: StoreRoomDetail
  onBack: () => void
}) {
  const stat = availabilityStat(detail.is_available_now)
  const price = monthlyPrice(detail)
  const security = parseSecurity(detail.security)

  return (
    <>
      <div className="flex-1 overflow-y-auto">
        <div className="relative h-64 w-full bg-lg-hair">
          {hasPhotos(detail) ? (
            <img
              src={detail.photos[0]}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-lg-t4">
              Sin foto
            </div>
          )}
          <button
            type="button"
            onClick={onBack}
            aria-label="Volver"
            className="absolute left-4 top-12 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 shadow"
          >
            ←
          </button>
          <span className="absolute bottom-3.5 left-4 rounded-full bg-black/75 px-2.5 py-1 text-[11px] font-semibold text-white">
            {roomTypeLabel(detail.room_type)}
          </span>
        </div>

        <div className="px-5 pb-4 pt-4">
          {!detail.is_available_now && (
            <div className="mb-4 flex items-center gap-2.5 rounded-xl border border-[#F4E3A0] bg-lg-warn-bg px-3.5 py-3">
              <p className="m-0 text-xs leading-relaxed text-lg-t2">
                Este espacio ya no está disponible.
              </p>
            </div>
          )}

          <div className="flex items-start justify-between gap-3">
            <h1 className="m-0 text-lg font-bold leading-tight text-lg-ink">
              {detail.title}
            </h1>
            <Stars rating={detail.rating_avg} />
          </div>
          <p className="mt-1.5 text-xs text-lg-t3">
            {detail.direction} · {detail.city}
          </p>

          <div className="mt-4 flex gap-2.5">
            <StatBox label="Capacidad" value={`${detail.size} m²`} />
            <StatBox label="Reseñas" value={String(detail.rating_count)} />
            <StatBox
              label="Disponible"
              value={stat.value}
              warn={!stat.available}
            />
          </div>

          <h3 className="mb-1.5 mt-4 text-sm font-semibold text-lg-ink">
            Descripción
          </h3>
          <p className="m-0 text-xs leading-relaxed text-lg-t2">
            {detail.description}
          </p>

          {security.length > 0 && (
            <>
              <h3 className="mb-1.5 mt-4 text-sm font-semibold text-lg-ink">
                Seguridad
              </h3>
              <ul className="m-0 flex list-none flex-col gap-1 p-0 text-xs text-lg-t2">
                {security.map((key) => (
                  <li key={key}>{securityLabel(key)}</li>
                ))}
              </ul>
            </>
          )}

          {hasCoordinates(detail) && (
            <>
              <h3 className="mb-1.5 mt-4 text-sm font-semibold text-lg-ink">
                Ubicación
              </h3>
              <div className="h-32 overflow-hidden rounded-2xl border border-lg-line">
                <MapContainer
                  center={[detail.latitude as number, detail.longitude as number]}
                  zoom={15}
                  zoomControl={false}
                  dragging={false}
                  scrollWheelZoom={false}
                  doubleClickZoom={false}
                  attributionControl={false}
                  className="h-full w-full"
                >
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <Marker
                    position={[
                      detail.latitude as number,
                      detail.longitude as number,
                    ]}
                    icon={markerIcon}
                  />
                </MapContainer>
              </div>
            </>
          )}

          <div className="mt-4 flex items-center gap-3 rounded-2xl border border-lg-line p-3.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-lg-hair text-sm font-semibold text-lg-t2">
              {detail.landlord.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="m-0 truncate text-sm font-semibold text-lg-ink">
                {detail.landlord.name}
              </p>
              <p className="m-0 text-xs text-lg-t3">Gestor</p>
            </div>
            <div className="flex flex-col items-end gap-0.5 text-xs">
              {detail.landlord.phone && (
                <a
                  href={`tel:${detail.landlord.phone}`}
                  className="font-semibold text-lg-primary"
                >
                  {detail.landlord.phone}
                </a>
              )}
              <a href={`mailto:${detail.landlord.email}`} className="text-lg-t3">
                {detail.landlord.email}
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center border-t border-lg-line px-5 py-4">
        <span className="text-lg font-bold text-lg-ink">
          {price ? `${price} /mes` : 'Precio no publicado'}
        </span>
      </div>
    </>
  )
}
