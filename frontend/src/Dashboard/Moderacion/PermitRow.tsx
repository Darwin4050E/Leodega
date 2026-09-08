import React from "react";
import { FileText, AlertTriangle } from "lucide-react";
import { downloadStoreRoomPermit } from "../../services/storeRooms";

interface PermitRowProps {
  storeRoomId: number;
  permitAttached: boolean;
}

/**
 * Shows whether the fire-department permit was attached. When it was, a
 * click streams the admin-only endpoint as a blob and opens it in a new
 * tab. When it was not, states so plainly — no download control renders.
 */
const PermitRow: React.FC<PermitRowProps> = ({ storeRoomId, permitAttached }) => {
  const handleDownload = async () => {
    try {
      const { data } = await downloadStoreRoomPermit(storeRoomId);
      const url = URL.createObjectURL(data);
      window.open(url, "_blank");
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error al descargar el permiso", error);
    }
  };

  if (!permitAttached) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
        <AlertTriangle className="text-red-600 flex-shrink-0" size={20} />
        <p className="text-sm text-red-700 font-medium">
          Sin permiso de bomberos adjunto.
        </p>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handleDownload}
      className="w-full flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 hover:bg-gray-50 transition-colors text-left"
    >
      <FileText className="text-purple-600 flex-shrink-0" size={20} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900">Permiso del cuerpo de bomberos</p>
        <p className="text-xs text-gray-500">Descargar documento</p>
      </div>
    </button>
  );
};

export default PermitRow;
