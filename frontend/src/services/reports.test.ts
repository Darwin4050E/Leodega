import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockApi = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
}));

vi.mock('../api/axios', () => ({
  default: mockApi,
}));

import { getReports, getReport, createReport, updateReportStatus } from './reports';

describe('reports service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getReports calls GET /reports', () => {
    getReports();
    expect(mockApi.get).toHaveBeenCalledWith('/reports');
  });

  it('getReport calls GET /reports/:id', () => {
    getReport(4);
    expect(mockApi.get).toHaveBeenCalledWith('/reports/4');
  });

  it('createReport posts FormData with multipart headers', () => {
    const formData = new FormData();
    formData.append('title', 'Ruido');
    createReport(formData);
    expect(mockApi.post).toHaveBeenCalledWith('/reports', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  });

  it('updateReportStatus patches the given report id with the payload', () => {
    updateReportStatus(12, { status: 'resolved' });
    expect(mockApi.patch).toHaveBeenCalledWith('/reports/12/status', { status: 'resolved' });
  });
});
