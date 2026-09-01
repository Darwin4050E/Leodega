import React from 'react';
import { MessageSquare, Home, XCircle,CalendarClock,User} from 'lucide-react';

interface SolicitudRechazadaProps {
    solicitud: {
        id: number;
        nombre: string;
    };
     razonRechazo: string;
    onVolverDashboard: () => void;
}

const SolicitudRechazada: React.FC<SolicitudRechazadaProps> = ({ 
    solicitud, razonRechazo,
    onVolverDashboard,
}) => {
    const fechaActual = new Date().toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });
    
    const horaActual = new Date().toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    });

    return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="bg-white min-h-screen p-8">
        <div className="bg-white p-4 pt-6 px-8 rounded-xl min-h-screen">
          <div className="max-w-4xl mx-auto">
            <div className="space-y-6">
              {/* Banner */}
              <div className="bg-red-50 border border-red-200 rounded-lg p-8 text-center">
                <div className="flex justify-center mb-4">
                  <div className="bg-red-100 rounded-full p-3">
                    <XCircle className="w-12 h-12 text-red-600" />
                  </div>
                </div>
                <h2 className="text-2xl font-bold text-red-800 mb-2">
                  Reporte Rechazado
                </h2>
                <p className="text-red-700">
                  El reporte fue marcado como rechazado correctamente.
                </p>
              </div>

              {/* Detalles */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <CalendarClock className="w-5 h-5 text-gray-600" />
                  <h3 className="text-xl font-semibold text-gray-900">
                    Detalles del Rechazo
                  </h3>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-start">
                    <span className="text-sm font-semibold text-gray-500">REPORTE ID:</span>
                    <span className="text-sm text-gray-900 font-medium border px-3 rounded-xl">
                      #{String(solicitud.id).padStart(5, "0")}
                    </span>
                  </div>

                  <div className="flex justify-between items-start">
                    <span className="text-sm font-semibold text-gray-500">USUARIO:</span>
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-gray-600" />
                      <span className="text-sm text-gray-900 font-medium">{solicitud.nombre}</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-start">
                    <span className="text-sm font-semibold text-gray-500">FECHA:</span>
                    <span className="text-sm text-gray-900 font-medium">
                      {fechaActual}, {horaActual}
                    </span>
                  </div>

                  <div className="pt-3 border-t border-gray-200">
                    <div className="flex items-center gap-2 mb-2">
                      <MessageSquare className="w-4 h-4 text-gray-600" />
                      <span className="text-sm font-semibold text-gray-500">RAZÓN:</span>
                    </div>
                    <p className="text-sm text-gray-800 leading-6 bg-gray-50 border border-gray-200 p-3 rounded-lg">
                      {razonRechazo}
                    </p>
                  </div>
                </div>
              </div>

              {/* Qué sucede ahora */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">
                  ¿Qué sucede ahora?
                </h3>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3">
                    <span className="text-purple-600 text-2xl mt-[-5px]">•</span>
                    <span className="text-sm text-gray-700">
                      El reporte queda registrado como <b>Rechazado</b> en el panel de administración.
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-purple-600 text-2xl mt-[-5px]">•</span>
                    <span className="text-sm text-gray-700">
                      Puedes volver a la lista de reportes y continuar revisando otros.
                    </span>
                  </li>
                </ul>
              </div>

              {/* Acciones */}
              <div className="space-y-3">
                <button
                  onClick={onVolverDashboard}
                  className="w-full bg-purple-600 text-white py-3 px-6 rounded-lg hover:bg-purple-700 transition-colors font-medium flex items-center justify-center gap-2"
                >
                  <Home size={20} />
                  Volver a Reportes
                </button>

              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SolicitudRechazada;