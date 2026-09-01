import { Heart, Star, ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getStoreRooms, type StoreRoomSummary } from "../services/storeRooms";

const PopularStorage = () => {
  const navigate = useNavigate();
  const [bodegas, setBodegas] = useState<StoreRoomSummary[]>([]);

  useEffect(() => {
    getStoreRooms()
      .then(res => {
        const approved = res.data.filter(
          (bodega: StoreRoomSummary) => bodega.publication_status === "approved"
        )

        const topRated = [...approved]
          .sort((a, b) => (b.rating_avg ?? 0) - (a.rating_avg ?? 0))
          .slice(0, 3);

        setBodegas(topRated);
      })
      .catch(console.error);
  }, []);

  return (
    <section className="w-full bg-white py-14 px-6 text-center">
      <div className="mb-4">
        <span className="bg-[#F5E8FF] text-[#A855F7] text-sm font-medium px-4 py-1 rounded-full">
          BODEGAS POPULARES
        </span>
      </div>

      <h2 className="text-3xl font-semibold text-gray-900 mb-16">
        Las ofertas de las bodegas más populares
      </h2>

      <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10">
        {bodegas.map((bodega) => (
          <div
            key={bodega.id}
            className="bg-white rounded-2xl shadow-md overflow-hidden hover:shadow-lg transition"
          >
            <div className="relative">
              <img
                src={bodega.image}
                alt={bodega.title}
                className="w-full h-56 object-cover"
              />
              <button className="absolute top-3 right-3 bg-white p-2 rounded-full shadow-sm">
                <Heart className="w-5 h-5 text-[#FF4D6D]" />
              </button>
            </div>

            <div className="p-5 text-left">
              <h3 className="text-lg font-semibold text-gray-900">
                {bodega.title}
              </h3>

              <p className="text-[#3B82F6] font-semibold mt-1">
                ${bodega.store_prices?.[0]?.price ?? "—"} USD
              </p>

              <div className="flex items-center mt-2 text-sm text-gray-600">
                <div className="flex items-center text-[#FFA500]">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`w-4 h-4 ${i < Math.round(bodega.rating_avg ?? 0) ? "fill-current" : ""}`}
                    />
                  ))}
                </div>
                <span className="ml-2 text-gray-500">
                  ({bodega.rating_count ?? 0})
                </span>
              </div>

              <button
                onClick={() => navigate(`/detalles/${bodega.id}`)}
                className="mt-5 bg-gray-100 text-gray-800 font-medium py-2 px-4 rounded-lg hover:bg-gray-200 transition"
              >
                Ver Bodega
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-14">
        <button
          onClick={() => {
            window.scrollTo(0, 0);
            navigate("/storage");
          }}
          className="flex items-center gap-2 mx-auto bg-white border border-gray-300 shadow-sm hover:shadow-md px-5 py-2 rounded-lg font-medium text-gray-800 transition"
        >
          Mostrar todas las bodegas
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </section>
  );
};

export default PopularStorage;
