import { ArrowLeft } from "lucide-react";

const Status = () => {
  return (
    <div className="w-full min-h-screen bg-white px-4 sm:px-6 md:px-10 py-8 flex flex-col items-center">
      {/* Volver */}
      <div className="w-full max-w-4xl mb-6 flex items-center gap-2 text-gray-700 cursor-pointer hover:text-gray-900 transition">
        <ArrowLeft className="w-5 h-5" />
        <span className="text-sm font-medium">Volver al inicio</span>
      </div>

      {/* Contenedor principal */}
      <div className="w-full max-w-4xl bg-white shadow-md rounded-2xl p-6 sm:p-8 border border-gray-200">
        <h2 className="text-2xl font-semibold text-gray-900">Estado del Incidente</h2>
        <p className="text-gray-500 text-sm mt-1">Seguimiento en tiempo real de su reporte</p>

        {/* Estado enviado */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mt-5">
          <span className="bg-purple-100 text-purple-700 text-xs font-bold py-1 px-3 rounded-md w-fit mb-2 sm:mb-0">
            SUBMITTED
          </span>
          <span className="text-gray-500 text-sm">11/8/2025, 22:13:09</span>
        </div>

        <div className="mt-5 bg-gray-50 border border-gray-200 rounded-lg p-4 text-gray-700 text-sm">
          Incidente <span className="font-semibold">INC-1754968389375</span> reportado exitosamente. Se ha enviado notificación al administrador.
        </div>

        {/* Proceso del incidente */}
        <h3 className="mt-8 mb-3 text-lg font-semibold text-gray-900">Proceso del incidente:</h3>

        <div className="space-y-3">
          {[
            { label: "Incidente reportado", color: "bg-green-500 text-green-600" },
            { label: "En proceso de revisión", color: "bg-green-500 text-green-600" },
            { label: "Incidente clasificado", color: "bg-green-500 text-green-600" },
            { label: "Analizando evidencia", color: "bg-green-500 text-green-600" },
            { label: "Evidencia validada", color: "bg-gray-300 text-gray-500" },
            { label: "Incidente resuelto", color: "bg-gray-300 text-gray-500" },
            { label: "Incidente rechazado", color: "bg-gray-300 text-gray-500" },
          ].map((step, index) => (
            <div key={index} className="flex items-center gap-3">
              <span className={`w-3 h-3 rounded-full ${step.color}`}></span>
              <span className={`text-sm font-medium ${step.color.includes("green") ? "text-green-700" : "text-gray-500"}`}>
                {step.label}
              </span>
            </div>
          ))}
        </div>

        {/* Botones */}
        <div className="mt-10 flex flex-col sm:flex-row sm:gap-4 gap-3">
          <button className="w-full sm:w-auto bg-gray-100 text-gray-800 py-2 px-4 rounded-lg font-medium hover:bg-gray-200 transition text-center">
            Reportar otro incidente
          </button>

          <button className="w-full sm:w-auto bg-purple-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-purple-700 transition text-center">
            Volver al inicio
          </button>
        </div>
      </div>
    </div>
  );
};

export default Status;