import api from "../api/axios";

export interface Organization {
  id: number;
  name: string;
  ruc: string;
  email: string;
  logo: string | null;
  status: string;
  role: "admin" | "member";
}

export interface CreateOrganizationPayload {
  name: string;
  ruc: string;
  email: string;
  logo?: File | null;
}

export interface CreateOrganizationResponse {
  message: string;
  organization: Organization;
}

export function createOrganization(payload: CreateOrganizationPayload) {
  const formData = new FormData();
  formData.append("name", payload.name);
  formData.append("ruc", payload.ruc);
  formData.append("email", payload.email);
  if (payload.logo) {
    formData.append("logo", payload.logo);
  }

  return api.post<CreateOrganizationResponse>("/organizations", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
}

export function getOrganizations() {
  return api.get<Organization[]>("/organizations");
}

export interface OrganizationWallet {
  organization_id: number;
  /** 2-decimal string, e.g. "80.50". */
  balance: string;
}

export type WalletMovementType = "recarga" | "reserva" | "reembolso";

/** `amount` is signed (debits negative); both money fields are 2-decimal strings. */
export interface WalletMovement {
  id: number;
  type: WalletMovementType;
  amount: string;
  balance_after: string;
  reservation_id: number | null;
  actor_name: string | null;
  created_at: string;
}

export interface TopUpWalletResponse {
  message: string;
  balance: string;
  movement: WalletMovement;
}

// The organization is addressed in the path: wallet routes ignore the
// X-Organization-Id header (OW-12).
export function getOrganizationWallet(organizationId: number) {
  return api.get<OrganizationWallet>(`/organizations/${organizationId}/wallet`);
}

export function getWalletMovements(organizationId: number) {
  return api.get<WalletMovement[]>(`/organizations/${organizationId}/wallet/movements`);
}

export function topUpWallet(organizationId: number, amount: string) {
  return api.post<TopUpWalletResponse>(`/organizations/${organizationId}/wallet/top-ups`, { amount });
}

/** One member row of the spending-limit list; money fields are 2-decimal strings. */
export interface SpendingLimitRow {
  user_id: number;
  name: string;
  role: "admin" | "member";
  /** `null` means the member has no limit. */
  monthly_limit: string | null;
  /** Consumed in the current calendar month. */
  spent: string;
}

// Path-addressed like the wallet routes: the X-Organization-Id header is ignored.
export function getSpendingLimits(organizationId: number) {
  return api.get<SpendingLimitRow[]>(`/organizations/${organizationId}/spending-limits`);
}

export function setSpendingLimit(organizationId: number, userId: number, monthlyLimit: string | null) {
  return api.put<SpendingLimitRow>(`/organizations/${organizationId}/spending-limits/${userId}`, {
    monthly_limit: monthlyLimit,
  });
}

export const InvitationStatus = {
  PENDING: "pending",
  ACCEPTED: "accepted",
  REJECTED: "rejected",
  EXPIRED: "expired",
  CANCELLED: "cancelled",
} as const;

export type InvitationStatus = (typeof InvitationStatus)[keyof typeof InvitationStatus];

/**
 * One invitation as the organization admins see it. `status` is the server's
 * effective status (a lapsed pending already reads `expired`), and
 * `can_be_revoked` is the only per-row permission flag: the web never derives
 * either from its own clock. Dates are ISO 8601 strings.
 */
export interface OrganizationInvitation {
  id: number;
  email: string;
  status: InvitationStatus;
  expires_at: string;
  created_at: string;
  responded_at: string | null;
  invited_by_name: string | null;
  can_be_revoked: boolean;
}

/** Laravel's flat paginator (page size 20, newest first); `links` is ignored. */
export interface PaginatedInvitations {
  data: OrganizationInvitation[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  /** Effective-pending invitations of the whole organization, not just this page. */
  pending_count: number;
}

// Path-addressed like the wallet and spending-limit routes: the
// X-Organization-Id header is ignored.
export function inviteMember(organizationId: number, email: string) {
  return api.post<OrganizationInvitation>(`/organizations/${organizationId}/invitations`, { email });
}

export function getInvitations(organizationId: number, page: number) {
  return api.get<PaginatedInvitations>(`/organizations/${organizationId}/invitations`, { params: { page } });
}

export function revokeInvitation(organizationId: number, invitationId: number) {
  return api.delete<OrganizationInvitation>(`/organizations/${organizationId}/invitations/${invitationId}`);
}

/**
 * One invitation as the invitee sees it in the inbox. `status` is the server's
 * effective status (a lapsed pending already reads `expired`) and `can_respond`
 * is the only permission flag: the web never derives either from its own
 * clock. `role` is always `member`. Dates are ISO 8601 strings.
 */
export interface InboxInvitation {
  id: number;
  organization_id: number;
  organization_name: string;
  invited_by_name: string | null;
  role: "member";
  status: InvitationStatus;
  expires_at: string;
  created_at: string;
  responded_at: string | null;
  can_respond: boolean;
}

/**
 * Pending invitations first, then the most recent expired ones, in the order
 * the server sent them. `pending_count` counts effective-pending only, so it
 * can be lower than `data.length`.
 */
export interface InvitationInbox {
  data: InboxInvitation[];
  pending_count: number;
}

// Personal-scope routes: the caller is the invitee, so no organization id is
// sent and the X-Organization-Id header is ignored by the server.
export function getMyInvitations() {
  return api.get<InvitationInbox>("/invitations");
}

export function acceptInvitation(invitationId: number) {
  return api.post<Organization>(`/invitations/${invitationId}/accept`);
}

export function rejectInvitation(invitationId: number) {
  return api.post<InboxInvitation>(`/invitations/${invitationId}/reject`);
}

export const PANEL_HISTORY_KIND = {
  RESERVATION_CREATED: "reservation_created",
  RESERVATION_CANCELLED: "reservation_cancelled",
  WALLET_TOPUP: "wallet_topup",
  WALLET_REFUND: "wallet_refund",
  MEMBER_JOINED: "member_joined",
} as const;

export type PanelHistoryKind = (typeof PANEL_HISTORY_KIND)[keyof typeof PANEL_HISTORY_KIND];

const PANEL_HISTORY_KINDS: readonly string[] = Object.values(PANEL_HISTORY_KIND);

/** The history feed can grow new kinds on the server; narrow before switching on one. */
export function isPanelHistoryKind(value: string): value is PanelHistoryKind {
  return PANEL_HISTORY_KINDS.includes(value);
}

export const PANEL_RESERVATION_STATUS = {
  CONFIRMED: "confirmed",
  PENDING: "pending",
} as const;

export type PanelReservationStatus = (typeof PANEL_RESERVATION_STATUS)[keyof typeof PANEL_RESERVATION_STATUS];

/**
 * Control panel summary. `role` is the caller's role in THIS organization and
 * is authoritative over any cached one. `pending_invitations_count` is absent
 * (not null) for members.
 */
export interface PanelSummary {
  organization_id: number;
  role: "admin" | "member";
  members_count: number;
  active_reservations_count: number;
  pending_invitations_count?: number;
}

/**
 * One member row. A key the caller may not see is ABSENT, never null:
 * `email` is admin-only; `monthly_limit` and `spent` are sent to admins for
 * every row and to a member for their own row only. Where `monthly_limit` is
 * present, `null` means "no limit". Money is a 2-decimal string.
 */
export interface PanelMember {
  user_id: number;
  name: string;
  role: "admin" | "member";
  joined_at: string | null;
  is_self: boolean;
  email?: string;
  monthly_limit?: string | null;
  spent?: string;
}

/** Active reservation row; dates are `Y-m-d`, `total` a 2-decimal string. */
export interface PanelReservation {
  id: number;
  warehouse_name: string | null;
  member_name: string | null;
  start_date: string;
  end_date: string;
  status: PanelReservationStatus;
  total: string;
  paid_with_wallet: boolean;
}

/**
 * Derived history row, admin only. `kind` stays a plain string on the wire so
 * an unknown future kind still type-checks; `amount` is set for created,
 * top-up and refund rows only.
 */
export interface PanelHistoryEntry {
  id: string;
  kind: string;
  occurred_at: string;
  actor_name: string | null;
  target_label: string | null;
  amount: string | null;
}

/** Laravel's flat paginator (page size 20); `links` is ignored. */
export interface PaginatedPanelReservations {
  data: PanelReservation[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export interface PaginatedPanelHistory {
  data: PanelHistoryEntry[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

// Read-only and path-addressed like the wallet and invitation routes: the
// X-Organization-Id header is ignored.
export function getPanelSummary(organizationId: number) {
  return api.get<PanelSummary>(`/organizations/${organizationId}/panel/summary`);
}

export function getPanelMembers(organizationId: number) {
  return api.get<PanelMember[]>(`/organizations/${organizationId}/panel/members`);
}

export function getPanelReservations(organizationId: number, page: number) {
  return api.get<PaginatedPanelReservations>(`/organizations/${organizationId}/panel/reservations`, {
    params: { page },
  });
}

export function getPanelHistory(organizationId: number, page: number) {
  return api.get<PaginatedPanelHistory>(`/organizations/${organizationId}/panel/history`, { params: { page } });
}
