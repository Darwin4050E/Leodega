import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

const Consulta = () => {
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState(
    `Hola Eduardo Vallejo, estoy interesado en la bodega "Bodega Doble Almacenaje (Centro de la Ciudad)". Me gustaría obtener más información sobre disponibilidad, precios y condiciones de alquiler.`
  );

  // Plantillas rápidas
  const setTemplate = (template: string) => {
    setMessage(template);
  };

  return (
    <div className="w-full flex justify-center px-4 py-10 bg-gray-50 min-h-screen">
      <div className="w-full max-w-4xl bg-white p-6 md:p-10 rounded-xl shadow-sm border">

        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <span className="text-purple-600 text-2xl">✉</span>
            <h2 className="text-2xl md:text-3xl font-semibold text-gray-900">
              Enviar Consulta por Email
            </h2>
          </div>

          <button
            className="text-gray-500 hover:text-gray-800 text-xl"
            onClick={() => navigate(-1)}
          >
            ✕
          </button>
        </div>

        {/* Info del contacto */}
        <div className="bg-purple-50 p-4 rounded-xl mb-8 border border-purple-100">
          <div className="flex items-center gap-3">
            {/* Iniciales */}
            <div className="w-12 h-12 rounded-full bg-purple-600 text-white flex items-center justify-center font-semibold text-lg">
              EV
            </div>

            {/* Info */}
            <div>
              <p className="font-semibold text-gray-800 text-lg">Eduardo Vallejo</p>
              <p className="text-gray-600 text-sm">Sr. Ejecutivo</p>
            </div>
          </div>

          <div className="mt-4 text-gray-700 text-sm">
            <p>
              <strong>Para:</strong> eduardo@leodega.com
            </p>
            <p className="mt-1">
              <strong>Asunto:</strong> Consulta sobre Bodega Doble Almacenaje (Centro de la Ciudad)
            </p>
          </div>
        </div>

        {/* Formulario */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Nombre */}
          <div className="flex flex-col">
            <label className="font-medium text-gray-700 mb-1">
              Nombre completo *
            </label>
            <input
              className="border rounded-lg p-3 focus:ring-purple-500 focus:border-purple-500 outline-none"
              type="text"
              placeholder="Tu nombre completo"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Email */}
          <div className="flex flex-col">
            <label className="font-medium text-gray-700 mb-1">Email *</label>
            <input
              className="border rounded-lg p-3 focus:ring-purple-500 focus:border-purple-500 outline-none"
              type="email"
              placeholder="tu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          {/* Teléfono */}
          <div className="flex flex-col md:col-span-2">
            <label className="font-medium text-gray-700 mb-1">
              Teléfono (opcional)
            </label>
            <input
              className="border rounded-lg p-3 focus:ring-purple-500 focus:border-purple-500 outline-none"
              type="text"
              placeholder="+593 99 123 4567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
        </div>

        {/* Mensaje */}
        <div className="mt-6">
          <label className="font-medium text-gray-700 mb-1">Mensaje *</label>
          <textarea
            className="w-full h-40 border rounded-lg p-3 focus:ring-purple-500 focus:border-purple-500 outline-none resize-none"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          ></textarea>
        </div>

        {/* Plantillas rápidas */}
        <div className="flex flex-wrap gap-3 mt-4">
          <button
            onClick={() =>
              setTemplate("Hola, quisiera solicitar una visita para ver la bodega.")
            }
            className="px-4 py-2 border rounded-lg bg-white hover:bg-gray-100 text-gray-800 text-sm"
          >
            Solicitar visita
          </button>

          <button
            onClick={() =>
              setTemplate("Hola, podría indicarme el precio actual de la bodega?")
            }
            className="px-4 py-2 border rounded-lg bg-white hover:bg-gray-100 text-gray-800 text-sm"
          >
            Consultar precio
          </button>

          <button
            onClick={() =>
              setTemplate(
                "Hola, me gustaría saber si la bodega está disponible en este momento."
              )
            }
            className="px-4 py-2 border rounded-lg bg-white hover:bg-gray-100 text-gray-800 text-sm"
          >
            Consultar disponibilidad
          </button>
        </div>

        {/* Botones */}
        <div className="flex flex-col md:flex-row gap-4 mt-8">
          <button
            className="w-full md:w-1/2 bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-lg transition font-medium flex items-center justify-center gap-2"
          >
            ✉ Enviar Consulta
          </button>

          <button
            onClick={() => navigate(-1)}
            className="w-full md:w-1/2 bg-gray-100 hover:bg-gray-200 text-gray-800 py-3 rounded-lg transition font-medium"
          >
            Cancelar
          </button>
        </div>

      </div>
    </div>
  );
};

export default Consulta;
