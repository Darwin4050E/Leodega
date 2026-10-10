import { useState } from "react";

import { asApiError } from "../api/errors";
import { topUpWallet } from "../services/organizations";
import { notifyWalletChanged } from "../utils/walletEvents";

interface WalletTopUpModalProps {
  organizationId: number;
  onClose: () => void;
}

const MIN_TOP_UP = 50;
const MAX_TOP_UP = 50000;

const AMOUNT_MESSAGE = "El monto de la recarga debe estar entre $50 y $50.000";
const GENERIC_ERROR = "No se pudo realizar la recarga. Intenta nuevamente.";

// Plain decimal with at most 2 fraction digits: rules out exponent notation,
// signs and a third decimal before the server ever sees the value.
const AMOUNT_PATTERN = /^\d+(\.\d{1,2})?$/;

function isValidAmount(raw: string): boolean {
  if (!AMOUNT_PATTERN.test(raw)) return false;
  const value = Number(raw);
  return value >= MIN_TOP_UP && value <= MAX_TOP_UP;
}

/**
 * Admin-only simulated top-up: there is no payment gateway, so the amount is
 * credited directly. The amount is sent as the raw string the admin typed so
 * the server is the only place that does money arithmetic.
 */
const WalletTopUpModal = ({ organizationId, onClose }: WalletTopUpModalProps) => {
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleConfirm = async () => {
    if (submitting) return;

    const trimmed = amount.trim();
    if (!isValidAmount(trimmed)) {
      setError(AMOUNT_MESSAGE);
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      await topUpWallet(organizationId, trimmed);
      notifyWalletChanged();
      onClose();
    } catch (err) {
      const data = asApiError(err).response?.data;
      setError(data?.errors?.amount?.[0] || data?.message || GENERIC_ERROR);
      setSubmitting(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black/55 flex items-center justify-center z-[2200] px-5"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="wallet-top-up-title"
        className="bg-white rounded-2xl w-full max-w-[400px] shadow-2xl overflow-hidden"
      >
        <div className="px-6 pt-6">
          <h4 id="wallet-top-up-title" className="text-lg font-bold text-gray-900 m-0 mb-2">
            Recargar saldo
          </h4>
          <p className="text-sm text-gray-500 m-0 leading-relaxed">
            Recarga simulada: el monto se acredita de inmediato al saldo de la organización.
          </p>
        </div>

        <div className="px-6 pt-4">
          <label htmlFor="wallet-top-up-amount" className="block text-sm font-semibold text-gray-700 mb-1">
            Monto a recargar
          </label>
          <input
            id="wallet-top-up-amount"
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="100.00"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          {error && (
            <p className="text-sm text-red-600 mt-2 mb-0" role="alert">
              {error}
            </p>
          )}
        </div>

        <div className="px-6 pt-5 pb-6 flex gap-2.5 justify-end">
          <button
            onClick={onClose}
            className="px-4.5 py-2.5 bg-white text-gray-700 border border-gray-300 rounded-lg text-sm font-semibold"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={submitting}
            className={`px-4.5 py-2.5 rounded-lg text-sm font-semibold border-none ${
              submitting ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "bg-[#7551E9] text-white"
            }`}
          >
            {submitting ? "Procesando..." : "Confirmar recarga"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default WalletTopUpModal;
