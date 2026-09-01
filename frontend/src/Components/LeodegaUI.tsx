import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { getStoreRoomDetail, type StoreRoomDetail } from "../services/storeRooms";
import { getReservedDates, createReservation } from "../services/reservations";
import { useAuth } from "../context/useAuth";
import { asApiError } from "../api/errors";

type ReservedRange = { start_date: string; end_date: string };

// calendario
function toDateOnlyISO(d: Date) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isDateBetween(target: string, start: string, end: string) {
  return target >= start && target <= end;
}

export default function LeodegaUI() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useAuth();

  const [data, setData] = useState<StoreRoomDetail | null>(null);
  const [openReserve, setOpenReserve] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [reservedRanges, setReservedRanges] = useState<ReservedRange[]>([]);
  const [loadingRanges, setLoadingRanges] = useState(false);

  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    getStoreRoomDetail(id as string)
      .then((res) => setData(res.data))
      .catch(console.error);
  }, [id]);

  useEffect(() => {
    if (!openReserve || !id) return;

    setLoadingRanges(true);
    setError("");

    getReservedDates(id)
      .then((res) => setReservedRanges(res.data || []))
      .catch(() => setReservedRanges([]))
      .finally(() => setLoadingRanges(false));
  }, [openReserve, id]);

  const priceMonthly = useMemo(() => {
    const p = Number(data?.prices?.[0]?.price ?? 0);
    return Number.isFinite(p) ? p : 0;
  }, [data]);

  const todayISO = useMemo(() => toDateOnlyISO(new Date()), []);

  const startDisabled = useMemo(() => {
    if (!startDate) return false;
    return reservedRanges.some((r) => isDateBetween(startDate, r.start_date, r.end_date));
  }, [startDate, reservedRanges]);

  const endDisabled = useMemo(() => {
    if (!endDate) return false;
    return reservedRanges.some((r) => isDateBetween(endDate, r.start_date, r.end_date));
  }, [endDate, reservedRanges]);

  const rangeHasOverlap = useMemo(() => {
    if (!startDate || !endDate) return false;
    return reservedRanges.some((r) => startDate <= r.end_date && endDate >= r.start_date);
  }, [startDate, endDate, reservedRanges]);

  const sendReservation = async () => {
    if (!id) return;

    setError("");

    if (!startDate || !endDate) {
      setError("Selecciona fecha de inicio y fin.");
      return;
    }

    if (startDate < todayISO) {
      setError("La fecha de inicio no puede ser anterior a hoy.");
      return;
    }

    if (endDate < startDate) {
      setError("La fecha fin no puede ser menor a la fecha inicio.");
      return;
    }

    if (startDisabled || endDisabled || rangeHasOverlap) {
      setError("Ese rango se cruza con una reserva ya confirmada. Elige otras fechas.");
      return;
    }

    try {
      setSending(true);

      await createReservation({
        store_room_id: Number(id),
        start_date: startDate,
        end_date: endDate,
        total_mount: priceMonthly,
      });

      setOpenReserve(false);
      setStartDate("");
      setEndDate("");

      alert("Solicitud enviada");
    } catch (e: unknown) {
      const err = asApiError(e);
      const status = err.response?.status;

      if (status === 401) setError("Debes iniciar sesión para reservar.");
      else if (status === 409) setError(err.response?.data?.message || "Fechas no disponibles.");
      else if (status === 422) setError("Revisa las fechas ingresadas.");
      else setError("Ocurrió un error enviando la solicitud.");
    } finally {
      setSending(false);
    }
  };

  if (!data) {
    return (
      <div className="min-h-screen bg-[#f5f6fa] flex items-center justify-center">
        <div className="bg-white border border-gray-200 rounded-xl px-6 py-4 shadow-sm text-gray-700">
          Cargando...
        </div>
      </div>
    );
  }

  const initials =
    (data.landlord?.name?.charAt(0) || "L") +
    ((data.landlord?.name?.charAt(1) || "").toUpperCase());


  const handleContactar = async () => {
    navigate("/arrendador/mensajes");

  };

  const role = user?.role ?? null;

  const handleVolver = () => {
    if (role === "landlord") navigate("/arrendador/bodegas");
    else if (role === "tenant") navigate("/storage");
    //else if (role === "admin") navigate("/admin/bodegas");
    else navigate("/login");
  };


  return (
    <div className="w-full min-h-screen bg-[#f5f6fa] text-gray-800">
      {/* Top bar */}
      <div className="w-full bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">Detalle de bodega</p>
            <h1 className="text-lg font-semibold text-gray-900">
              {data.title ?? `Bodega #${id}`}
            </h1>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleVolver}
              className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              ← Volver a mis bodegas
            </button>

            <button
              onClick={() => setOpenReserve(true)}
              className="px-4 py-2 rounded-lg bg-yellow-500 text-white hover:bg-yellow-600"
            >
              Reservar
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-3 gap-6">
          {/* Left */}
          <div className="col-span-2 space-y-6">
            {/* Images */}
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-4">
              <div className="grid grid-cols-3 gap-2" style={{ height: "280px" }}>
                <div className="col-span-2 overflow-hidden rounded-xl bg-gray-100">
                  <img
                    src={data.photos?.[0]}
                    className="h-full w-full object-cover"
                    alt="Foto principal"
                  />
                </div>
                <div className="flex flex-col space-y-2">
                  {data.photos?.slice(1, 3).map((img: string, i: number) => (
                    <div
                      key={i}
                      className="overflow-hidden rounded-xl bg-gray-100"
                      style={{ height: "calc(140px - 4px)" }}
                    >
                      <img src={img} className="h-full w-full object-cover" alt={`Foto ${i + 2}`} />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Price */}
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-purple-700 font-bold text-3xl leading-tight">
                    ${data.prices?.[0]?.price}
                    <span className="text-sm font-normal text-gray-500"> / mes</span>
                  </p>
                  <p className="text-gray-600 text-sm mt-2">
                    {data.size} m² • {data.room_type}
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => navigate(`/reportIncident/${id}`)}
                    className="px-4 py-2 rounded-lg bg-orange-500 text-white hover:bg-orange-600 text-sm"
                  >
                    Reportar
                  </button>

                  <button
                    onClick={() => setOpenReserve(true)}
                    className="px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 text-sm"
                  >
                    Enviar solicitud
                  </button>
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6">
              <h3 className="font-semibold text-gray-900 mb-2">Descripción</h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                {data.description}
              </p>
            </div>

            {/* Features */}
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Características</h3>
              <div className="grid grid-cols-3 gap-3 text-sm">
                {[data.size + " m²", "Estacionamiento", "24/7", "Internet", "CCTV", "Muelle de carga"].map((item, i) => (
                  <div
                    key={i}
                    className="border border-gray-200 rounded-xl p-3 text-gray-700 bg-gray-50 text-center"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>

            {/* Extra images */}
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Imágenes adicionales</h3>
              <div className="grid grid-cols-3 gap-4">
                {data.photos?.map((img: string, i: number) => (
                  <img
                    key={i}
                    src={img}
                    className="h-32 w-full object-cover rounded-xl bg-gray-100"
                    alt={`Extra ${i + 1}`}
                  />
                ))}
              </div>
            </div>

            {/* Specs */}
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Especificaciones técnicas</h3>
              <table className="w-full text-sm text-gray-700">
                <tbody className="[&>tr>td]:py-2">
                  <tr><td className="text-gray-500">Dimensiones</td><td>20m x 15m</td></tr>
                  <tr><td className="text-gray-500">Altura</td><td>6 metros</td></tr>
                  <tr><td className="text-gray-500">Tipo de suelo</td><td>Concreto industrial</td></tr>
                  <tr><td className="text-gray-500">Piso</td><td>2 puertas industriales</td></tr>
                  <tr><td className="text-gray-500">Iluminación</td><td>LED industrial</td></tr>
                  <tr><td className="text-gray-500">Ventilación</td><td>Natural y forzada</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Right: contact */}
          <div className="col-span-1">
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 sticky top-6">
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-purple-600 text-white flex items-center justify-center rounded-full text-2xl font-bold">
                  {initials}
                </div>
                <h2 className="font-semibold mt-3 text-gray-900">
                  {data.landlord.name} {data.landlord.lastname}
                </h2>
                <p className="text-xs text-gray-500 mt-1">Arrendador</p>

                <div className="w-full mt-4 space-y-2">
                  <button onClick={handleContactar}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg w-full text-sm hover:bg-purple-700">
                    Contactar ahora
                  </button>
                  <button onClick={handleContactar}
                    className="px-4 py-2 border border-purple-600 text-purple-700 rounded-lg w-full text-sm hover:bg-purple-50">
                    Enviar email a {data.landlord.email}
                  </button>
                </div>

                <div className="mt-5 text-xs text-gray-500 text-left w-full border-t border-gray-200 pt-4">
                  <p className="font-semibold text-gray-700 mb-2">Horario de atención</p>
                  <p>Lunes a Viernes: 08h00 - 17h00</p>
                  <p className="font-semibold text-gray-700 mt-3 mb-2">Disponibilidad</p>
                  <p>Inmediata</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal reservar */}
      {openReserve && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">Solicitud de reserva</h3>
                <p className="text-xs text-gray-500">Precio mensual: <span className="font-semibold">${priceMonthly}</span></p>
              </div>

              <button
                onClick={() => {
                  setOpenReserve(false);
                  setError("");
                }}
                className="h-9 w-9 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-500"
                aria-label="Cerrar"
              >
                ✕
              </button>
            </div>

            <div className="px-6 py-4">
              {loadingRanges ? (
                <div className="text-sm text-gray-500 mb-3">Cargando disponibilidad...</div>
              ) : (
                <div className="text-xs text-gray-500 mb-3">
                  *Fechas bloqueadas = reservas confirmadas. Si se cruza, no te deja enviar.
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <label className="text-sm text-gray-700">Fecha inicio</label>
                  <input
                    type="date"
                    min={todayISO}
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className={`w-full border rounded-xl px-3 py-2 mt-1 outline-none focus:ring-2 focus:ring-purple-200 ${startDisabled ? "border-red-400" : "border-gray-300"
                      }`}
                  />
                  {startDisabled && (
                    <p className="text-xs text-red-600 mt-1">Esta fecha está dentro de un rango reservado.</p>
                  )}
                </div>

                <div>
                  <label className="text-sm text-gray-700">Fecha fin</label>
                  <input
                    type="date"
                    min={startDate || todayISO}
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className={`w-full border rounded-xl px-3 py-2 mt-1 outline-none focus:ring-2 focus:ring-purple-200 ${endDisabled || rangeHasOverlap ? "border-red-400" : "border-gray-300"
                      }`}
                  />
                </div>

                {rangeHasOverlap && (
                  <p className="text-sm text-red-600">
                    Ese rango se cruza con fechas ya confirmadas.
                  </p>
                )}

                {error && <p className="text-sm text-red-600">{error}</p>}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex gap-2 justify-end bg-gray-50">
              <button
                onClick={() => setOpenReserve(false)}
                className="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 hover:bg-white"
                disabled={sending}
              >
                Cancelar
              </button>

              <button
                onClick={sendReservation}
                className="px-4 py-2 rounded-xl bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-60"
                disabled={sending || loadingRanges}
              >
                {sending ? "Enviando..." : "Enviar solicitud"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
