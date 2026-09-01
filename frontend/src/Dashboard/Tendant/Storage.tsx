import { useEffect, useState } from "react";
import SearchBar from "../../Components/SearchBar";
import { Heart, ArrowRight, Star } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getStoreRooms } from "../../services/storeRooms";
import { rateStoreRoom } from "../../services/ratings";
import { useAuth } from "../../context/useAuth";
import { asApiError } from "../../api/errors";
import HeaderTendant from "../../Components/HeaderTendant";


type StorePrice = {
  price: number;
};

type Warehouse = {
  id: number;
  title: string;
  city: string;
  size: number;
  image: string | null;
  store_prices: StorePrice[];
  rating_avg?: number;
  rating_count?: number;
  publication_status: "approved" | "pending" | "rejected";
};

const Storage = () => {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [ratings, setRatings] = useState<Record<number, number>>({});
  const [ratedStores, setRatedStores] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);

  const navigate = useNavigate();
  const { token } = useAuth();
  const isLogged = !!token;

  const DEFAULT_IMAGE =
    "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=600&h=400&fit=crop";

  useEffect(() => {
    const fetchWarehouses = async () => {
      try {
        const res = await getStoreRooms();

        const approvedWarehouses = res.data.filter(
          (warehouse: Warehouse) =>
            warehouse.publication_status === "approved"
        );
        setWarehouses(approvedWarehouses);
      } catch (error) {
        console.error("Error al cargar bodegas:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchWarehouses();
  }, []);


  const submitRating = async (warehouse: Warehouse) => {
    const stars = ratings[warehouse.id];
    if (!stars) return;

    try {
      await rateStoreRoom({
        store_id: warehouse.id,
        stars,
        comment: "Calificación desde Storage",
      });

      updateWarehouseRating(warehouse.id, stars);
    } catch (error: unknown) {
      const err = asApiError(error);
      if (err.response?.status === 409) {
        setRatedStores((prev) => new Set(prev).add(warehouse.id));
      } else if (err.response?.status === 401) {
        alert("Debes iniciar sesión");
      } else {
        console.error("Error rating:", err.response?.data);
      }
    }
  };


  const updateWarehouseRating = (storeId: number, stars: number) => {
    setWarehouses((prev) =>
      prev.map((w) => {
        if (w.id !== storeId) return w;

        const newCount = (w.rating_count ?? 0) + 1;
        const newAvg =
          ((w.rating_avg ?? 0) * (newCount - 1) + stars) / newCount;

        return {
          ...w,
          rating_avg: Number(newAvg.toFixed(1)),
          rating_count: newCount,
        };
      })
    );

    setRatedStores((prev) => new Set(prev).add(storeId));

    setRatings((prev) => {
      const copy = { ...prev };
      delete copy[storeId];
      return copy;
    });
  };


  if (loading) {
    return (
      <section className="min-h-screen flex items-center justify-center">
        <p className="text-lg text-gray-600">Cargando bodegas...</p>
      </section>
    );
  }


  return (
    <section className="w-full min-h-screen bg-white">
      <HeaderTendant />

      <div className="mt-24">
        <SearchBar />
      </div>

      <div className="max-w-7xl mx-auto mt-16 px-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10">
        {warehouses.map((warehouse) => {
          const alreadyRated = ratedStores.has(warehouse.id);
          const currentRating =
            ratings[warehouse.id] ?? warehouse.rating_avg ?? 0;

          return (
            <div
              key={warehouse.id}
              className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden"
            >
              {/* IMAGEN */}
              <div className="relative">
                <img
                  src={warehouse.image || DEFAULT_IMAGE}
                  alt={warehouse.title}
                  className="w-full h-56 object-cover"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = DEFAULT_IMAGE;
                  }}
                />

                <button className="absolute top-3 right-3 bg-white p-2 rounded-full shadow">
                  <Heart className="w-5 h-5 text-[#FF4D6D]" />
                </button>
              </div>


              <div className="p-5 text-left">
                <h3 className="text-lg font-semibold">{warehouse.title}</h3>

                <p className="text-gray-600 text-sm">
                  {warehouse.city} • {warehouse.size} m²
                </p>

                <p className="text-[#3B82F6] font-bold mt-2">
                  ${warehouse.store_prices?.[0]?.price ?? "N/A"}
                </p>

                <div className="flex items-center mt-3 gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`w-6 h-6 ${currentRating >= star
                          ? "text-[#FFA500] fill-[#FFA500]"
                          : "text-gray-300"
                        } ${alreadyRated
                          ? "cursor-not-allowed opacity-50"
                          : "cursor-pointer"
                        }`}
                      onClick={() => {
                        if (!isLogged || alreadyRated) return;

                        setRatings((prev) => ({
                          ...prev,
                          [warehouse.id]: star,
                        }));
                      }}
                    />
                  ))}

                  <span className="text-sm text-gray-500 ml-2">
                    ({warehouse.rating_count ?? 0})
                  </span>
                </div>


                <button
                  disabled={!ratings[warehouse.id] || alreadyRated}
                  onClick={() => submitRating(warehouse)}
                  className="mt-3 w-full bg-[#FFA500] text-white py-2 rounded-lg disabled:opacity-50"
                >
                  {alreadyRated ? "Ya calificado" : "Calificar"}
                </button>

                <button
                  onClick={() => navigate(`/detalles/${warehouse.id}`)}
                  className="mt-3 w-full border py-2 rounded-lg"
                >
                  Ver bodega <ArrowRight className="inline w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default Storage;
