import { useEffect, useState } from "react";

import { cancelReservation, getCancellationRate, type LandlordReservation } from "../../services/reservations";
import { asApiError } from "../../api/errors";
import { formatUSD } from "../../utils/money";

interface CancelarReservaModalProps {
  reservation: LandlordReservation;
  clienteNombre: string;
  bodegaTitulo: string;
  onClose: () => void;
  onCancelled: (updated: LandlordReservation) => void;
}

/**
 * HUG-06: the gestor cancellation cost breakdown modal. Mirrors
 * GCancelarReservaModal (PrototipoLeodega-main/js/GestorReservasPublicar.jsx:330-415)
 * almost verbatim, except the penalty rate is fetched from the backend
 * (obs #149 DECISION 1) instead of hardcoded, and a rate-fetch failure
 * blocks confirmation entirely -- no fabricated number is ever shown.
 */
const CancelarReservaModal = ({
  reservation,
  clienteNombre,
  bodegaTitulo,
  onClose,
  onCancelled,
}: CancelarReservaModalProps) => {
  const [rate, setRate] = useState<number | null>(null);
  const [rateLoading, setRateLoading] = useState(true);
  const [rateError, setRateError] = useState(false);

  const [reason, setReason] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string>("");

  useEffect(() => {
    let cancelled = false;

    getCancellationRate()
      .then((res) => {
        if (cancelled) return;
        setRate(res.data.gestor_cancellation_penalty_rate);
      })
      .catch(() => {
        if (cancelled) return;
        setRateError(true);
      })
      .finally(() => {
        if (!cancelled) setRateLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const rentSubtotal = Number(reservation.rent_subtotal ?? 0);
  const refund = Number(reservation.total_mount ?? 0);
  const penalty = rate !== null ? Math.round(rate * rentSubtotal) : null;
  const total = penalty !== null ? penalty + refund : null;

  const reasonValid = reason.trim().length >= 10;
  const canConfirm = accepted && reasonValid && rate !== null && !rateLoading && !submitting;

  const handleConfirm = async () => {
    if (!canConfirm) return;

    setSubmitting(true);
    setServerError("");

    try {
      const response = await cancelReservation(reservation.id, { reason: reason.trim() });
      onCancelled(response.data.reservation);
      onClose();
    } catch (error) {
      const apiError = asApiError(error);
      setServerError(
        apiError.response?.data?.message || "Ocurrió un error al cancelar la reserva."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black/55 flex items-center justify-center z-50 px-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Vas a cancelar una reserva pagada"
        className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[92vh] overflow-y-auto"
      >
        <div className="bg-[#7F1D1D] px-6 py-5 flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <h4 className="text-white text-lg font-semibold m-0">
              Vas a cancelar una reserva pagada
            </h4>
            <p className="text-[#FCA5A5] text-xs mt-1">
              Reserva #{reservation.id} · {bodegaTitulo} · {clienteNombre} · {reservation.start_date} →{" "}
              {reservation.end_date}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="flex-shrink-0 p-1.5 rounded-lg bg-white/15 text-[#FECACA] hover:bg-white/25"
          >
            ✕
          </button>
        </div>

        <div className="px-6 pt-5">
          <p className="text-xs font-extrabold text-[#7F1D1D] tracking-wider m-0 mb-3">
            LO QUE TE COSTARÍA
          </p>

          {rateLoading && (
            <p className="text-sm text-gray-500">Calculando el costo de la cancelación...</p>
          )}

          {rateError && (
            <p className="text-sm text-red-600" role="alert">
              No se pudo calcular el costo de la cancelación. Intenta nuevamente más tarde.
            </p>
          )}

          {!rateLoading && !rateError && penalty !== null && total !== null && (
            <div className="border border-[#FBD5D5] rounded-xl overflow-hidden">
              <div className="flex justify-between gap-4 items-start px-4 py-3 bg-white">
                <div>
                  <p className="text-sm font-semibold text-gray-900 m-0">Reembolso al cliente</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Ya pagó el alojamiento completo. Leodega se lo devuelve y te reclama el monto.
                  </p>
                </div>
                <p className="text-sm font-bold text-[#B91C1C] whitespace-nowrap">
                  {formatUSD(refund)}
                </p>
              </div>
              <div className="flex justify-between gap-4 items-start px-4 py-3 bg-white border-t border-[#FDE8E8]">
                <div>
                  <p className="text-sm font-semibold text-gray-900 m-0">
                    Multa por cancelación ({Math.round((rate ?? 0) * 100)}%)
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Se debita automáticamente de tu próximo pago de Leodega.
                  </p>
                </div>
                <p className="text-sm font-bold text-[#B91C1C] whitespace-nowrap">
                  {formatUSD(penalty)}
                </p>
              </div>
              <div className="flex justify-between items-center gap-4 px-4 py-3 bg-[#FFF5F5] border-t border-[#FDE8E8]">
                <p className="text-sm font-bold text-[#7F1D1D] m-0">Total a tu cargo</p>
                <p className="text-lg font-bold text-[#B91C1C] whitespace-nowrap m-0">
                  {formatUSD(total, { suffix: true })}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 pt-5">
          <label className="block text-xs font-medium text-gray-700 mb-2">
            Motivo de la cancelación <span className="text-red-600">*</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Explica al cliente por qué cancelas (mín. 10 caracteres)…"
            className="w-full min-h-[70px] px-3 py-2.5 border border-gray-300 rounded-lg text-sm outline-none resize-y"
          />
          <p className="text-[11px] text-gray-400 mt-1.5">
            Se enviará al cliente y quedará registrado para auditoría.
          </p>
        </div>

        {serverError && (
          <div className="px-6 pt-3">
            <p className="text-sm text-red-600" role="alert">
              {serverError}
            </p>
          </div>
        )}

        <div className="mt-4 px-6 pt-4 pb-5 border-t border-gray-100 bg-[#FAFAFB]">
          <label className="flex gap-2.5 items-start mb-4 cursor-pointer">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              className="w-[17px] h-[17px] mt-0.5 accent-red-600 cursor-pointer flex-shrink-0"
            />
            <span className="text-xs text-gray-700 leading-relaxed">
              Entiendo que se aplicará una penalización
              {penalty !== null ? ` de ${formatUSD(penalty, { suffix: true })}` : ""} y que Leodega
              me reclamará
              {penalty !== null ? ` los ${formatUSD(refund, { suffix: true })}` : ""} que el
              cliente ya pagó.
            </span>
          </label>

          <div className="flex gap-2.5">
            <button
              onClick={onClose}
              className="flex-1 px-5 py-3 bg-white text-gray-700 border border-gray-300 rounded-lg text-sm font-semibold hover:bg-gray-50"
            >
              Mantener la reserva
            </button>
            <button
              onClick={handleConfirm}
              disabled={!canConfirm}
              title={canConfirm ? "" : "Completa el motivo y marca la casilla de confirmación"}
              className={`flex-1 px-5 py-3 rounded-lg text-sm font-semibold ${
                canConfirm
                  ? "bg-[#DC2626] text-white hover:bg-red-700"
                  : "bg-gray-100 text-gray-400 cursor-not-allowed"
              }`}
            >
              {submitting ? "Cancelando..." : "Confirmar cancelación"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CancelarReservaModal;
