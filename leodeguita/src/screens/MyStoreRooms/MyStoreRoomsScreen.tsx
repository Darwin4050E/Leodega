import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import PhoneFrame from '../../components/PhoneFrame'
import Button from '../../components/Button'
import { listMyStoreRooms, type MyStoreRoom } from '../../services/storeRooms'
import StoreRoomCard from './StoreRoomCard'
import {
  FILTERS,
  STATUS_META,
  countByStatus,
  filterRooms,
  type StatusFilter,
} from './model'

/**
 * HUL-04: the gestor's overview of every store room they own. Non-landlord
 * guard first (mirrors `PublishStoreRoomScreen`). One fetch on mount, three
 * phases, and a client-side status filter over the already-loaded list.
 */

type Phase = 'loading' | 'error' | 'ready'

const chipLabel = (filter: StatusFilter): string =>
  filter === 'todas' ? 'Todas' : STATUS_META[filter].filterLabel

function Header() {
  return (
    <div className="shrink-0 px-5 pb-3 pt-12">
      <h1 className="m-0 text-xl font-bold tracking-tight text-lg-ink">
        Mis bodegas
      </h1>
    </div>
  )
}

export default function MyStoreRoomsScreen() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const isLandlord = user?.role === 'landlord'
  const landlordId =
    typeof user?.landlord?.id === 'number' ? user.landlord.id : null

  const [phase, setPhase] = useState<Phase>('loading')
  const [rooms, setRooms] = useState<MyStoreRoom[]>([])
  const [filter, setFilter] = useState<StatusFilter>('todas')

  const load = useCallback(() => {
    if (!isLandlord) return
    if (landlordId === null) {
      setPhase('error')
      return
    }
    setPhase('loading')
    listMyStoreRooms(landlordId)
      .then((result) => {
        setRooms(result)
        setPhase('ready')
      })
      .catch(() => setPhase('error'))
  }, [isLandlord, landlordId])

  useEffect(() => {
    load()
  }, [load])

  if (!isLandlord) {
    return (
      <PhoneFrame>
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <p className="text-sm text-lg-t3">
            Solo un gestor de almacenamiento puede ver sus bodegas.
          </p>
          <Button
            variant="sec"
            className="mt-6 w-auto px-4"
            onClick={() => navigate('/', { replace: true })}
          >
            Volver al inicio
          </Button>
        </div>
      </PhoneFrame>
    )
  }

  if (phase === 'loading') {
    return (
      <PhoneFrame>
        <Header />
        <div className="flex flex-1 items-center justify-center px-6 text-sm text-lg-t3">
          Cargando tus bodegas…
        </div>
      </PhoneFrame>
    )
  }

  if (phase === 'error') {
    return (
      <PhoneFrame>
        <Header />
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <p className="text-sm text-lg-t3">
            No pudimos cargar tus bodegas. Intenta de nuevo.
          </p>
          <Button variant="sec" className="w-auto px-4" onClick={load}>
            Reintentar
          </Button>
        </div>
      </PhoneFrame>
    )
  }

  if (rooms.length === 0) {
    return (
      <PhoneFrame>
        <Header />
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <p className="text-sm text-lg-t3">
            Aún no has publicado ninguna bodega.
          </p>
          <Button
            className="w-auto px-4"
            onClick={() => navigate('/publicar')}
          >
            Publicar una nueva
          </Button>
        </div>
      </PhoneFrame>
    )
  }

  const counts = countByStatus(rooms)
  const visible = filterRooms(rooms, filter)

  return (
    <PhoneFrame>
      <Header />

      <div className="flex shrink-0 gap-2 overflow-x-auto px-5 pb-3">
        {FILTERS.map((option) => {
          const active = filter === option
          return (
            <button
              key={option}
              type="button"
              aria-pressed={active}
              onClick={() => setFilter(option)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                active
                  ? 'border-lg-primary bg-lg-soft text-lg-primary'
                  : 'border-lg-line bg-white text-lg-t3'
              }`}
            >
              {chipLabel(option)} ({counts[option]})
            </button>
          )
        })}
      </div>

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-5 pb-8">
        {visible.length === 0 ? (
          <p className="mt-8 text-center text-sm text-lg-t3">
            Ninguna bodega coincide con este filtro.
          </p>
        ) : (
          visible.map((room) => <StoreRoomCard key={room.id} room={room} />)
        )}
      </div>
    </PhoneFrame>
  )
}
