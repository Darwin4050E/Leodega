import React, { useEffect, useState } from 'react';
import { Filter, RotateCcw } from 'lucide-react';
import { getReports } from '../services/reports';
import type { ReportListItem } from '../services/reports';
import SolicitudNueva from './SolicitudNueva';
import SolicitudRevisarResponder from './SolicitudRevisarResponder';
import SolicitudRechazada from './SolicitudRechazada';
import type { Solicitud } from './Interfaces/SolicitudesData';

const Solicitudes: React.FC = () => {
    const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
    const [loading, setLoading] = useState(true);

    const [searchTerm, setSearchTerm] = useState('');
    const [filtroFecha, setFiltroFecha] = useState('');
    const [filtroTipo, setFiltroTipo] = useState('');
    const [filtroEstado, setFiltroEstado] = useState('');

    const [solicitudSeleccionada, setSolicitudSeleccionada] = useState<Solicitud | null>(null);
    const [mostrarSolicitudNueva, setMostrarSolicitudNueva] = useState(false);
    const [mostrarRevisarResponder, setMostrarRevisarResponder] = useState(false);
    const [mostrarSolicitudRechazada, setMostrarSolicitudRechazada] = useState(false);
    const [razonRechazo, setRazonRechazo] = useState('');

    // =========================
    // CARGAR REPORTES
    // =========================
    const fetchReports = async () => {
        try {
            setLoading(true);
            const { data } = await getReports();

            const mapped: Solicitud[] = data.map((r: ReportListItem) => ({
                id: r.id,
                nombre: r.user?.name ?? 'Usuario desconocido',
                email: r.user?.email ?? '',
                direccion: r.store?.direction ?? 'Sin dirección',
                fecha: new Date(r.created_at).toLocaleDateString(),
                tipo: r.report_type,
                estado:
                    r.status === 'resolved'
                        ? 'Completada'
                        : r.status === 'canceled'
                            ? 'Rechazada'
                            : 'En proceso',
            }));

            setSolicitudes(mapped);
        } catch (error) {
            console.error('Error cargando reportes', error);
        } finally {
            setLoading(false);
        }
    };
    useEffect(() => {
        fetchReports();
    }, []);

    // =========================
    // FILTROS
    // =========================
    const solicitudesFiltradas = solicitudes.filter((s) => {
        const coincideBusqueda =
            s.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.direccion.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.tipo.toLowerCase().includes(searchTerm.toLowerCase());

        const coincideFecha = filtroFecha === '' || s.fecha.includes(filtroFecha);
        const coincideTipo = filtroTipo === '' || s.tipo === filtroTipo;
        const coincideEstado = filtroEstado === '' || s.estado === filtroEstado;

        return coincideBusqueda && coincideFecha && coincideTipo && coincideEstado;
    });

    const obtenerClaseEstado = (estado: string) => {
        const base =
            'inline-flex items-center justify-center px-4 py-1.5 text-xs font-semibold rounded-full whitespace-nowrap min-w-[110px]';

        switch (estado) {
            case 'Completada':
                return `${base} bg-green-100 text-green-700`;
            case 'En proceso':
                return `${base} bg-yellow-100 text-yellow-700`;
            case 'Rechazada':
                return `${base} bg-red-100 text-red-700`;
            default:
                return `${base} bg-gray-100 text-gray-700`;
        }
    };


    const reiniciarFiltros = () => {
        setFiltroFecha('');
        setFiltroTipo('');
        setFiltroEstado('');
        setSearchTerm('');
    };

    // =========================
    // NAVEGACIÓN
    // =========================
    const handleRowClick = (s: Solicitud) => {
        setSolicitudSeleccionada(s);
        setMostrarSolicitudNueva(true);
    };

    const volver = () => {
        setMostrarSolicitudNueva(false);
        setMostrarRevisarResponder(false);
        setMostrarSolicitudRechazada(false);
        setSolicitudSeleccionada(null);
        setRazonRechazo('');
        fetchReports();
    };

    if (mostrarSolicitudRechazada && solicitudSeleccionada) {
        return (
            <SolicitudRechazada
                solicitud={solicitudSeleccionada}
                razonRechazo={razonRechazo}
                onVolverDashboard={volver}
            />
        );
    }

    if (mostrarRevisarResponder && solicitudSeleccionada) {
        return (
            <SolicitudRevisarResponder
                solicitud={solicitudSeleccionada}
                onVolver={volver}
                onRechazar={(r) => {
                    setRazonRechazo(r);
                    setMostrarSolicitudRechazada(true);
                }}

            />
        );
    }

    if (mostrarSolicitudNueva && solicitudSeleccionada) {
        return (
            <SolicitudNueva
                solicitud={solicitudSeleccionada}
                onVolver={volver}
                onRevisarResponder={(s) => {
                    setSolicitudSeleccionada(s);
                    setMostrarRevisarResponder(true);
                }}
            />
        );
    }

    if (loading) {
        return <div className="p-6">Cargando reportes...</div>;
    }



    // =========================
    // UI
    // =========================
    return (
        <div className="px-4 lg:pl-8 lg:pr-8 pt-5 bg-[#f5f6fa] min-h-screen">
            <h1 className="text-2xl font-semibold text-gray-900 mb-6">Reportes</h1>

            {/* FILTROS DESKTOP */}
            <div className="hidden md:inline-flex items-center gap-3 pl-4 pr-4 bg-white border border-gray-200 rounded-xl shadow-sm mb-6">
                <Filter className="w-5 h-5 text-gray-600" />

                <select value={filtroFecha} onChange={(e) => setFiltroFecha(e.target.value)}
                    className="px-4 py-2 bg-white border-0 text-sm font-medium text-gray-700">
                    <option value="">Fecha</option>
                    <option value="2025">2025</option>
                    <option value="2026">2026</option>
                </select>

                <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}
                    className="px-4 py-2 bg-white border-0 text-sm font-medium text-gray-700">
                    <option value="">Tipo</option>
                    <option value="Acceso">Acceso</option>
                    <option value="Seguridad">Seguridad</option>
                    <option value="Infraestructura">Infraestructura</option>
                </select>

                <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}
                    className="px-4 py-2 bg-white border-0 text-sm font-medium text-gray-700">
                    <option value="">Estado</option>
                    <option value="En proceso">En proceso</option>
                    <option value="Completada">Completada</option>
                    <option value="Rechazada">Rechazada</option>
                </select>

                <button onClick={reiniciarFiltros}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600">
                    <RotateCcw className="w-4 h-4" />
                    Reiniciar
                </button>
            </div>

            {/* TABLA */}
            <div className="bg-white rounded-lg shadow-sm overflow-hidden border border-gray-200">
                <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                            {['ID', 'USUARIO', 'DIRECCIÓN', 'FECHA', 'TIPO', 'ESTADO'].map(h => (
                                <th key={h} className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">
                                    {h}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {solicitudesFiltradas.map((s) => (
                            <tr
                                key={s.id}
                                onClick={() => handleRowClick(s)}
                                className="hover:bg-gray-50 cursor-pointer"
                            >
                                <td className="px-6 py-4">{s.id.toString().padStart(5, '0')}</td>
                                <td className="px-6 py-4">{s.nombre}</td>
                                <td className="px-6 py-4">{s.direccion}</td>
                                <td className="px-6 py-4">{s.fecha}</td>
                                <td className="px-6 py-4">{s.tipo}</td>
                                <td className="px-6 py-4">
                                    <span className={`px-3 py-1 text-xs font-medium rounded-md ${obtenerClaseEstado(s.estado)}`}>
                                        {s.estado}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                <div className="flex justify-between px-6 py-4 border-t text-sm text-gray-500">
                    Mostrando {solicitudesFiltradas.length} reportes
                </div>
            </div>
        </div>
    );
};

export default Solicitudes;
