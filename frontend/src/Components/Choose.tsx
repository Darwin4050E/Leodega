// src/components/Choose.tsx
import { DollarSign, User, Clock, MessageSquare } from "lucide-react";
import backgroundShapes from "../img/LOGO_LEODEGAISO.png"
import bodegaImage from "../img/bodegaa.webp"

const Choose = () => {
  return (
    <section className="relative w-full bg-white py-24 px-6 overflow-hidden">
      {/* Fondo geométrico con opacidad baja */}
      <img
        src={backgroundShapes}
        alt="background shapes"
        className="absolute left-0 top-0 w-[30%] opacity-15 pointer-events-none select-none"
      />

      {/* Contenedor principal */}
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center gap-10 relative z-10">
        {/* Imagen principal */}
        <div className="relative flex-1 flex justify-center">
          <img
            src={bodegaImage}
            alt="Bodega"
            className="w-full max-w-md md:max-w-lg"
          />
        </div>

        {/* Contenido de texto */}
        <div className="flex-1">
          {/* Etiqueta superior */}
          <div className="mb-4">
            <span className="bg-[#FFF3E0] text-[#E68A00] text-sm font-medium px-4 py-1 rounded-full">
              POR QUÉ ESCOGERNOS
            </span>
          </div>

          {/* Título */}
          <h2 className="text-3xl font-semibold text-gray-900 mb-10 leading-snug">
            Ofrecemos la mejor experiencia con las bodegas
          </h2>

          {/* Lista de beneficios */}
          <ul className="space-y-6">
            <li className="flex items-start gap-4">
              <div className="bg-[#6B4EFF] text-white p-3 rounded-xl">
                <DollarSign className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">
                  Precios transparentes
                </h3>
                <p className="text-gray-500 text-sm">
                  Consulta y compara precios sin costos ocultos.
                </p>
              </div>
            </li>

            <li className="flex items-start gap-4">
              <div className="bg-[#6B4EFF] text-white p-3 rounded-xl">
                <User className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">
                  Variedad de opciones
                </h3>
                <p className="text-gray-500 text-sm">
                  Encuentra bodegas de diferentes tamaños, ubicaciones y precios, todas en un solo lugar.
                </p>
              </div>
            </li>

            <li className="flex items-start gap-4">
              <div className="bg-[#6B4EFF] text-white p-3 rounded-xl">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">
                  Disponibilidad actualizada
                </h3>
                <p className="text-gray-500 text-sm">
                  Ve en tiempo real qué bodegas están libres para tus fechas.
                </p>
              </div>
            </li>

            <li className="flex items-start gap-4">
              <div className="bg-[#6B4EFF] text-white p-3 rounded-xl">
                <MessageSquare className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">
                  Mensajería directa
                </h3>
                <p className="text-gray-500 text-sm">
                  Contacta fácilmente con el arrendador para resolver dudas antes de reservar.
                </p>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
};

export default Choose;
