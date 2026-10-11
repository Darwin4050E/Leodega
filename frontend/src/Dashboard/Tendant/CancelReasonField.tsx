import { useId } from "react";

import { REASON_MAX, REASON_MIN, reasonLength } from "./cancelReason";

interface CancelReasonFieldProps {
  value: string;
  /** The field was blurred at least once; gates the client-side error. */
  touched: boolean;
  /** Message from a server 422 on `errors.reason`; takes precedence over the client message. */
  serverError: string;
  onChange: (value: string) => void;
  onBlur: () => void;
}

const MIN_MESSAGE = "El motivo debe tener al menos 10 caracteres.";

/**
 * Presentational reason textarea for the org admin cancel modal (HUE-06 OR-W8).
 * The server owns validation; this only mirrors it for fast feedback.
 */
const CancelReasonField = ({ value, touched, serverError, onChange, onBlur }: CancelReasonFieldProps) => {
  const id = useId();
  const helperId = `${id}-helper`;
  const counterId = `${id}-counter`;
  const errorId = `${id}-error`;

  const length = reasonLength(value);
  const valid = length >= REASON_MIN;
  const error = serverError || (touched && !valid ? MIN_MESSAGE : "");

  const handleChange = (next: string) => {
    onChange(Array.from(next).slice(0, REASON_MAX).join(""));
  };

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-gray-900 mb-1.5">
        Motivo de la cancelación *
      </label>
      <textarea
        id={id}
        value={value}
        rows={3}
        placeholder="Explica por qué se cancela esta reserva…"
        onChange={(e) => handleChange(e.target.value)}
        onBlur={onBlur}
        aria-invalid={error ? true : undefined}
        aria-describedby={[helperId, counterId, error ? errorId : ""].filter(Boolean).join(" ")}
        className={`w-full px-3 py-2 border rounded-lg text-sm text-gray-900 resize-none ${
          error ? "border-red-400" : "border-gray-300"
        }`}
      />
      <div className="flex justify-between gap-3 mt-1">
        <span id={helperId} className="text-xs text-gray-500">
          Obligatorio · queda en el historial de la empresa.
        </span>
        <span
          id={counterId}
          className={`text-xs font-semibold whitespace-nowrap ${valid ? "text-green-600" : "text-gray-400"}`}
        >
          {length} / {REASON_MIN} mín.
        </span>
      </div>
      {error && (
        <p id={errorId} role="alert" className="text-xs text-red-600 mt-1 m-0">
          {error}
        </p>
      )}
    </div>
  );
};

export default CancelReasonField;
