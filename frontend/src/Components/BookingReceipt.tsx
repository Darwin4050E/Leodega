import { useState } from "react";
import { formatReservationCode } from "../utils/reservationCode";
import { formatUSD } from "../utils/money";
import { monthsBetween } from "../utils/dates";

export interface BookingReceiptStoreRoom {
  image?: string | null;
  title?: string;
  direction?: string | null;
  city?: string | null;
  size?: number;
  gestorName?: string;
}

export interface BookingReceiptReservation {
  id: number;
  start_date: string;
  end_date: string;
  total_mount: string | number | null;
}

interface BookingReceiptProps {
  storeRoom: BookingReceiptStoreRoom;
  reservation: BookingReceiptReservation;
  onViewReservations: () => void;
  onBackToCatalog: () => void;
}

const COPY = {
  title: "¡Reserva confirmada!",
  subtitle: "Tu bodega quedó reservada al instante. Enviamos el comprobante a tu correo.",
  reservationCodeLabel: "N.º de reserva",
  paid: "● PAGADO",
  start: "Inicio",
  end: "Fin",
  duration: "Duración",
  gestor: "Gestor",
  amountPaid: "Monto pagado",
  downloadPdf: "Descargar PDF",
  viewReservations: "Ver mis reservas",
  backToCatalog: "Volver al catálogo",
  downloadToast: "Comprobante PDF descargado (demo)",
} as const;

/**
 * Receipt step, fidelity to `BkReceipt` (`BookingFlow.jsx:386-435`). The
 * "PAGADO" badge renders unconditionally — this screen is reached only
 * after a successful `createPayment()` call in the same flow, so payment
 * success is known by construction, with no re-fetch (REQ-REC-3). Per the
 * corrected REQ-REC-1, the "Enviamos el comprobante a tu correo" line
 * STAYS — the `reservation-receipt-email` cycle ships real email dispatch
 * on paid confirmation, so this copy is no longer false.
 */
export default function BookingReceipt({
  storeRoom,
  reservation,
  onViewReservations,
  onBackToCatalog,
}: BookingReceiptProps) {
  const [toast, setToast] = useState("");

  const months = monthsBetween(reservation.start_date, reservation.end_date);
  const code = formatReservationCode(reservation.id);

  return (
    <div className="mx-auto max-w-xl px-5 pb-16 pt-10">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#16A34A"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h1 className="mb-2 text-2xl font-bold text-gray-900">{COPY.title}</h1>
        <p className="text-sm leading-relaxed text-gray-500">{COPY.subtitle}</p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-5 py-4">
          <div>
            <p className="mb-0.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
              {COPY.reservationCodeLabel}
            </p>
            <p className="font-mono text-base font-bold text-gray-900">{code}</p>
          </div>
          <span className="rounded-full bg-green-100 px-3.5 py-1.5 text-sm font-bold text-green-600">
            {COPY.paid}
          </span>
        </div>

        <div className="flex gap-3 border-b border-gray-100 px-5 py-4">
          {storeRoom.image && (
            <img
              src={storeRoom.image}
              alt={storeRoom.title}
              className="h-16 w-16 rounded-xl object-cover"
            />
          )}
          <div>
            <p className="mb-1 text-sm font-semibold text-gray-900">{storeRoom.title}</p>
            <p className="text-xs text-gray-500">
              {storeRoom.direction}
              {storeRoom.city ? `, ${storeRoom.city}` : ""}
              {storeRoom.size ? ` · ${storeRoom.size} m²` : ""}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 px-5 py-4">
          <div>
            <p className="mb-0.5 text-xs text-gray-400">{COPY.start}</p>
            <p className="text-sm font-semibold text-gray-900">{reservation.start_date}</p>
          </div>
          <div>
            <p className="mb-0.5 text-xs text-gray-400">{COPY.end}</p>
            <p className="text-sm font-semibold text-gray-900">{reservation.end_date}</p>
          </div>
          <div>
            <p className="mb-0.5 text-xs text-gray-400">{COPY.duration}</p>
            <p className="text-sm font-semibold text-gray-900">
              {months} mes{months > 1 ? "es" : ""}
            </p>
          </div>
          <div>
            <p className="mb-0.5 text-xs text-gray-400">{COPY.gestor}</p>
            <p className="text-sm font-semibold text-gray-900">{storeRoom.gestorName}</p>
          </div>
        </div>

        <div className="flex items-baseline justify-between border-t border-gray-100 px-5 py-4">
          <span className="text-sm font-semibold text-gray-700">{COPY.amountPaid}</span>
          <span className="text-lg font-bold text-gray-900">
            {formatUSD(reservation.total_mount ?? 0, { suffix: true })}
          </span>
        </div>
      </div>

      <button
        onClick={() => setToast(COPY.downloadToast)}
        className="mt-4.5 flex w-full items-center justify-center gap-2 rounded-lg bg-purple-600 py-3.5 text-sm font-semibold text-white"
      >
        {COPY.downloadPdf}
      </button>

      <div className="mt-3 flex gap-3">
        <button
          onClick={onViewReservations}
          className="flex-1 rounded-lg border border-gray-300 py-3 text-sm font-semibold text-gray-700"
        >
          {COPY.viewReservations}
        </button>
        <button
          onClick={onBackToCatalog}
          className="flex-1 rounded-lg border border-gray-300 py-3 text-sm font-semibold text-gray-700"
        >
          {COPY.backToCatalog}
        </button>
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-lg bg-gray-900 px-5 py-3 text-sm font-medium text-white">
          {toast}
        </div>
      )}
    </div>
  );
}
