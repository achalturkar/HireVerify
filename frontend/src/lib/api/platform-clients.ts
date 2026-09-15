import type { Client, ClientStatus } from '@/src/types/client';

const API_BASE = process.env.NEXT_PUBLIC_API || '/api/v1';

export interface PlatformClient extends Client {
  company: { id: string; name: string; shortCode: string | null };
  _count: { candidates: number; bgvCases: number };
}

export interface ClientCompanySummary {
  id: string;
  name: string;
  shortCode: string | null;
  clientCount: number;
}

export interface PlatformClientResult {
  items: PlatformClient[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    summary: { total: number; companies: ClientCompanySummary[] };
  };
}

export async function listPlatformClients(params: {
  page: number;
  limit: number;
  search?: string;
  companyId?: string;
  status?: ClientStatus | '';
}, accessToken: string | null): Promise<PlatformClientResult> {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) query.set(key, String(value));
  });

  const response = await fetch(`${API_BASE}/platform/clients?${query.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.message || 'Unable to load clients');

  return { items: body.data.data, meta: body.data.meta };
}