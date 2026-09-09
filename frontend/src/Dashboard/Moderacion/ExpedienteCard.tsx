import React, { useState } from "react";
import { Mail, MapPin, Check, X as XIcon, ChevronDown, ChevronUp } from "lucide-react";
import type { StoreRoomModerationDetail } from "../../services/storeRooms";
import MiniMap from "./MiniMap";
import PermitRow from "./PermitRow";
import Lightbox from "./Lightbox";

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

const CANCELLATION_POLICY: Record<string, { label: string; description: string }> = {
  flexible: {
    label: "Flexible",
    description: "Cancelación hasta 24 h antes con reembolso completo.",
  },
  moderada: {
    label: "Moderada",
    description: "Reembolso completo hasta 5 días antes; luego cargo parcial.",
  },
  estricta: {
    label: "Estricta",
    description: "Sin reembolso con menos de 30 días de anticipación.",
  },
};

const SECURITY_LABEL: Record<"camara" | "ruido" | "control" | "acceso", string> = {
  camara: "Cámara de seguridad exterior",
  ruido: "Monitor de ruido / decibeles",
  control: "Control de plagas y humedad",
  acceso: "Acceso restringido 24/7",
};

function initials(name: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

interface RowProps {
  label: string;
  value: React.ReactNode;
}

/** Label/value row — matches the prototype's `ADRow` (`AdminPanel.jsx:397-402`). */
const Row: React.FC<RowProps> = ({ label, value }) => (
  <div className="flex justify-between gap-4 py-2 border-b border-gray-100">
    <span className="text-sm text-gray-400 flex-shrink-0">{label}</span>
    <span className="text-sm font-semibold text-gray-900 text-right break-words">{value}</span>
  </div>
);

interface ExpedienteCardProps {
  detail: StoreRoomModerationDetail;
  onApprove: () => void;
  onReject: () => void;
}

/**
 * One always-expanded dossier card, matching the prototype's
 * `ADExpediente` (`AdminPanel.jsx:404-505`). Pure presentational: no
 * internal expand/collapse state, no lazy detail fetch — the parent
 * container feeds the full `StoreRoomModerationDetail` straight from the
 * single queue request.
 */
const ExpedienteCard: React.FC<ExpedienteCardProps> = ({ detail, onApprove, onReject }) => {
  const hasCoords = detail.latitude !== null && detail.longitude !== null;
  const policy = detail.cancellation_policy_tier
    ? CANCELLATION_POLICY[detail.cancellation_policy_tier]
    : undefined;

  /**
   * Collapsed by default so the screen reads as a work queue: the header band
   * stays visible for every storeroom and the dossier opens on demand.
   *
   * This is purely presentational — every field is already in memory, because
   * the queue endpoint serves the full dossier in one request. It must NOT be
   * turned back into a per-card fetch trigger; that coupling is exactly what
   * this change removed.
   *
   * The decision buttons live inside the collapsed region on purpose: an admin
   * should not be able to approve or reject a storeroom whose photos, permit
   * and declared location they have not opened.
   */
  const [expanded, setExpanded] = useState(false);
  const bodyId = `expediente-${detail.id}`;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Dark header band — doubles as the expand/collapse control */}
      <div
        onClick={() => setExpanded((v) => !v)}
        className="bg-leodega-600 px-5 py-4 flex items-center gap-3.5 flex-wrap cursor-pointer"
      >
        <div className="flex-1 min-w-60">
          <p className="text-xs uppercase tracking-widest text-leodega-200 font-semibold mb-1">
            Expediente de verificación
          </p>
          <h2 className="text-xl font-semibold text-white mb-3">{detail.title}</h2>
          <div className="flex items-center gap-3">
            <span className="w-12 h-12 rounded-full bg-white/20 text-white flex items-center justify-center text-base font-semibold flex-shrink-0">
              {initials(detail.landlord.name)}
            </span>
            <div className="min-w-0">
              <p className="text-base font-semibold text-white m-0">
                {detail.landlord.name ?? "—"}
              </p>
              <p className="text-sm text-leodega-200 flex items-center gap-1.5 mt-0.5">
                <Mail size={14} /> {detail.landlord.email ?? "sin correo"}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-sm text-leodega-300 font-mono m-0">#{detail.id}</p>
            <p className="text-sm text-leodega-300 mt-0.5">Enviada {detail.submitted_at}</p>
          </div>
          {/* The real control: a div with onClick is not reachable by keyboard. */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded((v) => !v);
            }}
            aria-expanded={expanded}
            aria-controls={bodyId}
            aria-label={expanded ? "Contraer expediente" : "Abrir expediente"}
            className="flex-shrink-0 rounded-lg p-1.5 text-white hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-white/60"
          >
            {expanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </button>
        </div>
      </div>

      {!expanded && (
        <p className="px-5 py-3 text-sm text-gray-500 border-t border-gray-100">
          {detail.permit_attached
            ? "Abre el expediente para revisar y decidir."
            : "Sin permiso de bomberos adjunto. Abre el expediente para revisar y decidir."}
        </p>
      )}

      {expanded && (
      <div id={bodyId}>
      {/* Two-column body — lg:grid-cols-[1.05fr_1fr] is the one sanctioned
          arbitrary-value utility in this change. */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.05fr_1fr]">
        {/* Visual column */}
        <div className="p-5 lg:border-r border-gray-100">
          <Lightbox photos={detail.photos} />
          <p className="text-xs uppercase tracking-wide text-gray-500 font-bold mb-2">
            Ubicación declarada
          </p>
          {/*
            The address is ALWAYS shown; the map is the optional part, drawn
            only when coordinates exist (they are null for storerooms created
            before the coordinate columns, and are never invented or geocoded).
            Both matter here: the pin says where the storeroom is, the text says
            what the gestor declared, and the admin's job is checking they agree.
            Matches the prototype's `ADExpediente` (AdminPanel.jsx:443-444).
          */}
          {hasCoords && (
            <MiniMap latitude={detail.latitude} longitude={detail.longitude} />
          )}
          <p
            className={`text-sm text-gray-600 flex items-start gap-2 ${hasCoords ? "mt-2" : ""}`}
          >
            <MapPin size={14} className="text-gray-400 mt-0.5 flex-shrink-0" />
            {detail.direction ?? "—"}, {detail.city}
          </p>
        </div>

        {/* Data column */}
        <div className="p-5">
          <p className="text-xs uppercase tracking-wide text-gray-500 font-bold mb-1">
            Datos del gestor
          </p>
          <div className="mb-5">
            <Row label="Tipo de espacio" value={ROOM_TYPE_LABEL[detail.room_type ?? ""] ?? "—"} />
            <Row
              label="Almacenamiento"
              value={STORAGE_TYPE_LABEL[detail.storage_type ?? ""] ?? "—"}
            />
            <Row label="Tamaño" value={`${detail.size} m²`} />
            <Row label="Tarifa mensual" value={`$${detail.monthly_price}`} />
            <Row label="Servicio Leodega (10%)" value={`$${detail.leodega_fee}`} />
            <Row label="El gestor recibe" value={`$${detail.landlord_share}`} />
          </div>

          <p className="text-xs uppercase tracking-wide text-gray-500 font-bold mb-1.5">
            Descripción
          </p>
          <p className="text-xs text-gray-500 leading-relaxed mb-5">
            {detail.description ?? "—"}
          </p>

          <p className="text-xs uppercase tracking-wide text-gray-500 font-bold mb-2">
            Política de cancelación
          </p>
          <div className="border border-gray-200 rounded-xl px-4 py-3.5 mb-5">
            <div className={`flex items-center gap-2.5 ${policy ? "mb-1.5" : ""}`}>
              <span
                className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                  policy ? "bg-leodega-600" : "bg-red-600"
                }`}
              />
              <span className="text-sm font-semibold text-gray-900">
                {policy ? policy.label : "Sin política declarada"}
              </span>
            </div>
            {policy && (
              <p className="text-xs text-gray-500 leading-relaxed pl-5">
                {policy.description}
              </p>
            )}
          </div>

          <p className="text-xs uppercase tracking-wide text-gray-500 font-bold mb-2">
            Seguridad del espacio
          </p>
          <div className="mb-5">
            {(Object.keys(SECURITY_LABEL) as Array<keyof typeof SECURITY_LABEL>).map(
              (key, index) => {
                const on = detail.security[key];
                return (
                  <div
                    key={key}
                    className={`flex items-center gap-2.5 py-2 ${
                      index > 0 ? "border-t border-gray-100" : ""
                    }`}
                  >
                    <span
                      className={`w-5 h-5 rounded flex-shrink-0 flex items-center justify-center ${
                        on ? "bg-green-600" : "bg-gray-100"
                      }`}
                    >
                      {on ? (
                        <Check size={11} className="text-white" />
                      ) : (
                        <XIcon size={10} className="text-gray-400" />
                      )}
                    </span>
                    <span
                      className={`text-xs ${on ? "text-gray-900 font-semibold" : "text-gray-400"}`}
                    >
                      {SECURITY_LABEL[key]}
                    </span>
                    {!on && <span className="ml-auto text-xs text-gray-400">No declarado</span>}
                  </div>
                );
              },
            )}
          </div>

          <p className="text-xs uppercase tracking-wide text-gray-500 font-bold mb-2">
            Documentación
          </p>
          <PermitRow storeRoomId={detail.id} permitFilename={detail.permit_filename} />
        </div>
      </div>

      {/* Action footer — asymmetric 2:1 weight */}
      <div className="border-t border-gray-100 px-5 py-4 bg-gray-50 grid grid-cols-3 gap-3">
        <button
          type="button"
          onClick={onApprove}
          className="col-span-2 py-3 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700"
        >
          Aprobar y publicar
        </button>
        <button
          type="button"
          onClick={onReject}
          className="col-span-1 py-3 rounded-xl border border-red-600 bg-white text-red-600 text-sm font-semibold hover:bg-red-50"
        >
          Rechazar
        </button>
      </div>
      </div>
      )}
    </div>
  );
};

export default ExpedienteCard;
