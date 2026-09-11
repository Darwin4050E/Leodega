import { useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import TextField, { TextAreaField } from '../../components/TextField'
import type { NewStoreRoom } from '../../services/storeRooms'
import {
  DESCRIPTION_MAX,
  POLICY_TIERS,
  ROOM_TYPES,
  SECURITY_OPTIONS,
  SERVICE_FEE_RATE,
  STORAGE_TYPES,
  type FormErrors,
} from './model'

interface StepProps {
  step: number
  values: NewStoreRoom
  set: <K extends keyof NewStoreRoom>(key: K, value: NewStoreRoom[K]) => void
  errors: FormErrors
}

const cardBase =
  'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 bg-white p-3 text-center transition-colors'

// Fire-department permit: PDF only, 5 MB. Must match the backend rule in
// StoreStoreRoomRequest (`mimes:pdf|max:5120`) and the web wizard.
const PERMIT_MAX_BYTES = 5 * 1024 * 1024

// Default map view when no pin is set yet (Guayaquil).
const MAP_DEFAULT_CENTER: [number, number] = [-2.1894, -79.8891]
const MAP_DEFAULT_ZOOM = 12

// Leaflet's default icon resolves its images from a relative path that breaks
// under a bundler; point it at a CDN copy instead (same fix the web wizard uses).
const markerIcon = L.icon({
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  iconRetinaUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  shadowUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
})

export default function StepBody({ step, values, set, errors }: StepProps) {
  switch (step) {
    case 0:
      return (
        <div className="grid grid-cols-2 gap-3">
          {ROOM_TYPES.map((o) => {
            const on = values.room_type === o.value
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => set('room_type', o.value)}
                className={`${cardBase} h-28 ${
                  on ? 'border-lg-primary text-lg-primary' : 'border-lg-line text-lg-t2'
                }`}
              >
                <span className="text-sm font-semibold">{o.label}</span>
              </button>
            )
          })}
        </div>
      )

    case 1:
      return (
        <div className="flex flex-col gap-3">
          {STORAGE_TYPES.map((o) => {
            const on = values.storage_type === o.value
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => set('storage_type', o.value)}
                className={`flex cursor-pointer items-start gap-3 rounded-2xl border-2 bg-white p-4 text-left transition-colors ${
                  on ? 'border-lg-primary' : 'border-lg-line'
                }`}
              >
                <div>
                  <h3 className="m-0 text-sm font-semibold text-lg-ink">{o.title}</h3>
                  <p className="mt-1 text-xs leading-snug text-lg-t3">{o.desc}</p>
                </div>
              </button>
            )
          })}
        </div>
      )

    case 2:
      return <PhotoStep values={values} set={set} error={errors.photos} />

    case 3:
      return <LocationStep values={values} set={set} errors={errors} />


    case 4:
      return (
        <div className="flex flex-col gap-4">
          <TextField
            label="Título"
            placeholder="Bodega con acceso para tráiler"
            value={values.title}
            onChange={(e) => set('title', e.target.value)}
            error={errors.title}
          />
          <div>
            <TextAreaField
              label="Descripción"
              rows={6}
              placeholder="Ideal para almacenar mercadería, archivo o equipos. Guardianía 24/7, piso industrial…"
              value={values.description}
              onChange={(e) =>
                set('description', e.target.value.slice(0, DESCRIPTION_MAX))
              }
              error={errors.description}
            />
            <p className="mt-1.5 text-right text-xs text-lg-t4">
              {values.description.length}/{DESCRIPTION_MAX}
            </p>
          </div>
        </div>
      )

    case 5:
      return <PriceStep values={values} set={set} errors={errors} />

    case 6:
      return <SecurityStep values={values} set={set} errors={errors} />

    default:
      return null
  }
}

function LocationStep({
  values,
  set,
  errors,
}: {
  values: NewStoreRoom
  set: StepProps['set']
  errors: FormErrors
}) {
  const pin =
    values.latitude !== null && values.longitude !== null
      ? ([values.latitude, values.longitude] as [number, number])
      : null

  return (
    <div className="flex flex-col gap-4">
      <TextField
        label="Dirección"
        placeholder="Km 11.5 Vía a Daule"
        value={values.direction}
        onChange={(e) => set('direction', e.target.value)}
        error={errors.direction}
      />
      <TextField
        label="Ciudad"
        placeholder="Guayaquil"
        value={values.city}
        onChange={(e) => set('city', e.target.value)}
        error={errors.city}
      />

      <div>
        <p className="mb-1.5 text-sm font-medium text-lg-t2">
          Ubicación en el mapa{' '}
          <span className="font-normal text-lg-t4">(opcional)</span>
        </p>
        <div className="h-56 overflow-hidden rounded-2xl border border-lg-line">
          <MapContainer
            center={pin ?? MAP_DEFAULT_CENTER}
            zoom={pin ? 15 : MAP_DEFAULT_ZOOM}
            className="h-full w-full"
          >
            <TileLayer
              attribution="&copy; OpenStreetMap"
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapResizer />
            <LocationPicker
              pin={pin}
              onPick={(lat, lng) => {
                set('latitude', lat)
                set('longitude', lng)
              }}
            />
          </MapContainer>
        </div>
        <div className="mt-1.5 flex items-center justify-between text-xs text-lg-t4">
          <span>
            {pin
              ? `Marcado: ${pin[0].toFixed(5)}, ${pin[1].toFixed(5)}`
              : 'Toca el mapa para marcar la ubicación exacta.'}
          </span>
          {pin && (
            <button
              type="button"
              onClick={() => {
                set('latitude', null)
                set('longitude', null)
              }}
              className="font-semibold text-lg-primary"
            >
              Quitar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function MapResizer() {
  const map = useMap()
  useEffect(() => {
    const id = setTimeout(() => map.invalidateSize(), 0)
    return () => clearTimeout(id)
  }, [map])
  return null
}

function LocationPicker({
  pin,
  onPick,
}: {
  pin: [number, number] | null
  onPick: (lat: number, lng: number) => void
}) {
  useMapEvents({
    click: (e) => onPick(e.latlng.lat, e.latlng.lng),
  })
  return pin ? <Marker position={pin} icon={markerIcon} /> : null
}

function PhotoStep({
  values,
  set,
  error,
}: {
  values: NewStoreRoom
  set: StepProps['set']
  error?: string
}) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const previews = useMemo(
    () => values.photos.map((f) => ({ name: f.name, url: URL.createObjectURL(f) })),
    [values.photos],
  )

  const add = (files: FileList | null) => {
    if (!files) return
    set('photos', [...values.photos, ...Array.from(files)])
  }
  const removeAt = (i: number) =>
    set(
      'photos',
      values.photos.filter((_, j) => j !== i),
    )

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        onChange={(e) => {
          add(e.target.files)
          e.target.value = ''
        }}
        className="hidden"
        aria-label="Agregar fotos"
      />

      {previews.length === 0 ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex h-64 w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-lg-line2 bg-lg-bg text-sm font-semibold text-lg-t2"
        >
          Toca para subir fotos
          <span className="text-xs font-normal text-lg-t4">
            Mínimo 3 · recomendado 5 · JPG, PNG o WEBP
          </span>
        </button>
      ) : (
        <div className="grid grid-cols-3 gap-2.5">
          {previews.map((p, i) => (
            <div
              key={p.url}
              className="relative h-24 overflow-hidden rounded-xl border border-lg-line"
            >
              <img src={p.url} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => removeAt(i)}
                aria-label={`Quitar foto ${i + 1}`}
                className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-xs text-white"
              >
                ✕
              </button>
              {i === 0 && (
                <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  Portada
                </span>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex h-24 items-center justify-center rounded-xl border-2 border-dashed border-lg-line2 bg-lg-bg text-xl text-lg-t4"
          >
            +
          </button>
        </div>
      )}

      {error && <p className="mt-2 text-xs text-lg-err">{error}</p>}
      {previews.length > 0 && (
        <p className="mt-2.5 text-center text-xs text-lg-t4">
          {previews.length} foto{previews.length > 1 ? 's' : ''} · recomendado 5
        </p>
      )}
    </div>
  )
}

function PriceStep({
  values,
  set,
  errors,
}: {
  values: NewStoreRoom
  set: StepProps['set']
  errors: FormErrors
}) {
  const base = Number(values.monthly_price) || 0
  const fee = base * SERVICE_FEE_RATE
  const net = base - fee

  return (
    <div className="flex flex-col gap-5">
      <div className="flex gap-4">
        <TextField
          label="Tarifa mensual (USD)"
          type="number"
          inputMode="decimal"
          min="0"
          placeholder="0"
          value={values.monthly_price}
          onChange={(e) => set('monthly_price', e.target.value)}
          error={errors['storePrices.0.price']}
        />
        <TextField
          label="Tamaño (m²)"
          type="number"
          inputMode="decimal"
          min="0"
          placeholder="0"
          value={values.size}
          onChange={(e) => set('size', e.target.value)}
          error={errors.size}
        />
      </div>

      <div className="rounded-2xl border border-lg-line bg-lg-bg p-4 text-sm text-lg-t2">
        <Row label="Precio base" value={base} />
        <Row label="Tarifa por servicio (10%)" value={fee} divider />
        <div className="mt-0.5 flex justify-between border-t border-lg-line pt-2.5 text-[15px] font-bold text-lg-ink">
          <span>Recibes</span>
          <span className="text-lg-primary">${net.toFixed(2)}</span>
        </div>
      </div>
    </div>
  )
}

function Row({
  label,
  value,
  divider,
}: {
  label: string
  value: number
  divider?: boolean
}) {
  return (
    <div
      className={`flex justify-between py-2 ${divider ? 'border-t border-lg-line' : ''}`}
    >
      <span>{label}</span>
      <span>${value.toFixed(2)}</span>
    </div>
  )
}

function SecurityStep({
  values,
  set,
  errors,
}: {
  values: NewStoreRoom
  set: StepProps['set']
  errors: FormErrors
}) {
  const permitRef = useRef<HTMLInputElement | null>(null)
  const [permitError, setPermitError] = useState<string | null>(null)

  function pickPermit(file: File | null) {
    if (file) {
      if (file.type !== 'application/pdf') {
        setPermitError('El permiso debe ser un archivo PDF.')
        return
      }
      if (file.size > PERMIT_MAX_BYTES) {
        setPermitError('El permiso no debe superar los 5 MB.')
        return
      }
    }
    setPermitError(null)
    set('permit', file)
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="mb-1 text-sm font-semibold text-lg-t2">
          ¿Tu espacio cuenta con alguno de estos?
        </p>
        {SECURITY_OPTIONS.map((opt) => (
          <label
            key={opt.key}
            className="flex cursor-pointer items-center justify-between border-b border-lg-hair py-3 text-sm text-lg-t2"
          >
            {opt.label}
            <input
              type="checkbox"
              checked={Boolean(values.security[opt.key])}
              onChange={(e) =>
                set('security', {
                  ...values.security,
                  [opt.key]: e.target.checked,
                })
              }
              className="h-[18px] w-[18px] accent-lg-primary"
            />
          </label>
        ))}
      </div>

      <div>
        <label
          htmlFor="policy-tier"
          className="block text-sm font-medium text-lg-t2"
        >
          Política de cancelación
        </label>
        <select
          id="policy-tier"
          value={values.cancellation_policy_tier}
          onChange={(e) =>
            set(
              'cancellation_policy_tier',
              e.target.value as NewStoreRoom['cancellation_policy_tier'],
            )
          }
          aria-invalid={Boolean(errors.cancellation_policy_tier)}
          className={`mt-1.5 w-full rounded-xl border bg-white px-3.5 py-3 text-sm outline-none focus:ring-4 focus:ring-lg-soft ${
            errors.cancellation_policy_tier
              ? 'border-lg-err'
              : 'border-lg-line2 focus:border-lg-primary'
          }`}
        >
          <option value="">Selecciona una política</option>
          {POLICY_TIERS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
        {errors.cancellation_policy_tier && (
          <p className="mt-1 text-xs text-lg-err">
            {errors.cancellation_policy_tier}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="permit" className="block text-sm font-medium text-lg-t2">
          Permiso del cuerpo de bomberos <span className="text-lg-err">*</span>
        </label>
        <input
          ref={permitRef}
          id="permit"
          type="file"
          accept="application/pdf"
          onChange={(e) => {
            pickPermit(e.target.files?.[0] ?? null)
            e.target.value = ''
          }}
          className="hidden"
        />
        {values.permit ? (
          <div className="mt-1.5 flex items-center gap-3 rounded-xl border border-[#B7E9C6] bg-lg-ok-bg px-4 py-3">
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-lg-ink">
              {values.permit.name}
            </span>
            <button
              type="button"
              onClick={() => {
                setPermitError(null)
                set('permit', null)
              }}
              aria-label="Quitar permiso"
              className="text-lg-t4"
            >
              ✕
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => permitRef.current?.click()}
            className={`mt-1.5 flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed bg-lg-bg p-5 text-sm font-semibold text-lg-t2 ${
              errors.firefighter_permit || permitError
                ? 'border-lg-err'
                : 'border-lg-line2'
            }`}
          >
            Sube el PDF del permiso
            <span className="text-xs font-normal text-lg-t4">
              Obligatorio · PDF, máximo 5 MB
            </span>
          </button>
        )}
        {(permitError || errors.firefighter_permit) && (
          <p className="mt-1 text-xs text-lg-err">
            {permitError ?? errors.firefighter_permit}
          </p>
        )}
      </div>

      <div className="flex gap-2.5 rounded-xl border border-[#F4E3A0] bg-lg-warn-bg px-3.5 py-3">
        <p className="m-0 text-xs leading-relaxed text-lg-t2">
          Al enviar, tu espacio queda <b>pendiente de verificación</b> del
          administrador antes de aparecer en el catálogo.
        </p>
      </div>
    </div>
  )
}
