import type { Candidate, CandidateStatus } from '@/src/types/candidate';

const API_BASE = process.env.NEXT_PUBLIC_API || '/api/v1';

export interface CandidateCompanySummary {
  id: string;
  name: string;
  shortCode: string | null;
  candidateCount: number;
}

export interface PlatformCandidate extends Candidate {
  company: { id: string; name: string; shortCode: string | null };
  client: { id: string; name: string };
}

export interface PlatformCandidateResult {
  items: PlatformCandidate[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    summary: { total: number; companies: CandidateCompanySummary[] };
  };
}

export async function listPlatformCandidates(params: {
  page: number;
  limit: number;
  search?: string;
  companyId?: string;
  status?: CandidateStatus | '';
}, accessToken: string | null): Promise<PlatformCandidateResult> {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) query.set(key, String(value));
  });

  const response = await fetch(`${API_BASE}/platform/candidates?${query.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.message || 'Unable to load candidates');

  return { items: body.data.data, meta: body.data.meta };
}