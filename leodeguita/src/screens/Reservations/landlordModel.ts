import type { LandlordReservation } from '../../services/reservations'
import { formatAmount, todayDateOnly } from './model'

/**
 * Pure screen logic for the gestor's `/reservas`. The prototype only has
 * "Activas" and "Finalizadas", so canceled and unpaid (`pending`) rows, which
 * the endpoint also returns, belong to neither tab and are left out.
 */

export type LandlordTab = 'activa' | 'finalizada'

export const LANDLORD_TABS: { key: LandlordTab; label: string }[] = [
  { key: 'activa', label: 'Activas' },
  { key: 'finalizada', label: 'Finalizadas' },
]

export function deriveLandlordTab(
  reservation: Pick<LandlordReservation, 'status' | 'end_date'>,
  today: string = todayDateOnly(),
): LandlordTab | null {
  if (reservation.status !== 'confirmed') return null
  return reservation.end_date < today ? 'finalizada' : 'activa'
}

export function groupLandlord(
  reservations: LandlordReservation[],
  today: string = todayDateOnly(),
): Record<LandlordTab, LandlordReservation[]> {
  const grouped: Record<LandlordTab, LandlordReservation[]> = { activa: [], finalizada: [] }
  for (const reservation of reservations) {
    const tab = deriveLandlordTab(reservation, today)
    if (tab) grouped[tab].push(reservation)
  }
  return grouped
}

export function clientName(reservation: LandlordReservation): string {
  const user = reservation.tenants?.user
  return `${user?.name ?? ''} ${user?.lastname ?? ''}`.trim() || 'Cliente'
}

export interface LandlordRowViewModel {
  id: number
  title: string
  client: string
  period: string
  amount: string
  tab: LandlordTab | null
}

export function toLandlordRow(
  reservation: LandlordReservation,
  today: string = todayDateOnly(),
): LandlordRowViewModel {
  return {
    id: reservation.id,
    title: reservation.store_rooms?.title ?? 'Bodega',
    client: clientName(reservation),
    period: `${reservation.start_date} — ${reservation.end_date}`,
    amount: formatAmount(reservation.total_mount),
    tab: deriveLandlordTab(reservation, today),
  }
}
