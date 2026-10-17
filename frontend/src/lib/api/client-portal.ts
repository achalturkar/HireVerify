import type { CandidateFormConfig, ClientPortalPermission } from '@/src/types/client';
import type { VerificationType } from '@/src/types/bgv';
import { ApiError, authFetch } from './http';

const API_BASE = process.env.NEXT_PUBLIC_API ?? '/api/v1';
const CLIENT_PORTAL_SCOPE_KEY = 'hireverify_client_portal_scope';

export function getClientPortalScope() {
  return typeof window === 'undefined' ? null : window.sessionStorage.getItem(CLIENT_PORTAL_SCOPE_KEY);
}

export function setClientPortalScope(clientId: string | null) {
  if (typeof window === 'undefined') return;
  if (clientId) window.sessionStorage.setItem(CLIENT_PORTAL_SCOPE_KEY, clientId);
  else window.sessionStorage.removeItem(CLIENT_PORTAL_SCOPE_KEY);
}

function scopedPortalHeaders(): Record<string, string> {
  const clientId = getClientPortalScope();
  return clientId ? { 'X-Client-Portal-Client-Id': clientId } : {};
}

function scopedPortalQuery() {
  const clientId = getClientPortalScope();
  return clientId ? `?portalClientId=${encodeURIComponent(clientId)}` : '';
}

export interface PortalCandidate {
  id: string;
  candidateCode: string;
  fullName: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  email: string | null;
  phone: string | null;
  status: string;
  createdAt: string;
  subclient: Pick<PortalSubclient, 'id' | 'name' | 'clientCode'> | null;
}

export interface PortalSubclient {
  id: string;
  parentClientId: string;
  name: string;
  clientCode: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  serviceRates: { checkType: VerificationType; rate: number }[];
  packageRate: number | null;
  status: 'ACTIVE' | 'INACTIVE';
  candidateCount: number;
  bgvCaseCount: number;
}

export interface SubclientPortalUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: 'ACTIVE' | 'INACTIVE';
  permissions: ClientPortalPermission[];
  mustChangePassword: boolean;
  lastLoginAt: string | null;
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
  candidate: { fullName: string; firstName: string; middleName: string | null; lastName: string; candidateCode: string };
}

export interface PortalCaseDetail extends PortalCase {
  updatedAt: string;
  checks: { id: string; type: string; label: string; status: string; result: string | null; startedAt: string | null; completedAt: string | null; remarks: string | null }[];
}

export interface PortalReport {
  id: string;
  caseNumber: string;
  completedAt: string | null;
  verificationStatuses: string[];
  reportVerificationStatus: string;
  candidate: { fullName: string; firstName: string; middleName: string | null; lastName: string; candidateCode: string };
}

export interface PortalPage<T> {
  items: T[];
  total: number;
  totalPages: number;
}

export interface PortalDashboardSummary {
  permissions: { candidates: boolean; cases: boolean; reports: boolean; invoices: boolean; subclients: boolean };
  counts: {
    candidates: number | null;
    cases: number | null;
    openCases: number | null;
    completedCases: number | null;
    reports: number | null;
    invoices: number | null;
    subclients: number | null;
  };
  monthlyActivity: { key: string; month: string; candidates?: number; cases?: number; reports?: number; invoices?: number }[];
  recentCases: {
    id: string;
    caseNumber: string;
    status: string;
    createdAt: string;
    candidate: PortalCase['candidate'];
  }[];
  recentReports: {
    id: string;
    caseNumber: string;
    completedAt: string;
    candidate: PortalCase['candidate'];
  }[];
  recentInvoices: Pick<PortalInvoice, 'id' | 'invoiceNumber' | 'status' | 'invoiceDate' | 'currency' | 'total'>[];
}

export interface PortalListFilters {
  search?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  subclientId?: string;
}

export interface PortalInvoice {
  id: string;
  invoiceNumber: string;
  status: string;
  invoiceDate: string;
  dueDate: string;
  currency: string;
  total: number;
  amountPaid: number;
  balanceDue: number;
}

export type ClientRequestStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
export type ClientRequestCategory = 'ACCOUNT' | 'CANDIDATE' | 'CASE' | 'REPORT' | 'INVOICE' | 'TECHNICAL_SUPPORT' | 'OTHER';

export interface ClientRequest {
  id: string;
  clientId: string;
  client: { id: string; name: string; clientCode: string };
  category: ClientRequestCategory;
  subject: string;
  description: string;
  status: ClientRequestStatus;
  adminResponse: string | null;
  respondedAt: string | null;
  respondedBy: { id: string; firstName: string; lastName: string } | null;
  submittedBy: { id: string; firstName: string; lastName: string; email: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClientRequestPage {
  items: ClientRequest[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export class ClientPortalApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = 'ClientPortalApiError';
  }
}

async function requestClientRequests<T>(path: string, token: string | null, init: RequestInit = {}): Promise<T> {
  try {
    const body = await authFetch(`/client-requests${path}`, token, init);
    return body?.data as T;
  } catch (error) {
    if (error instanceof ApiError) {
      throw new ClientPortalApiError(error.message, error.status);
    }
    throw error;
  }
}

export async function listClientRequests(
  token: string | null,
  filters: { page?: number; status?: string; search?: string } = {},
): Promise<ClientRequestPage> {
  const query = new URLSearchParams({ page: String(filters.page ?? 1), limit: '20' });
  if (filters.status) query.set('status', filters.status);
  if (filters.search) query.set('search', filters.search);
  return requestClientRequests<ClientRequestPage>(`?${query.toString()}`, token);
}

export async function createClientRequest(
  payload: Pick<ClientRequest, 'category' | 'subject' | 'description'>,
  token: string | null,
): Promise<ClientRequest> {
  return requestClientRequests<ClientRequest>('', token, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateClientRequest(
  id: string,
  payload: { status?: ClientRequestStatus; adminResponse?: string },
  token: string | null,
): Promise<ClientRequest> {
  return requestClientRequests<ClientRequest>(`/${id}`, token, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
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
      ...scopedPortalHeaders(),
      ...Object.fromEntries(new Headers(init.headers).entries()),
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

async function list<T>(path: string, page: number, token: string | null, filters: PortalListFilters = {}): Promise<PortalPage<T>> {
  const query = new URLSearchParams({ page: String(page), limit: '20' });
  Object.entries(filters).forEach(([key, value]) => {
    if (value) query.set(key, value);
  });
  const result = await request<{ data: T[]; meta?: { total?: number; totalPages?: number } }>(
    `${path}?${query.toString()}`,
    token,
  );
  return {
    items: result.data,
    total: result.meta?.total ?? result.data.length,
    totalPages: result.meta?.totalPages ?? 1,
  };
}

export async function getPortalDashboard(token: string | null): Promise<PortalDashboardSummary> {
  const result = await request<{ data: PortalDashboardSummary }>('/dashboard', token);
  return result.data;
}

export const listPortalCandidates = (page: number, token: string | null, filters?: PortalListFilters) =>
  list<PortalCandidate>('/candidates', page, token, filters);

export async function getPortalCandidateFormConfig(token: string | null): Promise<CandidateFormConfig> {
  const result = await request<{ data: CandidateFormConfig }>('/candidate-form-config', token);
  return result.data;
}

export async function listPortalSubclients(token: string | null): Promise<PortalSubclient[]> {
  const result = await request<{ data: PortalSubclient[] }>('/subclients', token);
  return result.data;
}

export async function createPortalSubclient(payload: Pick<PortalSubclient, 'name' | 'clientCode' | 'serviceRates' | 'packageRate'> & Partial<Pick<PortalSubclient, 'contactName' | 'contactEmail' | 'contactPhone'>>, token: string | null): Promise<PortalSubclient> {
  const result = await request<{ data: PortalSubclient }>('/subclients', token, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return result.data;
}

export async function updatePortalSubclient(id: string, payload: Pick<PortalSubclient, 'name' | 'clientCode' | 'serviceRates' | 'packageRate' | 'status'> & Partial<Pick<PortalSubclient, 'contactName' | 'contactEmail' | 'contactPhone'>>, token: string | null): Promise<PortalSubclient> {
  const result = await request<{ data: PortalSubclient }>(`/subclients/${id}`, token, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  return result.data;
}

export async function listSubclientPortalUsers(subclientId: string, token: string | null): Promise<SubclientPortalUser[]> {
  const result = await request<{ data: SubclientPortalUser[] }>(`/subclients/${subclientId}/users`, token);
  return result.data;
}

export async function inviteSubclientPortalUser(
  subclientId: string,
  payload: { firstName: string; lastName: string; email: string; accountMethod: 'INVITATION' | 'PASSWORD'; password?: string },
  token: string | null,
): Promise<SubclientPortalUser> {
  const result = await request<{ data: SubclientPortalUser }>(`/subclients/${subclientId}/users`, token, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return result.data;
}

export async function updateSubclientPortalUser(
  subclientId: string,
  userId: string,
  status: 'ACTIVE' | 'INACTIVE',
  token: string | null,
): Promise<SubclientPortalUser> {
  const result = await request<{ data: SubclientPortalUser }>(`/subclients/${subclientId}/users/${userId}`, token, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
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

export const listPortalCases = (page: number, token: string | null, filters?: PortalListFilters) =>
  list<PortalCase>('/cases', page, token, filters);

export async function getPortalCase(id: string, token: string | null): Promise<PortalCaseDetail> {
  const result = await request<{ data: PortalCaseDetail }>(`/cases/${id}`, token);
  return result.data;
}

export const listPortalReports = (page: number, token: string | null, filters?: PortalListFilters) =>
  list<PortalReport>('/reports', page, token, filters);

export const listPortalInvoices = (page: number, token: string | null, filters?: PortalListFilters) =>
  list<PortalInvoice>('/invoices', page, token, filters);

export async function downloadPortalInvoice(id: string, token: string | null): Promise<Blob> {
  const response = await fetch(`${API_BASE}/client-portal/invoices/${id}/pdf${scopedPortalQuery()}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const message = typeof body?.message === 'string'
      ? body.message
      : body?.message?.message ?? `Could not download invoice (${response.status})`;
    throw new ClientPortalApiError(message, response.status);
  }
  return response.blob();
}

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
  const response = await fetch(`${API_BASE}/client-portal/reports/${id}/download${scopedPortalQuery()}`, {
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

export function hasPortalPermission(permissions: string[], permission: ClientPortalPermission, companyAdmin = false): boolean {
  return companyAdmin || permissions.includes(permission);
}
