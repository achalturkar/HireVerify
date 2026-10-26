import type {
  User,
  RoleRef,
  CompanyRef,
  CreateUserPayload,
  UpdateUserPayload,
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

export async function listDeletedUsers(
  token: string | null,
  params: ListUsersParams
): Promise<{ items: User[]; meta: PaginationMeta }> {
  const query = buildQuery({
    page: params.page,
    limit: params.limit,
    search: params.search,
    companyId: params.companyId,
    sortBy: params.sortBy,
    sortOrder: params.sortOrder,
  });
  const json = await authFetch(`/users/deleted${query}`, token, { method: 'GET' });
  return { items: json.data.data as User[], meta: json.data.meta as PaginationMeta };
}

export async function getUser(token: string | null, id: string): Promise<User> {
  const json = await authFetch(`/users/${id}`, token, { method: 'GET' });
  return json.data.data as User;
}

export async function createUser(token: string | null, payload: CreateUserPayload): Promise<User> {
  const json = await authFetch('/users', token, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return json.data.data as User;
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
  return json.data.data as User;
}

export async function deleteUser(token: string | null, id: string): Promise<void> {
  await authFetch(`/users/${id}`, token, { method: 'DELETE' });
}

export async function permanentlyDeleteUser(token: string | null, id: string): Promise<void> {
  await authFetch(`/users/${id}/permanent`, token, { method: 'DELETE' });
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