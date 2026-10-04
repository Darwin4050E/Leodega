import api from "../api/axios";

export interface LandlordReservation {
  id: number;
  status: string;
  start_date: string;
  end_date: string;
  store_room_id: number;
  rent_subtotal: string | number | null;
  total_mount: string | number | null;
  cancelation_reason: string | null;
  payment_status: "paid" | "pending";
  has_refund_obligation: boolean;
  /**
   * Server-computed cancel eligibility, from the same method the cancel guard
   * enforces. Authoritative — never re-derive it client-side, or the button
   * and the endpoint will disagree across a timezone boundary.
   */
  can_be_cancelled: boolean;
  /**
   * HUG-05 escenario 3 (comprobante de pago): the most recent 'paid'
   * Payments row for this reservation, from landlordIndex(). All three are
   * null together for a reservation that was never actually paid --
   * `payment_id` is the field to check for "does a receipt exist", not
   * `payment_status`, since REEMBOLSADO is also `payment_status: 'paid'`.
   */
  payment_id: number | null;
  payment_method: "credit card" | "debit card" | null;
  payment_date: string | null;
  // Laravel serializes the `storeRooms()` relation snake_cased.
  store_rooms?: {
    id?: number;
    title?: string;
  };
  tenants?: {
    user?: {
      id?: number;
      name?: string;
      lastname?: string;
      email?: string;
      phone?: string;
    };
  };
}

export function getLandlordReservations() {
  return api.get<LandlordReservation[]>("/landlord/reservations");
}

/**
 * Since commits `338f35c`..`eae68fd`, this endpoint returns the UNION of
 * confirmed reservations, active holds and landlord date blocks in the same
 * bare `{start_date, end_date}` shape. Consumers must treat every range as an
 * opaque occupied interval and must not attempt to distinguish origin.
 *
 * The endpoint is PUBLIC (HUC-03): visitors call it without a token. The
 * request interceptor only attaches `Authorization` when a token exists, so
 * no special visitor path is needed here.
 */
export interface ReservedRange {
  start_date: string;
  end_date: string;
}

export function getReservedDates(storeRoomId: number | string) {
  return api.get<ReservedRange[]>(`/storeRooms/${storeRoomId}/reserved-dates`);
}

export function createReservation(data: {
  store_room_id: number;
  start_date: string;
  end_date: string;
}) {
  return api.post<{ message: string; reservation: LandlordReservation }>("/reservations", data);
}

export function cancelReservation(id: number | string, data: { reason: string }) {
  return api.patch<{ message: string; reservation: LandlordReservation }>(
    `/landlord/reservations/${id}/cancel`,
    data
  );
}

export function getCancellationRate() {
  return api.get<{ gestor_cancellation_penalty_rate: number }>(
    "/landlord/reservations/cancellation-rate"
  );
}

export interface Payment {
  id: number;
  reservation_id: number;
  payment_method: "credit card" | "debit card";
  payment_state: "paid" | "pending" | "failed";
  payment_date: string;
}

/**
 * Matches `StorePaymentRequest::rules()` on the backend (read-only
 * reference — backend unchanged). No card number/holder/expiry/CVV field
 * ever belongs here: those stay in local component state and are discarded
 * after submit (REQ-PAY-6).
 */
export interface CreatePaymentInput {
  reservation_id: number;
  payment_method: "credit card" | "debit card";
  payment_state: "paid" | "pending" | "failed";
  payment_date: string;
}

export function createPayment(data: CreatePaymentInput) {
  return api.post<{ message: string; payment: Payment }>("/payments", data);
}

// -- sdd/tenant-reservations-screen ---------------------------------------

/**
 * Built server-side by ReservationReceipt::build() and nested in each
 * tenantIndex() row; null for any reservation that is not confirmed and paid.
 * `paid_at_label` is already formatted in America/Guayaquil: print it verbatim,
 * never parse or convert it.
 */
export interface TenantReceipt {
  code: string;
  status_label: string;
  store_room_title: string | null;
  gestor_name: string | null;
  start_date: string;
  end_date: string;
  total_paid: string;
  payment_id: number;
  payment_method: "credit card" | "debit card" | null;
  payment_method_label: string | null;
  paid_at: string;
  paid_at_label: string;
}

/**
 * Shape of a row from GET /tenant/reservations (tenantIndex()). Mirrors
 * LandlordReservation's `can_be_cancelled` idiom: server-computed, never
 * re-derived client-side (design decision #2). `photo_url` is already a
 * directly-usable asset() URL, never a bare storage-relative path.
 */
export interface TenantReservation {
  id: number;
  status: string;
  start_date: string;
  end_date: string;
  store_room_id: number;
  total_mount: string | number | null;
  can_be_cancelled: boolean;
  photo_url: string | null;
  /**
   * Set only once the reservation is canceled (ReservationService::
   * cancelByTenant()'s recorded amount). Spec "Post-cancel outcome": the
   * card MUST display this exact figure, never a re-derived one.
   */
  refund_amount?: string | number | null;
  receipt?: TenantReceipt | null;
  store_rooms?: {
    id?: number;
    title?: string;
    direction?: string;
    city?: string;
    size?: number;
  };
}

export function getTenantReservations() {
  return api.get<TenantReservation[]>("/tenant/reservations");
}

/**
 * Response shape of GET /tenant/reservations/:id/cancellation-preview.
 * Fetched by the cancel modal on open (design decision #1) — the amount it
 * carries MUST equal what the confirm action actually records.
 */
export interface CancellationPreview {
  can_be_cancelled: boolean;
  refund_amount: string;
}

export function getCancellationPreview(id: number | string) {
  return api.get<CancellationPreview>(`/tenant/reservations/${id}/cancellation-preview`);
}

export function cancelReservationAsTenant(id: number | string) {
  return api.patch<{ message: string; reservation: TenantReservation }>(
    `/tenant/reservations/${id}/cancel`,
    {}
  );
}

export function getReservationReceiptPdf(id: number | string) {
  return api.get<Blob>(`/tenant/reservations/${id}/receipt`, { responseType: "blob" });
}
