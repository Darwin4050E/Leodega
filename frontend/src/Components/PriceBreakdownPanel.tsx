import { useEffect, useState } from "react";
import { getStoreRoomQuote, type StoreRoomQuote } from "../services/storeRooms";
import { asApiError } from "../api/errors";
import { formatUSD } from "../utils/money";

interface PriceBreakdownPanelProps {
  roomId: number | string;
  pricePerMonth: number;
  startDate: string;
  endDate: string;
}

const COPY = {
  loading: "Calculando...",
  noEligiblePrice: "No hay un precio mensual disponible para esta bodega.",
  genericError: "No se pudo calcular el precio. Intenta de nuevo.",
} as const;

/**
 * Display-only price panel (storeroom-detail-pricing). NO interactive
 * controls — the 3-month default is computed server-side by the quote
 * endpoint, never here. `startDate`/`endDate` are the SAME page-scope hooks
 * `LeodegaUI` already owns, passed down as props with no hoisting.
 *
 * `service_fee` is deliberately never destructured into JSX: it is internal
 * accounting the customer never sees (obs #289). The deposit row renders
 * only when `deposit` is non-zero (obs #301 leaves it at "0.00" today).
 */
export default function PriceBreakdownPanel({
  roomId,
  pricePerMonth,
  startDate,
  endDate,
}: PriceBreakdownPanelProps) {
  const [quote, setQuote] = useState<StoreRoomQuote | null>(null);
  const [errorCopy, setErrorCopy] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const hasValidRange = Boolean(startDate && endDate && endDate >= startDate);

    setLoading(true);
    setErrorCopy("");

    getStoreRoomQuote(roomId, hasValidRange ? startDate : undefined, hasValidRange ? endDate : undefined)
      .then((res) => setQuote(res.data))
      .catch((e: unknown) => {
        const err = asApiError(e);
        setErrorCopy(err.response?.status === 422 ? COPY.noEligiblePrice : COPY.genericError);
      })
      .finally(() => setLoading(false));
  }, [roomId, startDate, endDate]);

  if (loading) {
    return <p className="text-sm text-gray-500">{COPY.loading}</p>;
  }

  if (errorCopy) {
    return <p className="text-sm text-red-600">{errorCopy}</p>;
  }

  if (!quote) {
    return null;
  }

  const months =
    pricePerMonth > 0 ? Math.round(Number(quote.rent_subtotal) / pricePerMonth) : null;

  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between text-sm text-gray-700">
        <span>
          {formatUSD(pricePerMonth)} × {months ?? "-"} meses
        </span>
        <span>{formatUSD(quote.rent_subtotal)}</span>
      </div>

      {Number(quote.deposit) > 0 && (
        <div className="flex items-baseline justify-between text-sm text-gray-700">
          <span>Depósito de garantía</span>
          <span>{formatUSD(quote.deposit)}</span>
        </div>
      )}

      <div className="flex items-baseline justify-between text-base font-semibold text-gray-900">
        <span>Total</span>
        <span>{formatUSD(quote.total_mount)}</span>
      </div>
    </div>
  );
}
