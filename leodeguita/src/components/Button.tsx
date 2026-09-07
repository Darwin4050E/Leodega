import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'pri' | 'sec' | 'soft' | 'ghost'

const VARIANT: Record<Variant, string> = {
  pri: 'bg-lg-primary text-white',
  sec: 'bg-white text-lg-t2 border border-lg-line2',
  soft: 'bg-lg-soft text-lg-primary',
  ghost: 'bg-transparent text-lg-t3',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  children: ReactNode
}

/** Primary action button, mirrors the prototype's `LBtn`. */
export default function Button({
  variant = 'pri',
  className = '',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-sm font-semibold transition-opacity disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT[variant]} ${className}`}
    >
      {children}
    </button>
  )
}
