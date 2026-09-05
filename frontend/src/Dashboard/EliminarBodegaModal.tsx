interface EliminarBodegaModalProps {
  title: string;
  onCancel: () => void;
  onConfirm: () => void;
  isDeleting?: boolean;
}

/**
 * Destructive delete confirmation. Deliberately NOT ModalConfirmacion.tsx --
 * that component hardcodes a green-check/purple-button success shape, which
 * is semantically wrong for a destructive action. This follows the inline
 * `fixed inset-0` pattern already used elsewhere in the codebase (e.g.
 * LeodegaUI.tsx, Mensajes.tsx) with a red confirm button instead.
 */
const EliminarBodegaModal = ({ title, onCancel, onConfirm, isDeleting = false }: EliminarBodegaModalProps) => {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
      <div
        role="dialog"
        aria-label="Eliminar bodega"
        className="bg-white rounded-2xl w-full max-w-md shadow-xl border border-gray-200 overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">Eliminar bodega</h3>
        </div>

        <div className="px-6 py-4">
          <p className="text-sm text-gray-700">
            ¿Seguro que deseas eliminar {title}? Esta acción no se puede deshacer.
          </p>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex gap-2 justify-end bg-gray-50">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 hover:bg-white"
            disabled={isDeleting}
          >
            Cancelar
          </button>

          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-xl bg-[#DC2626] text-white hover:bg-red-700 disabled:opacity-60"
            disabled={isDeleting}
          >
            {isDeleting ? "Eliminando..." : "Eliminar"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EliminarBodegaModal;
