import { formatUSD } from "../../utils/money";
import { formatReservationCode } from "../../utils/reservationCode";
import type { LandlordReservation } from "../../services/reservations";

interface ComprobantePagoModalProps {
  reservation: LandlordReservation;
  clienteNombre: string;
  clienteEmail: string;
  bodegaTitulo: string;
  onClose: () => void;
}

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  "credit card": "Tarjeta de crédito",
  "debit card": "Tarjeta de débito",
};

/**
 * HUG-05 escenario 3: read-only payment receipt for a reservation the
 * gestor already knows was paid (caller only renders this when
 * `payment_id` is non-null -- see GestorReservas.tsx). No PDF library: the
 * "Descargar" action is the browser's own print-to-PDF via `window.print()`,
 * scoped to this content by the `#comprobante-print-area` print rule below.
 * There is no payment gateway in this project, so every field here comes
 * from data already recorded server-side (ReservationsController::
 * landlordIndex()) -- never a fabricated transaction id or card number.
 */
const ComprobantePagoModal = ({
  reservation,
  clienteNombre,
  clienteEmail,
  bodegaTitulo,
  onClose,
}: ComprobantePagoModalProps) => {
  const metodoPago = reservation.payment_method
    ? PAYMENT_METHOD_LABEL[reservation.payment_method] ?? reservation.payment_method
    : "—";

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black/55 flex items-center justify-center z-50 px-4 print:bg-white print:static print:block"
    >
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #comprobante-print-area, #comprobante-print-area * { visibility: visible; }
          #comprobante-print-area { position: fixed; inset: 0; padding: 24px; }
        }
      `}</style>

      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Comprobante de pago de la reserva ${formatReservationCode(reservation.id)}`}
        className="bg-white rounded-2xl w-full max-w-md shadow-2xl max-h-[92vh] overflow-y-auto"
      >
        <div id="comprobante-print-area">
          <div className="px-6 py-5 flex items-start justify-between gap-3 border-b border-gray-100">
            <div>
              <h4 className="text-gray-900 text-lg font-semibold m-0">Comprobante de pago</h4>
              <p className="text-gray-400 text-xs mt-1">{formatReservationCode(reservation.id)}</p>
            </div>
            <button
              onClick={onClose}
              aria-label="Cerrar"
              className="print:hidden flex-shrink-0 p-1.5 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200"
            >
              ✕
            </button>
          </div>

          <div className="px-6 py-5 grid grid-cols-2 gap-4">
            {[
              ["Bodega", bodegaTitulo],
              ["Cliente", clienteNombre],
              ["Email", clienteEmail || "—"],
              ["Período", `${reservation.start_date} → ${reservation.end_date}`],
              ["Método de pago", metodoPago],
              ["Fecha de pago", reservation.payment_date ?? "—"],
            ].map(([label, value]) => (
              <div key={label}>
                <p className="text-[11px] text-gray-400 mb-0.5">{label}</p>
                <p className="text-sm font-semibold text-gray-900 m-0">{value}</p>
              </div>
            ))}
          </div>

          <div className="mx-6 mb-6 flex justify-between items-center px-4 py-3 bg-[#F5F3FF] rounded-lg">
            <p className="text-sm font-bold text-gray-900 m-0">Monto pagado</p>
            <p className="text-lg font-bold text-[#7551E9] m-0">
              {formatUSD(reservation.total_mount ?? 0, { suffix: true })}
            </p>
          </div>
        </div>

        <div className="print:hidden flex gap-2.5 px-6 pb-5">
          <button
            onClick={onClose}
            className="flex-1 px-5 py-3 bg-white text-gray-700 border border-gray-300 rounded-lg text-sm font-semibold hover:bg-gray-50"
          >
            Cerrar
          </button>
          <button
            onClick={() => window.print()}
            className="flex-1 px-5 py-3 bg-[#7551E9] text-white rounded-lg text-sm font-semibold hover:bg-[#6440d8]"
          >
            Descargar
          </button>
        </div>
      </div>
    </div>
  );
};

export default ComprobantePagoModal;
