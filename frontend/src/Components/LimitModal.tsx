import { useState } from "react";

import { asApiError } from "../api/errors";
import { setSpendingLimit, type SpendingLimitRow } from "../services/organizations";
import { formatUSD } from "../utils/money";
import { SPENDING_LIMIT_COPY } from "../utils/spendingLimitCopy";

interface LimitModalProps {
  organizationId: number;
  row: SpendingLimitRow;
  onClose: () => void;
  /** Called after the server accepted the change, before `onClose`. */
  onSaved: () => void;
}

// Mirrors the server rule: 1-6 integer digits, at most 2 decimals. It also
// rules out signs and exponent notation before the server ever sees the value.
const LIMIT_PATTERN = /^\d{1,6}(\.\d{1,2})?$/;

function isValidLimit(raw: string): boolean {
  return LIMIT_PATTERN.test(raw) && Number(raw) > 0;
}

/**
 * Admin-only editor of one member's monthly limit. The typed string is sent
 * as is (the server does the money arithmetic); "Sin límite" sends `null`.
 * A limit below what the member already consumed is allowed, so it only
 * warns (ML-12).
 */
const LimitModal = ({ organizationId, row, onClose, onSaved }: LimitModalProps) => {
  const [value, setValue] = useState(row.monthly_limit ?? "");
  const [unlimited, setUnlimited] = useState(row.monthly_limit === null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const trimmed = value.trim();
  const showWarning = !unlimited && isValidLimit(trimmed) && Number(trimmed) < Number(row.spent);

  const handleSave = async () => {
    if (submitting) return;

    if (!unlimited && !isValidLimit(trimmed)) {
      setError(SPENDING_LIMIT_COPY.invalidLimit);
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      await setSpendingLimit(organizationId, row.user_id, unlimited ? null : trimmed);
      onSaved();
      onClose();
    } catch (err) {
      const data = asApiError(err).response?.data;
      setError(data?.errors?.monthly_limit?.[0] || data?.message || SPENDING_LIMIT_COPY.saveError);
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
        aria-labelledby="limit-modal-title"
        className="bg-white rounded-2xl w-full max-w-[400px] shadow-2xl overflow-hidden"
      >
        <div className="px-6 pt-6">
          <h4 id="limit-modal-title" className="text-lg font-bold text-gray-900 m-0 mb-2">
            {SPENDING_LIMIT_COPY.modalTitle(row.name)}
          </h4>
          <p className="text-sm text-gray-500 m-0 leading-relaxed">{SPENDING_LIMIT_COPY.startMonthHelp}</p>
        </div>

        <div className="px-6 pt-4">
          <label htmlFor="limit-modal-amount" className="block text-sm font-semibold text-gray-700 mb-1">
            {SPENDING_LIMIT_COPY.fieldLabel}
          </label>
          <input
            id="limit-modal-amount"
            type="text"
            inputMode="decimal"
            value={value}
            disabled={unlimited}
            onChange={(e) => setValue(e.target.value)}
            placeholder="500.00"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm disabled:bg-gray-100"
          />
          <label htmlFor="limit-modal-unlimited" className="flex items-center gap-2 mt-3 text-sm text-gray-700">
            <input
              id="limit-modal-unlimited"
              type="checkbox"
              checked={unlimited}
              onChange={(e) => setUnlimited(e.target.checked)}
            />
            {SPENDING_LIMIT_COPY.noLimit}
          </label>
          {showWarning && (
            <p className="text-sm text-amber-700 mt-2 mb-0">
              {SPENDING_LIMIT_COPY.lowLimitWarning(formatUSD(row.spent, { fixed: true }))}
            </p>
          )}
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
            {SPENDING_LIMIT_COPY.cancel}
          </button>
          <button
            onClick={handleSave}
            disabled={submitting}
            className={`px-4.5 py-2.5 rounded-lg text-sm font-semibold border-none ${
              submitting ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "bg-[#7551E9] text-white"
            }`}
          >
            {submitting ? SPENDING_LIMIT_COPY.saving : SPENDING_LIMIT_COPY.save}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LimitModal;
