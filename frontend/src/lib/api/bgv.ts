import type { BGVCase, BGVCaseStatus, BGVOverallResult, CreateBGVCasePayload, VerificationCheck, VerificationProvider, VerificationResult, VerificationStatus, VerificationType } from '@/src/types/bgv';
import type { PaginationMeta } from '@/src/types/user';

const API_BASE = process.env.NEXT_PUBLIC_API ?? '/api/v1';
export const API_ORIGIN = API_BASE.startsWith('http') ? new URL(API_BASE).origin : '';
export const resolveFileUrl = (fileUrl: string) => fileUrl.startsWith('http') ? fileUrl : `${API_ORIGIN}${fileUrl}`;

export class ApiError extends Error { status: number; constructor(message: string, status: number) { super(message); this.status = status; } }

async function request<T>(path: string, token: string | null | undefined, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init?.headers ?? {}) } });
  const body = await response.json().catch(() => null);
  if (!response.ok || body?.success === false) throw new ApiError(typeof body?.message === 'string' ? body.message : body?.message?.message ?? `Request failed (${response.status})`, response.status);
  return body.data;
}

function query(params: Record<string, string | number | undefined>) { const values = new URLSearchParams(); Object.entries(params).forEach(([key, value]) => { if (value !== undefined && value !== '') values.set(key, String(value)); }); const text = values.toString(); return text ? `?${text}` : ''; }

export async function listBGVCases(params: { page: number; limit: number; search?: string; clientId?: string; candidateId?: string; status?: BGVCaseStatus | ''; overallResult?: BGVOverallResult | ''; initiatedFrom?: string; initiatedTo?: string }, token: string | null): Promise<{ items: BGVCase[]; meta: PaginationMeta }> {
  const data = await request<{ data: BGVCase[]; meta: PaginationMeta }>(`/bgv/cases${query(params)}`, token);
  return { items: data.data, meta: data.meta };
}

export async function exportBGVCases(params: { search?: string; clientId?: string; candidateId?: string; status?: BGVCaseStatus | ''; overallResult?: BGVOverallResult | ''; initiatedFrom?: string; initiatedTo?: string }, token: string | null): Promise<Blob> {
  const response = await fetch(`${API_BASE}/bgv/cases/export${query(params)}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!response.ok) throw new ApiError('Could not export BGV cases', response.status);
  return response.blob();
}

export async function getBGVCase(id: string, token: string | null): Promise<BGVCase> { const data = await request<{ data: BGVCase }>(`/bgv/cases/${id}`, token); return data.data; }
export async function createBGVCase(payload: CreateBGVCasePayload, token: string | null): Promise<BGVCase> { const data = await request<{ data: BGVCase }>('/bgv/cases', token, { method: 'POST', body: JSON.stringify(payload) }); return data.data; }
export async function deleteBGVCase(id: string, token: string | null): Promise<void> { await request(`/bgv/cases/${id}`, token, { method: 'DELETE' }); }
export async function transitionBGVCase(id: string, status: BGVCaseStatus, remarks: string | undefined, token: string | null): Promise<BGVCase> { const data = await request<{ data: BGVCase }>(`/bgv/cases/${id}/status`, token, { method: 'PATCH', body: JSON.stringify({ status, remarks }) }); return data.data; }

export async function listVerifications(caseId: string | undefined, token: string | null, type?: VerificationType, status?: VerificationStatus): Promise<VerificationCheck[]> { const data = await request<{ data: VerificationCheck[] }>(`/bgv/verifications${query({ caseId, type, status })}`, token); return data.data; }
export async function retryVerification(id: string, token: string | null): Promise<VerificationCheck> { const data = await request<{ data: VerificationCheck }>(`/bgv/verifications/${id}/retry`, token, { method: 'POST' }); return data.data; }
export async function createVerification(payload: { caseId: string; type: VerificationType; provider?: VerificationProvider; priority?: number; inputData?: Record<string, unknown> }, token: string | null): Promise<VerificationCheck> { const data = await request<{ data: VerificationCheck }>('/bgv/verifications', token, { method: 'POST', body: JSON.stringify(payload) }); return data.data; }
export async function updateVerificationResult(id: string, payload: { status: VerificationStatus; result?: VerificationResult; resultData?: Record<string, unknown>; remarks?: string }, token: string | null): Promise<VerificationCheck> { const data = await request<{ data: VerificationCheck }>(`/bgv/verifications/${id}`, token, { method: 'PATCH', body: JSON.stringify(payload) }); return data.data; }
export async function lockVerification(id: string, locked: boolean, token: string | null): Promise<VerificationCheck> { const data = await request<{ data: VerificationCheck }>(`/bgv/verifications/${id}/lock`, token, { method: 'PATCH', body: JSON.stringify({ locked }) }); return data.data; }
export async function uploadVerificationDocument(id: string, file: File, documentType: string, token: string | null): Promise<VerificationCheck> { const form = new FormData(); form.append('file', file); form.append('documentType', documentType); const response = await fetch(`${API_BASE}/bgv/verifications/${id}/documents`, { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body: form }); const body = await response.json().catch(() => null); if (!response.ok || body?.success === false) throw new ApiError(typeof body?.message === 'string' ? body.message : body?.message?.message || `Request failed (${response.status})`, response.status); return body.data; }
export async function deleteVerificationDocument(id: string, documentId: string, token: string | null): Promise<VerificationCheck> { const data = await request<{ data: VerificationCheck }>(`/bgv/verifications/${id}/documents/${documentId}`, token, { method: 'DELETE' }); return data.data; }
export async function downloadBGVReport(id: string, token: string | null): Promise<Blob> { const response = await fetch(`${API_BASE}/bgv/cases/${id}/report`, { headers: token ? { Authorization: `Bearer ${token}` } : {} }); if (!response.ok) throw new ApiError('Could not generate BGV report', response.status); return response.blob(); }
export async function executePan(id: string, pan: string, token: string | null): Promise<VerificationCheck> { const data = await request<{ data: VerificationCheck }>(`/bgv/verifications/${id}/execute-pan`, token, { method: 'POST', body: JSON.stringify({ pan }) }); return data.data; }
export async function downloadVerificationPdf(id: string, token: string | null): Promise<Blob> { const response = await fetch(`${API_BASE}/bgv/verifications/${id}/pdf`, { headers: { Authorization: `Bearer ${token}` } }); if (!response.ok) throw new ApiError('Could not download verification PDF', response.status); return response.blob(); }


export interface UpdateBGVCaseMetaPayload {
  clientReference?: string;
  packageName?: string;
  initiatedAt?: string | null;
  completedAt?: string | null;
  remarks?: string;
}
 
export async function updateBGVCaseMeta(
  id: string,
  payload: UpdateBGVCaseMetaPayload,
  token: string | null
): Promise<BGVCase> {
  const data = await request<{ data: BGVCase }>(`/bgv/cases/${id}`, token, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  return data.data;
}

export async function updateBGVCaseChecks(id: string, checks: { type: VerificationType; provider?: VerificationProvider; priority?: number }[], token: string | null): Promise<BGVCase> {
  const data = await request<{ data: BGVCase }>(`/bgv/cases/${id}/checks`, token, { method: 'PATCH', body: JSON.stringify({ checks }) });
  return data.data;
}

export type { BGVCaseStatus, VerificationProvider, VerificationResult, VerificationStatus, VerificationType };
