import React, { useState, useEffect } from 'react';
import { Check, X, AlertTriangle, MessageSquare } from 'lucide-react';
import type { Solicitud, ReporteDetalle } from './Interfaces/SolicitudesData';
import { getReport, updateReportStatus } from '../services/reports';


interface SolicitudRevisarResponderProps {
  solicitud: Solicitud;
  onVolver: () => void;
  onRechazar: (razon: string) => void;
}

const SolicitudRevisarResponder: React.FC<SolicitudRevisarResponderProps> = ({
  solicitud,
  onVolver,
  onRechazar
}) => {
  const [mostrarConfirmarResolver, setMostrarConfirmarResolver] = useState(false);
  const [razonRechazo, setRazonRechazo] = useState("");
  const [opcionSeleccionada, setOpcionSeleccionada] = useState<"resolver" | "rechazar" | null>(null);
  const [detalle, setDetalle] = useState<ReporteDetalle | null>(null);
  const [loading, setLoading] = useState(true);


  const datosCompletos = { ...solicitud };

  const handleConfirmarResolver = async () => {
    try {
      await updateReportStatus(solicitud.id, {
        status: "resolved",
      });

      setMostrarConfirmarResolver(false);
      onVolver();
    } catch (error) {
      console.error("Error resolviendo reporte", error);
      alert("No se pudo marcar como resuelto.");
    }
  };

  useEffect(() => {
    const fetchDetalle = async () => {
      try {
        const res = await getReport(solicitud.id);
        setDetalle(res.data);
      } catch (error) {
        console.error("Error cargando detalle del reporte", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDetalle();
  }, [solicitud.id]);


  const handleConfirmarRechazo = async () => {
    if (!razonRechazo.trim()) return;

    try {
      await updateReportStatus(solicitud.id, {
        status: "canceled",
        cancelation_reason: razonRechazo.trim(),
      });

      onRechazar(razonRechazo.trim());
    } catch (error) {
      console.error("Error rechazando reporte", error);
      alert("No se pudo rechazar el reporte.");
    }
  };

  if (loading) {
    return (
      <div className="p-6 text-gray-600">
        Cargando detalle del reporte...
      </div>
    );
  }

  if (!detalle) {
    return (
      <div className="p-6 text-red-600">
        No se pudo cargar el detalle del reporte.
      </div>
    );
  }

  return (
    <div className="w-full bg-gray-50 p-6">
      <div className="w-full mx-auto bg-white p-8 rounded-xl">
        <div className="mb-6 flex flex-row items-center">
          <h1 className="text-2xl font-bold text-gray-900">Decidir sobre Reporte</h1>
          <div className="text-sm text-gray-600 border rounded-xl px-3 py-1 bg-white ml-4">
            <span className="font-semibold">ID:</span> #{String(datosCompletos.id).padStart(5, "0")}
          </div>
        </div>

        {/* Resumen */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Resumen del Reporte</h2>

          <div className="grid grid-cols-3 gap-6 mb-6">
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1">USUARIO</p>
              <p className="text-base font-bold text-gray-900">{datosCompletos.nombre}</p>
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1">TIPO</p>
              <p className="text-base font-bold text-gray-900">{datosCompletos.tipo}</p>
              <p className="text-sm text-gray-500">Fecha: {datosCompletos.fecha}</p>
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1">ESTADO</p>
              <p className="text-base font-bold text-gray-900">{datosCompletos.estado}</p>
              <p className="text-sm text-gray-500">Dirección: {datosCompletos.direccion}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            {/* Resolver */}
            <button
              type="button"
              onClick={() => {
                setOpcionSeleccionada("resolver");
                setRazonRechazo("");
              }}
              className={`border-2 rounded-lg p-5 cursor-pointer transition-all duration-200 ${opcionSeleccionada === "resolver"
                ? "bg-green-50 border-green-300 shadow-md"
                : "bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm"
                }`}
            >
              <div className="flex items-center gap-2 mb-3">
                <Check className={`w-5 h-5 ${opcionSeleccionada === "resolver" ? "text-green-600" : "text-gray-400"}`} />
                <h3 className="text-xl font-semibold text-green-600">Marcar como Resuelto</h3>
              </div>

              <p className="text-sm text-gray-600 mb-4">
                Cambia el estado del reporte a <b>Completada</b> una vez verificado el incidente.
              </p>

              <div className="space-y-2 text-sm text-gray-700 mb-4">
                <div className="flex items-start gap-2">
                  <Check className={`w-4 h-4 mt-0.5 flex-shrink-0 ${opcionSeleccionada === "resolver" ? "text-green-600" : "text-gray-400"}`} />
                  <span>Se registrará como completado</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check className={`w-4 h-4 mt-0.5 flex-shrink-0 ${opcionSeleccionada === "resolver" ? "text-green-600" : "text-gray-400"}`} />
                  <span>Quedará en el historial del sistema</span>
                </div>
              </div>
            </button>

            {/* Rechazar */}
            <button
              type="button"
              onClick={() => setOpcionSeleccionada("rechazar")}
              className={`border-2 rounded-lg p-5 cursor-pointer transition-all duration-200 ${opcionSeleccionada === "rechazar"
                ? "bg-red-50 border-red-300 shadow-md"
                : "bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm"
                }`}
            >
              <div className="flex items-center gap-2 mb-3">
                <X className={`w-5 h-5 ${opcionSeleccionada === "rechazar" ? "text-red-600" : "text-gray-400"}`} />
                <h3 className="text-xl font-semibold text-red-600">Rechazar Reporte</h3>
              </div>

              <p className="text-sm text-gray-600 mb-4">
                Rechaza el reporte si no corresponde o no cumple condiciones, indicando una razón.
              </p>

              <div className="space-y-2 text-sm text-gray-700 mb-4">
                <div className="flex items-start gap-2">
                  <span className={`mt-0.5 flex-shrink-0 ${opcionSeleccionada === "rechazar" ? "text-red-600" : "text-gray-400"}`}>•</span>
                  <span>Se guardará la razón del rechazo</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className={`mt-0.5 flex-shrink-0 ${opcionSeleccionada === "rechazar" ? "text-red-600" : "text-gray-400"}`}>•</span>
                  <span>El estado quedará en “Rechazada”</span>
                </div>
              </div>
            </button>
          </div>
        </div>


        {opcionSeleccionada === "resolver" && (
          <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4 mb-6">
            <div className="flex gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">Importante</h3>
                <p className="text-sm text-gray-700">
                  Antes de marcar como completado, asegúrate de haber verificado el incidente asociado al reporte.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Razón de rechazo */}
        {opcionSeleccionada === "rechazar" && (
          <div className="bg-white border border-gray-300 rounded-lg p-6 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare className="w-5 h-5 text-gray-600" />
              <h3 className="font-semibold text-xl text-gray-900">Razón del Rechazo</h3>
            </div>

            <p className="text-sm text-gray-600 mb-3">Explica brevemente por qué se rechaza este reporte</p>

            <textarea
              value={razonRechazo}
              onChange={(e) => setRazonRechazo(e.target.value)}
              rows={4}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
              placeholder="Ej: El incidente no corresponde a esta bodega / evidencia insuficiente / reporte duplicado..."
            />

            <p className="text-xs text-gray-500 mt-2">Este motivo quedará registrado para auditoría.</p>
          </div>
        )}

        {/* Botones finales */}
        {opcionSeleccionada === "rechazar" ? (
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={handleConfirmarRechazo}
              disabled={!razonRechazo.trim()}
              className={`py-3 px-6 rounded-lg transition-colors font-medium flex items-center justify-center gap-2 ${razonRechazo.trim()
                ? "bg-red-600 text-white hover:bg-red-700"
                : "bg-red-300 text-white cursor-not-allowed"
                }`}
            >
              <X size={20} />
              Confirmar Rechazo
            </button>

            <button
              onClick={onVolver}
              className="bg-white border border-gray-300 text-gray-700 py-3 px-6 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            >
              Volver
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => {
                if (opcionSeleccionada === "resolver") setMostrarConfirmarResolver(true);
              }}
              disabled={opcionSeleccionada !== "resolver"}
              className={`py-3 px-6 rounded-lg transition-colors font-medium flex items-center justify-center gap-2 ${opcionSeleccionada === "resolver"
                ? "bg-green-600 text-white hover:bg-green-700"
                : "bg-gray-300 text-gray-500 cursor-not-allowed"
                }`}
            >
              <Check size={20} />
              Confirmar Resolución
            </button>

            <button
              onClick={onVolver}
              className="bg-white border border-gray-300 text-gray-700 py-3 px-6 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            >
              Volver
            </button>
          </div>
        )}

        {/* Modal confirmar resolver */}
        {mostrarConfirmarResolver && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Confirmar Resolución</h3>
              <p className="text-sm text-gray-600 mb-6">
                ¿Estás seguro de marcar este reporte como <b>Completado</b>?
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => setMostrarConfirmarResolver(false)}
                  className="flex-1 border border-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>

                <button
                  onClick={handleConfirmarResolver}
                  className="flex-1 bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
export default SolicitudRevisarResponder;