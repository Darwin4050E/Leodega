import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import PhoneFrame from '../../components/PhoneFrame'
import Button from '../../components/Button'
import {
  getStoreRoomDetail,
  listMyStoreRooms,
  StoreRoomNotFoundError,
  type MyStoreRoom,
  type StoreRoomDetail,
} from '../../services/storeRooms'
import MyStoreRoomDetailView from './MyStoreRoomDetailView'

/**
 * The gestor's detail of one of their own store rooms (`LgBodegaDetalle`).
 * Status, rejection and reservation count come from the own-rooms list (the
 * same source `/mis-bodegas` uses); description, coordinates and photos from
 * the detail endpoint the web gestor also consumes. A room missing from the
 * gestor's own list is treated as not found, so another gestor's approved
 * room is never shown here. Landlord-only via the route's `RolesOnly` gate.
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

export default function MyStoreRoomDetailScreen() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const roomId = Number(id)
  const landlordId =
    typeof user?.landlord?.id === 'number' ? user.landlord.id : null

  const [phase, setPhase] = useState<Phase>('loading')
  const [room, setRoom] = useState<MyStoreRoom | null>(null)
  const [detail, setDetail] = useState<StoreRoomDetail | null>(null)

  const load = useCallback(() => {
    if (!Number.isInteger(roomId) || roomId <= 0) {
      setPhase('notfound')
      return
    }
    if (landlordId === null) {
      setPhase('error')
      return
    }
    setPhase('loading')
    Promise.all([getStoreRoomDetail(roomId), listMyStoreRooms(landlordId)])
      .then(([fetchedDetail, mine]) => {
        const own = mine.find((entry) => entry.id === roomId)
        if (!own) {
          setPhase('notfound')
          return
        }
        setDetail(fetchedDetail)
        setRoom(own)
        setPhase('ready')
      })
      .catch((error: unknown) => {
        setPhase(error instanceof StoreRoomNotFoundError ? 'notfound' : 'error')
      })
  }, [roomId, landlordId])

  useEffect(() => {
    load()
  }, [load])

  const goToList = () => navigate('/mis-bodegas')

  if (phase === 'loading') {
    return (
      <PhoneFrame>
        <Header onBack={goToList} />
        <div className="flex flex-1 items-center justify-center px-6 text-sm text-lg-t3">
          Cargando bodega…
        </div>
      </PhoneFrame>
    )
  }

  if (phase === 'notfound') {
    return (
      <PhoneFrame>
        <Header onBack={goToList} />
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <p className="text-sm text-lg-t3">Esta bodega ya no existe.</p>
          <Button variant="sec" className="w-auto px-4" onClick={goToList}>
            Volver a mis bodegas
          </Button>
        </div>
      </PhoneFrame>
    )
  }

  if (phase === 'error' || !room || !detail) {
    return (
      <PhoneFrame>
        <Header onBack={goToList} />
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <p className="text-sm text-lg-t3">
            No pudimos cargar esta bodega. Intenta de nuevo.
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
      <MyStoreRoomDetailView room={room} detail={detail} onBack={goToList} />
    </PhoneFrame>
  )
}
