import React, { useEffect, useMemo, useState } from "react";
import { Filter, RotateCcw } from "lucide-react";
import { getLandlordReservations } from "../services/reservations";
import type { SolicitudL } from "./Interfaces/SolicitudesLData";
import SolicitudNuevaL from "./SolicitudNuevaL";
import SolicitudRevisarResponderL from "./SolicitudRevisarResponderL";

const statusText = (s: SolicitudL["status"]) =>
    s === "pending" ? "Pendiente" : s === "confirmed" ? "Confirmada" : "Rechazada";

const statusClass = (estado: string) => {
    const base =
        "inline-flex items-center justify-center px-4 py-1.5 text-xs font-semibold rounded-full whitespace-nowrap min-w-[110px]";
    if (estado === "Confirmada") return `${base} bg-green-100 text-green-700`;
    if (estado === "Pendiente") return `${base} bg-yellow-100 text-yellow-700`;
    if (estado === "Rechazada") return `${base} bg-red-100 text-red-700`;
    return `${base} bg-gray-100 text-gray-700`;
};

const SolicitudesL: React.FC = () => {
    const [solicitudes, setSolicitudes] = useState<SolicitudL[]>([]);
    const [loading, setLoading] = useState(true);

    const [searchTerm, setSearchTerm] = useState("");
    const [filtroEstado, setFiltroEstado] = useState<"" | "Pendiente" | "Confirmada" | "Rechazada">("");

    const [seleccionada, setSeleccionada] = useState<SolicitudL | null>(null);
    const [mostrarDetalle, setMostrarDetalle] = useState(false);
    const [mostrarRevisar, setMostrarRevisar] = useState(false);

    useEffect(() => {
        const fetchSolicitudes = async () => {
            try {
                const { data } = await getLandlordReservations();
                setSolicitudes(data);
            } catch (error) {
                console.error("Error cargando solicitudes landlord", error);
            } finally {
                setLoading(false);
            }
        };
        fetchSolicitudes();
    }, []);

    const reiniciarFiltros = () => {
        setFiltroEstado("");
        setSearchTerm("");
    };

    const filtradas = useMemo(() => {
        return solicitudes.filter((s) => {
            const cliente = `${s.tenants?.user?.name ?? ""} ${s.tenants?.user?.lastname ?? ""}`.toLowerCase();
            const bodega = `${s.storeRooms?.title ?? ""} ${s.storeRooms?.direction ?? ""}`.toLowerCase();
            const estado = statusText(s.status);

            const coincideBusqueda =
                cliente.includes(searchTerm.toLowerCase()) || bodega.includes(searchTerm.toLowerCase());

            const coincideEstado = filtroEstado === "" || estado === filtroEstado;

            return coincideBusqueda && coincideEstado;
        });
    }, [solicitudes, searchTerm, filtroEstado]);

    const handleRowClick = (s: SolicitudL) => {
        setSeleccionada(s);
        setMostrarDetalle(true);
    };

    const volver = () => {
        setMostrarDetalle(false);
        setMostrarRevisar(false);
        setSeleccionada(null);
    };

    const actualizarSolicitud = (updated: SolicitudL) => {
        setSeleccionada(updated);
        setSolicitudes((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
    };

    
    if (mostrarRevisar && seleccionada) {
        return (
            <SolicitudRevisarResponderL
                solicitud={seleccionada}
                onVolver={volver}
                onActualizarSolicitud={actualizarSolicitud}
                onRevisarDetalles={() => setMostrarDetalle(true)}
            />
        );
    }

    if (mostrarDetalle && seleccionada) {
        return (
            <SolicitudNuevaL
                solicitud={seleccionada}
                onVolver={volver}
                onRevisarResponder={() => setMostrarRevisar(true)}
            />
        );
    }

    if (loading) return <div className="p-6">Cargando solicitudes...</div>;

    return (
        <div className="px-4 lg:pl-8 lg:pr-8 pt-5 bg-[#f5f6fa] min-h-screen">
            <h1 className="text-2xl font-semibold text-gray-900 mb-6">Solicitudes</h1>

            
            <div className="hidden md:inline-flex items-center gap-3 pl-4 pr-4 bg-white border border-gray-200 rounded-xl shadow-sm mb-6">
                <Filter className="w-5 h-5 text-gray-600" />

                <input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="px-4 py-2 bg-white border-0 text-sm font-medium text-gray-700 outline-none"
                    placeholder="Buscar cliente o bodega..."
                />

                <select
                    value={filtroEstado}
                    onChange={(e) => setFiltroEstado(e.target.value as "" | "Pendiente" | "Confirmada" | "Rechazada")}
                    className="px-4 py-2 bg-white border-0 text-sm font-medium text-gray-700"
                >
                    <option value="">Estado</option>
                    <option value="Pendiente">Pendiente</option>
                    <option value="Confirmada">Confirmada</option>
                    <option value="Rechazada">Rechazada</option>
                </select>

                <button onClick={reiniciarFiltros} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600">
                    <RotateCcw className="w-4 h-4" />
                    Reiniciar
                </button>
            </div>

            
            <div className="bg-white rounded-lg shadow-sm overflow-hidden border border-gray-200">
                <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                            {["ID", "CLIENTE", "BODEGA/DIRECCIÓN", "INICIO", "FIN", "ESTADO"].map((h) => (
                                <th key={h} className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">
                                    {h}
                                </th>
                            ))}
                        </tr>
                    </thead>

                    <tbody className="divide-y divide-gray-200">
                        {filtradas.map((s) => {
                            const cliente = `${s.tenants?.user?.name ?? ""} ${s.tenants?.user?.lastname ?? ""}`.trim() || "—";
                            const bodega = s.storeRooms?.title ?? `Bodega #${s.storeRooms?.id}`;
                            const direccion = s.storeRooms?.direction ?? "";
                            const estado = statusText(s.status);

                            return (
                                <tr key={s.id} onClick={() => handleRowClick(s)} className="hover:bg-gray-50 cursor-pointer">
                                    <td className="px-6 py-4">{String(s.id).padStart(5, "0")}</td>
                                    <td className="px-6 py-4">{cliente}</td>
                                    <td className="px-6 py-4">{direccion ? `${bodega} - ${direccion}` : bodega}</td>
                                    <td className="px-6 py-4">{s.start_date}</td>
                                    <td className="px-6 py-4">{s.end_date}</td>
                                    <td className="px-6 py-4">
                                        <span className={statusClass(estado)}>{estado}</span>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>

                <div className="flex justify-between px-6 py-4 border-t text-sm text-gray-500">
                    Mostrando {filtradas.length} solicitudes
                </div>
            </div>
        </div>
    );
};

export default SolicitudesL;
