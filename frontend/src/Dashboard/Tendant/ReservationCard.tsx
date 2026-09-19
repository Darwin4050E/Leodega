import { formatReservationCode } from "../../utils/reservationCode";
import { formatUSD } from "../../utils/money";
import { deriveTenantTab } from "../../utils/reservationVigencia";
import type { TenantReservation } from "../../services/reservations";

const RES_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  activa: { bg: "#EDE9FE", color: "#7551E9", label: "Activa" },
  finalizada: { bg: "#F3F4F6", color: "#6B7280", label: "Finalizada" },
  cancelada: { bg: "#FEE2E2", color: "#DC2626", label: "Cancelada" },
};

interface ReservationCardProps {
  reservation: TenantReservation;
  onCancelClick: (reservation: TenantReservation) => void;
}

/**
 * Presentational card for the tenant reservations list. Mirrors ResCard
 * (PrototipoLeodega-main/js/TenantReservasPage.jsx:166-195) -- thumbnail,
 * title, badge, direction/city/size line, Período/Monto/Reserva stat row --
 * minus review/report actions (out of scope, spec #351). The cancel button
 * is gated exclusively on `reservation.can_be_cancelled` (server-computed),
 * never client-side date math.
 */
const ReservationCard = ({ reservation, onCancelClick }: ReservationCardProps) => {
  const tab = deriveTenantTab(reservation);
  const badge = RES_BADGE[tab];
  const title = reservation.store_rooms?.title ?? "Bodega";
  // sdd/tenant-reservations-screen decision #6: the backend has no `sector`
  // column; `direction` is the closest available field.
  const direction = reservation.store_rooms?.direction ?? "";
  const city = reservation.store_rooms?.city ?? "";
  const size = reservation.store_rooms?.size ?? "";

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="flex gap-4 p-4 flex-wrap">
        {reservation.photo_url && (
          <img
            src={reservation.photo_url}
            alt={title}
            className="w-32 h-26 rounded-xl object-cover flex-shrink-0"
          />
        )}
        <div className="flex-1 min-w-[200px]">
          <div className="flex justify-between items-start gap-2.5 mb-1">
            <h3 className="text-base font-semibold text-gray-900 m-0">{title}</h3>
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap"
              style={{ background: badge.bg, color: badge.color }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: badge.color }} />
              {badge.label}
            </span>
          </div>
          <p className="text-xs text-gray-500 mb-2.5">
            {direction}, {city} · {size} m²
          </p>
          <div className="flex gap-6 flex-wrap">
            <div>
              <p className="text-[11px] text-gray-400 mb-0.5">Período</p>
              <p className="text-sm font-semibold text-gray-900 m-0">
                {reservation.start_date} → {reservation.end_date}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-gray-400 mb-0.5">Monto</p>
              <p className="text-sm font-semibold text-gray-900 m-0">
                {formatUSD(reservation.total_mount ?? 0)}{" "}
                <span className="font-medium text-gray-500 text-xs">USD</span>
              </p>
            </div>
            <div>
              <p className="text-[11px] text-gray-400 mb-0.5">Reserva</p>
              <p className="text-sm font-semibold text-gray-900 m-0 font-mono">
                {formatReservationCode(reservation.id)}
              </p>
            </div>
            {tab === "cancelada" && reservation.refund_amount != null && (
              <div>
                <p className="text-[11px] text-gray-400 mb-0.5">Reembolso</p>
                <p className="text-sm font-semibold text-gray-900 m-0">
                  {formatUSD(reservation.refund_amount)}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
      {reservation.can_be_cancelled && (
        <div className="px-4 pb-4">
          <div className="border-t border-gray-100 pt-3.5">
            <button
              onClick={() => onCancelClick(reservation)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-white text-red-600 border border-red-300 rounded-lg text-sm font-semibold"
            >
              Cancelar reserva
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReservationCard;
