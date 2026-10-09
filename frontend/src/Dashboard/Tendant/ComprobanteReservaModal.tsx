import { useState } from "react";

import { downloadReservationReceipt } from "../../utils/receiptDownload";
import { formatUSD } from "../../utils/money";
import { formatReservationCode } from "../../utils/reservationCode";
import { organizationIdentityLine } from "../../utils/organization";
import type { TenantReservation } from "../../services/reservations";

interface ComprobanteReservaModalProps {
  reservation: TenantReservation;
  onClose: () => void;
}

/**
 * Tenant payment receipt. Renders the server-built `reservation.receipt`
 * as-is (no request to open): `paid_at_label` is already formatted in
 * America/Guayaquil and is printed verbatim, never parsed or converted.
 */
const ComprobanteReservaModal = ({ reservation, onClose }: ComprobanteReservaModalProps) => {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");

  const receipt = reservation.receipt;
  if (!receipt) return null;

  const handleDownload = async () => {
    setDownloading(true);
    setError("");
    try {
      await downloadReservationReceipt(reservation.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDownloading(false);
    }
  };

  const fields: [string, string][] = [
    ["Número de reserva", receipt.code],
    ["Bodega", receipt.store_room_title ?? "—"],
    ["Gestor", receipt.gestor_name ?? "—"],
    ["Fecha de inicio", receipt.start_date],
    ["Fecha de fin", receipt.end_date],
    ["Fecha y hora de pago", receipt.paid_at_label],
  ];
  if (receipt.payment_method_label) {
    fields.push(["Método de pago", receipt.payment_method_label]);
  }
  // HUE-05 OR-WS6/WS7: present only for an org reservation's receipt.
  if (receipt.organization_name && receipt.organization_ruc) {
    fields.push(["Organización", organizationIdentityLine(receipt.organization_name, receipt.organization_ruc)]);
  }

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black/55 flex items-center justify-center z-50 px-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Comprobante de la reserva ${formatReservationCode(reservation.id)}`}
        className="bg-white rounded-2xl w-full max-w-md shadow-2xl max-h-[92vh] overflow-y-auto"
      >
        <div className="px-6 py-5 flex items-start justify-between gap-3 border-b border-gray-100">
          <div>
            <h4 className="text-gray-900 text-lg font-semibold m-0">Comprobante de reserva</h4>
            <p className="text-gray-400 text-xs mt-1">{receipt.code}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar comprobante"
            className="flex-shrink-0 p-1.5 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200"
          >
            ✕
          </button>
        </div>

        <div className="px-6 py-5 grid grid-cols-2 gap-4">
          {fields.map(([label, value]) => (
            <div key={label}>
              <p className="text-[11px] text-gray-400 mb-0.5">{label}</p>
              <p className="text-sm font-semibold text-gray-900 m-0">{value}</p>
            </div>
          ))}
          <div>
            <p className="text-[11px] text-gray-400 mb-0.5">Estado</p>
            <p className="m-0">
              <span className="inline-block px-2.5 py-1 rounded-full bg-green-100 text-green-700 text-xs font-bold">
                {receipt.status_label}
              </span>
            </p>
          </div>
        </div>

        <div className="mx-6 mb-6 flex justify-between items-center px-4 py-3 bg-[#F5F3FF] rounded-lg">
          <p className="text-sm font-bold text-gray-900 m-0">Monto total pagado</p>
          <p className="text-lg font-bold text-[#7551E9] m-0">
            {formatUSD(receipt.total_paid, { suffix: true })}
          </p>
        </div>

        {error && (
          <p role="alert" className="mx-6 mb-3 text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="flex gap-2.5 px-6 pb-5">
          <button
            onClick={onClose}
            className="flex-1 px-5 py-3 bg-white text-gray-700 border border-gray-300 rounded-lg text-sm font-semibold hover:bg-gray-50"
          >
            Cerrar
          </button>
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="flex-1 px-5 py-3 bg-[#7551E9] text-white rounded-lg text-sm font-semibold hover:bg-[#6440d8] disabled:opacity-60"
          >
            {downloading ? "Descargando..." : "Descargar PDF"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ComprobanteReservaModal;
