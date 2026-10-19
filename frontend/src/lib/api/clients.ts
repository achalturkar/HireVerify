import type {
  Client,
  CreateClientPayload,
  UpdateClientPayload,
  ListClientsParams,
  PaginationMeta,
  ClientPortalPermission,
  ClientPortalAccountMethod,
  ClientPortalUser,
  ClientStatus,
} from "@/src/types/client";

const API_BASE =
  process.env.NEXT_PUBLIC_API || '/api/v1' ||
  "http://localhost:5001/api/";

class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

// Every endpoint on this API wraps its real payload two levels deep:
// { success, message: "Success", data: { message: "...", data: T, meta? } }
type Envelope<T> = ApiResponse<{ message: string; data: T; meta?: PaginationMeta }>;

/**
 * Pulls a human-readable string out of whatever shape the backend sent.
 * `message` can be: a plain string, an object with its own `.message`,
 * or (from express-validator via the `validate` middleware) an object or
 * top-level field carrying an `errors` array of { msg } / { message }
 * entries. Previously this only handled the first two, so any real
 * validation failure (bad logoUrl, bad email, etc) silently collapsed
 * into "Request failed (400)" instead of telling you what was wrong.
 */
function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function extractErrorMessage(body: unknown, status: number): string {
  const payload = asRecord(body);
  const raw = payload.message;

  if (typeof raw === "string" && raw.trim()) return raw;

  if (raw && typeof raw === "object") {
    const error = asRecord(raw);
    if (typeof error.message === "string" && error.message.trim()) return error.message;
    if (Array.isArray(error.errors) && error.errors.length > 0) {
      const first = error.errors[0];
      if (typeof first === "string") return first;
      const firstRecord = asRecord(first);
      if (typeof firstRecord.msg === "string") return firstRecord.msg;
      if (typeof firstRecord.message === "string") return firstRecord.message;
    }
  }

  // Some validate-middleware setups put `errors` at the top level instead
  // of nested under `message` — check there too before giving up.
  if (Array.isArray(payload.errors) && payload.errors.length > 0) {
    const first = payload.errors[0];
    if (typeof first === "string") return first;
    const firstRecord = asRecord(first);
    if (typeof firstRecord.msg === "string") return firstRecord.msg;
    if (typeof firstRecord.message === "string") return firstRecord.message;
  }

  return `Request failed (${status})`;
}

async function request<T>(
  path: string,
  accessToken: string | null | undefined,
  init?: RequestInit
): Promise<T> {
  if (!accessToken) {
    throw new ApiError("You must be signed in to do this.", 401);
  }

  const url = `${API_BASE}${path}`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    ...(init?.headers ? Object.fromEntries(new Headers(init.headers).entries()) : {}),
  };

  if (!(init?.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(url, {
    credentials: "include",
    headers,
    ...init,
  });

  const body = await res.json().catch(() => null);

  if (!res.ok || body?.success === false) {
    throw new ApiError(extractErrorMessage(body, res.status), res.status);
  }

  return body as T;
}

function buildQuery(
  params: Record<string, string | number | boolean | undefined>
) {
  const qs = new URLSearchParams();

  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== "") {
      qs.set(k, String(v));
    }
  });

  const s = qs.toString();
  return s ? `?${s}` : "";
}

/* -------------------------------------------------------------------------- */
/*                                   LIST                                     */
/* -------------------------------------------------------------------------- */

export async function listClients(
  params: ListClientsParams,
  accessToken: string | null
): Promise<{ items: Client[]; meta: PaginationMeta }> {
  const query = buildQuery({
    page: params.page,
    limit: params.limit,
    search: params.search,
    status: params.status,
    includeDeleted: params.includeDeleted,
    deletedOnly: params.deletedOnly,
    sortBy: params.sortBy,
    sortOrder: params.sortOrder,
  });

  const res = await request<Envelope<Client[]>>(`/clients${query}`, accessToken);

  return {
    items: res.data.data,
    meta: res.data.meta as PaginationMeta,
  };
}

/* -------------------------------------------------------------------------- */
/*                                  GET ONE                                   */
/* -------------------------------------------------------------------------- */

export async function getClient(
  id: string,
  accessToken: string | null
): Promise<Client> {
  const res = await request<Envelope<Client>>(`/clients/${id}`, accessToken);
  return res.data.data;
}

export interface ClientAnalytics {
  range: { from: string; to: string; groupBy: 'month' | 'year' };
  summary: {
    candidates: number;
    cases: number;
    completedCases: number;
    openCases: number;
    reports: number;
    invoices: number;
    invoicedAmount: number;
    taxAmount: number;
    collectedAmount: number;
    outstandingAmount: number;
    completionRate: number;
  };
  trend: {
    key: string;
    label: string;
    candidates: number;
    cases: number;
    completedCases: number;
    reports: number;
    invoices: number;
    invoicedAmount: number;
    collectedAmount: number;
  }[];
  distributions: {
    candidatesByStatus: { name: string; value: number }[];
    casesByStatus: { name: string; value: number }[];
    casesByResult: { name: string; value: number }[];
    invoicesByStatus: { name: string; value: number }[];
    checksByType: { type: string; total: number; completed: number; failed: number; pending: number }[];
  };
  recentCases: {
    id: string;
    caseNumber: string;
    status: string;
    overallResult: string;
    createdAt: string;
    completedAt: string | null;
    candidateName: string;
    candidate: { candidateCode: string };
  }[];
  recentInvoices: {
    id: string;
    invoiceNumber: string;
    status: string;
    invoiceDate: string;
    dueDate: string;
    currency: string;
    total: number;
    paid: number;
    balance: number;
  }[];
}

export async function getClientAnalytics(
  id: string,
  params: { from: string; to: string; groupBy: 'month' | 'year' },
  accessToken: string | null,
): Promise<ClientAnalytics> {
  const query = buildQuery({ from: params.from, to: params.to, groupBy: params.groupBy });
  const res = await request<Envelope<ClientAnalytics>>(`/clients/${id}/analytics${query}`, accessToken);
  return res.data.data;
}

export async function downloadClientAnalyticsReport(
  id: string,
  params: { from: string; to: string },
  accessToken: string | null,
): Promise<Blob> {
  if (!accessToken) throw new ApiError('You must be signed in to do this.', 401);
  const query = buildQuery(params);
  const response = await fetch(`${API_BASE}/clients/${id}/analytics/export${query}`, {
    credentials: 'include',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ApiError(extractErrorMessage(body, response.status), response.status);
  }
  return response.blob();
}

export type SubclientPayload = {
  name: string;
  clientCode: string;
  industry?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  gstNumber?: string;
  panNumber?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  status?: ClientStatus;
  serviceRates: { checkType: string; rate: number }[];
  packageRate: number;
};

export async function listSubclients(parentClientId: string, accessToken: string | null): Promise<Client[]> {
  const res = await request<Envelope<Client[]>>(`/clients/${parentClientId}/subclients`, accessToken);
  return res.data.data;
}

export async function createSubclient(parentClientId: string, payload: SubclientPayload, accessToken: string | null): Promise<Client> {
  const res = await request<Envelope<Client>>(`/clients/${parentClientId}/subclients`, accessToken, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return res.data.data;
}

export async function updateSubclient(parentClientId: string, subclientId: string, payload: Partial<SubclientPayload>, accessToken: string | null): Promise<Client> {
  const res = await request<Envelope<Client>>(`/clients/${parentClientId}/subclients/${subclientId}`, accessToken, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  return res.data.data;
}

export async function deleteSubclient(parentClientId: string, subclientId: string, accessToken: string | null): Promise<void> {
  await request<ApiResponse<{ message: string }>>(`/clients/${parentClientId}/subclients/${subclientId}`, accessToken, { method: 'DELETE' });
}

/* -------------------------------------------------------------------------- */
/*                                  CREATE                                    */
/* -------------------------------------------------------------------------- */

export async function createClient(
  payload: CreateClientPayload | FormData,
  accessToken: string | null
): Promise<Client> {
  const res = await request<Envelope<Client>>("/clients", accessToken, {
    method: "POST",
    body: payload instanceof FormData ? payload : JSON.stringify(payload),
  });

  return res.data.data;
}

/* -------------------------------------------------------------------------- */
/*                                   UPDATE                                   */
/* -------------------------------------------------------------------------- */

export async function updateClient(
  id: string,
  payload: UpdateClientPayload | FormData,
  accessToken: string | null
): Promise<Client> {
  const res = await request<Envelope<Client>>(`/clients/${id}`, accessToken, {
    method: "PUT",
    body: payload instanceof FormData ? payload : JSON.stringify(payload),
  });

  return res.data.data;
}

export async function uploadCandidateFormTemplate(
  id: string,
  payload: { file: File; name: string; category: string; required: boolean },
  accessToken: string | null,
): Promise<Client> {
  const body = new FormData();
  body.append('file', payload.file);
  body.append('name', payload.name);
  body.append('category', payload.category);
  body.append('required', String(payload.required));
  const res = await request<Envelope<Client>>(`/clients/${id}/candidate-form-templates`, accessToken, {
    method: 'POST',
    body,
  });
  return res.data.data;
}

export async function removeCandidateFormTemplate(
  id: string,
  formId: string,
  accessToken: string | null,
): Promise<Client> {
  const res = await request<Envelope<Client>>(`/clients/${id}/candidate-form-templates/${formId}`, accessToken, {
    method: 'DELETE',
  });
  return res.data.data;
}

export async function downloadCandidateFormTemplate(
  id: string,
  formId: string,
  accessToken: string | null,
): Promise<Blob> {
  if (!accessToken) throw new ApiError('You must be signed in to do this.', 401);
  const response = await fetch(`${API_BASE}/clients/${id}/candidate-form-templates/${formId}/download`, {
    credentials: 'include',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ApiError(extractErrorMessage(body, response.status), response.status);
  }
  return response.blob();
}

/* -------------------------------------------------------------------------- */
/*                                   DELETE                                   */
/* -------------------------------------------------------------------------- */

export async function deleteClient(
  id: string,
  accessToken: string | null
): Promise<void> {
  await request<ApiResponse<{ message: string }>>(`/clients/${id}`, accessToken, {
    method: "DELETE",
  });
}

export async function restoreClient(
  id: string,
  accessToken: string | null
): Promise<Client> {
  const res = await request<Envelope<Client>>(`/clients/${id}/restore`, accessToken, {
    method: 'POST',
  });
  return res.data.data;
}

/* -------------------------------------------------------------------------- */
/*                                  ACTIVATE                                  */
/* -------------------------------------------------------------------------- */

export async function activateClient(
  id: string,
  accessToken: string | null
): Promise<Client> {
  const res = await request<Envelope<Client>>(`/clients/${id}/activate`, accessToken, {
    method: "POST",
  });

  return res.data.data;
}

/* -------------------------------------------------------------------------- */
/*                                INACTIVATE                                  */
/* -------------------------------------------------------------------------- */

export async function inactivateClient(
  id: string,
  accessToken: string | null
): Promise<Client> {
  const res = await request<Envelope<Client>>(`/clients/${id}/inactivate`, accessToken, {
    method: "POST",
  });

  return res.data.data;
}

export async function listClientPortalUsers(
  id: string,
  accessToken: string | null
): Promise<ClientPortalUser[]> {
  const res = await request<Envelope<ClientPortalUser[]>>(`/clients/${id}/portal-users`, accessToken);
  return res.data.data;
}

export async function inviteClientPortalUser(
  id: string,
  payload: {
    firstName: string;
    lastName: string;
    email: string;
    permissions: ClientPortalPermission[];
    accountMethod?: ClientPortalAccountMethod;
    password?: string;
  },
  accessToken: string | null
): Promise<ClientPortalUser> {
  const res = await request<Envelope<ClientPortalUser>>(`/clients/${id}/portal-users`, accessToken, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return res.data.data;
}

export async function updateClientPortalUser(
  clientId: string,
  userId: string,
  payload: { permissions?: ClientPortalPermission[]; status?: 'ACTIVE' | 'INACTIVE' },
  accessToken: string | null
): Promise<ClientPortalUser> {
  const res = await request<Envelope<ClientPortalUser>>(`/clients/${clientId}/portal-users/${userId}`, accessToken, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  return res.data.data;
}

export async function revokeClientPortalUser(
  clientId: string,
  userId: string,
  accessToken: string | null
): Promise<void> {
  await request<ApiResponse<{ message: string }>>(`/clients/${clientId}/portal-users/${userId}`, accessToken, {
    method: 'DELETE',
  });
}

export { ApiError };