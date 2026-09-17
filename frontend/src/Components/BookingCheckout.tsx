import { useRef, useState } from "react";
import { createPayment, type CreatePaymentInput } from "../services/reservations";
import { formatUSD } from "../utils/money";
import { toDateOnlyISO, monthsBetween } from "../utils/dates";
import { asApiError } from "../api/errors";
import { PriceBreakdownRows } from "./PriceBreakdownPanel";
import RatingStars from "./RatingStars";

export interface BookingCheckoutStoreRoom {
  image?: string | null;
  title?: string;
  direction?: string | null;
  city?: string | null;
  ratingAvg: number;
  ratingCount: number;
}

export interface BookingCheckoutReservation {
  id: number;
  start_date: string;
  end_date: string;
  total_mount: string | number | null;
  rent_subtotal: string | number | null;
}

interface BookingCheckoutProps {
  storeRoom: BookingCheckoutStoreRoom;
  reservation: BookingCheckoutReservation;
  pricePerMonth: number;
  onPaid: (reservation: BookingCheckoutReservation) => void;
  onBack: () => void;
}

const COPY = {
  heading: "Pago",
  simulatedPayment: "Pago simulado — no se realiza ningún cargo real.",
  cardNumberLabel: "Número de tarjeta",
  holderLabel: "Titular de la tarjeta",
  expiryLabel: "Vencimiento",
  cvvLabel: "CVV",
  processing: "Procesando pago…",
  ctaPrefix: "Confirmar y pagar",
  back: "← Volver al detalle",
  disclosure: "Pago cifrado y seguro · demo: una tarjeta que empiece con 0000 simula un rechazo.",
  declinePrefix: "Pago rechazado.",
  decline:
    "Tu banco rechazó la tarjeta y no se realizó ningún cargo. Verifica el número y el vencimiento, o intenta con otra tarjeta.",
  networkError: "Ocurrió un error procesando el pago. Intenta de nuevo.",
  authRequired: "Debes iniciar sesión para completar el pago.",
  period: "Período",
  duration: "Duración",
  instantConfirmation: "El pago confirma la reserva de inmediato. Sin aprobación del gestor.",
} as const;

function formatCardNumber(value: string): string {
  return value
    .replace(/\D/g, "")
    .slice(0, 16)
    .replace(/(.{4})/g, "$1 ")
    .trim();
}

function formatExpiry(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
}

/**
 * Payment step, fidelity to `BkPaymentForm` (`BookingFlow.jsx:289-383`).
 * Card fields are held only in local state and NEVER sent to
 * `createPayment()` — the request body is exactly `{ reservation_id,
 * payment_method, payment_state, payment_date }` (REQ-PAY-6). A card number
 * starting with `0000` simulates a decline with NO backend call
 * (REQ-PAY-11); a retry re-POSTs `/payments` with the SAME reservation.id,
 * never re-creating the reservation.
 */
export default function BookingCheckout({
  storeRoom,
  reservation,
  pricePerMonth,
  onPaid,
  onBack,
}: BookingCheckoutProps) {
  const [cardNumber, setCardNumber] = useState("");
  const [holderName, setHolderName] = useState("María López");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [paying, setPaying] = useState(false);
  const [declined, setDeclined] = useState(false);
  const [payError, setPayError] = useState("");
  const [authRequired, setAuthRequired] = useState(false);
  // Ref-based guard (not state) because a rapid double-click dispatches both
  // handlers within the same synchronous tick, before the `paying` state
  // update commits — a state-only guard would let both calls through.
  const payingRef = useRef(false);

  const months = monthsBetween(reservation.start_date, reservation.end_date);
  const ready = cardNumber.replace(/\s/g, "").length >= 15 && expiry.length === 5 && cvv.length >= 3;

  const handlePay = async () => {
    if (!ready || payingRef.current) return;

    payingRef.current = true;
    setPaying(true);
    setDeclined(false);
    setPayError("");
    setAuthRequired(false);

    const isDeclined = cardNumber.replace(/\s/g, "").startsWith("0000");

    if (isDeclined) {
      payingRef.current = false;
      setPaying(false);
      setDeclined(true);
      return;
    }

    const input: CreatePaymentInput = {
      reservation_id: reservation.id,
      payment_method: "credit card",
      payment_state: "paid",
      payment_date: toDateOnlyISO(new Date()),
    };

    try {
      await createPayment(input);
      payingRef.current = false;
      setPaying(false);
      onPaid(reservation);
    } catch (e: unknown) {
      payingRef.current = false;
      setPaying(false);
      const err = asApiError(e);
      if (err.response?.status === 401) {
        setAuthRequired(true);
      } else {
        setPayError(COPY.networkError);
      }
    }
  };

  return (
    <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
      {/* Summary panel */}
      <div>
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
          <div className="flex gap-3 border-b border-gray-100 p-4">
            {storeRoom.image && (
              <img
                src={storeRoom.image}
                alt={storeRoom.title}
                className="h-20 w-20 flex-shrink-0 rounded-xl object-cover"
              />
            )}
            <div className="min-w-0">
              <p className="mb-1 text-sm font-semibold text-gray-900">{storeRoom.title}</p>
              <p className="mb-1 text-xs text-gray-500">
                {storeRoom.direction}
                {storeRoom.city ? `, ${storeRoom.city}` : ""}
              </p>
              <RatingStars average={storeRoom.ratingAvg} count={storeRoom.ratingCount} />
            </div>
          </div>

          <div className="border-b border-gray-100 p-4 text-sm text-gray-700">
            <div className="mb-2 flex justify-between">
              <span>{COPY.period}</span>
              <span className="font-semibold text-gray-900">
                {reservation.start_date} → {reservation.end_date}
              </span>
            </div>
            <div className="flex justify-between">
              <span>{COPY.duration}</span>
              <span className="font-semibold text-gray-900">
                {months} mes{months > 1 ? "es" : ""}
              </span>
            </div>
          </div>

          <div className="p-4">
            <PriceBreakdownRows
              pricePerMonth={pricePerMonth}
              rentSubtotal={reservation.rent_subtotal ?? 0}
              deposit={0}
              totalMount={reservation.total_mount ?? 0}
            />
          </div>
        </div>

        <div className="mt-3.5 flex items-center gap-2 rounded-xl bg-purple-50 border border-purple-100 px-3.5 py-2.5">
          <span className="text-sm font-medium text-purple-700">{COPY.instantConfirmation}</span>
        </div>
      </div>

      {/* Card form */}
      <div>
        <h2 className="mb-1 text-xl font-bold text-gray-900">{COPY.heading}</h2>
        <p className="mb-5 text-sm text-gray-500">{COPY.simulatedPayment}</p>

        <div className="flex flex-col gap-4">
          <div>
            <label htmlFor="booking-card-number" className="mb-1.5 block text-xs font-semibold text-gray-700">
              {COPY.cardNumberLabel}
            </label>
            <input
              id="booking-card-number"
              value={cardNumber}
              onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
              placeholder="4242 4242 4242 4242"
              inputMode="numeric"
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-purple-200"
            />
          </div>

          <div>
            <label htmlFor="booking-holder-name" className="mb-1.5 block text-xs font-semibold text-gray-700">
              {COPY.holderLabel}
            </label>
            <input
              id="booking-holder-name"
              value={holderName}
              onChange={(e) => setHolderName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-purple-200"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="booking-expiry" className="mb-1.5 block text-xs font-semibold text-gray-700">
                {COPY.expiryLabel}
              </label>
              <input
                id="booking-expiry"
                value={expiry}
                onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                placeholder="MM/AA"
                inputMode="numeric"
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-purple-200"
              />
            </div>
            <div>
              <label htmlFor="booking-cvv" className="mb-1.5 block text-xs font-semibold text-gray-700">
                {COPY.cvvLabel}
              </label>
              <input
                id="booking-cvv"
                value={cvv}
                onChange={(e) => setCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="123"
                inputMode="numeric"
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-purple-200"
              />
            </div>
          </div>

          {declined && (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              <strong className="font-semibold">{COPY.declinePrefix}</strong> {COPY.decline}
            </div>
          )}

          {payError && (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              {payError}
            </div>
          )}

          {authRequired && (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              {COPY.authRequired}
            </div>
          )}

          <button
            onClick={handlePay}
            disabled={!ready || paying}
            className="mt-1 w-full rounded-lg bg-purple-600 py-3.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
          >
            {paying ? COPY.processing : `${COPY.ctaPrefix} ${formatUSD(reservation.total_mount ?? 0)}`}
          </button>

          <button
            onClick={onBack}
            disabled={paying}
            className="w-full py-2.5 text-sm font-semibold text-gray-500 disabled:cursor-not-allowed disabled:text-gray-300"
          >
            {COPY.back}
          </button>

          <p className="text-center text-xs text-gray-400">{COPY.disclosure}</p>
        </div>
      </div>
    </div>
  );
}
