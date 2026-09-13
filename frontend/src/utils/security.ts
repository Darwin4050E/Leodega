/**
 * Safe parsing for the `security` raw JSON column served by the storeroom
 * detail endpoint. The key set is `camara, ruido, control, acceso` — matches
 * `backend/app/Casts/SecurityFeatures.php` after the security-key migration
 * (commit `6e132e2`). Never throws: absent, empty, malformed, or wrong-shape
 * input all resolve to all-`false`.
 */
export interface ParsedSecurityFeatures {
  camara: boolean;
  ruido: boolean;
  control: boolean;
  acceso: boolean;
}

export const SECURITY_LABELS: Record<keyof ParsedSecurityFeatures, string> = {
  camara: "Cámara de seguridad exterior",
  ruido: "Monitor de ruido",
  control: "Control de plagas y humedad",
  acceso: "Acceso restringido 24/7",
};

const EMPTY_FEATURES: ParsedSecurityFeatures = {
  camara: false,
  ruido: false,
  control: false,
  acceso: false,
};

export function parseSecurityFeatures(raw?: string | null): ParsedSecurityFeatures {
  if (!raw) return { ...EMPTY_FEATURES };

  try {
    const parsed: unknown = JSON.parse(raw);

    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return { ...EMPTY_FEATURES };
    }

    const p = parsed as Record<string, unknown>;

    return {
      camara: Boolean(p.camara),
      ruido: Boolean(p.ruido),
      control: Boolean(p.control),
      acceso: Boolean(p.acceso),
    };
  } catch {
    return { ...EMPTY_FEATURES };
  }
}
