import type { StatusTone } from '../../components/StatusChip'
import type { MyStoreRoom } from '../../services/storeRooms'

/**
 * HUL-04: pure screen logic for `/mis-bodegas`. Kept beside the screen and
 * render-free (mirrors `PublishStoreRoom/model.ts`) so status derivation and
 * filtering are unit-testable without mounting React. Presentation tones live
 * here, never in the transport layer.
 */

export type DerivedStatus = 'rechazada' | 'pendiente' | 'ocupada' | 'disponible'
export type StatusFilter = 'todas' | DerivedStatus

/**
 * Reduce `publication_status` + `active_reservations_count` to ONE label.
 * Precedence is the order of these guards (spec AC "Derived per-card status
 * precedence"). The second guard tests `!== 'approved'` rather than
 * `=== 'pending'` so an unexpected enum value degrades to the conservative
 * "pendiente", never to "disponible".
 */
export function deriveStatus(room: MyStoreRoom): DerivedStatus {
  if (room.publication_status === 'rejected') return 'rechazada'
  if (room.publication_status !== 'approved') return 'pendiente'
  return room.active_reservations_count > 0 ? 'ocupada' : 'disponible'
}

export const STATUS_META: Record<
  DerivedStatus,
  { label: string; tone: StatusTone; filterLabel: string }
> = {
  rechazada: { label: 'Rechazada', tone: 'err', filterLabel: 'Rechazadas' },
  pendiente: { label: 'Pendiente', tone: 'warn', filterLabel: 'Pendientes' },
  ocupada: { label: 'Ocupada', tone: 'info', filterLabel: 'Ocupadas' },
  disponible: { label: 'Disponible', tone: 'ok', filterLabel: 'Disponibles' },
}

export const FILTERS: StatusFilter[] = [
  'todas',
  'disponible',
  'ocupada',
  'pendiente',
  'rechazada',
]

export function countByStatus(
  rooms: MyStoreRoom[],
): Record<StatusFilter, number> {
  const counts: Record<StatusFilter, number> = {
    todas: rooms.length,
    disponible: 0,
    ocupada: 0,
    pendiente: 0,
    rechazada: 0,
  }
  for (const room of rooms) {
    counts[deriveStatus(room)] += 1
  }
  return counts
}

export function filterRooms(
  rooms: MyStoreRoom[],
  filter: StatusFilter,
): MyStoreRoom[] {
  if (filter === 'todas') return rooms
  return rooms.filter((room) => deriveStatus(room) === filter)
}
