import type { Permission } from "@/src/types/permission";

const API_BASE =
  process.env.NEXT_PUBLIC_API ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  '/api/v1';

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

// Same double-wrapped envelope as /clients, /assessments, /companies:
// { success, message: "Success", data: { message: "...", data: T } }
// The permissions list has no pagination meta, so there's no `meta` field here.
type Envelope<T> = ApiResponse<{ message: string; data: T }>;

async function request<T>(
  path: string,
  accessToken: string | null | undefined,
  init?: RequestInit
): Promise<T> {
  if (!accessToken) {
    // Calling an authenticated endpoint without a token would otherwise send
    // "Authorization: Bearer undefined" and fail with a confusing 401/403.
    // Fail fast with a clear message instead.
    throw new ApiError("You must be signed in to do this.", 401);
  }

  const url = `${API_BASE}${path}`;

  const res = await fetch(url, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  const body = await res.json().catch(() => null);

  if (!res.ok || body?.success === false) {
    const msgObj = body?.message;
    const message =
      (typeof msgObj === "object" && msgObj?.message) ||
      (typeof msgObj === "string" ? msgObj : null) ||
      `Request failed (${res.status})`;
    throw new ApiError(message, res.status);
  }

  return body as T;
}

/* -------------------------------------------------------------------------- */
/*                                   LIST                                     */
/* -------------------------------------------------------------------------- */

// Always fetches the flat (ungrouped) list — the frontend groups by module
// itself so it can also search/filter across the full set in one pass.
export async function listPermissions(
  accessToken: string | null
): Promise<Permission[]> {
  const res = await request<Envelope<Permission[]>>("/permissions?grouped=false", accessToken);
  return res.data.data;
}

export { ApiError };