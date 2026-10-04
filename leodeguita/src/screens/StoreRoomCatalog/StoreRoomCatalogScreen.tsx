import { useCallback, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import PhoneFrame from '../../components/PhoneFrame'
import Button from '../../components/Button'
import { listStoreRooms, type CatalogStoreRoom } from '../../services/storeRooms'
import CatalogCard from './CatalogCard'
import { excludeUnavailable, toCardViewModel } from './model'

/**
 * The mobile catalog entry point (`LgExplorar` in the prototype,
 * trimmed to spec — no search, filters, sort, or map controls; spec
 * "Minimal Catalog List"). One fetch on mount, three phases, mirrors
 * `MyStoreRoomsScreen`'s shape.
 *
 * `location.state.unavailableId` is how the detail screen reports that a
 * room stopped being available (design decision #3): this screen filters it
 * out of the already-loaded list. The state is session-scoped only — a hard
 * reload re-derives truth per room, which is the accepted trade-off.
 */

type Phase = 'loading' | 'error' | 'ready'

interface NavigationState {
  unavailableId?: number
}

function Header() {
  return (
    <div className="shrink-0 px-5 pb-3 pt-12">
      <h1 className="m-0 text-xl font-bold tracking-tight text-lg-ink">
        Explorar
      </h1>
      <p className="m-0 mt-1 text-sm text-lg-t3">Espacios disponibles</p>
    </div>
  )
}

export default function StoreRoomCatalogScreen() {
  const location = useLocation()
  const unavailableId =
    (location.state as NavigationState | null)?.unavailableId ?? null

  const [phase, setPhase] = useState<Phase>('loading')
  const [rooms, setRooms] = useState<CatalogStoreRoom[]>([])

  const load = useCallback(() => {
    setPhase('loading')
    listStoreRooms()
      .then((result) => {
        setRooms(result)
        setPhase('ready')
      })
      .catch(() => setPhase('error'))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (phase === 'loading') {
    return (
      <PhoneFrame>
        <Header />
        <div className="flex flex-1 items-center justify-center px-6 text-sm text-lg-t3">
          Cargando espacios…
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
            No pudimos cargar los espacios disponibles. Intenta de nuevo.
          </p>
          <Button variant="sec" className="w-auto px-4" onClick={load}>
            Reintentar
          </Button>
        </div>
      </PhoneFrame>
    )
  }

  const visible = excludeUnavailable(rooms, unavailableId)

  if (visible.length === 0) {
    return (
      <PhoneFrame>
        <Header />
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <p className="text-sm text-lg-t3">
            No hay espacios disponibles por ahora.
          </p>
        </div>
      </PhoneFrame>
    )
  }

  return (
    <PhoneFrame>
      <Header />
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-5 pb-8">
        {visible.map((room) => (
          <CatalogCard key={room.id} room={toCardViewModel(room)} />
        ))}
      </div>
    </PhoneFrame>
  )
}
