import type {
  CancellationPolicyTier,
  NewStoreRoom,
  RoomType,
  StorageType,
} from '../../services/storeRooms'

export const EMPTY_STORE_ROOM: NewStoreRoom = {
  room_type: '',
  storage_type: '',
  photos: [],
  direction: '',
  city: '',
  title: '',
  description: '',
  monthly_price: '',
  size: '',
  security: {},
  cancellation_policy_tier: '',
  permit: null,
}

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

export const POLICY_TIERS: { value: CancellationPolicyTier; label: string }[] = [
  { value: 'flexible', label: 'Flexible' },
  { value: 'moderada', label: 'Moderada' },
  { value: 'estricta', label: 'Estricta' },
]

export const SECURITY_OPTIONS: { key: string; label: string }[] = [
  { key: 'camara', label: 'Cámara de seguridad exterior' },
  { key: 'ruido', label: 'Monitor de ruido / decibeles' },
  { key: 'control', label: 'Control de plagas y humedad' },
  { key: 'acceso', label: 'Acceso restringido 24/7' },
]

export const DESCRIPTION_MAX = 500
export const SERVICE_FEE_RATE = 0.1

export interface StepDef {
  title: string
  sub: string
  /** Whether the step has enough input to advance. */
  isComplete: (v: NewStoreRoom) => boolean
}

export const STEPS: StepDef[] = [
  {
    title: '¿Qué describe mejor tu espacio?',
    sub: 'Selecciona el tipo de propiedad que vas a publicar.',
    isComplete: (v) => Boolean(v.room_type),
  },
  {
    title: '¿Qué tipo de almacenamiento ofreces?',
    sub: 'Define cómo usará el cliente tu espacio.',
    isComplete: (v) => Boolean(v.storage_type),
  },
  {
    title: 'Agrega fotos de tu bodega',
    sub: 'Necesitas al menos una foto. Recomendamos cinco.',
    isComplete: (v) => v.photos.length >= 1,
  },
  {
    title: '¿Dónde se encuentra tu espacio?',
    sub: 'Solo compartimos la dirección con clientes con reserva confirmada.',
    isComplete: (v) => v.direction.trim().length > 0 && v.city.trim().length > 0,
  },
  {
    title: 'Título y descripción',
    sub: 'Comparte lo que hace especial a tu espacio.',
    isComplete: (v) =>
      v.title.trim().length > 0 && v.description.trim().length > 0,
  },
  {
    title: 'Precio y tamaño',
    sub: 'Define la tarifa mensual y los metros cuadrados.',
    isComplete: (v) => Number(v.monthly_price) > 0 && Number(v.size) > 0,
  },
  {
    title: 'Seguridad y documentación',
    sub: 'Adjunta el permiso de bomberos para la verificación.',
    isComplete: (v) => Boolean(v.permit) && Boolean(v.cancellation_policy_tier),
  },
]

export const LAST_STEP = STEPS.length - 1

/**
 * Which wizard step owns each backend validation key, so a 400 can jump the
 * user back to the offending step. `title` is HUL-03 scenario 3.
 */
const FIELD_STEP: Record<string, number> = {
  room_type: 0,
  storage_type: 1,
  direction: 3,
  city: 3,
  title: 4,
  description: 4,
  size: 5,
  'storePrices.0.price': 5,
  security: 6,
  cancellation_policy_tier: 6,
  firefighter_permit: 6,
}

export type FormErrors = Record<string, string>

export function mapApiErrors(errors: Record<string, string[]> = {}): {
  fieldErrors: FormErrors
  firstStep: number | null
} {
  const fieldErrors: FormErrors = {}
  let firstStep: number | null = null

  for (const [key, messages] of Object.entries(errors)) {
    fieldErrors[key] = messages[0]
    const step = FIELD_STEP[key]
    if (step !== undefined && (firstStep === null || step < firstStep)) {
      firstStep = step
    }
  }

  return { fieldErrors, firstStep }
}
