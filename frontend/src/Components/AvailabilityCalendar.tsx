import { toDateOnlyISO, isDateBetween } from "../utils/dates";
import type { ReservedRange } from "../services/reservations";

interface AvailabilityCalendarProps {
  reservedRanges: ReservedRange[];
  loading: boolean;
}

const WEEKDAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function buildMonthGrid(reference: Date): (Date | null)[] {
  const year = reference.getFullYear();
  const month = reference.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Monday-first offset: getDay() is 0 (Sun) .. 6 (Sat).
  const firstWeekday = (firstOfMonth.getDay() + 6) % 7;

  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(new Date(year, month, day));

  return cells;
}

/**
 * Read-only inline availability calendar. It displays occupied days from the
 * shared `reservedRanges` state — it never selects or submits dates, and it
 * has no field derived from `is_available_now` (compile-time guarantee: this
 * prop interface only accepts `ReservedRange[]` and `loading`).
 *
 * The endpoint unions confirmed reservations and landlord date blocks in the
 * same shape, so every range is treated as an opaque occupied interval with
 * no visual distinction by origin.
 */
export default function AvailabilityCalendar({
  reservedRanges,
  loading,
}: AvailabilityCalendarProps) {
  if (loading) {
    return <div className="text-sm text-gray-500">Cargando disponibilidad...</div>;
  }

  const today = new Date();
  const cells = buildMonthGrid(today);

  return (
    <div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-500 mb-2">
        {WEEKDAY_LABELS.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((cellDate, i) => {
          if (!cellDate) return <span key={`empty-${i}`} />;

          const iso = toDateOnlyISO(cellDate);
          const occupied = reservedRanges.some((r) =>
            isDateBetween(iso, r.start_date, r.end_date)
          );

          return (
            <button
              key={iso}
              type="button"
              disabled={occupied}
              aria-label={String(cellDate.getDate())}
              className={
                occupied
                  ? "rounded-lg py-2 text-xs bg-[#FEE2E2] text-[#B91C1C] line-through cursor-not-allowed"
                  : "rounded-lg py-2 text-xs bg-gray-50 text-gray-700"
              }
            >
              {cellDate.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
