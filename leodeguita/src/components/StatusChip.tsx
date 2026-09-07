export type StatusTone = 'ok' | 'warn' | 'err' | 'info' | 'neutral'

const TONE: Record<StatusTone, { dot: string; text: string }> = {
  ok: { dot: 'bg-lg-ok', text: 'text-lg-ok' },
  warn: { dot: 'bg-lg-warn', text: 'text-lg-warn' },
  err: { dot: 'bg-lg-err', text: 'text-lg-err' },
  info: { dot: 'bg-lg-info', text: 'text-lg-info' },
  neutral: { dot: 'bg-lg-t4', text: 'text-lg-t4' },
}

/**
 * Dot + label status indicator, matching the prototype's `LgStat`. Used for
 * "pendiente de verificación" and the other listing states.
 */
export default function StatusChip({
  tone = 'neutral',
  children,
}: {
  tone?: StatusTone
  children: React.ReactNode
}) {
  const t = TONE[tone]
  return (
    <span
      className={`inline-flex items-center gap-2 text-xs font-semibold ${t.text}`}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${t.dot}`} />
      {children}
    </span>
  )
}
