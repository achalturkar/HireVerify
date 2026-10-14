import type { CandidateFormConfig, ClientPortalPermission } from '@/src/types/client';

const API_BASE = process.env.NEXT_PUBLIC_API ?? '/api/v1';

export interface PortalCandidate {
  id: string;
  candidateCode: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  status: string;
  createdAt: string;
}

export interface PortalCandidateDetail extends PortalCandidate {
  updatedAt: string;
  dateOfBirth: string | null;
  gender: string | null;
  fatherName: string | null;
  motherName: string | null;
  aadhaarNumber: string | null;
  panNumber: string | null;
  uanNumber: string | null;
  passportNumber: string | null;
  drivingLicenseNumber: string | null;
  voterIdNumber: string | null;
  highestQualification: string | null;
  courseName: string | null;
  institutionName: string | null;
  universityName: string | null;
  yearOfPassing: number | null;
  gradeOrPercentage: string | null;
  employeeId: string | null;
  employeeDesignation: string | null;
  employeeDepartment: string | null;
  employmentType: string | null;
  joiningDate: string | null;
  workLocation: string | null;
  currentEmployer: string | null;
  currentAddress: string | null;
  permanentAddress: string | null;
  documents: { id: string; documentType: string; documentNumber: string | null; fileName: string; fileUrl: string; verificationStatus: string; uploadedAt: string }[];
  bgvCases: PortalCase[];
  portalInvitation: { activatedAt: string | null; lastSentAt: string | null; expiresAt: string; revokedAt: string | null; reminderCount: number } | null;
  client?: { candidateFormConfig: CandidateFormConfig };
}

export interface PortalCandidateAccess {
  activatedAt: string | null;
  lastSentAt: string | null;
  expiresAt: string;
  revokedAt: string | null;
  reminderCount: number;
  lastRemindedAt: string | null;
  url: string | null;
}

export interface PortalCase {
  id: string;
  caseNumber: string;
  status: string;
  overallResult: string | null;
  verificationStatuses: string[];
  initiatedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  candidate: { firstName: string; lastName: string; candidateCode: string };
}

export interface PortalCaseDetail extends PortalCase {
  updatedAt: string;
  checks: { id: string; type: string; status: string; result: string | null; startedAt: string | null; completedAt: string | null; remarks: string | null }[];
}

export interface PortalReport {
  id: string;
  caseNumber: string;
  completedAt: string | null;
  verificationStatuses: string[];
  reportVerificationStatus: string;
  candidate: { firstName: string; lastName: string; candidateCode: string };
}

export interface PortalPage<T> {
  items: T[];
  total: number;
  totalPages: number;
}

export class ClientPortalApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = 'ClientPortalApiError';
  }
}

async function request<T>(
  path: string,
  token: string | null,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API_BASE}/client-portal${path}`, {
    ...init,
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || body?.success === false) {
    const message = typeof body?.message === 'string'
      ? body.message
      : body?.message?.message ?? `Request failed (${response.status})`;
    throw new ClientPortalApiError(message, response.status);
  }
  return body?.data as T;
}

async function list<T>(path: string, page: number, token: string | null): Promise<PortalPage<T>> {
  const result = await request<{ data: T[]; meta?: { total?: number; totalPages?: number } }>(
    `${path}?page=${page}&limit=10`,
    token,
  );
  return {
    items: result.data,
    total: result.meta?.total ?? result.data.length,
    totalPages: result.meta?.totalPages ?? 1,
  };
}

export const listPortalCandidates = (page: number, token: string | null) =>
  list<PortalCandidate>('/candidates', page, token);

export async function getPortalCandidateFormConfig(token: string | null): Promise<CandidateFormConfig> {
  const result = await request<{ data: CandidateFormConfig }>('/candidate-form-config', token);
  return result.data;
}

export async function getPortalCandidate(id: string, token: string | null): Promise<PortalCandidateDetail> {
  const result = await request<{ data: PortalCandidateDetail }>(`/candidates/${id}`, token);
  return result.data;
}

export async function invitePortalCandidate(id: string, token: string | null): Promise<{ emailSent: boolean; url: string | null; expiresAt: string }> {
  const result = await request<{ data: { emailSent: boolean; url: string | null; expiresAt: string } }>(`/candidates/${id}/invitation`, token, {
    method: 'POST',
    body: JSON.stringify({ expiresInDays: 30 }),
  });
  return result.data;
}

export async function getPortalCandidateAccess(id: string, token: string | null): Promise<PortalCandidateAccess | null> {
  const result = await request<{ data: PortalCandidateAccess | null }>(`/candidates/${id}/portal-access`, token);
  return result.data;
}

export async function remindPortalCandidate(id: string, token: string | null): Promise<{ emailSent: boolean; lastSentAt: string | null }> {
  const result = await request<{ data: { emailSent: boolean; lastSentAt: string | null } }>(`/candidates/${id}/invitation/remind`, token, { method: 'POST' });
  return result.data;
}

export async function setPortalCandidateAccess(id: string, locked: boolean, token: string | null): Promise<PortalCandidateAccess> {
  const result = await request<{ data: PortalCandidateAccess }>(`/candidates/${id}/portal-access`, token, { method: 'PATCH', body: JSON.stringify({ locked }) });
  return result.data;
}

export const listPortalCases = (page: number, token: string | null) =>
  list<PortalCase>('/cases', page, token);

export async function getPortalCase(id: string, token: string | null): Promise<PortalCaseDetail> {
  const result = await request<{ data: PortalCaseDetail }>(`/cases/${id}`, token);
  return result.data;
}

export const listPortalReports = (page: number, token: string | null) =>
  list<PortalReport>('/reports', page, token);

export async function savePortalCandidate(
  payload: Record<string, string | number | null>,
  token: string | null,
  id?: string,
): Promise<PortalCandidate> {
  const result = await request<{ data: PortalCandidate }>(
    id ? `/candidates/${id}` : '/candidates',
    token,
    { method: id ? 'PUT' : 'POST', body: JSON.stringify(payload) },
  );
  return result.data;
}

export async function downloadPortalReport(id: string, token: string | null): Promise<Blob> {
  const response = await fetch(`${API_BASE}/client-portal/reports/${id}/download`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const message = typeof body?.message === 'string'
      ? body.message
      : body?.message?.message ?? `Could not download report (${response.status})`;
    throw new ClientPortalApiError(message, response.status);
  }
  return response.blob();
}

export function hasPortalPermission(permissions: string[], permission: ClientPortalPermission): boolean {
  return permissions.includes(permission);
}
