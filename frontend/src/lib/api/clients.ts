import type {
  Client,
  CreateClientPayload,
  UpdateClientPayload,
  ListClientsParams,
  PaginationMeta,
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
function extractErrorMessage(body: any, status: number): string {
  const raw = body?.message;

  if (typeof raw === "string" && raw.trim()) return raw;

  if (raw && typeof raw === "object") {
    if (typeof raw.message === "string" && raw.message.trim()) return raw.message;
    if (Array.isArray(raw.errors) && raw.errors.length > 0) {
      const first = raw.errors[0];
      if (typeof first === "string") return first;
      if (first?.msg) return String(first.msg);
      if (first?.message) return String(first.message);
    }
  }

  // Some validate-middleware setups put `errors` at the top level instead
  // of nested under `message` — check there too before giving up.
  if (Array.isArray(body?.errors) && body.errors.length > 0) {
    const first = body.errors[0];
    if (typeof first === "string") return first;
    if (first?.msg) return String(first.msg);
    if (first?.message) return String(first.message);
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

export { ApiError };