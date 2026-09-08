import React, { useCallback, useEffect, useState } from "react";
import { getDashboardSummary, getRecentActivity, type DashboardSummary, type ActivityEntry } from "../../services/dashboard";
import { asApiError } from "../../api/errors";
import MetricCard from "./MetricCard";
import ActivityFeed from "./ActivityFeed";

type SummaryState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: DashboardSummary };

type ActivityState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; entries: ActivityEntry[] };

/**
 * Admin dashboard landing at `/admin/resumen`. Two independent
 * {status}/useEffect pairs (one per endpoint), per design #197's
 * "Two independent fetch effects" decision: a failed activity fetch must
 * never blank the metric cards, and vice versa.
 */
const ResumenAdmin: React.FC = () => {
  // -- Summary metrics -------------------------------------------
  const [summaryState, setSummaryState] = useState<SummaryState>({ status: "loading" });

  const loadSummary = useCallback(async () => {
    setSummaryState({ status: "loading" });
    try {
      const { data } = await getDashboardSummary();
      setSummaryState({ status: "ready", data });
    } catch (error) {
      const apiError = asApiError(error);
      setSummaryState({
        status: "error",
        message: apiError.response?.data?.message ?? "No se pudieron cargar las métricas.",
      });
    }
  }, []);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  // -- Activity feed ----------------------------------------------
  const [activityState, setActivityState] = useState<ActivityState>({ status: "loading" });

  const loadActivity = useCallback(async () => {
    setActivityState({ status: "loading" });
    try {
      const { data } = await getRecentActivity();
      setActivityState({ status: "ready", entries: data });
    } catch (error) {
      const apiError = asApiError(error);
      setActivityState({
        status: "error",
        message: apiError.response?.data?.message ?? "No se pudo cargar la actividad reciente.",
      });
    }
  }, []);

  useEffect(() => {
    loadActivity();
  }, [loadActivity]);

  return (
    <div className="p-6 lg:p-8 bg-gray-50 min-h-full">
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-gray-900">Resumen</h1>
      </div>

      {summaryState.status === "loading" && (
        <p className="text-sm text-gray-400">Cargando métricas...</p>
      )}

      {summaryState.status === "error" && (
        <div className="bg-white rounded-2xl border border-red-200 p-5 mb-6">
          <p className="text-sm text-red-600 mb-3">{summaryState.message}</p>
          <button
            onClick={loadSummary}
            className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-medium"
          >
            Reintentar
          </button>
        </div>
      )}

      {summaryState.status === "ready" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <MetricCard label="Bodegas activas" value={summaryState.data.active_store_rooms} />
          <MetricCard
            label="Pendientes por aprobar"
            value={summaryState.data.pending_moderation}
            accent
            sub={summaryState.data.pending_moderation > 0 ? "Requieren tu revisión" : "Cola al día"}
          />
          <MetricCard label="Reservas del mes" value={summaryState.data.reservations_this_month} />
          <MetricCard label="Reportes abiertos" value={summaryState.data.open_reports} />
          <MetricCard
            label="Cuentas"
            value={summaryState.data.accounts.total}
            secondaryLabel="Bloqueadas"
            secondaryValue={summaryState.data.accounts.blocked}
          />
        </div>
      )}

      {/* Activity feed — its own independent loading/error state, so a
          failed activity fetch never blanks the metric cards above. */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <h2 className="text-[15px] font-semibold text-gray-900 mb-3.5">Actividad reciente</h2>

        {activityState.status === "loading" && (
          <p className="text-sm text-gray-400">Cargando actividad...</p>
        )}

        {activityState.status === "error" && (
          <div>
            <p className="text-sm text-red-600 mb-3">{activityState.message}</p>
            <button
              onClick={loadActivity}
              className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-medium"
            >
              Reintentar
            </button>
          </div>
        )}

        {activityState.status === "ready" && <ActivityFeed entries={activityState.entries} />}
      </div>
    </div>
  );
};

export default ResumenAdmin;
