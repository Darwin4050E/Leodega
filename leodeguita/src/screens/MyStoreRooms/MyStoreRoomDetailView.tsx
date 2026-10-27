import type { ReactNode } from 'react'
import ReadOnlyMap from '../../components/ReadOnlyMap'
import { ROOM_TYPES } from '../../lib/storeRoomLabels'
import type { MyStoreRoom, StoreRoomDetail } from '../../services/storeRooms'
import { STATUS_META, deriveStatus, rejectionDetail } from './model'

/**
 * Presentational `LgBodegaDetalle`: hero with status chip, state banner, three
 * stats and the description / documentation / location sections. Fetch-free;
 * `MyStoreRoomDetailScreen` owns loading and errors. `footer` carries the
 * action bar (edit / delete) so each capability plugs in without touching the
 * layout.
 */

const TONE_TEXT = {
  ok: 'text-lg-ok',
  warn: 'text-lg-warn',
  err: 'text-lg-err',
  info: 'text-lg-info',
  neutral: 'text-lg-t4',
} as const

const TONE_DOT = {
  ok: 'bg-lg-ok',
  warn: 'bg-lg-warn',
  err: 'bg-lg-err',
  info: 'bg-lg-info',
  neutral: 'bg-lg-t4',
} as const

const roomTypeLabel = (value: string): string =>
  ROOM_TYPES.find((type) => type.value === value)?.label ?? value

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex-1 rounded-xl border border-lg-line bg-white p-2.5 text-center">
      <div className="truncate text-sm font-semibold text-lg-ink">{value}</div>
      <div className="mt-0.5 text-[10px] text-lg-t4">{label}</div>
    </div>
  )
}

export default function MyStoreRoomDetailView({
  room,
  detail,
  onBack,
  footer,
}: {
  room: MyStoreRoom
  detail: StoreRoomDetail
  onBack: () => void
  footer?: ReactNode
}) {
  const status = deriveStatus(room)
  const meta = STATUS_META[status]
  const rejection = rejectionDetail(room)
  const photo = detail.photos[0] ?? room.image
  const hasMap = detail.latitude !== null && detail.longitude !== null

  return (
    <>
      <div className="flex-1 overflow-y-auto">
        <div className="relative h-60 w-full bg-lg-hair">
          {photo ? (
            <img src={photo} alt="" className="h-full w-full object-cover" />
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
          <span
            className={`absolute bottom-3.5 left-4 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold shadow ${TONE_TEXT[meta.tone]}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${TONE_DOT[meta.tone]}`} />
            {meta.label}
          </span>
        </div>

        <div className="px-5 pb-6 pt-4">
          <h1 className="m-0 text-xl font-bold leading-tight text-lg-ink">
            {room.title}
          </h1>
          <p className="mt-1.5 text-xs text-lg-t3">
            {detail.direction}, {detail.city}
          </p>

          {status === 'rechazada' && (
            <div className="mt-4 rounded-xl border border-[#F3C7C7] bg-lg-err-bg px-3.5 py-3">
              <p className="m-0 text-xs font-semibold text-lg-ink">
                Rechazada por el administrador
              </p>
              {rejection?.label && (
                <p className="m-0 mt-1 text-xs font-semibold text-lg-err">
                  Motivo: {rejection.label}
                </p>
              )}
              {rejection?.reason && (
                <p className="m-0 mt-0.5 text-xs leading-relaxed text-lg-t2">
                  {rejection.reason}
                </p>
              )}
            </div>
          )}
          {status === 'pendiente' && (
            <div className="mt-4 rounded-xl border border-[#F4E3A0] bg-lg-warn-bg px-3.5 py-3">
              <p className="m-0 text-xs font-semibold text-lg-ink">
                En revisión del administrador
              </p>
              <p className="m-0 mt-0.5 text-xs leading-relaxed text-lg-t2">
                Tu bodega aparecerá en el catálogo una vez aprobada. La
                verificación se hace una sola vez por bodega.
              </p>
            </div>
          )}

          <div className="my-4 flex gap-2.5">
            <StatBox label="Tamaño" value={`${detail.size} m²`} />
            <StatBox label="Tipo" value={roomTypeLabel(detail.room_type)} />
            <StatBox label="Reservas" value={String(room.active_reservations_count)} />
          </div>

          <h3 className="mb-1.5 mt-1 text-sm font-semibold text-lg-ink">Descripción</h3>
          <p className="m-0 text-xs leading-relaxed text-lg-t2">{detail.description}</p>

          <h3 className="mb-2 mt-5 text-sm font-semibold text-lg-ink">Documentación</h3>
          <div className="flex items-center gap-3 rounded-xl border border-lg-line bg-white px-3.5 py-3">
            <div className="min-w-0 flex-1">
              <p className="m-0 text-sm font-semibold text-lg-ink">Permiso de bomberos</p>
              <p className="m-0 text-xs text-lg-t4">
                Se adjuntó al publicar; solo lo revisa el administrador.
              </p>
            </div>
          </div>

          <h3 className="mb-2 mt-5 text-sm font-semibold text-lg-ink">Ubicación</h3>
          {hasMap ? (
            <div className="h-36 overflow-hidden rounded-2xl border border-lg-line">
              <ReadOnlyMap
                latitude={detail.latitude as number}
                longitude={detail.longitude as number}
              />
            </div>
          ) : (
            <p className="m-0 text-xs text-lg-t3">
              {detail.direction}, {detail.city}
            </p>
          )}
        </div>
      </div>
      {footer}
    </>
  )
}
