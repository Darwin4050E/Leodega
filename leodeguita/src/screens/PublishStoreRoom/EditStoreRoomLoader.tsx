import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import PhoneFrame from '../../components/PhoneFrame'
import Button from '../../components/Button'
import {
  getStoreRoomDetail,
  listMyStoreRooms,
  StoreRoomNotFoundError,
} from '../../services/storeRooms'
import StoreRoomWizard, { type EditContext } from './StoreRoomWizard'
import { hasMonthlyPrice, storeRoomToFormValues } from './editModel'

/**
 * Loads one of the gestor's own rooms for edit mode. Status comes from the
 * own-rooms list (which also proves ownership: a room missing from it is
 * "not found"); the editable values and photos from the detail endpoint.
 */

type Phase = 'loading' | 'error' | 'notfound' | 'ready'

export default function EditStoreRoomLoader({ id }: { id: number }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const landlordId =
    typeof user?.landlord?.id === 'number' ? user.landlord.id : null

  const [phase, setPhase] = useState<Phase>('loading')
  const [edit, setEdit] = useState<EditContext | null>(null)

  const load = useCallback(() => {
    if (!Number.isInteger(id) || id <= 0) {
      setPhase('notfound')
      return
    }
    if (landlordId === null) {
      setPhase('error')
      return
    }
    setPhase('loading')
    Promise.all([getStoreRoomDetail(id), listMyStoreRooms(landlordId)])
      .then(([detail, mine]) => {
        const own = mine.find((entry) => entry.id === id)
        if (!own) {
          setPhase('notfound')
          return
        }
        setEdit({
          id,
          status: own.publication_status,
          hasMonthlyPrice: hasMonthlyPrice(detail),
          photoUrls: detail.photos,
          initialValues: storeRoomToFormValues(detail),
        })
        setPhase('ready')
      })
      .catch((error: unknown) => {
        setPhase(error instanceof StoreRoomNotFoundError ? 'notfound' : 'error')
      })
  }, [id, landlordId])

  useEffect(() => {
    load()
  }, [load])

  if (phase === 'ready' && edit) return <StoreRoomWizard edit={edit} />

  const goToList = () => navigate('/mis-bodegas', { replace: true })

  return (
    <PhoneFrame>
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        {phase === 'loading' && (
          <p className="text-sm text-lg-t3">Cargando bodega…</p>
        )}
        {phase === 'notfound' && (
          <>
            <p className="text-sm text-lg-t3">Esta bodega ya no existe.</p>
            <Button variant="sec" className="w-auto px-4" onClick={goToList}>
              Volver a mis bodegas
            </Button>
          </>
        )}
        {phase === 'error' && (
          <>
            <p className="text-sm text-lg-t3">
              No pudimos cargar esta bodega. Intenta de nuevo.
            </p>
            <Button variant="sec" className="w-auto px-4" onClick={load}>
              Reintentar
            </Button>
          </>
        )}
      </div>
    </PhoneFrame>
  )
}
