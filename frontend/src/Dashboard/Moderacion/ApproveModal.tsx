import React, { useState } from "react";
import ModalConfirmacion from "../../Components/ModalConfirmacion";

interface ApproveModalProps {
  isOpen: boolean;
  title: string;
  permitAttached: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: (waiverAcknowledged: boolean) => void;
}

/**
 * Wraps `ModalConfirmacion`. Approval is direct when the permit is
 * attached; when it is not, the waiver checkbox gates confirmation.
 *
 * `ModalConfirmacion`'s confirm button always fires `onConfirm` then
 * `onClose` synchronously — since the decision here is async and must
 * stay open on a 422, `onClose` passed to `ModalConfirmacion` is a no-op;
 * the parent container owns actually closing the modal (on success) or
 * keeping it open with an inline error (on failure). A dedicated Cancelar
 * button below calls the real `onClose`.
 */
const ApproveModal: React.FC<ApproveModalProps> = ({
  isOpen,
  title,
  permitAttached,
  error,
  onClose,
  onConfirm,
}) => {
  const [waiverAcknowledged, setWaiverAcknowledged] = useState(false);

  const handleCancel = () => {
    setWaiverAcknowledged(false);
    onClose();
  };

  return (
    <ModalConfirmacion
      isOpen={isOpen}
      onClose={() => {}}
      titulo="¿Aprobar y publicar?"
      mensaje={`"${title}" quedará publicada en el catálogo y reservable al instante, sin nueva aprobación en cada alquiler.`}
      textoBoton="Sí, aprobar"
      confirmDisabled={!permitAttached && !waiverAcknowledged}
      onConfirm={() => onConfirm(!permitAttached)}
    >
      {!permitAttached && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm font-semibold text-red-700 mb-2">
            Falta el permiso del cuerpo de bomberos
          </p>
          <label className="flex items-start gap-2 text-sm text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={waiverAcknowledged}
              onChange={() => setWaiverAcknowledged((v) => !v)}
              className="mt-1 accent-red-600"
            />
            Entiendo que publico esta bodega sin la documentación obligatoria y
            asumo la responsabilidad.
          </label>
        </div>
      )}

      {error && <p className="text-sm text-red-600 mt-3">{error}</p>}

      <button
        type="button"
        onClick={handleCancel}
        className="mt-4 w-full py-2.5 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50"
      >
        Cancelar
      </button>
    </ModalConfirmacion>
  );
};

export default ApproveModal;
