import { ApiError } from '@/src/lib/api';
const API_BASE = process.env.NEXT_PUBLIC_API ?? '/api/v1';

const extractApiMessage = (body: any, defaultMessage: string): string => {
  if (!body) return defaultMessage;
  const message = body.message ?? body;
  if (typeof message === 'string') return message;
  if (typeof message === 'object' && message !== null) {
    if (typeof message.message === 'string') return message.message;
    if (Array.isArray(message)) return message.map((item) => extractApiMessage(item, '')).filter(Boolean).join(', ');
    return JSON.stringify(message);
  }
  return defaultMessage;
};

interface CompanyResponse {
  id: string;
  name: string;
  slug: string;
  shortCode: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  logoUrl: string | null;
  signatureUrl: string | null;
  stampUrl: string | null;
  primaryColor: string | null;
  address: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface StatsResponse {
  users: number;
  clients: number;
  candidates: number;
  bgvCases: number;
  pendingCases: number;
  inProgressCases: number;
  completedCases: number;
  reports: number;
}

export async function getCompany(companyId: string, accessToken: string | null): Promise<CompanyResponse> {
  if (!accessToken) throw new ApiError('You must be signed in to do this.', 401);

  const res = await fetch(`${API_BASE}/companies/${companyId}`, {
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
  });

  const body = await res.json().catch(() => null);
  if (!res.ok || body?.success === false) {
    const msg = extractApiMessage(body, `Request failed (${res.status})`);
    throw new ApiError(msg, res.status);
  }

  return (body?.data && body.data.data) ? body.data.data : body.data;
}

export async function updateCompany(
  companyId: string,
  payload: FormData | Record<string, unknown>,
  accessToken: string | null
): Promise<CompanyResponse> {
  if (!accessToken) throw new ApiError('You must be signed in to do this.', 401);

  const headers: Record<string, string> = { Authorization: `Bearer ${accessToken}` };
  const init: RequestInit = { method: 'PUT' };

  if (payload instanceof FormData) {
    init.body = payload;
  } else {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(payload);
  }

  const res = await fetch(`${API_BASE}/companies/${companyId}`, {
    ...init,
    headers,
  });

  const body = await res.json().catch(() => null);
  if (!res.ok || body?.success === false) {
    const msg = extractApiMessage(body, `Request failed (${res.status})`);
    throw new ApiError(msg, res.status);
  }

  return (body?.data && body.data.data) ? body.data.data : body.data;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  metadata: unknown;
  createdAt: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
}

export interface CompanyDetailsResponse {
  company: CompanyResponse;
  admin: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    status: string;
    roleName: string | null;
  } | null;
  stats: StatsResponse;
  auditLogs: AuditLogEntry[];
}

export async function getCompanyDetails(
  companyId: string,
  accessToken: string | null
): Promise<CompanyDetailsResponse> {
  if (!accessToken) throw new ApiError('You must be signed in to do this.', 401);

  const res = await fetch(`${API_BASE}/companies/${companyId}/details`, {
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
  });

  const body = await res.json().catch(() => null);
  if (!res.ok || body?.success === false) {
    const msg = body?.message || `Request failed (${res.status})`;
    throw new ApiError(msg, res.status);
  }

  return (body?.data && body.data.data) ? body.data.data : body.data;
}

export async function getCompanyStats(companyId: string, accessToken: string | null): Promise<StatsResponse> {
  if (!accessToken) throw new ApiError('You must be signed in to do this.', 401);

  const res = await fetch(`${API_BASE}/companies/${companyId}/stats`, {
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
  });

  const body = await res.json().catch(() => null);
  if (!res.ok || body?.success === false) {
    const msg = body?.message || `Request failed (${res.status})`;
    throw new ApiError(msg, res.status);
  }

  return (body?.data && body.data.data) ? body.data.data : body.data;
}

export interface CompanyAnalytics {
  period: 'monthly' | 'yearly';
  year: number | null;
  generatedAt: string;
  summary: { users: number; clients: number; candidates: number; cases: number; checks: number; completedChecks: number; failedChecks: number; pendingChecks: number; completedCases: number; reports: number; auditEvents: number; completionRate: number; averageTurnaroundDays: number };
  trends: { cases: Array<Record<string, string | number>>; clients: Array<Record<string, string | number>>; candidates: Array<Record<string, string | number>>; checks: Array<Record<string, string | number>>; reports: Array<Record<string, string | number>>; auditEvents: Array<Record<string, string | number>> };
  statusMix: { status: string; value: number }[];
  checkTypes: { type: string; total: number; completed: number; failed: number }[];
  clients: { name: string; cases: number; completed: number }[];
  growth: { clients: number; users: number; candidates: number };
}

export async function getCompanyAnalytics(period: 'monthly' | 'yearly', accessToken: string | null, year?: number): Promise<CompanyAnalytics> {
  if (!accessToken) throw new ApiError('You must be signed in to do this.', 401);
  const yearQuery = year ? `&year=${year}` : '';
  const res = await fetch(`${API_BASE}/companies/analytics?period=${period}${yearQuery}`, { headers: { Authorization: `Bearer ${accessToken}` } });
  const body = await res.json().catch(() => null);
  if (!res.ok || body?.success === false) throw new ApiError(body?.message || `Request failed (${res.status})`, res.status);
  return (body?.data && body.data.data) ? body.data.data : body.data;
}

export default { getCompanyStats, getCompanyDetails };