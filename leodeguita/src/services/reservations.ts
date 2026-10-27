import client from '../api/client'

/**
 * Transport for the tenant reservations list (`/reservas`).
 *
 * Reuses `GET /tenant/reservations` (`tenantIndex()`), the same endpoint the
 * web "Mis reservas" screen consumes. The active organization travels in the
 * `X-Organization-Id` header added by the shared client, so the backend
 * already narrows the list to the current context; nothing is filtered here.
 */

export interface ReservationOrganization {
  id: number
  name: string
  ruc: string
}

/** Only the fields the mobile list reads; the endpoint sends more. */
export interface TenantReservation {
  id: number
  status: string
  start_date: string
  end_date: string
  store_room_id: number
  total_mount: string | number | null
  photo_url: string | null
  /** Set once the reservation is canceled; print as sent, never re-derived. */
  refund_amount?: string | number | null
  store_rooms?: {
    id?: number
    title?: string
    direction?: string
    city?: string
    size?: number
  }
  /** Present (non-null) only for an organization reservation. */
  organization?: ReservationOrganization | null
  creator_name?: string | null
}

export async function listTenantReservations(): Promise<TenantReservation[]> {
  const { data } = await client.get<TenantReservation[]>('/tenant/reservations')
  return data
}

/**
 * A reservation received on one of the gestor's store rooms, from
 * `GET /landlord/reservations` (`landlordIndex()`, the endpoint the web
 * "Reservas" page reads). Only the fields the mobile list shows.
 */
export interface LandlordReservation {
  id: number
  status: string
  start_date: string
  end_date: string
  store_room_id: number
  total_mount: string | number | null
  store_rooms?: {
    id?: number
    title?: string
  }
  tenants?: {
    user?: {
      name?: string
      lastname?: string
    }
  }
}

export async function listLandlordReservations(): Promise<LandlordReservation[]> {
  const { data } = await client.get<LandlordReservation[]>('/landlord/reservations')
  return data
}
