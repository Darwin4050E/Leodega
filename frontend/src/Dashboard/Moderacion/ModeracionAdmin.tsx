import React, { useCallback, useEffect, useState } from "react";
import { ClipboardCheck } from "lucide-react";
import {
  getPendingStoreRooms,
  getModerationDetail,
  updateStoreRoom,
  type StoreRoomQueueItem,
  type StoreRoomModerationDetail,
  type ReasonCode,
} from "../../services/storeRooms";
import { asApiError } from "../../api/errors";
import ExpedienteCard, { type DetailState } from "./ExpedienteCard";
import ApproveModal from "./ApproveModal";
import RejectModal from "./RejectModal";

type QueueState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; items: StoreRoomQueueItem[] };

/**
 * Admin-only moderation queue at `/admin/moderacion`. Fetches the pending
 * queue once on mount; each expediente's full detail is fetched lazily on
 * first expand and cached — this is what avoids an N+1 burst on mount.
 */
const ModeracionAdmin: React.FC = () => {
  const [queueState, setQueueState] = useState<QueueState>({ status: "loading" });
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [details, setDetails] = useState<Record<number, DetailState>>({});

  // Decision flows (approve/reject) — PR3.
  const [decision, setDecision] = useState<
    { type: "approve" | "reject"; detail: StoreRoomModerationDetail } | null
  >(null);
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const loadQueue = useCallback(async () => {
    setQueueState({ status: "loading" });
    try {
      const { data } = await getPendingStoreRooms();
      setQueueState({ status: "ready", items: data });
    } catch (error) {
      const apiError = asApiError(error);
      setQueueState({
        status: "error",
        message: apiError.response?.data?.message ?? "No se pudo cargar la cola de moderación.",
      });
    }
  }, []);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  const fetchDetail = useCallback(async (id: number) => {
    setDetails((prev) => ({ ...prev, [id]: { status: "loading" } }));
    try {
      const { data } = await getModerationDetail(id);
      setDetails((prev) => ({ ...prev, [id]: { status: "ready", data } }));
    } catch (error) {
      const apiError = asApiError(error);
      setDetails((prev) => ({
        ...prev,
        [id]: {
          status: "error",
          message: apiError.response?.data?.message ?? "No se pudo cargar el expediente.",
        },
      }));
    }
  }, []);

  const handleToggle = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });

    const current = details[id];
    if (!current || current.status === "idle") {
      fetchDetail(id);
    }
  };

  const handleRetryDetail = (id: number) => {
    fetchDetail(id);
  };

  // Decision flows (approve/reject) — PR3.
  // Pessimistic update: the queue is only refetched after a confirmed 200
  // response; on failure the dialog stays open and the error surfaces
  // inline inside it via `asApiError`, matching `UsuariosAdmin.tsx`'s
  // `confirmarBloqueo` shape.
  const openDecision = (type: "approve" | "reject", detail: StoreRoomModerationDetail) => {
    setDecisionError(null);
    setDecision({ type, detail });
  };

  const closeDecisionModal = () => {
    setDecision(null);
    setDecisionError(null);
  };

  const confirmApprove = async (waiverAcknowledged: boolean) => {
    if (!decision) return;
    const { id } = decision.detail;
    try {
      await updateStoreRoom(
        id,
        waiverAcknowledged
          ? { publication_status: "approved", permit_waiver_acknowledged: true }
          : { publication_status: "approved" },
      );
      setDecision(null);
      setDecisionError(null);
      setAviso("Bodega aprobada correctamente.");
      await loadQueue();
    } catch (error) {
      const apiError = asApiError(error);
      setDecisionError(apiError.response?.data?.message ?? "No se pudo aprobar la bodega.");
    }
  };

  const confirmReject = async (reasonCode: ReasonCode, comment: string) => {
    if (!decision) return;
    const { id } = decision.detail;
    try {
      await updateStoreRoom(id, {
        publication_status: "rejected",
        reason_code: reasonCode,
        reason_rejected: reasonCode === "otro" ? comment : null,
      });
      setDecision(null);
      setDecisionError(null);
      setAviso("Bodega rechazada correctamente.");
      await loadQueue();
    } catch (error) {
      const apiError = asApiError(error);
      setDecisionError(apiError.response?.data?.message ?? "No se pudo rechazar la bodega.");
    }
  };

  return (
    <div className="px-4 lg:pl-8 lg:pr-8 pt-5 pb-10 bg-[#f5f6fa] min-h-screen">
      <h1 className="text-2xl font-semibold text-gray-900 mb-1">Moderación de bodegas</h1>
      <p className="text-sm text-gray-500 mb-6">
        Revisa cada expediente antes de aprobar o rechazar una publicación.
      </p>

      {aviso && (
        <div
          role="status"
          className="mb-4 rounded-lg border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-800"
        >
          {aviso}
        </div>
      )}

      {queueState.status === "loading" && (
        <div className="p-6 text-gray-500">Cargando cola de moderación…</div>
      )}

      {queueState.status === "error" && (
        <div className="bg-white rounded-2xl border border-dashed border-red-200 p-10 text-center">
          <p className="text-sm text-red-600 mb-4">{queueState.message}</p>
          <button
            type="button"
            onClick={loadQueue}
            className="px-5 py-2.5 rounded-xl bg-purple-600 text-white text-sm font-medium hover:bg-purple-700"
          >
            Reintentar
          </button>
        </div>
      )}

      {queueState.status === "ready" && queueState.items.length === 0 && (
        <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-green-100 flex items-center justify-center mx-auto mb-4">
            <ClipboardCheck className="text-green-600" size={26} />
          </div>
          <p className="text-base font-semibold text-gray-900 mb-1">Cola al día</p>
          <p className="text-sm text-gray-500">
            No hay bodegas pendientes de verificación. Vuelve más tarde.
          </p>
        </div>
      )}

      {queueState.status === "ready" && queueState.items.length > 0 && (
        <div className="flex flex-col gap-4">
          {queueState.items.map((item) => {
            const detailState = details[item.id] ?? { status: "idle" };
            return (
              <ExpedienteCard
                key={item.id}
                item={item}
                expanded={expandedIds.has(item.id)}
                detailState={detailState}
                onToggle={() => handleToggle(item.id)}
                onRetry={() => handleRetryDetail(item.id)}
              >
                {/* Decision actions (approve/reject) — PR3. */}
                {detailState.status === "ready" && (
                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => openDecision("approve", detailState.data)}
                      className="flex-1 py-2.5 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700"
                    >
                      Aprobar
                    </button>
                    <button
                      type="button"
                      onClick={() => openDecision("reject", detailState.data)}
                      className="flex-1 py-2.5 rounded-xl border border-red-300 bg-red-50 text-red-700 text-sm font-semibold hover:bg-red-100"
                    >
                      Rechazar
                    </button>
                  </div>
                )}
              </ExpedienteCard>
            );
          })}
        </div>
      )}

      {/* Decision modals — PR3. */}
      {decision && (
        <>
          <ApproveModal
            isOpen={decision.type === "approve"}
            title={decision.detail.title}
            permitAttached={decision.detail.permit_attached}
            error={decisionError}
            onClose={closeDecisionModal}
            onConfirm={confirmApprove}
          />
          <RejectModal
            isOpen={decision.type === "reject"}
            title={decision.detail.title}
            error={decisionError}
            onClose={closeDecisionModal}
            onConfirm={confirmReject}
          />
        </>
      )}
    </div>
  );
};

export default ModeracionAdmin;
