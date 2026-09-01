import React, { useMemo } from "react";
import { Bell, Building, Calendar, Clock, DollarSign, Mail, MapPin, Phone, User } from "lucide-react";
import type { SolicitudL } from "./Interfaces/SolicitudesLData";

interface Props {
  solicitud: SolicitudL;
  onVolver: () => void;
  onRevisarResponder: () => void;
}

const formatDateLong = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString("es-EC", { day: "2-digit", month: "long", year: "numeric" });
};

const monthsBetweenRough = (startISO: string, endISO: string) => {
  const [sy, sm, sd] = startISO.split("-").map(Number);
  const [ey, em, ed] = endISO.split("-").map(Number);
  const start = new Date(sy, sm - 1, sd);
  const end = new Date(ey, em - 1, ed);

  let months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  if (end.getDate() < start.getDate()) months -= 1;
  return Math.max(1, months);
};

const moneyUSD = (n: number) =>
  new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" }).format(n);

const statusBadge = (s: SolicitudL["status"]) => {
  if (s === "pending") return { text: "Pendiente", cls: "text-orange-600 bg-orange-50" };
  if (s === "confirmed") return { text: "Confirmada", cls: "text-green-700 bg-green-50" };
  return { text: "Rechazada", cls: "text-red-700 bg-red-50" };
};

const SolicitudNuevaL: React.FC<Props> = ({ solicitud, onVolver, onRevisarResponder }) => {
  const datos = useMemo(() => {
    const u = solicitud.tenants.user;
    const nombre = `${u.name} ${u.lastname}`;
    const bodega = solicitud.storeRooms?.title ?? `Bodega #${solicitud.storeRooms?.id}`;
    const ubicacion = [solicitud.storeRooms?.city, solicitud.storeRooms?.direction].filter(Boolean).join(" - ") || "—";
    const area = solicitud.storeRooms?.size ? `${solicitud.storeRooms.size} m²` : "—";

    const meses = monthsBetweenRough(solicitud.start_date, solicitud.end_date);
    const duracion = `${meses} mes${meses === 1 ? "" : "es"}`;

    const arriendoMensual = moneyUSD(Number(solicitud.total_mount ?? 0));
    const totalEstimado = moneyUSD(Number(solicitud.total_mount ?? 0) * meses);

    return {
      nombre,
      email: u.email,
      phone: u.phone ?? "—",
      bodega,
      ubicacion,
      area,
      duracion,
      inicio: formatDateLong(solicitud.start_date),
      fin: formatDateLong(solicitud.end_date),
      arriendoMensual,
      totalEstimado,
    };
  }, [solicitud]);

  const badge = statusBadge(solicitud.status);

  return (
    <div className="pl-8 pt-5 pr-8 bg-white">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Solicitud de Reserva</h1>
          <p className="text-sm text-gray-500">ID: LEO-{solicitud.id}</p>
        </div>
        <span className={`font-medium text-[12px] py-1 px-3 rounded-2xl ${badge.cls}`}>{badge.text}</span>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-start gap-4 mb-4">
          <div className="bg-orange-100 rounded-3xl p-2 flex-shrink-0 h-12 w-12">
            <div className="flex justify-center items-center pt-[2px] pl-[2px]">
              <Bell color="orange" size={28} />
            </div>
          </div>
          <div>
            <h2 className="text-[23px] font-bold text-gray-900 mb-1">Nueva Solicitud de Reserva</h2>
            <p className="text-gray-500 text-sm">Revisa y responde la solicitud</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Cliente */}
          <div className="border border-gray-200 rounded-lg p-5">
            <div className="flex items-center gap-2 mb-4">
              <User />
              <h3 className="text-[22px] ml-2 font-semibold text-gray-900 leading-6">Información del Cliente</h3>
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-3 pb-3">
                <div className="w-12 h-12 bg-gray-200 rounded-full flex-shrink-0" />
                <div>
                  <h4 className="font-semibold text-gray-900">{datos.nombre}</h4>
                  <span className="text-xs text-gray-500">Cliente</span>
                </div>
              </div>
              <div className="border-t border-gray-300 my-4" />
              <div className="space-y-2 pt-2">
                <div className="flex items-start text-gray-600 text-sm gap-2">
                  <Mail size={17} />
                  <span className="break-all">{datos.email}</span>
                </div>
                <div className="flex items-center text-gray-600 text-sm gap-2">
                  <Phone size={17} />
                  <span>{datos.phone}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Reserva */}
          <div className="border border-gray-200 rounded-lg p-5">
            <div className="flex items-center gap-2 mb-4">
              <Building />
              <h3 className="text-[22px] ml-2 font-semibold text-gray-900 leading-6">Detalles de la Reserva</h3>
            </div>
            <div className="space-y-4">
              <div>
                <span className="text-xs font-semibold text-gray-500 block mb-1">BODEGA</span>
                <span className="text-sm text-gray-900 font-semibold block">{datos.bodega}</span>
                <div className="flex items-center mt-1 gap-1">
                  <MapPin size={11} />
                  <span className="text-xs text-gray-500">{datos.ubicacion}</span>
                </div>
              </div>
              <div className="border-t border-gray-300 my-4" />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-xs font-semibold text-gray-500 block mb-1">ÁREA</span>
                  <span className="text-sm text-gray-900 font-semibold">{datos.area}</span>
                </div>
                <div>
                  <span className="text-xs font-semibold text-gray-500 block mb-1">DURACIÓN</span>
                  <span className="text-sm text-gray-900 font-semibold">{datos.duracion}</span>
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center text-gray-600 text-xs gap-1">
                  <Calendar size={16} className="mr-1" />
                  <span>Inicio: {datos.inicio}</span>
                </div>
                <div className="flex items-center text-gray-600 text-xs gap-1">
                  <Clock size={16} className="mr-1" />
                  <span>Fin: {datos.fin}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Financiero */}
          <div className="border border-gray-200 rounded-lg p-5">
            <div className="flex items-center gap-2 mb-4">
              <DollarSign />
              <h3 className="text-[22px] ml-2 font-semibold text-gray-900 leading-6">Información Financiera</h3>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Arriendo mensual:</span>
                <span className="text-sm text-gray-900 font-semibold">{datos.arriendoMensual}</span>
              </div>
              <div className="flex justify-between items-center pt-1">
                <span className="text-sm font-semibold text-gray-900">Total estimado:</span>
                <span className="text-lg font-bold text-gray-900">{datos.totalEstimado}</span>
              </div>
              <p className="text-xs text-gray-500">*Total estimado = mensual × duración (aprox).</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mt-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Acciones</h2>

        <div className="flex flex-col sm:flex-row gap-4">
          <button
            onClick={onRevisarResponder}
            className="text-[15px] flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200 font-medium"
            disabled={solicitud.status !== "pending"}
            title={solicitud.status !== "pending" ? "Solo puedes responder solicitudes pendientes" : ""}
          >
            Revisar y Responder
          </button>

          <button
            onClick={onVolver}
            className="text-[15px] flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors duration-200 font-medium"
          >
            Volver
          </button>
        </div>
      </div>
    </div>
  );
};

export default SolicitudNuevaL;
