import { useEffect, useMemo, useState } from "react";
import { Calendar } from "lucide-react";

import HeaderTendant from "../../Components/HeaderTendant";
import { getTenantReservations, type TenantReservation } from "../../services/reservations";
import { asApiError } from "../../api/errors";
import { deriveTenantTab, type TenantTab } from "../../utils/reservationVigencia";
import ReservationCard from "./ReservationCard";
import CancelarReservaTenantModal from "./CancelarReservaTenantModal";

const RES_TABS: { key: TenantTab; label: string }[] = [
  { key: "activa", label: "Activas" },
  { key: "finalizada", label: "Finalizadas" },
  { key: "cancelada", label: "Canceladas" },
];

/**
 * Container for the tenant "Mis reservas" screen. Mirrors
 * TenantReservasPage (PrototipoLeodega-main/js/TenantReservasPage.jsx:223-311)
 * minus review/report actions (out of scope, spec #351). Fetches the list,
 * derives three tab buckets via `deriveTenantTab`, and renders
 * `ReservationCard[]` + empty states, plus the cancel modal on card click.
 */
const MisReservas = () => {
  const [reservations, setReservations] = useState<TenantReservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string>("");
  const [tab, setTab] = useState<TenantTab>("activa");
  const [cancelingReservation, setCancelingReservation] = useState<TenantReservation | null>(null);

  const load = () => {
    setLoading(true);
    setLoadError("");
    getTenantReservations()
      .then((res) => setReservations(res.data))
      .catch((error) => {
        const apiError = asApiError(error);
        setReservations([]);
        setLoadError(apiError.response?.data?.message || "No se pudieron cargar las reservas.");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const buckets = useMemo(() => {
    const grouped: Record<TenantTab, TenantReservation[]> = {
      activa: [],
      finalizada: [],
      cancelada: [],
    };
    reservations.forEach((r) => {
      grouped[deriveTenantTab(r)].push(r);
    });
    return grouped;
  }, [reservations]);

  const counts = {
    activa: buckets.activa.length,
    finalizada: buckets.finalizada.length,
    cancelada: buckets.cancelada.length,
  };

  const list = buckets[tab];
  const activeTabLabel = RES_TABS.find((t) => t.key === tab)?.label.toLowerCase() ?? "";

  const handleCancelled = () => {
    setCancelingReservation(null);
    setTab("cancelada");
    load();
  };

  /**
   * Design decision #4: 409 (stale eligibility) or a 404 at confirm both
   * mean "nothing was cancelled, the list is out of date" -- close the
   * modal and refetch so `can_be_cancelled`/tab placement come from fresh
   * server data. No automatic retry of the mutating call itself.
   */
  const handleNeedsRefresh = () => {
    setCancelingReservation(null);
    load();
  };

  return (
    <>
      <HeaderTendant />
      <div className="px-8 py-7 bg-[#F5F6FA] min-h-screen">
        <div className="mb-5">
          <h1 className="text-2xl font-bold text-gray-900 m-0 mb-1">Mis reservas</h1>
          <p className="text-sm text-gray-500 m-0">
            Gestiona tus alquileres y consulta el estado de tus reservas.
          </p>
        </div>

        <div className="flex gap-1.5 mb-5 border-b border-gray-200">
          {RES_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`relative px-1 py-2.5 mr-4.5 border-none bg-transparent text-sm flex items-center gap-2 ${
                tab === t.key ? "font-bold text-[#7551E9]" : "font-medium text-gray-500"
              }`}
            >
              {t.label}
              <span
                className={`text-[11px] font-bold min-w-[20px] h-5 rounded-full inline-flex items-center justify-center px-1.5 ${
                  tab === t.key ? "bg-[#EDE9FE] text-[#7551E9]" : "bg-gray-100 text-gray-400"
                }`}
              >
                {counts[t.key]}
              </span>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-10 text-gray-500">Cargando reservas...</div>
        ) : loadError ? (
          <div className="text-center py-10">
            <p className="text-red-600 mb-3">{loadError}</p>
            <button
              onClick={load}
              className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-semibold"
            >
              Reintentar
            </button>
          </div>
        ) : list.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-gray-300 px-6 py-14 text-center max-w-lg mx-auto">
            <div className="w-16 h-16 rounded-full bg-[#F5F3FF] flex items-center justify-center mx-auto mb-4.5">
              <Calendar size={28} color="#7551E9" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 m-0 mb-2">
              Aún no tienes reservas {tab !== "activa" ? activeTabLabel : ""}
            </h3>
            <p className="text-sm text-gray-500 mb-5">
              Explora el catálogo y reserva tu bodega al instante.
            </p>
            <a
              href="/storage"
              role="button"
              className="inline-block px-6 py-2.5 bg-[#7551E9] text-white rounded-lg text-sm font-semibold no-underline"
            >
              Explorar catálogo
            </a>
          </div>
        ) : (
          <div className="flex flex-col gap-4 max-w-3xl">
            {list.map((r) => (
              <ReservationCard key={r.id} reservation={r} onCancelClick={setCancelingReservation} />
            ))}
          </div>
        )}
      </div>

      {cancelingReservation && (
        <CancelarReservaTenantModal
          reservation={cancelingReservation}
          onClose={() => setCancelingReservation(null)}
          onCancelled={handleCancelled}
          onNeedsRefresh={handleNeedsRefresh}
        />
      )}
    </>
  );
};

export default MisReservas;
