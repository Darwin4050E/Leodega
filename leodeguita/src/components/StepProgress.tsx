/** Segmented progress bar for a multi-step flow (prototype's publish wizard). */
export default function StepProgress({
  total,
  current,
}: {
  total: number
  current: number
}) {
  return (
    <div
      className="flex gap-1.5"
      role="progressbar"
      aria-valuenow={current + 1}
      aria-valuemin={1}
      aria-valuemax={total}
    >
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`h-1 flex-1 rounded-full transition-colors ${
            i <= current ? 'bg-lg-primary' : 'bg-lg-line'
          }`}
        />
      ))}
    </div>
  )
}
