'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Role } from '@/src/types/role';
import type { Permission } from '@/src/types/permission';
import type { CompanyOption } from '@/src/types/company';
import { listRoles, createRole, updateRole, deleteRole } from '@/src/lib/api/role.api';
import { listPermissions } from '@/src/lib/api/permission.api';
import { listCompanies } from '@/src/lib/api/company.api';
import { useAuth } from '@/src/hooks/useAuth'; // ← adjust this path if useAuth lives elsewhere
import { RoleTable } from '@/src/components/roles/RoleTable';
import { Pagination } from '@/src/components/roles/Pagination';
import { RoleFormPanel, type RoleFormSubmitValues } from '@/src/components/roles/RoleFormPanel';
import { DeleteRoleDialog } from '@/src/components/roles/DeleteRoleDialog';
import { ApiError } from '@/src/lib/api/http';

const LIMIT = 20;

export default function RolesPage() {
  // ASSUMPTION: useAuth() also returns `user` with the same shape as your
  // backend's req.user (role.isSuperAdmin, role.isCompanyAdmin, a flat
  // `permissions` string array). If your hook's shape differs, adjust the
  // three lines below only — nothing else in this file needs to change.
  const { accessToken, user } = useAuth();
  const isSuperAdmin = user?.role?.isSuperAdmin ?? false;
  const permissions_ = user?.permissions ?? [];
  const can = (key: string) => isSuperAdmin || permissions_.includes(key);

  const canCreate = can('roles.create');
  const canUpdate = can('roles.update');
  const canDelete = can('roles.delete');

  const [roles, setRoles] = useState<Role[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [companyFilter, setCompanyFilter] = useState(''); // super admin only
  const [sortBy, setSortBy] = useState<'name' | 'createdAt'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [panelOpen, setPanelOpen] = useState(false);
  const [panelMode, setPanelMode] = useState<'create' | 'edit'>('create');
  const [activeRole, setActiveRole] = useState<Role | null>(null);
  const [roleToDelete, setRoleToDelete] = useState<Role | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Debounce the free-text search box.
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const fetchRoles = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setLoadError(null);
    try {
      const result = await listRoles(accessToken, {
        page,
        limit: LIMIT,
        search: search || undefined,
        companyId: isSuperAdmin && companyFilter ? companyFilter : undefined,
        sortBy,
        sortOrder,
      });
      setRoles(result.items);
      setTotal(result.meta.total ?? result.items.length);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Could not load roles.');
    } finally {
      setLoading(false);
    }
  }, [accessToken, page, search, companyFilter, isSuperAdmin, sortBy, sortOrder]);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  useEffect(() => {
    if (!accessToken) return;
    listPermissions(accessToken)
      .then(setPermissions)
      .catch(() => setPermissions([]));
    if (isSuperAdmin) {
      listCompanies(accessToken)
        .then(setCompanies)
        .catch(() => setCompanies([]));
    }
  }, [accessToken, isSuperAdmin]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  function handleSortChange(field: 'name' | 'createdAt') {
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
    setActiveRole(null);
    setPanelOpen(true);
  }

  function openEdit(role: Role) {
    setPanelMode('edit');
    setActiveRole(role);
    setPanelOpen(true);
  }

  async function handleSubmit(values: RoleFormSubmitValues) {
    if (panelMode === 'create') {
      await createRole(accessToken, {
        name: values.name,
        description: values.description || undefined,
        companyId: values.companyId,
        permissionIds: values.permissionIds,
      });
      setToast('Role created');
    } else if (activeRole) {
      await updateRole(accessToken, activeRole.id, {
        name: values.name,
        description: values.description,
        permissionIds: values.permissionIds,
      });
      setToast('Role updated');
    }
    setPanelOpen(false);
    await fetchRoles();
  }

  async function handleDelete(role: Role) {
    await deleteRole(accessToken, role.id);
    setToast('Role deleted');
    setRoleToDelete(null);
    if (roles.length === 1 && page > 1) {
      setPage((p) => p - 1);
    } else {
      await fetchRoles();
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
            Access Control
          </p>
          <h1
            className="text-[26px] font-semibold tracking-tight text-[var(--foreground)]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Roles &amp; Permissions
          </h1>
          <p className="text-[13.5px] text-[var(--muted)] mt-1">
            {isSuperAdmin
              ? 'Manage roles across every company, or filter down to one.'
              : 'Manage the roles your team uses and what each one can do.'}
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="rounded-2xl bg-[var(--surface)] px-4 py-3 text-[13px] text-[var(--foreground)] border border-[var(--border)]">
            <span className="block text-[11px] text-[var(--muted)]">Total roles</span>
            <span className="text-[20px] font-semibold">{total}</span>
          </div>
          {canCreate && (
            <button
              type="button"
              onClick={openCreate}
              className="flex items-center gap-1.5 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] text-[13px] font-semibold px-4 py-2.5 hover:opacity-90 transition-opacity shrink-0"
            >
              New role
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
            placeholder="Search roles…"
            className="w-full rounded-lg bg-[var(--surface)] border border-[var(--border)] pl-9 pr-3 py-2.5 text-[13.5px] text-[var(--foreground)] placeholder:text-[var(--muted)] outline-none focus:border-[var(--primary)]/50 focus:ring-1 focus:ring-[var(--primary)]/30 transition-colors"
          />
        </div>

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
          <div className="flex justify-center py-16 text-[13px] text-[var(--muted)]">Loading roles…</div>
        ) : (
          <>
            <RoleTable
              roles={roles}
              showCompanyColumn={isSuperAdmin && !companyFilter}
              canUpdate={canUpdate}
              canDelete={canDelete}
              onEdit={openEdit}
              onDelete={setRoleToDelete}
              onSortChange={handleSortChange}
              sortBy={sortBy}
              sortOrder={sortOrder}
            />
            <Pagination page={page} limit={LIMIT} total={total} onPageChange={setPage} />
          </>
        )}
      </div>

      <RoleFormPanel
        open={panelOpen}
        mode={panelMode}
        role={activeRole}
        allPermissions={permissions}
        companies={companies}
        isSuperAdmin={isSuperAdmin}
        onClose={() => setPanelOpen(false)}
        onSubmit={handleSubmit}
      />

      <DeleteRoleDialog role={roleToDelete} onCancel={() => setRoleToDelete(null)} onConfirm={handleDelete} />
    </div>
  );
}