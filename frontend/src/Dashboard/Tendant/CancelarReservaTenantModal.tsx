import { useEffect, useState } from "react";

import {
  cancelReservationAsTenant,
  getCancellationPreview,
  type TenantReservation,
} from "../../services/reservations";
import { asApiError } from "../../api/errors";
import { formatUSD } from "../../utils/money";
import { formatReservationCode } from "../../utils/reservationCode";

interface CancelarReservaTenantModalProps {
  reservation: TenantReservation;
  onClose: () => void;
  /** Cancel succeeded; carries the refund amount actually recorded. */
  onCancelled: (refundAmount: string) => void;
  /**
   * The reservation turned out stale (409 at preview-open or confirm, or a
   * 404 at confirm). Design decision #4: no blind retry of the mutating
   * call itself -- the parent closes this modal and refetches the list so
   * `can_be_cancelled` and tab placement come from fresh server data.
   */
  onNeedsRefresh: () => void;
}

const STALE_MESSAGE = "Esta reserva ya no puede cancelarse.";

/**
 * sdd/tenant-reservations-screen: tenant self-cancel modal. Verbatim copy
 * mirrors ResCancelModal (PrototipoLeodega-main/js/TenantReservasPage.jsx:
 * 85-98) with one approved divergence (design decision #339): a refund
 * preview line inserted between the body text and the button row, fetched
 * on mount (pattern ref: CancelarReservaModal.tsx's getCancellationRate()
 * effect, frontend/src/Dashboard/GestorReservas/CancelarReservaModal.tsx).
 */
const CancelarReservaTenantModal = ({
  reservation,
  onClose,
  onCancelled,
  onNeedsRefresh,
}: CancelarReservaTenantModalProps) => {
  const [previewLoading, setPreviewLoading] = useState(true);
  const [refundAmount, setRefundAmount] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string>("");
  const [previewStale, setPreviewStale] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [confirmError, setConfirmError] = useState<string>("");
  const [confirmStale, setConfirmStale] = useState(false);

  const fetchPreview = () => {
    setPreviewLoading(true);
    setPreviewError("");
    setPreviewStale(false);

    getCancellationPreview(reservation.id)
      .then((res) => {
        setRefundAmount(res.data.refund_amount);
      })
      .catch((error) => {
        const apiError = asApiError(error);
        if (apiError.response?.status === 409) {
          setPreviewStale(true);
        } else {
          setPreviewError(
            apiError.response?.data?.message || "No se pudo calcular el reembolso. Intenta nuevamente."
          );
        }
      })
      .finally(() => setPreviewLoading(false));
  };

  useEffect(() => {
    fetchPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reservation.id]);

  const title = reservation.store_rooms?.title ?? "Bodega";
  const code = formatReservationCode(reservation.id);

  const canConfirm = !previewLoading && !previewStale && !previewError && refundAmount !== null && !submitting;

  const handleConfirm = async () => {
    if (!canConfirm) return;

    setSubmitting(true);
    setConfirmError("");
    setConfirmStale(false);

    try {
      const response = await cancelReservationAsTenant(reservation.id);
      const recordedAmount = response.data.reservation.refund_amount ?? refundAmount ?? "0.00";
      onCancelled(String(recordedAmount));
      onClose();
    } catch (error) {
      const apiError = asApiError(error);
      const status = apiError.response?.status;

      if (status === 409) {
        setConfirmStale(true);
        setConfirmError(apiError.response?.data?.message || STALE_MESSAGE);
      } else if (status === 404) {
        onNeedsRefresh();
      } else {
        setConfirmError(
          apiError.response?.data?.message || "Ocurrió un error al cancelar la reserva."
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  const staleMessage = previewStale ? STALE_MESSAGE : confirmStale ? confirmError || STALE_MESSAGE : "";

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black/55 flex items-center justify-center z-[2200] px-5"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        className="bg-white rounded-2xl w-full max-w-[400px] shadow-2xl overflow-hidden"
      >
        <div className="px-6 pt-6">
          <h4 className="text-lg font-bold text-gray-900 m-0 mb-2">Cancelar reserva</h4>
          <p className="text-sm text-gray-500 m-0 leading-relaxed">
            ¿Seguro que deseas cancelar tu reserva de{" "}
            <b className="text-gray-900">{title}</b> ({code})? Esta acción no se puede deshacer.
          </p>
        </div>

        <div className="px-6 pt-4">
          {previewLoading && (
            <p className="text-sm text-gray-500 m-0">Calculando el reembolso...</p>
          )}

          {!previewLoading && staleMessage && (
            <div>
              <p className="text-sm text-red-600 m-0" role="alert">
                {staleMessage}
              </p>
            </div>
          )}

          {!previewLoading && !previewStale && previewError && (
            <p className="text-sm text-red-600 m-0" role="alert">
              {previewError}
            </p>
          )}

          {!previewLoading && !previewStale && !previewError && refundAmount !== null && (
            <p className="text-sm text-gray-700 m-0">
              Recibirás un reembolso de{" "}
              <b className="text-gray-900">{formatUSD(refundAmount, { suffix: true })}</b>.
            </p>
          )}

          {!previewLoading && !previewStale && confirmError && !confirmStale && (
            <p className="text-sm text-red-600 mt-2" role="alert">
              {confirmError}
            </p>
          )}
        </div>

        <div className="px-6 pt-5 pb-6 flex gap-2.5 justify-end">
          <button
            onClick={onClose}
            className="px-4.5 py-2.5 bg-white text-gray-700 border border-gray-300 rounded-lg text-sm font-semibold"
          >
            Volver
          </button>

          {staleMessage ? (
            <button
              onClick={onNeedsRefresh}
              className="px-4.5 py-2.5 bg-[#7551E9] text-white rounded-lg text-sm font-semibold border-none"
            >
              Actualizar
            </button>
          ) : (
            <button
              onClick={handleConfirm}
              disabled={!canConfirm}
              className={`px-4.5 py-2.5 rounded-lg text-sm font-semibold border-none ${
                canConfirm ? "bg-[#FEE2E2] text-[#DC2626]" : "bg-gray-100 text-gray-400 cursor-not-allowed"
              }`}
            >
              {submitting ? "Cancelando..." : "Sí, cancelar"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CancelarReservaTenantModal;
