import type { TenantReservation } from '../../services/reservations'

/**
 * Pure screen logic for `/reservas`. Ports the web helpers
 * (`deriveTenantTab`, `formatReservationCode`) so tab placement and the code
 * shown to the user match across clients.
 */

export type ReservationTab = 'activa' | 'finalizada' | 'cancelada'

export const RESERVATION_TABS: { key: ReservationTab; label: string }[] = [
  { key: 'activa', label: 'Activas' },
  { key: 'finalizada', label: 'Finalizadas' },
  { key: 'cancelada', label: 'Canceladas' },
]

/** Today as `YYYY-MM-DD` in the local timezone. */
export function todayDateOnly(now: Date = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

/**
 * No backend field maps status + dates to a tab, so it is derived. `pending`
 * (never paid) and a not-yet-ended `confirmed` reservation both stay in
 * "activa", as on the web.
 */
export function deriveTab(
  reservation: Pick<TenantReservation, 'status' | 'end_date'>,
  today: string = todayDateOnly(),
): ReservationTab {
  if (reservation.status === 'canceled') return 'cancelada'
  if (reservation.status === 'confirmed' && reservation.end_date < today) return 'finalizada'
  return 'activa'
}

export function groupByTab(
  reservations: TenantReservation[],
  today: string = todayDateOnly(),
): Record<ReservationTab, TenantReservation[]> {
  const grouped: Record<ReservationTab, TenantReservation[]> = {
    activa: [],
    finalizada: [],
    cancelada: [],
  }
  for (const reservation of reservations) {
    grouped[deriveTab(reservation, today)].push(reservation)
  }
  return grouped
}

/** Byte-identical to the backend's `ReservationCode::format()` and the web twin. */
export function formatReservationCode(id: number): string {
  return `LEO-${String(id).padStart(6, '0')}`
}

export function formatAmount(value: string | number | null | undefined): string {
  return `$${Number(value ?? 0).toFixed(2)}`
}

export interface ReservationCardViewModel {
  id: number
  title: string
  location: string
  period: string
  amount: string
  code: string
  tab: ReservationTab
  photo: string | null
  organizationName: string | null
  /** Shown only on organization reservations. */
  creatorName: string | null
  refund: string | null
}

export function toCardViewModel(
  reservation: TenantReservation,
  today: string = todayDateOnly(),
): ReservationCardViewModel {
  const room = reservation.store_rooms
  const tab = deriveTab(reservation, today)
  const address = [room?.direction, room?.city].filter(Boolean).join(', ')
  const size = room?.size ? `${room.size} m²` : ''
  const organization = reservation.organization ?? null

  return {
    id: reservation.id,
    title: room?.title ?? 'Bodega',
    location: [address, size].filter(Boolean).join(' · '),
    period: `${reservation.start_date} → ${reservation.end_date}`,
    amount: formatAmount(reservation.total_mount),
    code: formatReservationCode(reservation.id),
    tab,
    photo: reservation.photo_url,
    organizationName: organization?.name ?? null,
    creatorName: organization ? (reservation.creator_name ?? null) : null,
    refund:
      tab === 'cancelada' && reservation.refund_amount != null
        ? formatAmount(reservation.refund_amount)
        : null,
  }
}
