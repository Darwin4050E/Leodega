import React from "react";
import { ChevronDown, Mail, MapPin, Check, X as XIcon } from "lucide-react";
import type {
  StoreRoomQueueItem,
  StoreRoomModerationDetail,
} from "../../services/storeRooms";
import MiniMap from "./MiniMap";
import PermitRow from "./PermitRow";
import Lightbox from "./Lightbox";

export type DetailState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: StoreRoomModerationDetail };

const ROOM_TYPE_LABEL: Record<string, string> = {
  habitacion: "Habitación",
  garaje: "Garaje / Parqueadero",
  contenedor: "Contenedor",
  sotano: "Sótano",
  atico: "Ático",
  bodega: "Bodega independiente",
};

const STORAGE_TYPE_LABEL: Record<string, string> = {
  completa: "Bodega completa",
  privado: "Espacio privado",
  compartido: "Espacio compartido",
};

const CANCELLATION_LABEL: Record<string, string> = {
  flexible: "Flexible",
  moderada: "Moderada",
  estricta: "Estricta",
};

const SECURITY_LABEL: Record<"camara" | "ruido" | "control" | "acceso", string> = {
  camara: "Cámara de seguridad exterior",
  ruido: "Monitor de ruido / decibeles",
  control: "Control de plagas y humedad",
  acceso: "Acceso restringido 24/7",
};

const REASON_LABEL: Record<string, string> = {
  fotos: "Fotos incorrectas",
  info: "Información incoherente",
  permiso: "Permiso inválido",
  otro: "Otro motivo",
};

const HISTORY_STATUS_LABEL: Record<string, string> = {
  approved: "Aprobada",
  pending: "Pendiente",
  rejected: "Rechazada",
};

interface ExpedienteCardProps {
  item: StoreRoomQueueItem;
  expanded: boolean;
  detailState: DetailState;
  onToggle: () => void;
  onRetry: () => void;
  children?: React.ReactNode;
}

/**
 * One dossier in the moderation queue. Starts collapsed (summary fields
 * from the queue payload only); the detail fetch fires on first expand,
 * owned by the parent container — this card only reports the intent.
 */
const ExpedienteCard: React.FC<ExpedienteCardProps> = ({
  item,
  expanded,
  detailState,
  onToggle,
  onRetry,
  children,
}) => {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-gray-50 transition-colors"
        aria-expanded={expanded}
      >
        <div className="w-14 h-14 rounded-lg bg-gray-100 flex-shrink-0 overflow-hidden">
          {item.image && (
            <img src={item.image} alt={item.title} className="w-full h-full object-cover" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-gray-900 truncate">{item.title}</h3>
          <p className="text-sm text-gray-500">
            {item.city} · {item.size} m² · Enviada {item.submitted_at}
          </p>
          <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
            <Mail size={12} /> {item.landlord.name ?? "—"} ({item.landlord.email ?? "sin correo"})
          </p>
        </div>
        <ChevronDown
          size={20}
          className={`text-gray-400 flex-shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </button>

      {expanded && (
        <div className="border-t border-gray-100 px-5 py-5">
          {detailState.status === "loading" && (
            <p className="text-sm text-gray-500 py-6 text-center">Cargando expediente…</p>
          )}

          {detailState.status === "error" && (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <p className="text-sm text-red-600">{detailState.message}</p>
              <button
                type="button"
                onClick={onRetry}
                className="px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-700"
              >
                Reintentar
              </button>
            </div>
          )}

          {detailState.status === "ready" && (
            <ExpedienteBody detail={detailState.data}>{children}</ExpedienteBody>
          )}
        </div>
      )}
    </div>
  );
};

interface ExpedienteBodyProps {
  detail: StoreRoomModerationDetail;
  children?: React.ReactNode;
}

const ExpedienteBody: React.FC<ExpedienteBodyProps> = ({ detail, children }) => {
  const hasCoords = detail.latitude !== null && detail.longitude !== null;
  const sortedHistory = [...detail.moderation_history].sort(
    (a, b) => new Date(b.moderation_date).getTime() - new Date(a.moderation_date).getTime(),
  );

  return (
    <div className="space-y-6">
      <section>
        <p className="text-xs uppercase tracking-wide text-gray-400 mb-2">Fotos</p>
        <Lightbox photos={detail.photos} />
      </section>

      <section className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Field label="Gestor" value={detail.landlord.name ?? "—"} />
        <Field label="Correo" value={detail.landlord.email ?? "—"} />
        <Field label="Tipo de espacio" value={ROOM_TYPE_LABEL[detail.room_type ?? ""] ?? "—"} />
        <Field label="Almacenamiento" value={STORAGE_TYPE_LABEL[detail.storage_type ?? ""] ?? "—"} />
        <Field label="Tamaño" value={`${detail.size} m²`} />
        <Field label="Enviada" value={detail.submitted_at} />
      </section>

      {detail.description && (
        <section>
          <p className="text-xs uppercase tracking-wide text-gray-400 mb-1">Descripción</p>
          <p className="text-sm text-gray-600 leading-relaxed">{detail.description}</p>
        </section>
      )}

      <section>
        <p className="text-xs uppercase tracking-wide text-gray-400 mb-2">Ubicación</p>
        {hasCoords ? (
          <MiniMap latitude={detail.latitude} longitude={detail.longitude} />
        ) : (
          <p className="text-sm text-gray-600 flex items-center gap-2">
            <MapPin size={14} className="text-gray-400" />
            {detail.direction ?? "—"}, {detail.city}
          </p>
        )}
      </section>

      <section className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 space-y-1">
        <Row label="Precio mensual" value={`$${detail.monthly_price}`} />
        <Row label="Tarifa Leodega" value={`$${detail.leodega_fee}`} />
        <Row label="El gestor recibe" value={`$${detail.landlord_share}`} emphasis />
      </section>

      <section>
        <p className="text-xs uppercase tracking-wide text-gray-400 mb-2">Política de cancelación</p>
        <span className="inline-flex items-center rounded-full bg-purple-50 text-purple-700 text-xs font-semibold px-3 py-1">
          {detail.cancellation_policy_tier
            ? CANCELLATION_LABEL[detail.cancellation_policy_tier] ?? detail.cancellation_policy_tier
            : "No declarada"}
        </span>
      </section>

      <section>
        <p className="text-xs uppercase tracking-wide text-gray-400 mb-2">Seguridad del espacio</p>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(SECURITY_LABEL) as Array<keyof typeof SECURITY_LABEL>).map((key) => {
            const on = detail.security[key];
            return (
              <span
                key={key}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium border ${
                  on
                    ? "bg-green-50 border-green-200 text-green-700"
                    : "bg-gray-50 border-gray-200 text-gray-400"
                }`}
              >
                {on ? <Check size={12} /> : <XIcon size={12} />}
                {SECURITY_LABEL[key]}
              </span>
            );
          })}
        </div>
      </section>

      <section>
        <p className="text-xs uppercase tracking-wide text-gray-400 mb-2">Documentación</p>
        <PermitRow storeRoomId={detail.id} permitAttached={detail.permit_attached} />
      </section>

      {sortedHistory.length > 0 && (
        <section>
          <p className="text-xs uppercase tracking-wide text-gray-400 mb-2">Historial de moderación</p>
          <ul className="space-y-2">
            {sortedHistory.map((entry) => (
              <li
                key={`${entry.status}-${entry.moderation_date}`}
                className="rounded-lg border border-gray-100 px-3 py-2 text-xs text-gray-600"
              >
                <p className="font-semibold text-gray-800">
                  {HISTORY_STATUS_LABEL[entry.status] ?? entry.status} · {entry.moderation_date}
                </p>
                {entry.reason_code && (
                  <p>Motivo: {REASON_LABEL[entry.reason_code] ?? entry.reason_code}</p>
                )}
                {entry.reason_rejected && <p>Comentario: {entry.reason_rejected}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {children}
    </div>
  );
};

const Field: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <p className="text-[11px] text-gray-400 mb-0.5">{label}</p>
    <p className="text-sm font-semibold text-gray-900 break-words">{value}</p>
  </div>
);

const Row: React.FC<{ label: string; value: string; emphasis?: boolean }> = ({
  label,
  value,
  emphasis,
}) => (
  <div className="flex justify-between text-xs">
    <span className="text-gray-500">{label}</span>
    <span className={emphasis ? "font-bold text-purple-700" : "text-gray-700"}>{value}</span>
  </div>
);

export default ExpedienteCard;
