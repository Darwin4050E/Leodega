import { useState } from "react";
import { toDateOnlyISO, isDateBetween } from "../utils/dates";
import type { ReservedRange } from "../services/reservations";

interface AvailabilityCalendarProps {
  reservedRanges: ReservedRange[];
  loading: boolean;
}

const WEEKDAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

/** How many months past the current one the calendar lets the user browse. */
const MAX_MONTH_OFFSET = 24;

const monthFormatter = new Intl.DateTimeFormat("es", { month: "long" });

const NAV_BUTTON_CLASS =
  "h-8 w-8 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50";

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
 * The endpoint unions confirmed reservations, active holds and landlord date
 * blocks in the same shape, so every range is treated as an opaque occupied
 * interval with no visual distinction by origin. It is public, so visitors
 * see the same marks as tenants.
 *
 * Month navigation: the user can browse forward up to `MAX_MONTH_OFFSET`
 * months. There is no "previous" button at the current month (past months
 * carry no booking information). The navigation buttons are never `disabled`:
 * they are hidden instead, so "no disabled button" stays a day-cell-only
 * signal for occupied days.
 */
export default function AvailabilityCalendar({
  reservedRanges,
  loading,
}: AvailabilityCalendarProps) {
  const [monthOffset, setMonthOffset] = useState(0);

  if (loading) {
    return <div className="text-sm text-gray-500">Cargando disponibilidad...</div>;
  }

  const today = new Date();
  const visibleMonth = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
  const cells = buildMonthGrid(visibleMonth);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        {monthOffset > 0 ? (
          <button
            type="button"
            aria-label="Mes anterior"
            onClick={() => setMonthOffset((o) => o - 1)}
            className={NAV_BUTTON_CLASS}
          >
            ‹
          </button>
        ) : (
          <span className="h-8 w-8" />
        )}
        <p className="text-sm font-semibold text-gray-800 capitalize">
          {monthFormatter.format(visibleMonth)} {visibleMonth.getFullYear()}
        </p>
        {monthOffset < MAX_MONTH_OFFSET ? (
          <button
            type="button"
            aria-label="Mes siguiente"
            onClick={() => setMonthOffset((o) => o + 1)}
            className={NAV_BUTTON_CLASS}
          >
            ›
          </button>
        ) : (
          <span className="h-8 w-8" />
        )}
      </div>
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
      <div className="flex items-center gap-2 mt-3 text-xs text-gray-500">
        <span className="inline-block h-3 w-3 rounded bg-[#FEE2E2]" />
        <span>Ocupada</span>
      </div>
    </div>
  );
}
