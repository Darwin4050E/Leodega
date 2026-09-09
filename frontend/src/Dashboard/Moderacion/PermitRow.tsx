import React from "react";
import pdfIcon from "../../img/pdf-icon.png";
import { downloadStoreRoomPermit } from "../../services/storeRooms";

interface PermitRowProps {
  storeRoomId: number;
  permitFilename: string | null;
}

/**
 * Fire-department permit row — matches the prototype's `ADPermisoRow`
 * (`AdminPanel.jsx:136-157`). Five state-dependent signals, all driven by
 * whether a permit is attached: filename text, dimmed PDF icon, border
 * color, click affordance, and a warning footer strip.
 */
const PermitRow: React.FC<PermitRowProps> = ({ storeRoomId, permitFilename }) => {
  const attached = permitFilename !== null;

  const handleDownload = async () => {
    if (!attached) return;
    try {
      const { data } = await downloadStoreRoomPermit(storeRoomId);
      const url = URL.createObjectURL(data);
      window.open(url, "_blank");
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error al descargar el permiso", error);
    }
  };

  return (
    <div
      className={`rounded-xl overflow-hidden bg-white border ${
        attached ? "border-gray-200" : "border-red-200"
      }`}
    >
      <div
        role={attached ? "button" : undefined}
        tabIndex={attached ? 0 : undefined}
        onClick={attached ? handleDownload : undefined}
        className={`flex items-center gap-3 px-4 py-4 ${
          attached ? "cursor-pointer hover:bg-gray-50" : "cursor-default"
        }`}
      >
        <div className="w-14 h-16 rounded-lg border border-gray-100 bg-gray-50 flex items-center justify-center flex-shrink-0">
          <img
            src={pdfIcon}
            alt="PDF"
            width={30}
            height={30}
            className={attached ? "" : "grayscale opacity-45"}
          />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 m-0">
            Permiso del cuerpo de bomberos
          </p>
          <p
            className={`text-xs text-gray-400 mt-1 truncate ${attached ? "font-mono" : ""}`}
          >
            {permitFilename ?? "Ningún archivo adjunto"}
          </p>
        </div>
      </div>
      {!attached && (
        <p className="m-0 px-4 py-2.5 border-t border-red-200 bg-red-50 text-xs text-red-700 font-medium">
          El gestor debe adjuntar el permiso antes de aprobar.
        </p>
      )}
    </div>
  );
};

export default PermitRow;
