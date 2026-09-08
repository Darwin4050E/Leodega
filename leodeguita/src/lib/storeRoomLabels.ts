import type { RoomType, StorageType } from '../services/storeRooms'

/**
 * Shared label maps for store-room enums. Extracted from
 * `screens/PublishStoreRoom/model.ts` so more than one screen can label a
 * `room_type` / `storage_type` without importing another screen's folder.
 * `PublishStoreRoom/model.ts` re-exports these to keep its own importers
 * (`steps.tsx`, the HUL-03 test suite) unchanged.
 */

export const ROOM_TYPES: { value: RoomType; label: string }[] = [
  { value: 'bodega', label: 'Bodega independiente' },
  { value: 'habitacion', label: 'Habitación' },
  { value: 'garaje', label: 'Garaje / parqueo' },
  { value: 'contenedor', label: 'Contenedor' },
  { value: 'sotano', label: 'Sótano' },
  { value: 'atico', label: 'Ático' },
]

export const STORAGE_TYPES: {
  value: StorageType
  title: string
  desc: string
}[] = [
  {
    value: 'completa',
    title: 'Una bodega completa',
    desc: 'El cliente dispondrá de la bodega entera para su uso exclusivo.',
  },
  {
    value: 'privado',
    title: 'Un espacio privado',
    desc: 'Espacio delimitado dentro de una propiedad, con acceso controlado.',
  },
  {
    value: 'compartido',
    title: 'Un espacio compartido',
    desc: 'Área compartida con otros, dentro de un espacio supervisado.',
  },
]
