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
