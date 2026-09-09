import React, { useCallback, useEffect, useState } from "react";
import { ClipboardCheck } from "lucide-react";
import {
  getPendingStoreRooms,
  updateStoreRoom,
  type StoreRoomModerationDetail,
  type ReasonCode,
} from "../../services/storeRooms";
import { asApiError } from "../../api/errors";
import ExpedienteCard from "./ExpedienteCard";
import ApproveModal from "./ApproveModal";
import RejectModal from "./RejectModal";

type QueueState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; items: StoreRoomModerationDetail[] };

/**
 * Admin-only moderation queue at `/admin/moderacion`. One
 * `getPendingStoreRooms()` fetch on mount populates the full dossier shape
 * for every pending storeroom — every card renders always-expanded, no
 * per-card lazy fetch (decision #206).
 */
const ModeracionAdmin: React.FC = () => {
  const [queueState, setQueueState] = useState<QueueState>({ status: "loading" });

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
      <p className="text-sm text-gray-500 mb-4">
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
            className="px-5 py-2.5 rounded-xl bg-leodega-600 text-white text-sm font-medium hover:bg-leodega-700"
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
        <div className="flex flex-col gap-5">
          {queueState.items.map((item) => (
            <ExpedienteCard
              key={item.id}
              detail={item}
              onApprove={() => openDecision("approve", item)}
              onReject={() => openDecision("reject", item)}
            />
          ))}
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
