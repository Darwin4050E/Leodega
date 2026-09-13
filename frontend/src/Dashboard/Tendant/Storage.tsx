import { useEffect, useState } from "react";
import axios from "axios";
import SearchBar, { type SearchBarFilters } from "../../Components/SearchBar";
import StorageMap from "../../Components/StorageMap";
import { Heart, ArrowRight, Star, List, Map as MapIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getStoreRooms, type StoreRoomFilters, type StoreRoomSummary } from "../../services/storeRooms";
import { rateStoreRoom } from "../../services/ratings";
import { useAuth } from "../../context/useAuth";
import { asApiError } from "../../api/errors";
import HeaderTendant from "../../Components/HeaderTendant";

type Warehouse = StoreRoomSummary;

const NO_RESULTS_MESSAGE =
  "No encontramos bodegas disponibles con esos criterios. Intenta ampliar tu búsqueda";

const Storage = () => {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [ratings, setRatings] = useState<Record<number, number>>({});
  const [ratedStores, setRatedStores] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<StoreRoomFilters>({});
  const [view, setView] = useState<"list" | "map">("list");

  const navigate = useNavigate();
  const { token } = useAuth();
  const isLogged = !!token;

  const DEFAULT_IMAGE =
    "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=600&h=400&fit=crop";

  const fetchWarehouses = async (appliedFilters?: StoreRoomFilters) => {
    setLoading(true);
    try {
      const res = await getStoreRooms(appliedFilters);

      const approvedWarehouses = res.data.filter(
        (warehouse: Warehouse) => warehouse.publication_status === "approved"
      );
      setWarehouses(approvedWarehouses);
    } catch (error) {
      console.error("Error al cargar bodegas:", error);
      setWarehouses([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWarehouses();
  }, []);

  const geocodeLocation = async (location: string): Promise<{ lat: number; lng: number } | null> => {
    try {
      const res = await axios.get(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=ec&q=${encodeURIComponent(location)}`
      );
      const first = res.data?.[0];
      if (!first) return null;

      const lat = Number.parseFloat(first.lat);
      const lng = Number.parseFloat(first.lon);
      if (Number.isNaN(lat) || Number.isNaN(lng)) return null;

      return { lat, lng };
    } catch (error) {
      // Nominatim can be rate-limited or unreachable; the search must still
      // proceed with the size/price filters instead of failing entirely.
      console.error("Error al geolocalizar la ubicación:", error);
      return null;
    }
  };

  const handleSearch = async (searchFilters: SearchBarFilters) => {
    const nextFilters: StoreRoomFilters = {};

    if (searchFilters.minSize) nextFilters.min_size = Number(searchFilters.minSize);
    if (searchFilters.minPrice) nextFilters.min_price = Number(searchFilters.minPrice);
    if (searchFilters.maxPrice) nextFilters.max_price = Number(searchFilters.maxPrice);

    if (searchFilters.location.trim()) {
      const coords = await geocodeLocation(searchFilters.location.trim());
      if (coords) {
        nextFilters.lat = coords.lat;
        nextFilters.lng = coords.lng;
      }
    }

    setFilters(nextFilters);
    fetchWarehouses(nextFilters);
  };

  const handleClearFilters = () => {
    setFilters({});
    fetchWarehouses();
  };

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

  const hasActiveFilters = Object.keys(filters).length > 0;

  return (
    <section className="w-full min-h-screen bg-white">
      <HeaderTendant />

      <div className="mt-24">
        <SearchBar onSearch={handleSearch} />
      </div>

      <div className="max-w-7xl mx-auto mt-16 px-4">
        <div className="flex items-center justify-end gap-2 mb-6">
          <button
            onClick={() => setView("list")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${
              view === "list" ? "bg-purple-600 text-white" : "bg-gray-100 text-gray-700"
            }`}
          >
            <List className="w-4 h-4" /> Lista
          </button>
          <button
            onClick={() => setView("map")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${
              view === "map" ? "bg-purple-600 text-white" : "bg-gray-100 text-gray-700"
            }`}
          >
            <MapIcon className="w-4 h-4" /> Mapa
          </button>
        </div>

        {warehouses.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
            <p className="text-gray-600 text-lg">{NO_RESULTS_MESSAGE}</p>
            {hasActiveFilters && (
              <button
                onClick={handleClearFilters}
                className="px-6 py-2 rounded-lg bg-purple-600 text-white font-semibold"
              >
                Limpiar filtros
              </button>
            )}
          </div>
        ) : view === "map" ? (
          <StorageMap
            rooms={warehouses.map((w) => ({
              id: w.id,
              title: w.title,
              monthly_price: w.monthly_price,
              latitude: w.latitude ?? null,
              longitude: w.longitude ?? null,
            }))}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10">
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
                      {warehouse.distance_km != null && ` • ${warehouse.distance_km.toFixed(1)} km`}
                    </p>

                    <p className="text-[#3B82F6] font-bold mt-2">
                      {warehouse.monthly_price != null ? `$${warehouse.monthly_price}/mes` : "N/A"}
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
        )}
      </div>
    </section>
  );
};

export default Storage;
