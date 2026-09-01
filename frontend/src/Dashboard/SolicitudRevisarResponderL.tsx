import React, { useState } from "react";
import { Check, X, AlertTriangle, MessageSquare } from "lucide-react";
import { updateReservationStatus } from "../services/reservations";
import { asApiError } from "../api/errors";
import type { SolicitudL } from "./Interfaces/SolicitudesLData";

interface Props {
  solicitud: SolicitudL;
  onVolver: () => void;
  onRevisarDetalles: () => void;
  onActualizarSolicitud: (updated: SolicitudL) => void;
}

const SolicitudRevisarResponderL: React.FC<Props> = ({
  solicitud,
  onVolver,
  onRevisarDetalles,
  onActualizarSolicitud,
}) => {
  const [mostrarConfirmarAceptar, setMostrarConfirmarAceptar] = useState(false);
  const [razonRechazo, setRazonRechazo] = useState("");
  const [opcionSeleccionada, setOpcionSeleccionada] = useState<"aceptar" | "rechazar" | null>(null);

  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState("");

  const handleSeleccionarAceptar = () => {
    setOpcionSeleccionada("aceptar");
    setRazonRechazo("");
    setApiError("");
  };

  const handleSeleccionarRechazar = () => {
    setOpcionSeleccionada("rechazar");
    setApiError("");
  };

  const confirmarAceptar = async () => {
    try {
      setLoading(true);
      setApiError("");

      await updateReservationStatus(solicitud.id, {
        status: "confirmed",
      });

      const updated: SolicitudL = { ...solicitud, status: "confirmed", cancelation_reason: null };
      onActualizarSolicitud(updated);

      setMostrarConfirmarAceptar(false);
      onVolver();
    } catch (e: unknown) {
      const err = asApiError(e);
      const status = err.response?.status;
      if (status === 409) setApiError(err.response?.data?.message || "Conflicto: hay una reserva confirmada en esas fechas.");
      else if (status === 403) setApiError("No autorizado.");
      else setApiError("Error aceptando la solicitud.");
    } finally {
      setLoading(false);
    }
  };

  const confirmarRechazo = async () => {
    if (!razonRechazo.trim()) return;

    try {
      setLoading(true);
      setApiError("");

      await updateReservationStatus(solicitud.id, {
        status: "canceled",
        cancelation_reason: razonRechazo.trim(),
      });

      const updated: SolicitudL = { ...solicitud, status: "canceled", cancelation_reason: razonRechazo.trim() };
      onActualizarSolicitud(updated);

      onVolver();
    } catch (e: unknown) {
      const status = asApiError(e).response?.status;
      if (status === 403) setApiError("No autorizado.");
      else setApiError("Error rechazando la solicitud.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full bg-gray-50 p-6">
      <div className="w-full mx-auto bg-white p-8 rounded-xl">
        <div className="mb-6 flex flex-row items-center">
          <h1 className="text-2xl font-bold text-gray-900">Decidir sobre Solicitud</h1>
          <div className="text-sm text-gray-600 border rounded-xl px-3 py-1 bg-white ml-4">
            <span className="font-semibold">ID:</span> LEO-{solicitud.id}
          </div>
        </div>

        {apiError && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm">
            {apiError}
          </div>
        )}

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Resumen</h2>

          <div className="grid grid-cols-2 gap-6">
            <button
              type="button"
              onClick={handleSeleccionarAceptar}
              className={`border-2 rounded-lg p-5 cursor-pointer transition-all duration-200 ${
                opcionSeleccionada === "aceptar"
                  ? "bg-green-50 border-green-300 shadow-md"
                  : "bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm"
              }`}
              disabled={loading || solicitud.status !== "pending"}
            >
              <div className="flex items-center gap-2 mb-3">
                <Check className={`w-5 h-5 ${opcionSeleccionada === "aceptar" ? "text-green-600" : "text-gray-400"}`} />
                <h3 className="text-xl font-semibold text-green-600">Aceptar Reserva</h3>
              </div>
              <p className="text-sm text-gray-600">
                Confirma esta reserva y se bloquearán otras solicitudes cruzadas.
              </p>
            </button>

            <button
              type="button"
              onClick={handleSeleccionarRechazar}
              className={`border-2 rounded-lg p-5 cursor-pointer transition-all duration-200 ${
                opcionSeleccionada === "rechazar"
                  ? "bg-red-50 border-red-300 shadow-md"
                  : "bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm"
              }`}
              disabled={loading || solicitud.status !== "pending"}
            >
              <div className="flex items-center gap-2 mb-3">
                <X className={`w-5 h-5 ${opcionSeleccionada === "rechazar" ? "text-red-600" : "text-gray-400"}`} />
                <h3 className="text-xl font-semibold text-red-600">Rechazar Reserva</h3>
              </div>
              <p className="text-sm text-gray-600">
                Rechaza la solicitud indicando la razón.
              </p>
            </button>
          </div>
        </div>

        {opcionSeleccionada === "aceptar" && (
          <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4 mb-6">
            <div className="flex gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">Importante</h3>
                <p className="text-sm text-gray-700">
                  Al aceptar, esta reserva queda confirmada y otras solicitudes cruzadas quedarán bloqueadas.
                </p>
              </div>
            </div>
          </div>
        )}

        {opcionSeleccionada === "rechazar" && (
          <div className="bg-white border border-gray-300 rounded-lg p-6 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare className="w-5 h-5 text-gray-600" />
              <h3 className="font-semibold text-xl text-gray-900">Razón del Rechazo</h3>
            </div>

            <textarea
              value={razonRechazo}
              onChange={(e) => setRazonRechazo(e.target.value)}
              rows={4}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
              placeholder="Ej: La bodega no estará disponible por mantenimiento..."
              disabled={loading}
            />
            <p className="text-xs text-gray-500 mt-2">Este mensaje quedará guardado en la reserva.</p>
          </div>
        )}

        {/* botones */}
        {opcionSeleccionada === "rechazar" ? (
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={confirmarRechazo}
              disabled={!razonRechazo.trim() || loading || solicitud.status !== "pending"}
              className={`py-3 px-6 rounded-lg transition-colors font-medium flex items-center justify-center gap-2 ${
                razonRechazo.trim() && !loading
                  ? "bg-red-600 text-white hover:bg-red-700"
                  : "bg-red-300 text-white cursor-not-allowed"
              }`}
            >
              <X size={20} />
              {loading ? "Procesando..." : "Confirmar Rechazo"}
            </button>

            <button
              onClick={onRevisarDetalles}
              className="bg-white border border-gray-300 text-gray-700 py-3 px-6 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              disabled={loading}
            >
              Revisar Detalles
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => opcionSeleccionada === "aceptar" && setMostrarConfirmarAceptar(true)}
              disabled={opcionSeleccionada !== "aceptar" || loading || solicitud.status !== "pending"}
              className={`py-3 px-6 rounded-lg transition-colors font-medium flex items-center justify-center gap-2 ${
                opcionSeleccionada === "aceptar" && !loading
                  ? "bg-green-600 text-white hover:bg-green-700"
                  : "bg-gray-300 text-gray-500 cursor-not-allowed"
              }`}
            >
              <Check size={20} />
              Confirmar Aceptación
            </button>

            <button
              onClick={onRevisarDetalles}
              className="bg-white border border-gray-300 text-gray-700 py-3 px-6 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              disabled={loading}
            >
              Revisar Detalles
            </button>
          </div>
        )}

        {mostrarConfirmarAceptar && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Confirmar Aceptación</h3>
              <p className="text-sm text-gray-600 mb-6">
                ¿Estás seguro? Se confirmará la reserva y se bloquearán solicitudes cruzadas.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setMostrarConfirmarAceptar(false)}
                  className="flex-1 border border-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-50 transition-colors"
                  disabled={loading}
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmarAceptar}
                  className="flex-1 bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors"
                  disabled={loading}
                >
                  {loading ? "Confirmando..." : "Confirmar"}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="mt-6">
          <button onClick={onVolver} className="text-sm text-gray-500 hover:text-gray-800">
            ← Volver a Solicitudes
          </button>
        </div>
      </div>
    </div>
  );
};

export default SolicitudRevisarResponderL;
