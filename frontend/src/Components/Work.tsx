// src/components/Work.tsx
import { CalendarDays, MapPin, Car } from "lucide-react";

const Work = () => {
  return (
    <section className="w-full bg-white py-8 my-8 px-4">
      {/* Etiqueta superior */}
      <div className="text-center mb-6">
        <span className="bg-[#FFF3E0] text-[#E68A00] text-sm font-medium px-4 py-1 rounded-full">
          CÓMO TRABAJAMOS
        </span>
      </div>

      {/* Título principal */}
      <h2 className="text-center text-3xl font-semibold text-gray-900 mb-16">
        Alquila con los siguientes 3 pasos
      </h2>

      {/* Pasos */}
      <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-14 text-center">
        {/* Paso 1 */}
        <div>
          <div className="flex justify-center mb-6">
            <div className="bg-[#FFB800] p-6 rounded-2xl shadow-md">
              <MapPin className="text-white w-10 h-10" />
            </div>
          </div>
          <h3 className="text-lg font-semibold text-gray-900">
            Escoge la ubicación
          </h3>
          <p className="text-gray-500 text-sm mt-3">
            Escoge y busca la mejor bodega
          </p>
        </div>

        {/* Paso 2 */}
        <div>
          <div className="flex justify-center mb-6">
            <div className="bg-[#FFB800] p-6 rounded-2xl shadow-md">
              <CalendarDays className="text-white w-10 h-10" />
            </div>
          </div>
          <h3 className="text-lg font-semibold text-gray-900">
            Fecha de Inicio
          </h3>
          <p className="text-gray-500 text-sm mt-3">
            Selecciona tu fecha y hora de inicio para reservar la bodega
          </p>
        </div>

        {/* Paso 3 */}
        <div>
          <div className="flex justify-center mb-6">
            <div className="bg-[#FFB800] p-6 rounded-2xl shadow-md">
              <Car className="text-white w-10 h-10" />
            </div>
          </div>
          <h3 className="text-lg font-semibold text-gray-900">
            Reserva tu bodega
          </h3>
          <p className="text-gray-500 text-sm mt-3">
            Reserva tu bodega y ponte en contacto con el arrendador
          </p>
        </div>
      </div>
    </section>
  );
};

export default Work;
