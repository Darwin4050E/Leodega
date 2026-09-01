import React, { useState, useEffect, useRef } from "react";
import { Star } from "lucide-react";

interface Testimonial {
  id: number;
  name: string;
  location: string;
  rating: number;
  text: string;
  image: string;
}

const testimonials: Testimonial[] = [
  {
    id: 1,
    name: "Charlie Johnson",
    location: "From New York, US",
    rating: 5,
    text: "Encontré una bodega perfecta cerca de mi casa en menos de 5 minutos. Todo el proceso de reserva fue súper fácil y rápido. ¡Muy recomendable!",
    image: "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?auto=format&fit=crop&w=600&q=80",
  },
  {
    id: 2,
    name: "Sarah Wilson",
    location: "From California, US",
    rating: 4.8,
    text: "Excelente atención y espacios muy bien cuidados. Definitivamente volveré a usar la plataforma.",
    image: "https://images.unsplash.com/photo-1544723795-3fb6469f5b39?auto=format&fit=crop&w=600&q=80",
  },
  {
    id: 3,
    name: "Carlos Pérez",
    location: "From Quito, EC",
    rating: 5,
    text: "El arrendador fue muy amable y el proceso muy rápido. ¡Todo tal como se anunciaba!",
    image: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=600&q=80",
  },
  {
    id: 4,
    name: "María González",
    location: "From Bogotá, CO",
    rating: 4.9,
    text: "Me encantó el sistema, pude reservar sin complicaciones y con excelente atención.",
    image: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?auto=format&fit=crop&w=600&q=80",
  },
];

const Testimonial = () =>   {
  const [current, setCurrent] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const nextSlide = () => {
    setCurrent((prev) => (prev + 1) % testimonials.length);
  };

  const prevSlide = () => {
    setCurrent((prev) => (prev - 1 + testimonials.length) % testimonials.length);
  };

  // 🔁 Auto-slide (opcional)
  useEffect(() => {
    const interval = setInterval(nextSlide, 7000);
    return () => clearInterval(interval);
  }, []);

  // 🎯 Centrar el elemento activo
  useEffect(() => {
    const container = containerRef.current;
    const activeCard = container?.children[current] as HTMLElement | undefined;

    if (container && activeCard) {
      const containerWidth = container.offsetWidth;
      const cardWidth = activeCard.offsetWidth;
      const cardLeft = activeCard.offsetLeft;
      const scrollPosition = cardLeft - (containerWidth - cardWidth) / 2;

      container.scrollTo({
        left: scrollPosition,
        behavior: "smooth",
      });
    }
  }, [current]);

  return (
    <section className="w-full py-20 bg-[#faf7ff] flex flex-col items-center overflow-hidden">
      {/* Encabezado */}
      <div className="text-center mb-12">
        <span className="text-sm font-semibold text-yellow-600 bg-yellow-100 px-3 py-1 rounded-full">
          TESTIMONIOS
        </span>
        <h2 className="text-3xl font-bold text-gray-800 mt-4">
          ¿Qué dice las personas de nosotros?
        </h2>
      </div>

      {/* Carrusel */}
      <div className="relative w-full max-w-6xl flex justify-center items-center">
        {/* Botón anterior */}
        <button
          onClick={prevSlide}
          className="absolute left-4 z-10 bg-white shadow-md p-2 rounded-full hover:bg-gray-50"
        >
          ‹
        </button>

        {/* Contenedor de tarjetas */}
        <div
          ref={containerRef}
          className="w-full flex overflow-x-hidden scroll-smooth px-8"
        >
          {testimonials.map((t, index) => (
            <div
              key={t.id}
              className={`flex-shrink-0 transition-all duration-500 mx-4
                ${
                  index === current
                    ? "scale-100 opacity-100"
                    : "scale-90 opacity-60"
                }
              `}
              style={{ width: "70%", minWidth: "70%" }}
            >
              <div className="bg-white rounded-2xl shadow-md overflow-hidden p-5 text-center">
                <img
                  src={t.image}
                  alt={t.name}
                  className="w-full h-56 object-cover rounded-xl mb-4"
                />
                <div className="flex justify-center mb-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`h-5 w-5 ${
                        i < Math.round(t.rating)
                          ? "fill-yellow-400 text-yellow-400"
                          : "text-gray-300"
                      }`}
                    />
                  ))}
                </div>
                <p className="text-sm text-gray-600 italic mb-4">"{t.text}"</p>
                <h3 className="text-base font-semibold text-gray-900">{t.name}</h3>
                <p className="text-xs text-gray-500">{t.location}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Botón siguiente */}
        <button
          onClick={nextSlide}
          className="absolute right-4 z-10 bg-white shadow-md p-2 rounded-full hover:bg-gray-50"
        >
          ›
        </button>
      </div>

      {/* Indicadores */}
      <div className="flex justify-center gap-2 mt-8">
        {testimonials.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            className={`w-3 h-3 rounded-full transition-colors ${
              current === i ? "bg-yellow-500" : "bg-gray-300"
            }`}
          />
        ))}
      </div>
    </section>
  );
}
export default Testimonial;