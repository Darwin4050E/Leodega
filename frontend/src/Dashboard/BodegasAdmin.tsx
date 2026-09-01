import { useState, useEffect } from 'react';
import { Search, ChevronDown } from 'lucide-react';
import BodegaDetalle from './BodegaDetalle';
import type { Bodega } from './Interfaces/SolicitudesData';
import { getStoreRooms, type StoreRoomSummary } from '../services/storeRooms';

const BodegasAdmin = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'name'>('newest');
    const [mostrarMenuOrden, setMostrarMenuOrden] = useState(false);
    const [bodegaSeleccionada, setBodegaSeleccionada] = useState<Bodega | null>(null);
    const [mostrarDetalle, setMostrarDetalle] = useState(false);


    const [bodegas, setBodegas] = useState<Bodega[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchBodegas = async () => {
            try {
                const { data } = await getStoreRooms();
                
                const mapped: Bodega[] = data.map((store: StoreRoomSummary) => ({
                    id: store.id,
                    nameBodega: store.title,
                    bodega: store.id,
                    phoneNumber: store.landlord?.user?.phone ?? '-',
                    email: store.landlord?.user?.email ?? '-',
                    country: store.city,
                    status:
                        store.publication_status === 'approved' ? 'Active' : 'Inactive',
                }));
                setBodegas(mapped);
            } catch (error) {
                console.error('Error fetching bodegas:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchBodegas();
    }, []);

    if (loading) {
        return <div className="p-6">Cargando bodegas...</div>;
    }

    const totalPages = 40;
    const bodegasFiltradas = bodegas.filter((bodega) => {
        const coincideBusqueda =
            bodega.nameBodega.toLowerCase().includes(searchTerm.toLowerCase()) ||
            bodega.bodega.toString().includes(searchTerm) ||
            bodega.phoneNumber.includes(searchTerm) ||
            bodega.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
            bodega.country.toLowerCase().includes(searchTerm.toLowerCase()) ||
            bodega.status.toLowerCase().includes(searchTerm.toLowerCase());

        return coincideBusqueda;
    });

    const bodegasOrdenadas = [...bodegasFiltradas].sort((a, b) => {
        if (sortBy === 'newest') {
            return b.id - a.id;
        } else if (sortBy === 'oldest') {
            return a.id - b.id;
        } else if (sortBy === 'name') {
            return a.nameBodega.localeCompare(b.nameBodega);
        }
        return 0;
    });

    const getSortLabel = () => {
        switch (sortBy) {
            case 'newest':
                return 'Newest';
            case 'oldest':
                return 'Oldest';
            case 'name':
                return 'Name A-Z';
            default:
                return 'Newest';
        }
    };

    const handleBodegaClick = (bodega: Bodega) => {
        setBodegaSeleccionada(bodega);
        setMostrarDetalle(true);
    };

    const handleVolverABodegas = () => {
        setMostrarDetalle(false);
        setBodegaSeleccionada(null);
    };

    if (mostrarDetalle && bodegaSeleccionada) {
        return (
            <BodegaDetalle
                bodega={bodegaSeleccionada}
                onVolver={handleVolverABodegas}
            />
        );
    }

    return (
        <div className="pl-8 pt-5 pr-8 bg-[#f5f6fa] min-h-screen">
            <div className="mb-6 mt-3 flex flex-row justify-between">
                <h1 className="text-2xl font-semibold text-gray-900 pt-3">Bodegas</h1>
                <div className="flex items-center gap-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                        <input
                            type="text"
                            placeholder="Search"
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
                            <span className="text-sm text-gray-600">Short by:</span>
                            <span className="text-sm font-medium text-gray-900">{getSortLabel()}</span>
                            <ChevronDown className="w-4 h-4 text-gray-400" />
                        </button>

                        {mostrarMenuOrden && (
                            <>
                                <button
                                    type="button"
                                    aria-label="Cerrar menú de orden"
                                    className="fixed inset-0 z-[1] cursor-default bg-transparent"
                                    onClick={() => setMostrarMenuOrden(false)}
                                ></button>

                                <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-[2]">
                                    <button
                                        onClick={() => {
                                            setSortBy('newest');
                                            setMostrarMenuOrden(false);
                                        }}
                                        className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 rounded-t-lg transition-colors ${sortBy === 'newest' ? 'text-purple-600 font-medium bg-purple-50' : 'text-gray-700'
                                            }`}
                                    >
                                        Newest
                                    </button>
                                    <button
                                        onClick={() => {
                                            setSortBy('oldest');
                                            setMostrarMenuOrden(false);
                                        }}
                                        className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors ${sortBy === 'oldest' ? 'text-purple-600 font-medium bg-purple-50' : 'text-gray-700'
                                            }`}
                                    >
                                        Oldest
                                    </button>
                                    <button
                                        onClick={() => {
                                            setSortBy('name');
                                            setMostrarMenuOrden(false);
                                        }}
                                        className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 rounded-b-lg transition-colors ${sortBy === 'name' ? 'text-purple-600 font-medium bg-purple-50' : 'text-gray-700'
                                            }`}
                                    >
                                        Name A-Z
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm overflow-hidden border-xl border-gray-200">
                <table className="w-full">
                    <thead className=" border-b border-gray-200">
                        <tr>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                Name Bodega
                            </th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                Bodega
                            </th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                Phone Number
                            </th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                Email
                            </th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                Country
                            </th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                Status
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                        {bodegasOrdenadas.length > 0 ? (
                            bodegasOrdenadas.map((bodega) => (
                                <tr
                                    key={bodega.id}
                                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                                    onClick={() => handleBodegaClick(bodega)}
                                >
                                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{bodega.nameBodega}</td>
                                    <td className="px-6 py-4 text-sm text-gray-900">{bodega.bodega}</td>
                                    <td className="px-6 py-4 text-sm text-gray-900">{bodega.phoneNumber}</td>
                                    <td className="px-6 py-4 text-sm text-gray-900">{bodega.email}</td>
                                    <td className="px-6 py-4 text-sm text-gray-900">{bodega.country}</td>
                                    <td className="px-6 py-4">
                                        <span
                                            className={`inline-flex px-3 py-1 text-xs font-medium rounded-md ${bodega.status === 'Active'
                                                ? 'bg-teal-100 text-teal-700'
                                                : 'bg-red-100 text-red-700'
                                                }`}
                                        >
                                            {bodega.status}
                                        </span>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={6} className="px-6 py-12 text-center text-sm text-gray-500">
                                    No se encontraron bodegas
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>

                <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-white">
                    <div className="text-sm text-gray-400">
                        Showing data 1 to 8 of 256K entries
                    </div>
                    <div className="flex items-center gap-2">
                        <button className="px-3 py-1.5 rounded hover:bg-gray-100 text-gray-600 transition-colors">
                            &lt;
                        </button>
                        <button className="px-3 py-1.5 bg-purple-600 text-white rounded font-medium">1</button>
                        <button className="px-3 py-1.5 rounded hover:bg-gray-100 text-gray-600 transition-colors">2</button>
                        <button className="px-3 py-1.5 rounded hover:bg-gray-100 text-gray-600 transition-colors">3</button>
                        <button className="px-3 py-1.5 rounded hover:bg-gray-100 text-gray-600 transition-colors">4</button>
                        <span className="px-2 text-gray-400">...</span>
                        <button className="px-3 py-1.5 rounded hover:bg-gray-100 text-gray-600 transition-colors">{totalPages}</button>
                        <button className="px-3 py-1.5 rounded hover:bg-gray-100 text-gray-600 transition-colors">
                            &gt;
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BodegasAdmin;