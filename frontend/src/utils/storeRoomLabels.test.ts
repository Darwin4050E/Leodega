import { describe, it, expect } from "vitest";
import { PUBLICATION_STATUS_LABEL, REASON_LABEL } from "./storeRoomLabels";

describe("storeRoomLabels", () => {
  it("labels every publication status in Spanish", () => {
    expect(PUBLICATION_STATUS_LABEL).toEqual({
      pending: "Pendiente",
      approved: "Aprobada",
      rejected: "Rechazada",
    });
  });

  it("labels every rejection reason code with the moderation copy", () => {
    expect(REASON_LABEL.fotos.label).toBe("Fotos incorrectas");
    expect(REASON_LABEL.info.label).toBe("Información incoherente");
    expect(REASON_LABEL.permiso.label).toBe("Permiso inválido");
    expect(REASON_LABEL.otro.label).toBe("Otro motivo");
  });
});
