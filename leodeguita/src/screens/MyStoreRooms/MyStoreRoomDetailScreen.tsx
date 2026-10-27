import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import PhoneFrame from '../../components/PhoneFrame'
import Button from '../../components/Button'
import {
  deleteStoreRoom,
  extractApiMessage,
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

/** Bottom bar of the detail: the trash action, locked while reservations are active. */
function ActionBar({ locked, onDelete }: { locked: boolean; onDelete: () => void }) {
  return (
    <div className="flex shrink-0 items-center gap-2.5 border-t border-lg-line bg-white px-5 pb-8 pt-3">
      <div className="flex-1">
        {locked && (
          <p className="m-0 text-xs text-lg-t4">Tiene reservas vigentes</p>
        )}
      </div>
      <button
        type="button"
        aria-label="Eliminar bodega"
        disabled={locked}
        title={locked ? 'Tiene reservas vigentes' : 'Eliminar'}
        onClick={onDelete}
        className={`flex h-[54px] w-[54px] shrink-0 items-center justify-center rounded-xl text-lg ${
          locked
            ? 'cursor-not-allowed bg-lg-hair text-lg-t4'
            : 'bg-lg-err-bg text-lg-err'
        }`}
      >
        <span aria-hidden="true">{locked ? '🔒' : '🗑'}</span>
      </button>
    </div>
  )
}

/** Destructive confirmation; copy follows the web `EliminarBodegaModal`. */
function DeleteDialog({
  title,
  deleting,
  error,
  onCancel,
  onConfirm,
}: {
  title: string
  deleting: boolean
  error: string | null
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-5">
      <div
        role="dialog"
        aria-label="Eliminar bodega"
        className="w-full max-w-[380px] overflow-hidden rounded-2xl bg-white shadow-xl"
      >
        <div className="px-5 pb-1 pt-5">
          <h2 className="m-0 text-base font-bold text-lg-ink">Eliminar bodega</h2>
          <p className="mt-2 text-sm leading-relaxed text-lg-t2">
            ¿Seguro que deseas eliminar {title}? Esta acción no se puede deshacer.
          </p>
          {error && (
            <p role="alert" className="mt-2 text-xs text-lg-err">
              {error}
            </p>
          )}
        </div>
        <div className="flex gap-2.5 px-5 pb-5 pt-4">
          <Button variant="sec" disabled={deleting} onClick={onCancel}>
            Cancelar
          </Button>
          <Button
            disabled={deleting}
            onClick={onConfirm}
            className="!bg-lg-err"
          >
            {deleting ? 'Eliminando…' : 'Eliminar'}
          </Button>
        </div>
      </div>
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
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

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

  async function handleDelete() {
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteStoreRoom(roomId)
      navigate('/mis-bodegas', { replace: true })
    } catch (error) {
      setDeleteError(
        extractApiMessage(error) ??
          'No se pudo eliminar la bodega. Intenta de nuevo.',
      )
      setDeleting(false)
    }
  }

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
      <MyStoreRoomDetailView
        room={room}
        detail={detail}
        onBack={goToList}
        footer={
          <ActionBar
            locked={room.active_reservations_count > 0}
            onDelete={() => {
              setDeleteError(null)
              setConfirmingDelete(true)
            }}
          />
        }
      />
      {confirmingDelete && (
        <DeleteDialog
          title={room.title}
          deleting={deleting}
          error={deleteError}
          onCancel={() => setConfirmingDelete(false)}
          onConfirm={handleDelete}
        />
      )}
    </PhoneFrame>
  )
}
