import type {
  User,
  RoleRef,
  CompanyRef,
  CreateUserPayload,
  UpdateUserPayload,
  UpdateProfilePayload,
  ChangePasswordPayload,
  ListUsersParams,
  PaginationMeta,
} from '@/src/types/user';
import { authFetch, ApiError } from './http';

export { ApiError };

function buildQuery(params: Record<string, string | number | undefined>) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '') qs.set(k, String(v));
  });
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export async function listUsers(
  token: string | null,
  params: ListUsersParams
): Promise<{ items: User[]; meta: PaginationMeta }> {
  const query = buildQuery({
    page: params.page,
    limit: params.limit,
    search: params.search,
    status: params.status,
    companyId: params.companyId,
    sortBy: params.sortBy,
    sortOrder: params.sortOrder,
  });
  const json = await authFetch(`/users${query}`, token, { method: 'GET' });
  return { items: json.data.data as User[], meta: json.data.meta as PaginationMeta };
}

export async function getUser(token: string | null, id: string): Promise<User> {
  const json = await authFetch(`/users/${id}`, token, { method: 'GET' });
  return json.data as User;
}

export async function createUser(token: string | null, payload: CreateUserPayload): Promise<User> {
  const json = await authFetch('/users', token, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return json.data as User;
}

export async function updateUser(
  token: string | null,
  id: string,
  payload: UpdateUserPayload
): Promise<User> {
  const json = await authFetch(`/users/${id}`, token, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  return json.data as User;
}

export async function deleteUser(token: string | null, id: string): Promise<void> {
  await authFetch(`/users/${id}`, token, { method: 'DELETE' });
}

/* ------------------------------------------------------------------
   Self-service: /users/me, /users/me/password
   No admin permission required — the backend scopes these to the
   caller's own id, so there's no :id param here to worry about.
------------------------------------------------------------------- */

export async function getMyProfile(token: string | null): Promise<User> {
  const json = await authFetch('/users/me', token, { method: 'GET' });
  return json.data as User;
}

export async function updateProfile(
  token: string | null,
  payload: UpdateProfilePayload
): Promise<User> {
  const json = await authFetch('/users/me', token, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  return json.data as User;
}

export async function changePassword(
  token: string | null,
  payload: ChangePasswordPayload
): Promise<void> {
  await authFetch('/users/me/password', token, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

// Lightweight lookups for the create/edit form.
export async function listRolesForCompany(token: string | null, companyId?: string): Promise<RoleRef[]> {
  const query = buildQuery({ companyId, limit: 100 });
  const json = await authFetch(`/roles${query}`, token, { method: 'GET' });
  return (json.data.data as RoleRef[]).filter((r) => !r.isSuperAdmin);
}

export async function listCompanyOptions(token: string | null, search?: string): Promise<CompanyRef[]> {
  const query = buildQuery({ search, limit: 50 });
  const json = await authFetch(`/companies${query}`, token, { method: 'GET' });
  return json.data.data as CompanyRef[];
}