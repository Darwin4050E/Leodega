import { useParams } from 'react-router-dom'
import EditStoreRoomLoader from './EditStoreRoomLoader'
import StoreRoomWizard from './StoreRoomWizard'

/**
 * `/publicar` publishes a new store room; `/mis-bodegas/:id/editar` runs the
 * same wizard in edit mode, prefilled from the gestor's own room. The wizard
 * itself lives in `StoreRoomWizard`.
 */
export default function PublishStoreRoomScreen() {
  const { id } = useParams<{ id: string }>()
  if (id === undefined) return <StoreRoomWizard />
  return <EditStoreRoomLoader id={Number(id)} />
}
