import { useState } from "react";
import { FileText, ImageOff, Lock, MapPin, X } from "lucide-react";

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
  onReceiptClick: (reservation: TenantReservation) => void;
}

const ADMIN_ONLY_TOOLTIP = "Solo el administrador puede cancelar reservas de la organización";

/**
 * Presentational card for the tenant reservations list. Mirrors ResCard
 * (PrototipoLeodega-main/js/TenantReservasPage.jsx:166-195) -- thumbnail,
 * title, badge, direction/city/size line, Período/Monto/Reserva stat row --
 * minus review/report actions (out of scope, spec #351). Cancel is gated
 * exclusively on the server flags (`can_be_cancelled`, and on org rows
 * `cancel_requires_admin` for the disabled state), never on client-side date
 * math, `is_creator` or the cached organization role. "Ver comprobante"
 * shows iff the server sent a non-null `reservation.receipt` and the caller
 * is the creator.
 */
const ReservationCard = ({ reservation, onCancelClick, onReceiptClick }: ReservationCardProps) => {
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const tab = deriveTenantTab(reservation);
  const badge = RES_BADGE[tab];
  const title = reservation.store_rooms?.title ?? "Bodega";
  // sdd/tenant-reservations-screen decision #6: the backend has no `sector`
  // column; `direction` is the closest available field.
  const direction = reservation.store_rooms?.direction ?? "";
  const city = reservation.store_rooms?.city ?? "";
  const size = reservation.store_rooms?.size ?? "";
  // HUE-06 OR-W5: org cancel follows the server flags only. `is_creator` still
  // gates the receipt (creator-only) and is absent on a personal row.
  const isOrgRow = Boolean(reservation.organization);
  const isCreatorOrPersonal = reservation.is_creator !== false;
  const showCancelButton = reservation.can_be_cancelled && (isOrgRow || isCreatorOrPersonal);
  const showDisabledCancel = isOrgRow && reservation.cancel_requires_admin === true;
  const showReceiptButton = Boolean(reservation.receipt) && isCreatorOrPersonal;
  const tooltipId = `cancel-tooltip-${reservation.id}`;

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="flex gap-4 p-4 flex-wrap">
        {reservation.photo_url ? (
          <img
            src={reservation.photo_url}
            alt={title}
            className="w-32 h-26 rounded-xl object-cover flex-shrink-0"
          />
        ) : (
          <div
            className="w-32 h-26 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0"
            aria-label={`${title} sin foto disponible`}
          >
            <ImageOff size={28} color="#9CA3AF" />
          </div>
        )}
        <div className="flex-1 min-w-[200px]">
          <div className="flex justify-between items-start gap-2.5 mb-1">
            <h3 className="text-base font-semibold text-gray-900 m-0">{title}</h3>
            <div className="flex items-center gap-1.5">
              {reservation.organization && (
                <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap bg-[#EDE9FE] text-[#7551E9]">
                  {reservation.organization.name}
                </span>
              )}
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap"
                style={{ background: badge.bg, color: badge.color }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: badge.color }} />
                {badge.label}
              </span>
            </div>
          </div>
          <p className="text-xs text-gray-500 mb-2.5 flex items-center gap-1.5">
            <MapPin size={13} color="#9CA3AF" />
            {direction}, {city} · {size} m²
          </p>
          {reservation.organization && reservation.creator_name && (
            <p className="text-xs text-gray-500 mb-2.5">Reservada por {reservation.creator_name}</p>
          )}
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
      {(showReceiptButton || showCancelButton || showDisabledCancel) && (
        <div className="px-4 pb-4">
          <div className="border-t border-gray-100 pt-3.5 flex gap-2.5 flex-wrap">
            {showReceiptButton && (
              <button
                onClick={() => onReceiptClick(reservation)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-white text-[#7551E9] border border-[#7551E9] rounded-lg text-sm font-semibold"
              >
                <FileText size={14} color="#7551E9" />
                Ver comprobante
              </button>
            )}
            {showCancelButton && (
              <button
                onClick={() => onCancelClick(reservation)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-white text-red-600 border border-red-300 rounded-lg text-sm font-semibold"
              >
                <X size={14} color="#DC2626" />
                Cancelar reserva
              </button>
            )}
            {showDisabledCancel && (
              <div className="relative">
                <button
                  type="button"
                  aria-disabled="true"
                  aria-describedby={tooltipId}
                  onMouseEnter={() => setTooltipOpen(true)}
                  onMouseLeave={() => setTooltipOpen(false)}
                  onFocus={() => setTooltipOpen(true)}
                  onBlur={() => setTooltipOpen(false)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setTooltipOpen(false);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-50 text-gray-400 border border-gray-200 rounded-lg text-sm font-semibold cursor-not-allowed"
                >
                  <Lock size={14} color="#9CA3AF" />
                  Cancelar reserva
                </button>
                <span
                  id={tooltipId}
                  role="tooltip"
                  hidden={!tooltipOpen}
                  className="absolute bottom-full left-0 mb-2 w-64 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg z-10"
                >
                  {ADMIN_ONLY_TOOLTIP}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ReservationCard;
