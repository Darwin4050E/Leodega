import React, { useState } from "react";
import { REASON_CODE, type ReasonCode } from "../../services/storeRooms";

const REASON_LABEL: Record<ReasonCode, { label: string; hint: string }> = {
  [REASON_CODE.FOTOS]: {
    label: "Fotos incorrectas",
    hint: "Imágenes borrosas, no corresponden o insuficientes.",
  },
  [REASON_CODE.INFO]: {
    label: "Información incoherente",
    hint: "Dimensiones, dirección o tarifa no coinciden.",
  },
  [REASON_CODE.PERMISO]: {
    label: "Permiso inválido",
    hint: "Permiso de bomberos ausente, ilegible o vencido.",
  },
  [REASON_CODE.OTRO]: {
    label: "Otro motivo",
    hint: "Especifica el motivo en el comentario.",
  },
};

interface RejectModalProps {
  isOpen: boolean;
  title: string;
  error: string | null;
  onClose: () => void;
  onConfirm: (reasonCode: ReasonCode, comment: string) => void;
}

/**
 * Rejection dialog. Deliberately NOT ModalConfirmacion.tsx, for the same
 * reason EliminarBodegaModal.tsx documents: that component hardcodes a
 * green-check/purple-button success shape, which is semantically wrong for
 * a destructive decision. This follows EliminarBodegaModal's inline
 * `fixed inset-0` shell with a red confirm button.
 *
 * One of the four reason codes is required; the comment is required
 * client-side only for `otro`, mirroring the backend rule. The dialog stays
 * open on a failed request so the inline error is readable — the parent
 * closes it only on success.
 */
const RejectModal: React.FC<RejectModalProps> = ({
  isOpen,
  title,
  error,
  onClose,
  onConfirm,
}) => {
  const [reasonCode, setReasonCode] = useState<ReasonCode | null>(null);
  const [comment, setComment] = useState("");

  const isValid =
    reasonCode !== null && (reasonCode !== REASON_CODE.OTRO || comment.trim().length > 0);

  const handleCancel = () => {
    setReasonCode(null);
    setComment("");
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
      <div
        role="dialog"
        aria-label="Rechazar bodega"
        className="bg-white rounded-2xl w-full max-w-md shadow-xl border border-gray-200 overflow-hidden max-h-[90vh] flex flex-col"
      >
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">Rechazar bodega</h3>
          <p className="text-sm text-gray-500 mt-1">
            Indica el motivo. Se enviará al gestor para que corrija y reenvíe {title}.
          </p>
        </div>

        <div className="px-6 py-4 overflow-y-auto">
          <div className="flex flex-col gap-2 mb-3">
            {(Object.keys(REASON_LABEL) as ReasonCode[]).map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => setReasonCode(code)}
                className={`text-left flex gap-3 items-start px-3 py-2.5 rounded-lg border transition-colors ${
                  reasonCode === code
                    ? "border-red-500 bg-red-50"
                    : "border-gray-200 bg-white hover:bg-gray-50"
                }`}
              >
                <span
                  className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded-full border-2 ${
                    reasonCode === code ? "border-red-600 bg-red-600" : "border-gray-300"
                  }`}
                />
                <span>
                  <span className="block text-sm font-semibold text-gray-900">
                    {REASON_LABEL[code].label}
                  </span>
                  <span className="block text-xs text-gray-400 mt-0.5">
                    {REASON_LABEL[code].hint}
                  </span>
                </span>
              </button>
            ))}
          </div>

          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={
              reasonCode === REASON_CODE.OTRO
                ? "Describe el motivo (obligatorio)…"
                : "Comentario para el gestor (opcional)…"
            }
            rows={3}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-vertical"
          />

          {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex gap-2 justify-end bg-gray-50">
          <button
            type="button"
            onClick={handleCancel}
            className="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 hover:bg-white"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={() => reasonCode && onConfirm(reasonCode, comment.trim())}
            disabled={!isValid}
            className="px-4 py-2 rounded-xl bg-[#DC2626] text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Rechazar y enviar
          </button>
        </div>
      </div>
    </div>
  );
};

export default RejectModal;
