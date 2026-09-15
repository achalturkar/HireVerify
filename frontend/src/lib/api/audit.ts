const API_BASE = process.env.NEXT_PUBLIC_API || '/api/v1';

export interface AuditCompany {
  id: string;
  name: string;
  shortCode: string | null;
}

export interface AuditActor {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface AuditLog {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  metadata: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  company: AuditCompany | null;
  user: AuditActor | null;
}

export interface AuditLogParams {
  page: number;
  limit: number;
  search?: string;
  companyId?: string;
  action?: string;
  entity?: string;
  from?: string;
  to?: string;
}

export interface AuditLogResult {
  items: AuditLog[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export async function listAuditLogs(params: AuditLogParams, accessToken: string | null): Promise<AuditLogResult> {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) query.set(key, String(value));
  });

  const response = await fetch(`${API_BASE}/audit-logs?${query.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.message || 'Unable to load audit logs');

  return { items: body.data.data, meta: body.data.meta };
}