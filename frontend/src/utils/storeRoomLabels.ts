import type { ReasonCode } from "../services/storeRooms";

export type PublicationStatus = "approved" | "pending" | "rejected";

export const PUBLICATION_STATUS_LABEL: Record<PublicationStatus, string> = {
  pending: "Pendiente",
  approved: "Aprobada",
  rejected: "Rechazada",
};

/**
 * Rejection reason copy, shared by the admin's RejectModal (label + hint)
 * and the gestor's views of a rejected room (label only). Keys are literal
 * (type-checked against ReasonCode) so this module has no runtime import of
 * the services layer, which many component tests mock.
 */
export const REASON_LABEL: Record<ReasonCode, { label: string; hint: string }> = {
  fotos: {
    label: "Fotos incorrectas",
    hint: "Imágenes borrosas, no corresponden o insuficientes.",
  },
  info: {
    label: "Información incoherente",
    hint: "Dimensiones, dirección o tarifa no coinciden.",
  },
  permiso: {
    label: "Permiso inválido",
    hint: "Permiso de bomberos ausente, ilegible o vencido.",
  },
  otro: {
    label: "Otro motivo",
    hint: "Especifica el motivo en el comentario.",
  },
};
