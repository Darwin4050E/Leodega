import { useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../auth/useAuth'
import { login } from '../services/auth'
import { safeReturnPath } from '../auth/returnPath'
import { SESSION_EXPIRED_MESSAGE, SESSION_EXPIRED_REASON } from '../auth/sessionExpiry'
import PhoneFrame from '../components/PhoneFrame'

interface FieldErrors {
  email?: string
  password?: string
}

export default function LoginScreen() {
  const navigate = useNavigate()
  const location = useLocation()
  const { setSession } = useAuth()

  // Router state is set by <Protected>; it is untrusted until sanitized below.
  const state = location.state as { from?: unknown; reason?: unknown } | null
  const sessionExpired = state?.reason === SESSION_EXPIRED_REASON

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function validate(): FieldErrors {
    const errors: FieldErrors = {}
    if (!email.trim()) errors.email = 'El correo es requerido.'
    if (!password) errors.password = 'La contraseña es requerida.'
    return errors
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setFormError(null)

    // AC-3: required fields empty -> highlight, show message, do not authenticate.
    const errors = validate()
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    setSubmitting(true)
    try {
      const { user, token } = await login(email.trim(), password)
      setSession(token, user)
      // AC-1: authenticated -> back to where the session ended, else the role's home.
      navigate(safeReturnPath(state?.from) ?? '/', { replace: true })
    } catch (error) {
      // AC-2: wrong credentials -> error message, no access.
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        setFormError('Correo o contraseña incorrectos.')
      } else if (axios.isAxiosError(error) && error.response?.status === 403) {
        setFormError(
          (error.response.data as { message?: string })?.message ??
            'Esta cuenta no puede iniciar sesión.',
        )
      } else {
        setFormError('No se pudo conectar. Intenta de nuevo.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <PhoneFrame>
      <div className="flex-1 flex flex-col justify-center px-6 py-10">
        <header className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-leodega_p">Leodeguita</h1>
          <p className="mt-1 text-sm text-gray-500">
            Inicia sesión con tu cuenta de Leodega
          </p>
        </header>

        {sessionExpired && (
          <p role="status" className="mb-4 text-center text-sm text-amber-700">
            {SESSION_EXPIRED_MESSAGE}
          </p>
        )}

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Correo
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={Boolean(fieldErrors.email)}
              className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-leodega_p ${
                fieldErrors.email ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {fieldErrors.email && (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.email}</p>
            )}
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={Boolean(fieldErrors.password)}
              className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-leodega_p ${
                fieldErrors.password ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {fieldErrors.password && (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.password}</p>
            )}
          </div>

          {formError && (
            <p role="alert" className="text-sm text-red-600">
              {formError}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-leodega_p py-2.5 text-sm font-semibold text-white transition-opacity disabled:opacity-60"
          >
            {submitting ? 'Ingresando…' : 'Iniciar sesión'}
          </button>
        </form>
      </div>
    </PhoneFrame>
  )
}
