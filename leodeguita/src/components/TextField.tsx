import { useId, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react'

const fieldClass = (error?: string) =>
  `mt-1.5 w-full rounded-xl border bg-white px-3.5 py-3 text-sm text-lg-ink outline-none focus:ring-4 focus:ring-lg-soft ${
    error ? 'border-lg-err' : 'border-lg-line2 focus:border-lg-primary'
  }`

function Frame({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string
  label: string
  error?: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-lg-t2">
        {label}
      </label>
      {children}
      {error ? (
        <p className="mt-1 text-xs text-lg-err">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-lg-t4">{hint}</p>
      ) : null}
    </div>
  )
}

type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> & {
  label: string
  error?: string
  hint?: string
}

/** Labelled input with the prototype's focus ring and error state. */
export default function TextField({ label, error, hint, ...rest }: TextFieldProps) {
  const id = useId()
  return (
    <Frame id={id} label={label} error={error} hint={hint}>
      <input {...rest} id={id} aria-invalid={Boolean(error)} className={fieldClass(error)} />
    </Frame>
  )
}

type TextAreaFieldProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> & {
  label: string
  error?: string
  hint?: string
}

/** Labelled textarea counterpart of `TextField`. */
export function TextAreaField({ label, error, hint, ...rest }: TextAreaFieldProps) {
  const id = useId()
  return (
    <Frame id={id} label={label} error={error} hint={hint}>
      <textarea
        {...rest}
        id={id}
        rows={rest.rows ?? 5}
        aria-invalid={Boolean(error)}
        className={`${fieldClass(error)} resize-none leading-relaxed`}
      />
    </Frame>
  )
}
