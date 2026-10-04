// Fire-department permit: PDF only, 5 MB. Must match the backend rule in
// StoreStoreRoomRequest (`mimes:pdf|max:5120`) and the mobile app.
export const PERMIT_MAX_BYTES = 5 * 1024 * 1024;

/** Returns the Spanish error for an invalid permit file, or null when it is acceptable. */
export function validatePermitFile(file: File): string | null {
  if (file.type !== "application/pdf") return "El permiso debe ser un archivo PDF.";
  if (file.size > PERMIT_MAX_BYTES) return "El permiso no debe superar los 5 MB.";
  return null;
}
