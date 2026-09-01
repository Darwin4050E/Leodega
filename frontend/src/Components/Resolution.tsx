import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

const Resolution = () => {
  const navigate = useNavigate();
  const [comments, setComments] = useState("");

  const handleResolve = () => {
    alert("Has marcado el incidente como resuelto.");
  };

  const handleReject = () => {
    alert("Has indicado que el problema persiste.");
  };

  return (
    <div className="w-full flex justify-center px-4 py-10 bg-gray-50 min-h-screen">
      
      <div className="w-full max-w-4xl bg-white p-6 md:p-10 rounded-xl shadow-sm border">
        
        {/* Volver */}
        <button
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
          onClick={() => navigate(-1)}
        >
          <span className="text-xl">←</span>
          Volver al inicio
        </button>

        {/* Título */}
        <h2 className="text-2xl md:text-3xl font-semibold text-gray-900 mb-2">
          Decisión sobre Resolución del Incidente
        </h2>

        <p className="text-gray-600 mb-6">
          Incidente: <span className="font-medium">INC-1754968403392</span>
        </p>

        {/* Estado */}
        <div className="p-4 bg-gray-50 border rounded-lg mb-6 flex items-start gap-3">
          <span className="text-green-600 text-xl">✔</span>
          <div>
            <p className="font-semibold text-gray-800">
              El incidente ha sido resuelto por el administrador.
            </p>
            <p className="text-gray-600 text-sm mt-1">
              Por favor, confirme si está de acuerdo con la resolución propuesta o si considera que el problema persiste.
            </p>
          </div>
        </div>

        {/* Resolución propuesta */}
        <div className="mb-6">
          <h3 className="font-semibold text-gray-800 mb-2">Resolución propuesta:</h3>
          <div className="p-4 bg-gray-100 rounded-lg text-gray-700">
            El problema reportado ha sido identificado y solucionado. Se han tomado las medidas correctivas necesarias para evitar que vuelva a ocurrir.
          </div>
        </div>

        {/* Comentarios */}
        <div className="mb-6">
          <h3 className="font-semibold text-gray-800 mb-2">
            Comentarios adicionales (opcional)
          </h3>
          <textarea
            className="w-full h-28 p-3 border rounded-lg focus:border-purple-500 focus:ring-purple-500 outline-none resize-none"
            placeholder="Proporcione cualquier comentario sobre la resolución o el servicio recibido..."
            value={comments}
            onChange={(e) => setComments(e.target.value)}
          ></textarea>
        </div>

        {/* Botones */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <button
            onClick={handleResolve}
            className="w-full md:w-1/2 bg-green-600 hover:bg-green-700 text-white font-medium py-3 rounded-lg transition"
          >
            Marcar como resuelto
          </button>

          <button
            onClick={handleReject}
            className="w-full md:w-1/2 bg-red-600 hover:bg-red-700 text-white font-medium py-3 rounded-lg transition"
          >
            Cerrar sin solución
          </button>
        </div>

        {/* Nota */}
        <div className="bg-gray-50 border rounded-lg p-4 text-sm text-gray-600">
          <strong>Nota:</strong> Si marca como resuelto, el incidente se cerrará definitivamente. Si elige "Cerrar sin solución", el incidente se archivará y podrá reportar uno nuevo si el problema persiste.
        </div>
      </div>
    </div>
  );
};

export default Resolution;
