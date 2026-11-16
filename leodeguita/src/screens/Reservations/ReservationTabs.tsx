/** Tab strip with a count badge, shared by the tenant and gestor reservations. */
export default function ReservationTabs<K extends string>({
  tabs,
  selected,
  onSelect,
}: {
  tabs: { key: K; label: string; count: number }[]
  selected: K
  onSelect: (key: K) => void
}) {
  return (
    <div role="tablist" aria-label="Estado de la reserva" className="flex shrink-0 gap-4 border-b border-lg-line px-5">
      {tabs.map((t) => {
        const isSelected = selected === t.key
        return (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={isSelected}
            onClick={() => onSelect(t.key)}
            className={`flex items-center gap-2 border-b-2 bg-transparent px-1 py-2.5 text-sm ${
              isSelected
                ? 'border-lg-primary font-bold text-lg-primary'
                : 'border-transparent font-medium text-lg-t3'
            }`}
          >
            {t.label}{' '}
            <span
              className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold ${
                isSelected ? 'bg-lg-soft text-lg-primary' : 'bg-lg-hair text-lg-t4'
              }`}
            >
              {t.count}
            </span>
          </button>
        )
      })}
    </div>
  )
}
