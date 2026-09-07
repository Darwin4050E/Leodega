import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../../auth/useAuth'
import PhoneFrame from '../../components/PhoneFrame'
import Button from '../../components/Button'
import StatusChip from '../../components/StatusChip'
import StepProgress from '../../components/StepProgress'
import {
  createStoreRoom,
  uploadStoreRoomPhotos,
  type ApiValidationError,
  type NewStoreRoom,
} from '../../services/storeRooms'
import StepBody from './steps'
import {
  EMPTY_STORE_ROOM,
  LAST_STEP,
  STEPS,
  mapApiErrors,
  type FormErrors,
} from './model'

type Phase = 'form' | 'success'

/**
 * HUL-03: publish a storeroom for review. Seven guided steps mirroring the web
 * wizard; each step gates "Continuar" until its fields are complete (scenario
 * 2). On submit the shared backend creates the listing as "pending" and
 * notifies the admins; a 400 sends the gestor back to the offending step with
 * the server's message, including the duplicate-name warning (scenario 3).
 * Photos are uploaded right after creation, best-effort.
 */
export default function PublishStoreRoomScreen() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [values, setValues] = useState<NewStoreRoom>(EMPTY_STORE_ROOM)
  const [step, setStep] = useState(0)
  const [errors, setErrors] = useState<FormErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [phase, setPhase] = useState<Phase>('form')
  const [photoWarning, setPhotoWarning] = useState(false)
  const [createdTitle, setCreatedTitle] = useState('')

  if (user?.role !== 'landlord') {
    return (
      <PhoneFrame>
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <p className="text-sm text-lg-t3">
            Solo un gestor de almacenamiento puede publicar espacios.
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

  if (phase === 'success') {
    return (
      <PhoneFrame>
        <div className="flex flex-1 flex-col items-center justify-center px-7 pb-8 text-center">
          <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-lg-warn-bg text-3xl">
            🕒
          </div>
          <h1 className="m-0 text-xl font-bold tracking-tight text-lg-ink">
            Tu espacio quedó pendiente de verificación
          </h1>
          <p className="mx-auto mt-2.5 max-w-xs text-sm leading-relaxed text-lg-t3">
            El administrador revisará las fotos, la información y el permiso de
            bomberos. Te avisaremos cuando{' '}
            <b className="text-lg-t2">{createdTitle || 'tu espacio'}</b> sea
            aprobado.
          </p>
          <div className="mt-5">
            <StatusChip tone="warn">Pendiente de verificación</StatusChip>
          </div>
          {photoWarning && (
            <p className="mt-4 text-xs text-lg-err">
              No pudimos subir las fotos. Podrás agregarlas desde «Mis bodegas».
            </p>
          )}
        </div>
        <div className="shrink-0 px-5 pb-8">
          <Button onClick={() => navigate('/mis-bodegas', { replace: true })}>
            Ir a mis bodegas
          </Button>
        </div>
      </PhoneFrame>
    )
  }

  const current = STEPS[step]
  const canAdvance = current.isComplete(values)

  function set<K extends keyof NewStoreRoom>(key: K, value: NewStoreRoom[K]) {
    setValues((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => {
      if (!(key in prev)) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  function goBack() {
    setFormError(null)
    if (step === 0) navigate('/', { replace: true })
    else setStep((s) => s - 1)
  }

  async function handleSubmit() {
    setFormError(null)
    setErrors({})
    setSubmitting(true)
    try {
      const result = await createStoreRoom(values)
      const id = result.item?.id
      setCreatedTitle(result.item?.title ?? values.title.trim())

      if (id && values.photos.length > 0) {
        try {
          await uploadStoreRoomPhotos(id, values.photos)
        } catch {
          setPhotoWarning(true)
        }
      }
      setPhase('success')
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 400) {
        const body = error.response.data as ApiValidationError
        const { fieldErrors, firstStep } = mapApiErrors(body.errors)
        setErrors(fieldErrors)
        if (firstStep !== null) setStep(firstStep)
        setFormError(
          fieldErrors.title ??
            body.message ??
            'Revisa los datos e inténtalo de nuevo.',
        )
      } else {
        setFormError('No se pudo enviar tu espacio. Intenta de nuevo.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <PhoneFrame>
      <div className="shrink-0 px-5 pb-3 pt-12">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={goBack}
            aria-label="Volver"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-lg-line bg-white"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-lg-t2"
            >
              <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold text-lg-t4">
              Publicar · Paso {step + 1} de {STEPS.length}
            </div>
            <h1 className="m-0 mt-0.5 text-lg font-bold leading-tight tracking-tight text-lg-ink">
              {current.title}
            </h1>
          </div>
        </div>
        <div className="mt-3.5">
          <StepProgress total={STEPS.length} current={step} />
        </div>
        <p className="mt-3 text-xs leading-snug text-lg-t3">{current.sub}</p>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        <StepBody step={step} values={values} set={set} errors={errors} />
        {formError && (
          <p role="alert" className="mt-4 text-sm text-lg-err">
            {formError}
          </p>
        )}
      </div>

      <div className="shrink-0 border-t border-lg-line px-5 pb-8 pt-3">
        {step < LAST_STEP ? (
          <Button
            disabled={!canAdvance}
            onClick={() => canAdvance && setStep((s) => s + 1)}
          >
            Continuar
          </Button>
        ) : (
          <Button
            disabled={!canAdvance || submitting}
            onClick={() => canAdvance && !submitting && handleSubmit()}
          >
            {submitting ? 'Enviando…' : 'Enviar a verificación'}
          </Button>
        )}
      </div>
    </PhoneFrame>
  )
}
