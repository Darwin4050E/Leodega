import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import PhoneFrame from '../../components/PhoneFrame'
import Button from '../../components/Button'
import {
  getStoreRoomDetail,
  StoreRoomNotFoundError,
  type StoreRoomDetail,
} from '../../services/storeRooms'
import StoreRoomDetailView from './StoreRoomDetailView'

/**
 * The mobile detail screen (`LgDetalle` in the prototype). Fetches
 * on every mount (spec "Unavailability Notice on Refresh" — an SPA remount
 * is this screen's refresh boundary; there is no polling). A 404 lands on a
 * `notfound` phase distinct from the in-view unavailability banner (spec
 * "Room no longer exists" vs. "Room becomes occupied while viewing").
 *
 * On back navigation from an unavailable room, this screen pushes the id
 * back to the catalog via react-router navigation state (design decision
 * #3), so `StoreRoomCatalogScreen` can drop it from its in-memory list.
 */

type Phase = 'loading' | 'error' | 'notfound' | 'ready'

function Header({ onBack }: { onBack: () => void }) {
  return (
    <div className="shrink-0 px-5 pb-3 pt-12">
      <button
        type="button"
        onClick={onBack}
        aria-label="Volver"
        className="flex h-9 w-9 items-center justify-center rounded-full border border-lg-line bg-white text-lg-ink"
      >
        ←
      </button>
    </div>
  )
}

export default function StoreRoomDetailScreen() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const roomId = Number(id)

  const [phase, setPhase] = useState<Phase>('loading')
  const [detail, setDetail] = useState<StoreRoomDetail | null>(null)

  const load = useCallback(() => {
    setPhase('loading')
    getStoreRoomDetail(roomId)
      .then((result) => {
        setDetail(result)
        setPhase('ready')
      })
      .catch((error: unknown) => {
        setPhase(error instanceof StoreRoomNotFoundError ? 'notfound' : 'error')
      })
  }, [roomId])

  useEffect(() => {
    load()
  }, [load])

  const goToCatalog = () => navigate('/bodegas')

  const goBack = () => {
    if (detail && !detail.is_available_now) {
      navigate('/bodegas', { state: { unavailableId: detail.id } })
      return
    }
    goToCatalog()
  }

  if (phase === 'loading') {
    return (
      <PhoneFrame>
        <Header onBack={goToCatalog} />
        <div className="flex flex-1 items-center justify-center px-6 text-sm text-lg-t3">
          Cargando espacio…
        </div>
      </PhoneFrame>
    )
  }

  if (phase === 'notfound') {
    return (
      <PhoneFrame>
        <Header onBack={goToCatalog} />
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <p className="text-sm text-lg-t3">Este espacio ya no existe.</p>
          <Button variant="sec" className="w-auto px-4" onClick={goToCatalog}>
            Volver al catálogo
          </Button>
        </div>
      </PhoneFrame>
    )
  }

  if (phase === 'error') {
    return (
      <PhoneFrame>
        <Header onBack={goToCatalog} />
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <p className="text-sm text-lg-t3">
            No pudimos cargar este espacio. Intenta de nuevo.
          </p>
          <Button variant="sec" className="w-auto px-4" onClick={load}>
            Reintentar
          </Button>
        </div>
      </PhoneFrame>
    )
  }

  return (
    <PhoneFrame>
      <StoreRoomDetailView detail={detail as StoreRoomDetail} onBack={goBack} />
    </PhoneFrame>
  )
}
