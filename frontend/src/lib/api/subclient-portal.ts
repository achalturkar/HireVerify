import { ApiError, authFetch } from './http';

const API_BASE = process.env.NEXT_PUBLIC_API ?? '/api/v1';

export interface SubclientDashboard {
  counts: { candidates: number; cases: number; openCases: number; completedCases: number };
  recentCases: SubclientCase[];
}

export interface SubclientCandidate {
  id: string;
  candidateCode: string;
  fullName: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  email: string | null;
  status: string;
  createdAt: string;
}

export interface SubclientCase {
  id: string;
  caseNumber: string;
  status: string;
  overallResult: string | null;
  verificationStatuses: string[];
  initiatedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  candidate: { fullName: string; firstName: string; middleName: string | null; lastName: string; candidateCode: string };
}

export interface SubclientCaseDetail extends SubclientCase {
  updatedAt: string;
  checks: { id: string; type: string; label: string; status: string; result: string | null; completedAt: string | null; remarks: string | null }[];
}

export interface SubclientReport {
  id: string;
  caseNumber: string;
  completedAt: string | null;
  reportVerificationStatus: string;
  verificationStatuses: string[];
  candidate: SubclientCase['candidate'];
}

export interface SubclientPage<T> {
  items: T[];
  total: number;
  totalPages: number;
}

async function request<T>(path: string, token: string | null): Promise<T> {
  const response = await authFetch(`/subclient-portal${path}`, token);
  return response.data as T;
}

async function list<T>(path: string, page: number, token: string | null): Promise<SubclientPage<T>> {
  const query = new URLSearchParams({ page: String(page), limit: '20' });
  const result = await request<{ data: T[]; meta?: { total?: number; totalPages?: number } }>(`${path}?${query}`, token);
  return {
    items: result.data,
    total: result.meta?.total ?? result.data.length,
    totalPages: result.meta?.totalPages ?? 1,
  };
}

export const getSubclientDashboard = (token: string | null) =>
  request<{ data: SubclientDashboard }>('/dashboard', token).then((result) => result.data);

export const listSubclientCandidates = (page: number, token: string | null) =>
  list<SubclientCandidate>('/candidates', page, token);

export const listSubclientCases = (page: number, token: string | null) =>
  list<SubclientCase>('/cases', page, token);

export const getSubclientCase = (id: string, token: string | null) =>
  request<{ data: SubclientCaseDetail }>(`/cases/${id}`, token).then((result) => result.data);

export const listSubclientReports = (page: number, token: string | null) =>
  list<SubclientReport>('/reports', page, token);

export async function downloadSubclientReport(id: string, token: string | null): Promise<Blob> {
  const response = await fetch(`${API_BASE}/subclient-portal/reports/${id}/download`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const message = typeof body?.message === 'string' ? body.message : `Could not download report (${response.status})`;
    throw new ApiError(message, response.status);
  }
  return response.blob();
}
