import { useState } from 'react'
import StatusChip from '../../components/StatusChip'
import { ROOM_TYPES } from '../../lib/storeRoomLabels'
import type { MyStoreRoom } from '../../services/storeRooms'
import { STATUS_META, deriveStatus } from './model'

/**
 * HUL-04: presentational card for one owned store room. No fetching, no
 * routing — the screen owns those. `image` is an absolute `asset()` URL whose
 * PWA-origin resolution is unverified, so a `null` image or a load error both
 * fall back to the same inline placeholder.
 */

const roomTypeLabel = (value: string): string =>
  ROOM_TYPES.find((type) => type.value === value)?.label ?? value

function monthlyPrice(room: MyStoreRoom): string | null {
  const price =
    room.storePrices?.find((entry) => entry.mode === 'month') ??
    room.storePrices?.[0]
  if (!price) return null
  const amount = Number(price.price)
  return Number.isFinite(amount) ? `$${amount}` : `$${price.price}`
}

export default function StoreRoomCard({ room }: { room: MyStoreRoom }) {
  const [imageFailed, setImageFailed] = useState(false)
  const meta = STATUS_META[deriveStatus(room)]
  const price = monthlyPrice(room)
  const showImage = Boolean(room.image) && !imageFailed

  return (
    <article className="overflow-hidden rounded-2xl border border-lg-line bg-white">
      <div className="h-36 w-full bg-lg-hair">
        {showImage ? (
          <img
            src={room.image ?? undefined}
            alt=""
            className="h-full w-full object-cover"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-lg-t4">
            Sin foto
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1.5 p-4">
        <StatusChip tone={meta.tone}>{meta.label}</StatusChip>
        <h3 className="m-0 text-sm font-bold text-lg-ink">{room.title}</h3>
        <p className="m-0 text-xs text-lg-t3">
          {room.direction} · {room.city}
        </p>
        <p className="m-0 text-xs text-lg-t3">
          {roomTypeLabel(room.room_type)} · {room.size} m²
        </p>
        {price && (
          <p className="m-0 text-sm font-semibold text-lg-ink">{price} /mes</p>
        )}
        {room.active_reservations_count > 0 && (
          <p className="m-0 text-xs text-lg-t4">
            {room.active_reservations_count} reserva
            {room.active_reservations_count === 1 ? '' : 's'} vigente
            {room.active_reservations_count === 1 ? '' : 's'}
          </p>
        )}
      </div>
    </article>
  )
}
