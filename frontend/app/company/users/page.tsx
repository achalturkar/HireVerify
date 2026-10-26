'use client';

import { useCallback, useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { User, UserStatus, RoleRef, CompanyRef } from '@/src/types/user';
import {
  listUsers,
  createUser,
  updateUser,
  deleteUser,
  listDeletedUsers,
  permanentlyDeleteUser,
  listRolesForCompany,
  listCompanyOptions,
} from '@/src/lib/api/user.api';
import { useAuth } from '@/src/hooks/useAuth'; // ← adjust this path if useAuth lives elsewhere
import { UserTable } from '@/src/components/users/UserTable';
import { Pagination } from '@/src/components/roles/Pagination';
import { UserFormPanel, type UserFormSubmitValues } from '@/src/components/users/UserFormPanel';
import { DeleteUserDialog } from '@/src/components/users/DeleteUserDialog';
import { GeneratedPasswordDialog } from '@/src/components/users/GeneratedPasswordDialog';
import { ApiError } from '@/src/lib/api/http';

const LIMIT = 20;

export default function UsersPage() {
  // Same assumption as the roles page: useAuth() returns `user` shaped like
  // your backend's req.user (role.isSuperAdmin, companyId, a flat
  // `permissions` string array). Adjust the lines below if it differs.
  const { accessToken, user: currentUser } = useAuth();
  const isSuperAdmin = currentUser?.role?.isSuperAdmin ?? false;
  const currentCompanyId: string | null = currentUser?.companyId ?? null;
  const currentPermissions: string[] = currentUser?.permissions ?? [];
  const can = (key: string) => isSuperAdmin || currentPermissions.includes(key);

  const canCreate = can('users.create');
  const canUpdate = can('users.update');
  const canDelete = can('users.delete');

  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState<UserStatus | ''>('');
  const [companyFilter, setCompanyFilter] = useState(''); // super admin only
  const [sortBy, setSortBy] = useState<'firstName' | 'lastName' | 'email' | 'createdAt'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showDeletedUsers, setShowDeletedUsers] = useState(false);
  const [permanentDeleteId, setPermanentDeleteId] = useState<string | null>(null);

  const [companies, setCompanies] = useState<CompanyRef[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [panelOpen, setPanelOpen] = useState(false);
  const [panelMode, setPanelMode] = useState<'create' | 'edit'>('create');
  const [activeUser, setActiveUser] = useState<User | null>(null);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [generated, setGenerated] = useState<{ email: string; password: string } | null>(null);

  // Debounce the free-text search box.
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const fetchUsers = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setLoadError(null);
    try {
      const params = {
        page,
        limit: LIMIT,
        search: search || undefined,
        status: statusFilter || undefined,
        companyId: isSuperAdmin && companyFilter ? companyFilter : undefined,
        sortBy,
        sortOrder,
      };
      const result = showDeletedUsers
        ? await listDeletedUsers(accessToken, params)
        : await listUsers(accessToken, params);
      setUsers(result.items);
      setTotal(result.meta.total ?? result.items.length);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Could not load users.');
    } finally {
      setLoading(false);
    }
  }, [accessToken, page, search, statusFilter, companyFilter, isSuperAdmin, sortBy, sortOrder, showDeletedUsers]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void fetchUsers(); }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchUsers]);

  useEffect(() => {
    if (!accessToken || !isSuperAdmin) return;
    listCompanyOptions(accessToken)
      .then(setCompanies)
      .catch(() => setCompanies([]));
  }, [accessToken, isSuperAdmin]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const fetchRolesForCompany = useCallback(
    (companyId: string): Promise<RoleRef[]> => listRolesForCompany(accessToken, companyId),
    [accessToken]
  );

  function handleSortChange(field: 'firstName' | 'lastName' | 'email' | 'createdAt') {
    if (field === sortBy) {
      setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
    setPage(1);
  }

  function openCreate() {
    setPanelMode('create');
    setActiveUser(null);
    setPanelOpen(true);
  }

  function openEdit(user: User) {
    setPanelMode('edit');
    setActiveUser(user);
    setPanelOpen(true);
  }

  async function handleSubmit(values: UserFormSubmitValues) {
    if (panelMode === 'create') {
      const created = await createUser(accessToken, {
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email!,
        phone: values.phone || undefined,
        roleId: values.roleId,
        companyId: isSuperAdmin ? values.companyId : undefined,
        password: values.password,
      });
      setToast('User invited');
      if (created.generatedPassword) {
        setGenerated({ email: created.email, password: created.generatedPassword });
      }
    } else if (activeUser) {
      await updateUser(accessToken, activeUser.id, {
        firstName: values.firstName,
        lastName: values.lastName,
        phone: values.phone || undefined,
        roleId: values.roleId,
        status: values.status,
      });
      setToast('User updated');
    }
    setPanelOpen(false);
    await fetchUsers();
  }

  async function handleDelete(user: User) {
    await deleteUser(accessToken, user.id);
    setToast('User deleted');
    setUserToDelete(null);
    if (users.length === 1 && page > 1) {
      setPage((p) => p - 1);
    } else {
      await fetchUsers();
    }
  }

  async function handlePermanentDelete(user: User) {
    if (!window.confirm(`Permanently delete ${user.email}? This cannot be undone. The email will then be available for a new account.`)) return;
    setPermanentDeleteId(user.id);
    setLoadError(null);
    try {
      await permanentlyDeleteUser(accessToken, user.id);
      setToast('Deleted user permanently removed. The email can now be reused.');
      if (users.length === 1 && page > 1) {
        setPage((currentPage) => currentPage - 1);
      } else {
        await fetchUsers();
      }
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Could not permanently delete user.');
    } finally {
      setPermanentDeleteId(null);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-7">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p
            className="text-[11px] uppercase tracking-[0.14em] text-[var(--primary)] mb-1.5"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            User Management
          </p>
          <h1
            className="text-[26px] font-semibold tracking-tight text-[var(--foreground)]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Users
          </h1>
          <p className="text-[13.5px] text-[var(--muted)] mt-1">
            {isSuperAdmin
              ? 'Manage users across every company, or filter down to one.'
              : 'Manage who has access to your workspace and what they can do.'}
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="rounded-2xl bg-[var(--surface)] px-4 py-3 text-[13px] text-[var(--foreground)] border border-[var(--border)]">
            <span className="block text-[11px] text-[var(--muted)]">{showDeletedUsers ? 'Deleted users' : 'Total users'}</span>
            <span className="text-[20px] font-semibold">{total}</span>
          </div>
          {isSuperAdmin && (
            <button
              type="button"
              onClick={() => {
                setShowDeletedUsers((showing) => !showing);
                setPage(1);
                setStatusFilter('');
              }}
              className="rounded-lg border border-[var(--border)] px-4 py-2.5 text-[13px] font-semibold text-[var(--foreground)] hover:border-[var(--primary)]"
            >
              {showDeletedUsers ? 'Active users' : 'Deleted users'}
            </button>
          )}
          {!showDeletedUsers && canCreate && (
            <button
              type="button"
              onClick={openCreate}
              className="flex items-center gap-1.5 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] text-[13px] font-semibold px-4 py-2.5 hover:opacity-90 transition-opacity shrink-0"
            >
              Invite user
            </button>
          )}
        </div>
      </div>

      {/* Toasts */}
      {toast && (
        <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-[13px] text-emerald-500 flex items-center justify-between">
          <span>{toast}</span>
          <button onClick={() => setToast(null)} className="opacity-70 hover:opacity-100 ml-3">
            ✕
          </button>
        </div>
      )}

      {loadError && (
        <div className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-[13px] text-red-500 flex items-center justify-between">
          <span>{loadError}</span>
          <button onClick={() => setLoadError(null)} className="opacity-70 hover:opacity-100 ml-3">
            ✕
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 h-[15px] w-[15px] text-[var(--muted)]"
            viewBox="0 0 16 16"
            fill="none"
          >
            <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.4" />
            <path d="M11 11L14.5 14.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search name or email…"
            className="w-full rounded-lg bg-[var(--surface)] border border-[var(--border)] pl-9 pr-3 py-2.5 text-[13.5px] text-[var(--foreground)] placeholder:text-[var(--muted)] outline-none focus:border-[var(--primary)]/50 focus:ring-1 focus:ring-[var(--primary)]/30 transition-colors"
          />
        </div>

        {!showDeletedUsers && <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as UserStatus | '');
            setPage(1);
          }}
          className="rounded-lg bg-[var(--surface)] border border-[var(--border)] px-3 py-2.5 text-[13px] text-[var(--foreground)] outline-none focus:border-[var(--primary)]/50 transition-colors"
        >
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="SUSPENDED">Suspended</option>
          <option value="INACTIVE">Inactive</option>
        </select>}

        {isSuperAdmin && (
          <select
            value={companyFilter}
            onChange={(e) => {
              setCompanyFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg bg-[var(--surface)] border border-[var(--border)] px-3 py-2.5 text-[13px] text-[var(--foreground)] outline-none focus:border-[var(--primary)]/50 transition-colors"
          >
            <option value="">All companies</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Table card */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16 text-[13px] text-[var(--muted)]">Loading users…</div>
        ) : (
          <>
            {!showDeletedUsers ? <UserTable
              users={users}
              showCompanyColumn={isSuperAdmin && !companyFilter}
              canUpdate={canUpdate}
              canDelete={canDelete}
              currentUserId={currentUser?.id}
              onEdit={openEdit}
              onDelete={setUserToDelete}
              onSortChange={handleSortChange}
              sortBy={sortBy}
              sortOrder={sortOrder}
            /> : (
              <div className="overflow-x-auto">
                {users.length ? (
                  <table className="min-w-[760px] w-full text-left">
                    <thead>
                      <tr className="border-b border-[var(--border)] text-[11px] uppercase tracking-wide text-[var(--muted)]">
                        <th className="px-5 py-3 font-medium">Name</th>
                        <th className="px-5 py-3 font-medium">Email</th>
                        <th className="px-5 py-3 font-medium">Company / client</th>
                        <th className="px-5 py-3 font-medium">Role</th>
                        <th className="px-5 py-3 font-medium">Deleted</th>
                        <th className="px-5 py-3 text-right font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((user) => (
                        <tr key={user.id} className="border-t border-[var(--border)]">
                          <td className="px-5 py-3 text-[13px] font-medium text-[var(--foreground)]">{user.firstName} {user.lastName}</td>
                          <td className="px-5 py-3 text-[13px] text-[var(--muted)]">{user.email}</td>
                          <td className="px-5 py-3 text-[13px] text-[var(--muted)]">{user.client?.name || user.company?.name || '—'}</td>
                          <td className="px-5 py-3 text-[13px] text-[var(--muted)]">{user.role?.name || '—'}{user.clientId && <span className="ml-1 text-[10px]">(client portal)</span>}</td>
                          <td className="px-5 py-3 text-[12px] text-[var(--muted)]">{user.deletedAt ? new Date(user.deletedAt).toLocaleDateString() : '—'}</td>
                          <td className="px-5 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => void handlePermanentDelete(user)}
                              disabled={permanentDeleteId === user.id}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 px-2.5 py-1.5 text-[11px] font-semibold text-red-600 hover:bg-red-500/10 disabled:opacity-50"
                            >
                              <Trash2 size={13} />{permanentDeleteId === user.id ? 'Deleting…' : 'Delete permanently'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="m-4 rounded-lg border border-dashed border-[var(--border)] py-12 text-center text-[13px] text-[var(--muted)]">No deleted users found.</p>
                )}
              </div>
            )}
            <Pagination page={page} limit={LIMIT} total={total} onPageChange={setPage} />
          </>
        )}
      </div>

      <UserFormPanel
        open={panelOpen}
        mode={panelMode}
        user={activeUser}
        companies={companies}
        isSuperAdmin={isSuperAdmin}
        defaultCompanyId={currentCompanyId}
        onClose={() => setPanelOpen(false)}
        onSubmit={handleSubmit}
        onFetchRoles={fetchRolesForCompany}
      />

      <DeleteUserDialog user={userToDelete} onCancel={() => setUserToDelete(null)} onConfirm={handleDelete} />

      <GeneratedPasswordDialog
        email={generated?.email ?? null}
        password={generated?.password ?? null}
        onClose={() => setGenerated(null)}
      />
    </div>
  );
}