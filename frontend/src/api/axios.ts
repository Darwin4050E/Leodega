import axios from 'axios';
import {
  ORGANIZATION_FORBIDDEN_MESSAGE,
  ORGANIZATION_HEADER,
  forcePersonalContext,
  readRequestOrganizationId,
} from '../utils/activeContext';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

function isOrganizationForbidden(error: unknown): boolean {
  if (!axios.isAxiosError(error)) return false;
  if (error.response?.status !== 403) return false;
  if (error.response.data?.message !== ORGANIZATION_FORBIDDEN_MESSAGE) return false;

  const sent = error.config?.headers?.get(ORGANIZATION_HEADER);
  const current = readRequestOrganizationId();
  return sent != null && current !== null && String(sent) === String(current);
}

// request identificada 
//hola probando

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("auth_token");
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;

    const organizationId = readRequestOrganizationId();
    if (organizationId !== null) {
      config.headers[ORGANIZATION_HEADER] = String(organizationId);
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (isOrganizationForbidden(error)) {
      forcePersonalContext();
    }
    return Promise.reject(error);
  },
);


export default api;
