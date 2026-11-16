import { useEffect, useState } from 'react';
import { Search, ChevronDown, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { getStoreRoomsByLandlord, type StoreRoomRejection } from "../services/storeRooms";
import { useAuth } from "../context/useAuth";
import BodegaCard from './BodegaCard';
import { PUBLICATION_STATUS_LABEL } from '../utils/storeRoomLabels';

interface StorePrice {
  id: number;
  store_room_id: number;
  mode: string;
  price: number;
  disponibility: boolean;
}

interface Bodega {
  id: number;
  title: string;
  direction: string;
  city: string;
  size: string;
  publication_status: string;
  storage_type: string;
  room_type: string;
  image?: string;
  storePrices?: StorePrice[];
  active_reservations_count?: number;
  rejection?: StoreRoomRejection | null;
}

type StatusFilter = 'all' | 'approved' | 'pending' | 'occupied' | 'rejected';

// "Ocupada" is derived, not stored: an approved room that has active or
// future reservations. It is exclusive with "Aprobada" so counts add up.
const matchesFilter = (b: Bodega, filter: StatusFilter) => {
  const occupied = b.publication_status === 'approved' && (b.active_reservations_count ?? 0) > 0;
  switch (filter) {
    case 'all': return true;
    case 'occupied': return occupied;
    case 'approved': return b.publication_status === 'approved' && !occupied;
    default: return b.publication_status === filter;
  }
};

const BodegasArrendador = () => {
  const [bodegas, setBodegas] = useState<Bodega[]>([]);
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'name'>('newest');
  const [mostrarMenuOrden, setMostrarMenuOrden] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const { user } = useAuth();
  const landlordId = user?.landlord?.id || "";

  useEffect(() => {
    const fetchStore = async () => {
      try {
        const response = await getStoreRoomsByLandlord(landlordId);
        const data = response.data.map((b: Omit<Bodega, 'storePrices'> & { store_prices?: StorePrice[] }) => ({
          ...b,
          storePrices: b.store_prices,
        }));
        setBodegas(data);
      } catch (error) {
        console.error("Error al obtener bodegas:", error);
      } finally {
        setLoading(false);
      }
    };
    if (landlordId) fetchStore();
  }, [landlordId]);

  const handleBodegaDeleted = (id: number) => {
    setBodegas((prev) => prev.filter((bodega) => bodega.id !== id));
  };

  const bodegasFiltradas = bodegas.filter((bodega) =>
    matchesFilter(bodega, statusFilter) && (
    bodega.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    bodega.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
    bodega.publication_status.toLowerCase().includes(searchTerm.toLowerCase())
  ));

  const bodegasOrdenadas = [...bodegasFiltradas].sort((a, b) => {
    if (sortBy === 'newest') return b.id - a.id;
    if (sortBy === 'oldest') return a.id - b.id;
    if (sortBy === 'name') return a.title.localeCompare(b.title);
    return 0;
  });

  const statusChips: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: 'Todas' },
    { key: 'approved', label: `${PUBLICATION_STATUS_LABEL.approved}s` },
    { key: 'pending', label: 'Pendientes' },
    { key: 'occupied', label: 'Ocupadas' },
    { key: 'rejected', label: 'Rechazadas' },
  ];

  const getSortLabel = () => {
    switch (sortBy) {
      case 'newest': return 'Nuevo';
      case 'oldest': return 'Antiguo';
      case 'name': return 'Nombre A-Z';
      default: return 'Nuevo';
    }
  };

  const renderContent = () => {
    if (loading) {
      return <div className="text-center py-10 text-gray-500">Cargando bodegas...</div>;
    }

    if (bodegasOrdenadas.length === 0) {
      return <div className="text-center py-10 text-gray-500">No se encontraron bodegas</div>;
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {bodegasOrdenadas.map((bodega) => {
          return (
            <BodegaCard
              key={bodega.id}
              {...bodega}
              onDeleted={() => handleBodegaDeleted(bodega.id)}
            />
          );
        })}

      </div>
    );
  };

  return (
    <div className="px-4 lg:pl-8 lg:pr-8 pt-5 bg-[#f5f6fa] min-h-screen">
      <div className="mb-6 flex flex-row justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Mis bodegas</h1>
          <p className="text-sm text-gray-500 mt-1">
            Gestiona tus espacios publicados y su estado de verificación.
          </p>
        </div>
        <div className="lg:hidden flex items-center gap-2">
          <button
            onClick={() => setShowMobileSearch(!showMobileSearch)}
            className="p-2.5 bg-white border border-gray-300 rounded-lg"
            title="Buscar"
          >
            <Search className="w-5 h-5 text-gray-400" />
          </button>

          <button
            onClick={() => navigate("/preguntainicio1", { state: { from: location.pathname } })}
            className="p-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium transition-colors"
            title="Nueva Bodega"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        <div className="hidden lg:flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar por nombre o sector"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white w-80 text-sm"
            />
          </div>

          <div className="relative">
            <button
              onClick={() => setMostrarMenuOrden(!mostrarMenuOrden)}
              className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 bg-white transition-colors"
            >
              <span className="text-sm text-gray-600">Ordenar por:</span>
              <span className="text-sm font-medium text-gray-900">{getSortLabel()}</span>
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </button>

            {mostrarMenuOrden && (
              <>
                <button
                  type="button"
                  aria-label="Cerrar menú de ordenamiento"
                  className="fixed inset-0 z-[1] cursor-default bg-transparent"
                  onClick={() => setMostrarMenuOrden(false)}
                />
                <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-[2]">
                  {(['newest', 'oldest', 'name'] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => {
                        setSortBy(type);
                        setMostrarMenuOrden(false);
                      }}
                      className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 ${sortBy === type ? 'text-purple-600 font-medium bg-purple-50' : 'text-gray-700'
                        }`}
                    >
                      {type === 'newest' ? 'Más recientes' :
                        type === 'oldest' ? 'Más antiguos' :
                          'Nombre A-Z'}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <button
            onClick={() => navigate("/PreguntaInicio1")}
            className="px-6 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium transition-colors"
          >
            Añadir Nueva Bodega
          </button>
        </div>
      </div>

      {showMobileSearch && (
        <div className="lg:hidden mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar por nombre o sector"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white text-sm"
            />
          </div>
        </div>
      )}

      <div className="lg:hidden mb-4">
        <button
          onClick={() => setMostrarMenuOrden(!mostrarMenuOrden)}
          className="w-full flex items-center justify-between px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 bg-white transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Ordenar por:</span>
            <span className="text-sm font-medium text-gray-900">{getSortLabel()}</span>
          </div>
          <ChevronDown className="w-4 h-4 text-gray-400" />
        </button>

        {mostrarMenuOrden && (
          <div className="mt-2 bg-white border border-gray-200 rounded-lg shadow-lg">
            <button
              onClick={() => {
                setSortBy('newest');
                setMostrarMenuOrden(false);
              }}
              className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 rounded-t-lg transition-colors ${sortBy === 'newest' ? 'text-purple-600 font-medium bg-purple-50' : 'text-gray-700'
                }`}
            >
              Más recientes primero
            </button>
            <button
              onClick={() => {
                setSortBy('oldest');
                setMostrarMenuOrden(false);
              }}
              className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors ${sortBy === 'oldest' ? 'text-purple-600 font-medium bg-purple-50' : 'text-gray-700'
                }`}
            >
              Más antiguos primero
            </button>
            <button
              onClick={() => {
                setSortBy('name');
                setMostrarMenuOrden(false);
              }}
              className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 rounded-b-lg transition-colors ${sortBy === 'name' ? 'text-purple-600 font-medium bg-purple-50' : 'text-gray-700'
                }`}
            >
              Nombre A-Z
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2 mb-5">
        {statusChips.map(({ key, label }) => {
          const count = bodegas.filter((b) => matchesFilter(b, key)).length;
          const selected = statusFilter === key;
          return (
            <button
              key={key}
              type="button"
              aria-pressed={selected}
              onClick={() => setStatusFilter(key)}
              className={`px-3.5 py-1.5 rounded-full text-sm font-medium border transition-colors ${selected
                ? 'bg-purple-600 text-white border-purple-600'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
            >
              {label} <span className={selected ? 'text-purple-100' : 'text-gray-400'}>{count}</span>
            </button>
          );
        })}
      </div>

      {renderContent()}
    </div>
  );
};

export default BodegasArrendador;