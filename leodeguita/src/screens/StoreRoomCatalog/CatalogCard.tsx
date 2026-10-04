import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { CatalogCardViewModel } from './model'

/**
 * Presentational card for one catalog room, ported from the
 * prototype's `LgExplorar` list item (photo, type badge, city, title,
 * stars, m², price, "Ver detalle"). No fetching — the screen owns that.
 */

function Stars({ rating }: { rating: number }) {
  const filled = Math.max(0, Math.min(5, Math.round(rating)))
  return (
    <span
      aria-label={`${rating} de 5 estrellas`}
      className="inline-flex items-center gap-0.5 text-xs font-semibold text-lg-ink"
    >
      {'★'.repeat(filled)}
      <span className="text-lg-t4">{'★'.repeat(5 - filled)}</span>
    </span>
  )
}

export default function CatalogCard({ room }: { room: CatalogCardViewModel }) {
  const navigate = useNavigate()
  const [imageFailed, setImageFailed] = useState(false)
  const showImage = Boolean(room.image) && !imageFailed

  return (
    <article className="overflow-hidden rounded-2xl border border-lg-line bg-white shadow-sm">
      <div className="relative h-36 w-full bg-lg-hair">
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
        <span className="absolute left-3 top-3 rounded-full bg-black/70 px-2.5 py-1 text-[11px] font-semibold text-white">
          {room.typeLabel}
        </span>
      </div>

      <div className="flex flex-col gap-1.5 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="m-0 text-sm font-bold text-lg-ink">{room.title}</h3>
          <Stars rating={room.rating} />
        </div>
        <p className="m-0 text-xs text-lg-t3">{room.city}</p>
        <p className="m-0 text-xs text-lg-t3">{room.size} m²</p>
        <div className="mt-1 flex items-end justify-between">
          <span className="text-sm font-semibold text-lg-ink">
            {room.price ? `${room.price} /mes` : 'Precio no publicado'}
          </span>
          <button
            type="button"
            onClick={() => navigate(`/bodegas/${room.id}`)}
            className="text-xs font-semibold text-lg-primary"
          >
            Ver detalle →
          </button>
        </div>
      </div>
    </article>
  )
}
