import type { NewStoreRoom, StoreRoomDetail } from '../../services/storeRooms'
import { parseSecurity } from '../StoreRoomDetail/model'
import { EMPTY_STORE_ROOM } from './model'

/**
 * Pure logic for the wizard's edit mode. The backend only lets the owner edit
 * title, description, size and the monthly price (`EditStoreRoomListingRequest`);
 * room/storage type, address, security and cancellation policy are ignored on
 * update, photos and the fire permit go through their own endpoints. So edit
 * mode prefills everything for context but only these fields are ever sent.
 */

/** Wizard steps whose fields the backend cannot edit (type, storage, photos, address). */
export const READ_ONLY_EDIT_STEPS = [0, 1, 2, 3]

/** Header subtitles that replace the publish copy where edit mode differs. */
export const EDIT_STEP_SUBS: Record<number, string> = {
  0: 'El tipo de espacio no se puede cambiar después de publicar.',
  1: 'El tipo de almacenamiento no se puede cambiar después de publicar.',
  2: 'Por ahora las fotos no se pueden cambiar desde la app.',
  3: 'La dirección no se puede cambiar después de publicar.',
  6: 'Sube un permiso nuevo solo si quieres reemplazar el actual.',
}

const toNumberString = (value: number | string): string => {
  const amount = Number(value)
  return Number.isFinite(amount) ? String(amount) : String(value)
}

const monthlyRow = (detail: StoreRoomDetail) =>
  detail.prices.find((entry) => entry.mode === 'month')

export function hasMonthlyPrice(detail: StoreRoomDetail): boolean {
  return monthlyRow(detail) !== undefined
}

export function storeRoomToFormValues(detail: StoreRoomDetail): NewStoreRoom {
  const monthly = monthlyRow(detail)
  return {
    ...EMPTY_STORE_ROOM,
    room_type: detail.room_type,
    storage_type: detail.storage_type,
    direction: detail.direction,
    city: detail.city,
    title: detail.title,
    description: detail.description,
    size: toNumberString(detail.size),
    monthly_price: monthly ? toNumberString(monthly.price) : '',
    security: Object.fromEntries(
      parseSecurity(detail.security).map((key) => [key, true]),
    ),
    latitude: detail.latitude,
    longitude: detail.longitude,
  }
}

export interface EditPayload {
  title?: string
  description?: string
  size?: number
  price?: number
}

/**
 * Only the editable fields that differ from the loaded room, mirroring the web
 * edit form. Sending an unchanged value would be harmless for the backend's
 * re-review check (it compares by value) but an empty payload lets the screen
 * skip the request altogether.
 */
export function buildEditPayload(
  initial: NewStoreRoom,
  current: NewStoreRoom,
  monthlyPriceEditable: boolean,
): EditPayload {
  const payload: EditPayload = {}

  if (current.title.trim() !== initial.title.trim()) {
    payload.title = current.title.trim()
  }
  if (current.description.trim() !== initial.description.trim()) {
    payload.description = current.description.trim()
  }
  if (Number(current.size) !== Number(initial.size)) {
    payload.size = Number(current.size)
  }
  if (
    monthlyPriceEditable &&
    Number(current.monthly_price) !== Number(initial.monthly_price)
  ) {
    payload.price = Number(current.monthly_price)
  }

  return payload
}

/** Edit-mode counterpart of `STEPS[n].isComplete`. */
export function isEditStepComplete(
  step: number,
  values: NewStoreRoom,
  monthlyPriceEditable: boolean,
): boolean {
  switch (step) {
    case 4:
      return (
        values.title.trim().length > 0 && values.description.trim().length > 0
      )
    case 5:
      return (
        Number(values.size) > 0 &&
        (!monthlyPriceEditable || Number(values.monthly_price) > 0)
      )
    default:
      return true
  }
}
