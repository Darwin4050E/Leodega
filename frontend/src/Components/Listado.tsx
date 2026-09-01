import React from "react";
import { useLocation } from "react-router-dom";

export default function Listado() {
  const { state } = useLocation();

  // MOCK de bodegas estilo Airbnb
  const bodegas = [
    {
      id: 1,
      title: "The People's Brownstone",
      address: "1995 Broadway, New York",
      image:
        "https://images.unsplash.com/photo-1581091870621-3a6b2782a142?q=80&w=1200",
      users: ["Richard", "Gill"],
      price: 3000,
      ratings: 4.0,
      reviews: 7,
      tags: ["Ventilación", "Estanterías", "Personal", "Iluminación interior", "Enchufes"],
      label1: "Cercana",
      label2: "Tamaño"
    },
    {
      id: 2,
      title: "Lovely room in Manhattan",
      address: "246 Mott St, New York",
      image:
        "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?q=80&w=1200",
      users: ["Roni", "Alex", "Mike"],
      price: 2440,
      ratings: 5.0,
      reviews: 14,
      tags: ["Wifi", "Kitchen", "Recycling", "Non smoking", "Parking"],
      label1: "Looking for a roommate",
      label2: "Sublet"
    },
    {
      id: 3,
      title: "Room in a boutique building",
      address: "1995 Broadway, New York",
      image:
        "https://images.unsplash.com/photo-1598300055444-ecf75bd1b548?q=80&w=1200",
      users: ["Richard", "Gill"],
      price: 3000,
      ratings: 4.0,
      reviews: 367,
      tags: ["Wifi", "Kitchen", "Heating", "Balcony", "Animal friendly"],
      label1: "New Building",
      label2: "Common Friends"
    }
  ];

  return (
    <div className="w-full min-h-screen bg-white">
      
      {/* Título + subtítulo */}
      <div className="max-w-7xl mx-auto px-6 mt-10 flex flex-col gap-1">
        <h1 className="text-3xl font-bold text-gray-900">
          Bodegas en {state?.location || "tu ubicación"}
        </h1>

        <p className="text-gray-600 text-sm">
          1248 results • {state ? `${new Date(state.startDate).toLocaleDateString()} - ${new Date(state.endDate).toLocaleDateString()}` : "Jul 14 - 25"}
        </p>
      </div>

      {/* Filtros */}
      <div className="max-w-7xl mx-auto px-6 flex items-center gap-3 mt-6">
        <button className="px-4 py-2 bg-gray-100 rounded-full text-gray-700 font-medium hover:bg-gray-200">
          Precio
        </button>
        <button className="px-4 py-2 bg-gray-100 rounded-full text-gray-700 font-medium hover:bg-gray-200">
          Tamaño
        </button>
        <button className="px-4 py-2 bg-gray-100 rounded-full text-gray-700 font-medium hover:bg-gray-200">
          Lugar
        </button>
        <button className="px-4 py-2 bg-gray-100 rounded-full text-gray-700 font-medium hover:bg-gray-200">
          More
        </button>

        <div className="ml-auto flex items-center gap-2 text-gray-700">
          <span>Compartidas</span>
          <div className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" className="sr-only" />
            <div className="w-10 h-5 bg-gray-300 rounded-full shadow-inner"></div>
            <div className="dot absolute left-0 top-0 bg-white w-5 h-5 rounded-full shadow transition"></div>
          </div>
        </div>
      </div>

      {/* Contenedor principal */}
      <div className="max-w-7xl mx-auto px-6 mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* LISTA */}
        <div className="col-span-2 flex flex-col gap-6">

          {bodegas.map((b) => (
            <div
              key={b.id}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex gap-4 hover:shadow-md transition cursor-pointer"
            >
              {/* Imagen */}
              <img
                src={b.image}
                className="w-44 h-40 rounded-xl object-cover"
              />

              {/* Info */}
              <div className="flex flex-col justify-between w-full">

                <div>
                  <h2 className="text-xl font-semibold">{b.title}</h2>
                  <p className="text-gray-500 text-sm">{b.address}</p>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-2 mt-2">
                    {b.tags.slice(0, 5).map((t, i) => (
                      <span
                        key={i}
                        className="text-xs bg-gray-100 px-2 py-1 rounded-full text-gray-600"
                      >
                        {t}
                      </span>
                    ))}
                  </div>

                  {/* Etiquetas (Cercana / Tamaño, etc) */}
                  <div className="flex gap-2 mt-2">
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                      {b.label1}
                    </span>
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                      {b.label2}
                    </span>
                  </div>
                </div>

                {/* Footer card */}
                <div className="flex justify-between items-center mt-3">
                  <div className="flex items-center gap-1">
                    <span className="font-semibold">{b.ratings}</span>
                    <span className="text-yellow-400">★★★★★</span>
                    <span className="text-gray-500 text-sm">
                      ({b.reviews} Reviews)
                    </span>
                  </div>

                  <p className="text-xl font-bold text-gray-900">
                    ${b.price}
                    <span className="text-gray-500 text-sm">/month</span>
                  </p>
                </div>
              </div>
            </div>
          ))}

        </div>

        {/* MAPA */}
        <div className="w-full h-[650px] bg-gray-200 rounded-2xl relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('https://cdn.pixabay.com/photo/2017/08/30/06/18/google-map-2692651_1280.png')] bg-cover opacity-60"></div>

          {/* Markers */}
          {[15, 16, 24, 30, 17, 19, 26, 23, 12, 44, 20].map((price, i) => (
            <div
              key={i}
              className="absolute px-3 py-1 bg-blue-600 text-white text-sm font-semibold rounded-full shadow-lg"
              style={{
                top: `${Math.random() * 85}%`,
                left: `${Math.random() * 75}%`,
              }}
            >
              ${price}
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
