'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, Plus, Pencil, Trash2, ChevronLeft, ChevronRight, ShieldCheck, Lock, Building2 } from 'lucide-react';
import { useAuth } from '@/src/auth/AuthProvider';

import { listRoles, createRole, updateRole, deleteRole, ApiError } from '@/src/lib/api/roles';
import { listCompanyOptions } from '@/src/lib/api/users';
import type { Role, RoleFormValues, PaginationMeta, CompanyRef } from '@/src/types/role';
import RoleConfirmDialog from '@/src/components/layout/superadmin/role/RoleConfirmDialog ';
import RoleFormModal from '@/src/components/layout/superadmin/role/RoleFormModal';

const PAGE_SIZE = 10;

export default function RolesPage() {
  const { user: currentUser, accessToken } = useAuth();
  const isSuperAdmin = Boolean(currentUser?.role?.isSuperAdmin);

  const [roles, setRoles] = useState<Role[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, limit: PAGE_SIZE, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  const [companies, setCompanies] = useState<CompanyRef[]>([]);

  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null);
  const [activeRole, setActiveRole] = useState<Role | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<Role | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [banner, setBanner] = useState<{ text: string; tone: 'success' | 'error' } | null>(null);

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const fetchRoles = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await listRoles({ page, limit: PAGE_SIZE, search, sortBy: 'createdAt', sortOrder: 'desc' });
      setRoles(res.items);
      setMeta(res.meta);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Failed to load roles');
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  useEffect(() => {
    if (isSuperAdmin) {
      listCompanyOptions(accessToken)
        .then(setCompanies)
        .catch(() => setCompanies([]));
    }
  }, [isSuperAdmin, accessToken]);

  useEffect(() => {
    if (banner) {
      const t = setTimeout(() => setBanner(null), 6000);
      return () => clearTimeout(t);
    }
  }, [banner]);

  const openCreate = () => {
    setFormError(null);
    setActiveRole(null);
    setModalMode('create');
  };

  const openEdit = (role: Role) => {
    setFormError(null);
    setActiveRole(role);
    setModalMode('edit');
  };

  const closeModal = () => {
    if (submitting) return;
    setModalMode(null);
    setActiveRole(null);
    setFormError(null);
  };

  const handleSubmit = async (values: RoleFormValues) => {
    setSubmitting(true);
    setFormError(null);
    try {
      if (modalMode === 'create') {
        const created = await createRole({
          name: values.name,
          description: values.description || undefined,
          companyId: isSuperAdmin ? values.companyId : undefined,
          permissionIds: values.permissionIds,
        });
        setBanner({ text: `Role "${created.name}" was created.`, tone: 'success' });
      } else if (activeRole) {
        const updated = await updateRole(activeRole.id, {
          name: values.name,
          description: values.description || undefined,
          permissionIds: values.permissionIds,
        });
        setBanner({ text: `Role "${updated.name}" was updated.`, tone: 'success' });
      }
      setModalMode(null);
      setActiveRole(null);
      fetchRoles();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteRole(deleteTarget.id);
      setBanner({ text: `Role "${deleteTarget.name}" was deleted.`, tone: 'success' });
      setDeleteTarget(null);
      fetchRoles();
    } catch (err) {
      setBanner({
        text: err instanceof ApiError ? err.message : 'Failed to delete role.',
        tone: 'error',
      });
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  const rangeLabel = useMemo(() => {
    if (meta.total === 0) return '0 roles';
    const start = (meta.page - 1) * meta.limit + 1;
    const end = Math.min(meta.page * meta.limit, meta.total);
    return `${start}–${end} of ${meta.total}`;
  }, [meta]);

  return (
    <div className="max-w-6xl mx-auto space-y-7">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p
            className="text-[11px] uppercase tracking-[0.14em] text-[#3FDCC0] mb-1.5"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            Access Control
          </p>
          <h1 className="text-[26px] font-semibold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
            Roles
          </h1>
          <p className="text-[13.5px] text-[#8891B8] mt-1">
            {isSuperAdmin ? 'Manage roles across every company' : 'Manage roles in your company'}
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 rounded-lg bg-[#3FDCC0] text-[#0B0F26] text-[13px] font-semibold px-4 py-2.5 hover:bg-[#3FDCC0]/90 transition-colors shrink-0"
        >
          <Plus size={14} strokeWidth={2.5} />
          Add role
        </button>
      </div>

      {/* Banner */}
      {banner && (
        <div
          className={`rounded-xl border px-4 py-3 text-[13px] flex items-center justify-between ${
            banner.tone === 'success'
              ? 'bg-[#3FDCC0]/10 border-[#3FDCC0]/25 text-[#3FDCC0]'
              : 'bg-[#FF6B6B]/10 border-[#FF6B6B]/25 text-[#FF6B6B]'
          }`}
        >
          <span>{banner.text}</span>
          <button onClick={() => setBanner(null)} className="opacity-70 hover:opacity-100 ml-3">
            ✕
          </button>
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-md">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#565F8C]">
          <Search size={15} />
        </span>
        <input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search roles by name…"
          className="w-full rounded-lg bg-[#161C3A] border border-white/[0.08] pl-9 pr-3 py-2.5 text-[13.5px] text-[#F2F4FA] placeholder:text-[#565F8C] outline-none focus:border-[#3FDCC0]/50 focus:ring-1 focus:ring-[#3FDCC0]/30 transition-colors"
        />
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#161C3A] overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr
              className="text-[11px] uppercase tracking-wide text-[#565F8C] border-b border-white/[0.08]"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              <th className="px-5 py-3 font-medium">Role</th>
              {isSuperAdmin && <th className="px-5 py-3 font-medium">Company</th>}
              <th className="px-5 py-3 font-medium">Permissions</th>
              <th className="px-5 py-3 font-medium">Created</th>
              <th className="px-5 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={isSuperAdmin ? 5 : 4} className="px-5 py-10 text-center text-[13px] text-[#565F8C]">
                  Loading roles…
                </td>
              </tr>
            )}

            {!loading && loadError && (
              <tr>
                <td colSpan={isSuperAdmin ? 5 : 4} className="px-5 py-10 text-center text-[13px] text-[#FF6B6B]">
                  {loadError}
                </td>
              </tr>
            )}

            {!loading && !loadError && roles.length === 0 && (
              <tr>
                <td colSpan={isSuperAdmin ? 5 : 4} className="px-5 py-10 text-center text-[13px] text-[#565F8C]">
                  No roles match this search.
                </td>
              </tr>
            )}

            {!loading &&
              !loadError &&
              roles.map((role) => {
                const isProtected = role.isSuperAdmin || role.isCompanyAdmin;
                return (
                  <tr key={role.id} className="border-t border-white/[0.06] hover:bg-white/[0.03]">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                            isProtected ? 'bg-[#F2AE55]/15 text-[#F2AE55]' : 'bg-[#3FDCC0]/15 text-[#3FDCC0]'
                          }`}
                        >
                          <ShieldCheck size={15} />
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-[13.5px] text-[#F2F4FA] truncate">{role.name}</p>
                            {isProtected && (
                              <span title="System role — protected">
                                <Lock size={11} className="text-[#565F8C] shrink-0" />
                              </span>
                            )}
                          </div>
                          {role.description && (
                            <p className="text-[11.5px] text-[#565F8C] truncate max-w-xs">{role.description}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    {isSuperAdmin && (
                      <td className="px-5 py-3 text-[13px] text-[#AAB2D4]">
                        <span className="flex items-center gap-1.5">
                          <Building2 size={12} className="text-[#565F8C]" />
                          {role.company?.name ?? '—'}
                        </span>
                      </td>
                    )}
                    <td className="px-5 py-3">
                      <span
                        className="text-[12px] text-[#8891B8]"
                        style={{ fontFamily: 'var(--font-mono)' }}
                      >
                        {role.permissions.length} permission{role.permissions.length === 1 ? '' : 's'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-[12.5px] text-[#8891B8]" style={{ fontFamily: 'var(--font-mono)' }}>
                      {new Date(role.createdAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => openEdit(role)}
                          disabled={isProtected}
                          className="w-7 h-7 rounded-md flex items-center justify-center text-[#8891B8] hover:text-[#3FDCC0] hover:bg-[#3FDCC0]/10 transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-[#8891B8]"
                          aria-label={`Edit ${role.name}`}
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(role)}
                          disabled={isProtected}
                          className="w-7 h-7 rounded-md flex items-center justify-center text-[#8891B8] hover:text-[#FF6B6B] hover:bg-[#FF6B6B]/10 transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-[#8891B8]"
                          aria-label={`Delete ${role.name}`}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>

        {/* Pagination */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-white/[0.08]">
          <p className="text-[12px] text-[#565F8C]" style={{ fontFamily: 'var(--font-mono)' }}>
            {rangeLabel}
          </p>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={meta.page <= 1 || loading}
              className="w-7 h-7 rounded-md flex items-center justify-center text-[#AAB2D4] border border-white/[0.08] hover:bg-white/[0.05] transition-colors disabled:opacity-30"
              aria-label="Previous page"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="text-[12.5px] text-[#AAB2D4] px-2" style={{ fontFamily: 'var(--font-mono)' }}>
              {meta.page} / {Math.max(1, meta.totalPages)}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(meta.totalPages || 1, p + 1))}
              disabled={meta.page >= meta.totalPages || loading}
              className="w-7 h-7 rounded-md flex items-center justify-center text-[#AAB2D4] border border-white/[0.08] hover:bg-white/[0.05] transition-colors disabled:opacity-30"
              aria-label="Next page"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {modalMode && (
        <RoleFormModal
          mode={modalMode}
          role={activeRole}
          companies={companies}
          isSuperAdmin={isSuperAdmin}
          submitting={submitting}
          error={formError}
          onClose={closeModal}
          onSubmit={handleSubmit}
        />
      )}

      {deleteTarget && (
        <RoleConfirmDialog
          title="Delete role?"
          description={`This will permanently delete "${deleteTarget.name}". Roles currently assigned to users cannot be deleted.`}
          confirmLabel="Delete role"
          submitting={deleting}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}