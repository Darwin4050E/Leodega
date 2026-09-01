import api from "../api/axios";

export interface ReportListItem {
  id: number;
  status: string;
  report_type: string;
  created_at: string;
  user?: {
    name?: string;
    email?: string;
  };
  store?: {
    direction?: string;
  };
}

export function getReports() {
  return api.get<ReportListItem[]>("/reports");
}

export function getReport(id: number | string) {
  return api.get(`/reports/${id}`);
}

export function createReport(formData: FormData) {
  return api.post("/reports", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
}

export function updateReportStatus(id: number | string, data: Record<string, unknown>) {
  return api.patch(`/reports/${id}/status`, data);
}
