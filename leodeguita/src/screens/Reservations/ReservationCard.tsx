import { useState } from 'react'
import StatusChip, { type StatusTone } from '../../components/StatusChip'
import type { ReservationCardViewModel, ReservationTab } from './model'

/**
 * Presentational card for one reservation, ported from the prototype's
 * `LgReservas` row (photo with status chip and title, period and amount
 * below) plus the code, organization and refund data the real API carries.
 * Cancel / review / report actions are not offered on mobile yet.
 */

const BADGE: Record<ReservationTab, { tone: StatusTone; label: string }> = {
  activa: { tone: 'ok', label: 'Activa' },
  finalizada: { tone: 'neutral', label: 'Finalizada' },
  cancelada: { tone: 'err', label: 'Cancelada' },
}

function Stat({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="m-0 text-[11px] text-lg-t4">{label}</p>
      <p className={`m-0 text-xs font-semibold text-lg-ink ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
  )
}

export default function ReservationCard({ reservation }: { reservation: ReservationCardViewModel }) {
  const [imageFailed, setImageFailed] = useState(false)
  const showImage = Boolean(reservation.photo) && !imageFailed
  const badge = BADGE[reservation.tab]

  return (
    <article className="overflow-hidden rounded-2xl border border-lg-line bg-white shadow-sm">
      <div className="relative h-28 w-full bg-lg-hair">
        {showImage ? (
          <img
            src={reservation.photo ?? undefined}
            alt=""
            className="h-full w-full object-cover"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-lg-t4">
            Sin foto
          </div>
        )}
        <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1">
          <StatusChip tone={badge.tone}>{badge.label}</StatusChip>
        </span>
        {reservation.organizationName && (
          <span className="absolute right-3 top-3 max-w-[50%] truncate rounded-full bg-lg-soft px-2.5 py-1 text-[11px] font-semibold text-lg-primary">
            {reservation.organizationName}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-2 p-4">
        <h3 className="m-0 text-sm font-bold text-lg-ink">{reservation.title}</h3>
        {reservation.location && <p className="m-0 text-xs text-lg-t3">{reservation.location}</p>}
        {reservation.creatorName && (
          <p className="m-0 text-xs text-lg-t3">Reservada por {reservation.creatorName}</p>
        )}
        <div className="mt-1 flex flex-wrap gap-x-6 gap-y-2">
          <Stat label="Período" value={reservation.period} />
          <Stat label="Monto" value={reservation.amount} />
          <Stat label="Reserva" value={reservation.code} mono />
          {reservation.refund && <Stat label="Reembolso" value={reservation.refund} />}
        </div>
      </div>
    </article>
  )
}
