import { getReservationReceiptPdf } from "../services/reservations";
import { formatReservationCode } from "./reservationCode";

const RECEIPT_DOWNLOAD_ERROR = "No se pudo descargar el comprobante. Inténtalo de nuevo.";

export function receiptFilename(reservationId: number): string {
  return `comprobante-${formatReservationCode(reservationId)}.pdf`;
}

export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * Any failure (403, 404, 409, 5xx, network) rejects with an Error carrying
 * the one generic message: the error body of a blob request is never parsed.
 */
export async function downloadReservationReceipt(reservationId: number): Promise<void> {
  try {
    const response = await getReservationReceiptPdf(reservationId);
    saveBlob(response.data, receiptFilename(reservationId));
  } catch {
    throw new Error(RECEIPT_DOWNLOAD_ERROR);
  }
}
