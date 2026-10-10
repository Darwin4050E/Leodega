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
