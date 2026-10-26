'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/src/auth/AuthProvider';
import UserFormModal from '@/components/users/UserFormModal';
import ConfirmDialog from '@/components/users/ConfirmDialog';
import {
  listUsers,
  createUser,
  updateUser,
  updateCompanyAdminEmail,
  deleteUser,
  listDeletedUsers,
  permanentlyDeleteUser,
  listRolesForCompany,
  listCompanyOptions,
  ApiError,
} from '@/src/lib/api/users';
import type { User, RoleRef, CompanyRef, UserStatus, PaginationMeta } from '@/src/types/user';

const PAGE_SIZE = 10;

const SearchIcon = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
    <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.4" />
    <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);

const PlusIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M7 1V13M1 7H13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

const EditIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path
      d="M9.5 1.5L12.5 4.5L4.5 12.5H1.5V9.5L9.5 1.5Z"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinejoin="round"
    />
  </svg>
);

const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path
      d="M2 3.5H12M5 3.5V2C5 1.5 5.5 1 6 1H8C8.5 1 9 1.5 9 2V3.5M11 3.5V12C11 12.5 10.5 13 10 13H4C3.5 13 3 12.5 3 12V3.5"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const ChevronIcon = ({ direction }: { direction: 'left' | 'right' }) => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path
      d={direction === 'left' ? 'M9 2L4 7L9 12' : 'M5 2L10 7L5 12'}
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

function initials(firstName: string, lastName: string) {
  return `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase();
}

function formatDate(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function StatusBadge({ status }: { status: UserStatus }) {
  const styles: Record<UserStatus, string> = {
    ACTIVE: 'bg-[var(--primary)]/15 text-[var(--primary)]',
    SUSPENDED: 'bg-[#FF6B6B]/15 text-[#FF6B6B]',
    INACTIVE: 'bg-[#565F8C]/20 text-[#8891B8]',
  };
  const labels: Record<UserStatus, string> = {
    ACTIVE: 'ACTIVE',
    SUSPENDED: 'SUSPENDED',
    INACTIVE: 'INACTIVE',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

export default function UsersPage() {
  const { user: currentUser, accessToken } = useAuth();
  const isSuperAdmin = Boolean(currentUser?.role?.isSuperAdmin);

  const [users, setUsers] = useState<User[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, limit: PAGE_SIZE, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<UserStatus | ''>('');
  const [companyId, setCompanyId] = useState('');
  const [showDeletedUsers, setShowDeletedUsers] = useState(false);
  const [permanentDeleteId, setPermanentDeleteId] = useState<string | null>(null);

  const [roles, setRoles] = useState<RoleRef[]>([]);
  const [companies, setCompanies] = useState<CompanyRef[]>([]);

  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null);
  const [activeUser, setActiveUser] = useState<User | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [emailTarget, setEmailTarget] = useState<User | null>(null);
  const [emailDraft, setEmailDraft] = useState('');
  const [emailSubmitting, setEmailSubmitting] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  const [banner, setBanner] = useState<{ text: string; tone: 'success' | 'error' } | null>(null);

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const params = { page, limit: PAGE_SIZE, search, status, companyId, sortBy: 'createdAt' as const, sortOrder: 'desc' as const };
      const res = showDeletedUsers
        ? await listDeletedUsers(accessToken, params)
        : await listUsers(accessToken, params);
      setUsers(res.items);
      setMeta(res.meta);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [accessToken, page, search, status, companyId, showDeletedUsers]);

  useEffect(() => {
    const task = Promise.resolve().then(fetchUsers);
    return () => { void task; };
  }, [fetchUsers]);

  useEffect(() => {
    if (!isSuperAdmin || !accessToken) return;
    listCompanyOptions(accessToken)
      .then(setCompanies)
      .catch(() => setCompanies([]));
  }, [isSuperAdmin, accessToken]);

  useEffect(() => {
    if (banner) {
      const t = setTimeout(() => setBanner(null), 6000);
      return () => clearTimeout(t);
    }
  }, [banner]);

  const openCreate = async () => {
    setFormError(null);
    setActiveUser(null);
    setModalMode('create');
    try {
      const [r, c] = await Promise.all([listRolesForCompany(accessToken), isSuperAdmin ? listCompanyOptions(accessToken) : Promise.resolve([])]);
      setRoles(r.filter((role) => !role.isSuperAdmin));
      setCompanies(c);
    } catch {
      setFormError('Could not load roles/companies for this form.');
    }
  };

  const openEdit = async (u: User) => {
    setFormError(null);
    setActiveUser(u);
    setModalMode('edit');
    try {
      const r = await listRolesForCompany(accessToken, u.companyId ?? undefined);
      setRoles(r.filter((role) => !role.isSuperAdmin));
    } catch {
      setFormError('Could not load roles for this form.');
    }
  };

  const closeModal = () => {
    if (submitting) return;
    setModalMode(null);
    setActiveUser(null);
    setFormError(null);
  };

  const handleSubmit = async (values: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    roleId: string;
    companyId: string;
    password: string;
    status: UserStatus;
  }) => {
    setSubmitting(true);
    setFormError(null);
    try {
      if (modalMode === 'create') {
        const created = await createUser(accessToken, {
          firstName: values.firstName.trim(),
          lastName: values.lastName.trim(),
          email: values.email.trim(),
          phone: values.phone.trim() || undefined,
          roleId: values.roleId,
          companyId: isSuperAdmin ? values.companyId : undefined,
          password: values.password.trim() || undefined,
        });
        setBanner({
          text: created.generatedPassword
            ? `${created.firstName} ${created.lastName} was created. Temporary password: ${created.generatedPassword}`
            : `${created.firstName} ${created.lastName} was created and emailed their credentials.`,
          tone: 'success',
        });
      } else if (activeUser) {
        await updateUser(accessToken, activeUser.id, {
          firstName: values.firstName.trim(),
          lastName: values.lastName.trim(),
          phone: values.phone.trim() || undefined,
          roleId: values.roleId,
          status: values.status,
        });
        setBanner({ text: 'User updated successfully.', tone: 'success' });
      }
      setModalMode(null);
      setActiveUser(null);
      fetchUsers();
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
      await deleteUser(accessToken, deleteTarget.id);
      setBanner({ text: `${deleteTarget.firstName} ${deleteTarget.lastName} was deleted.`, tone: 'success' });
      setDeleteTarget(null);
      fetchUsers();
    } catch (err) {
      setBanner({
        text: err instanceof ApiError ? err.message : 'Failed to delete user.',
        tone: 'error',
      });
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  const handlePermanentDelete = async (user: User) => {
    if (!window.confirm(`Permanently delete ${user.email}? This cannot be undone. The email will then be available for a new account.`)) return;
    setPermanentDeleteId(user.id);
    try {
      await permanentlyDeleteUser(accessToken, user.id);
      setBanner({ text: `${user.email} was permanently deleted. The email can now be reused.`, tone: 'success' });
      await fetchUsers();
    } catch (err) {
      setBanner({
        text: err instanceof ApiError ? err.message : 'Failed to permanently delete user.',
        tone: 'error',
      });
    } finally {
      setPermanentDeleteId(null);
    }
  };

  const openEmailChange = (user: User) => {
    setEmailTarget(user);
    setEmailDraft(user.email);
    setEmailError(null);
  };

  const closeEmailChange = () => {
    if (emailSubmitting) return;
    setEmailTarget(null);
    setEmailDraft('');
    setEmailError(null);
  };

  const handleEmailChange = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!emailTarget) return;

    setEmailSubmitting(true);
    setEmailError(null);
    try {
      const updated = await updateCompanyAdminEmail(accessToken, emailTarget.id, emailDraft.trim());
      setBanner({ text: `Login email changed to ${updated.email}.`, tone: 'success' });
      setEmailTarget(null);
      setEmailDraft('');
      await fetchUsers();
    } catch (err) {
      setEmailError(err instanceof ApiError ? err.message : 'Could not change the login email.');
    } finally {
      setEmailSubmitting(false);
    }
  };

  const rangeLabel = useMemo(() => {
    if (meta.total === 0) return '0 users';
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
            className="text-[11px] uppercase tracking-[0.14em] text-[var(--primary)] mb-1.5"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            User Management
          </p>
          <h1 className="text-[26px] font-semibold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
            Users
          </h1>
          <p className="text-[13.5px] text-[#8891B8] mt-1">
            {isSuperAdmin ? 'Manage users across every company' : 'Manage users in your company'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {isSuperAdmin && (
            <button
              type="button"
              onClick={() => {
                setShowDeletedUsers((showing) => !showing);
                setPage(1);
                setStatus('');
              }}
              className="rounded-lg border border-white/[0.12] px-4 py-2.5 text-[13px] font-semibold text-[#AAB2D4] hover:border-[var(--primary)] hover:text-white"
            >
              {showDeletedUsers ? 'Active users' : 'Deleted users'}
            </button>
          )}
          {!showDeletedUsers && <button
            onClick={openCreate}
            className="flex items-center gap-1.5 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] text-[13px] font-semibold px-4 py-2.5 hover:bg-[var(--primary)]/90 transition-colors shrink-0"
          >
            <PlusIcon />
            Add user
          </button>}
        </div>
      </div>

      {/* Banner */}
      {banner && (
        <div
          className={`rounded-xl border px-4 py-3 text-[13px] flex items-center justify-between ${
            banner.tone === 'success'
              ? 'bg-[var(--primary)]/10 border-[var(--primary)]/25 text-[var(--primary)]'
              : 'bg-[#FF6B6B]/10 border-[#FF6B6B]/25 text-[#FF6B6B]'
          }`}
        >
          <span>{banner.text}</span>
          <button onClick={() => setBanner(null)} className="opacity-70 hover:opacity-100 ml-3">
            ✕
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#565F8C]">
            <SearchIcon />
          </span>
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by name or email…"
            className="w-full rounded-lg bg-[#161C3A] border border-white/[0.08] pl-9 pr-3 py-2.5 text-[13.5px] text-[#F2F4FA] placeholder:text-[#565F8C] outline-none focus:border-[var(--primary)]/50 focus:ring-1 focus:ring-[var(--primary)]/30 transition-colors"
          />
        </div>
        {!showDeletedUsers && <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as UserStatus | '');
            setPage(1);
          }}
          className="rounded-lg bg-[#161C3A] border border-white/[0.08] px-3 py-2.5 text-[13px] text-[#AAB2D4] outline-none focus:border-[var(--primary)]/50 transition-colors"
        >
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="SUSPENDED">Suspended</option>
          <option value="INACTIVE">Inactive</option>
        </select>}
        {isSuperAdmin && (
          <select
            value={companyId}
            onChange={(e) => {
              setCompanyId(e.target.value);
              setPage(1);
            }}
            className="max-w-[260px] rounded-lg bg-[#161C3A] border border-white/[0.08] px-3 py-2.5 text-[13px] text-[#AAB2D4] outline-none focus:border-[var(--primary)]/50 transition-colors"
          >
            <option value="">All companies</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#161C3A] overflow-hidden">
        {showDeletedUsers ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left">
              <thead>
                <tr className="border-b border-white/[0.08] text-[11px] uppercase tracking-wide text-[#565F8C]" style={{ fontFamily: 'var(--font-mono)' }}>
                  <th className="px-5 py-3 font-medium">User</th>
                  <th className="px-5 py-3 font-medium">Company / client</th>
                  <th className="px-5 py-3 font-medium">Role</th>
                  <th className="px-5 py-3 font-medium">Deleted</th>
                  <th className="px-5 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={5} className="px-5 py-10 text-center text-[13px] text-[#565F8C]">Loading deleted users…</td></tr>}
                {!loading && loadError && <tr><td colSpan={5} className="px-5 py-10 text-center text-[13px] text-[#FF6B6B]">{loadError}</td></tr>}
                {!loading && !loadError && users.length === 0 && <tr><td colSpan={5} className="px-5 py-10 text-center text-[13px] text-[#565F8C]">No deleted users found.</td></tr>}
                {!loading && !loadError && users.map((user) => (
                  <tr key={user.id} className="border-t border-white/[0.06] hover:bg-white/[0.03]">
                    <td className="px-5 py-3">
                      <p className="text-[13.5px] text-[#F2F4FA]">{user.firstName} {user.lastName}</p>
                      <p className="text-[11.5px] text-[#8891B8]">{user.email}</p>
                    </td>
                    <td className="px-5 py-3 text-[13px] text-[#AAB2D4]">{user.client?.name || user.company?.name || '—'}</td>
                    <td className="px-5 py-3 text-[13px] text-[#AAB2D4]">{user.role?.name ?? '—'}{user.clientId && <span className="ml-1 text-[10px] text-[#8891B8]">(client portal)</span>}</td>
                    <td className="px-5 py-3 text-[12.5px] text-[#8891B8]" style={{ fontFamily: 'var(--font-mono)' }}>{formatDate(user.deletedAt ?? null)}</td>
                    <td className="px-5 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => void handlePermanentDelete(user)}
                        disabled={permanentDeleteId === user.id}
                        className="inline-flex items-center gap-1.5 rounded-md border border-[#FF6B6B]/30 px-2.5 py-1.5 text-[11px] font-semibold text-[#FF6B6B] hover:bg-[#FF6B6B]/10 disabled:opacity-50"
                      >
                        <TrashIcon />{permanentDeleteId === user.id ? 'Deleting…' : 'Delete permanently'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <table className="w-full text-left">
          <thead>
            <tr
              className="text-[11px] uppercase tracking-wide text-[#565F8C] border-b border-white/[0.08]"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              <th className="px-5 py-3 font-medium">User</th>
              {isSuperAdmin && <th className="px-5 py-3 font-medium">Company</th>}
              <th className="px-5 py-3 font-medium">Role</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">Last login</th>
              <th className="px-5 py-3 font-medium">Created</th>
              <th className="px-5 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={isSuperAdmin ? 7 : 6} className="px-5 py-10 text-center text-[13px] text-[#565F8C]">
                  Loading users…
                </td>
              </tr>
            )}

            {!loading && loadError && (
              <tr>
                <td colSpan={isSuperAdmin ? 7 : 6} className="px-5 py-10 text-center text-[13px] text-[#FF6B6B]">
                  {loadError}
                </td>
              </tr>
            )}

            {!loading && !loadError && users.length === 0 && (
              <tr>
                <td colSpan={isSuperAdmin ? 7 : 6} className="px-5 py-10 text-center text-[13px] text-[#565F8C]">
                  No users match these filters.
                </td>
              </tr>
            )}

            {!loading &&
              !loadError &&
              users.map((u, i) => (
                <tr key={u.id} className="border-t border-white/[0.06] hover:bg-white/[0.03]">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0 ${
                          i % 2 === 0 ? 'bg-[var(--primary)]/15 text-[var(--primary)]' : 'bg-[#F2AE55]/15 text-[#F2AE55]'
                        }`}
                      >
                        {initials(u.firstName, u.lastName)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[13.5px] text-[#F2F4FA] truncate">
                          {u.firstName} {u.lastName}
                        </p>
                        <p className="text-[11.5px] text-[#565F8C] truncate">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  {isSuperAdmin && (
                    <td className="px-5 py-3 text-[13px] text-[#AAB2D4]">{u.company?.name ?? '—'}</td>
                  )}
                  <td className="px-5 py-3 text-[13px] text-[#AAB2D4]">{u.role?.name ?? '—'}</td>
                  <td className="px-5 py-3">
                    <StatusBadge status={u.status} />
                  </td>
                  <td className="px-5 py-3 text-[12.5px] text-[#8891B8]" style={{ fontFamily: 'var(--font-mono)' }}>
                    {formatDate(u.lastLoginAt)}
                  </td>
                  <td className="px-5 py-3 text-[12.5px] text-[#8891B8]" style={{ fontFamily: 'var(--font-mono)' }}>
                    {formatDate(u.createdAt)}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      {isSuperAdmin && u.role?.isCompanyAdmin && (
                        <button
                          onClick={() => openEmailChange(u)}
                          className="rounded-md px-2 py-1 text-[11px] text-[#8891B8] hover:text-[var(--primary)] hover:bg-[var(--primary)]/10 transition-colors"
                          aria-label={`Change login email for ${u.firstName} ${u.lastName}`}
                          title="Change login email"
                        >
                          Email
                        </button>
                      )}
                      <button
                        onClick={() => openEdit(u)}
                        className="w-7 h-7 rounded-md flex items-center justify-center text-[#8891B8] hover:text-[var(--primary)] hover:bg-[var(--primary)]/10 transition-colors"
                        aria-label={`Edit ${u.firstName}`}
                      >
                        <EditIcon />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(u)}
                        disabled={u.id === currentUser?.id}
                        className="w-7 h-7 rounded-md flex items-center justify-center text-[#8891B8] hover:text-[#FF6B6B] hover:bg-[#FF6B6B]/10 transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-[#8891B8]"
                        aria-label={`Delete ${u.firstName}`}
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>}

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
              <ChevronIcon direction="left" />
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
              <ChevronIcon direction="right" />
            </button>
          </div>
        </div>
      </div>

      {modalMode && (
        <UserFormModal
          mode={modalMode}
          user={activeUser}
          roles={roles}
          companies={companies}
          isSuperAdmin={isSuperAdmin}
          submitting={submitting}
          error={formError}
          onClose={closeModal}
          onSubmit={handleSubmit}
        />
      )}

      {emailTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 cursor-default bg-[#060819]/70 backdrop-blur-sm"
            aria-label="Close email change dialog"
            onClick={closeEmailChange}
            disabled={emailSubmitting}
          />
          <div className="relative w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#161C3A] shadow-2xl shadow-black/40">
            <div className="border-b border-white/[0.08] px-5 py-4">
              <p className="mb-0.5 text-[11px] uppercase tracking-[0.14em] text-[var(--primary)]" style={{ fontFamily: 'var(--font-mono)' }}>
                Super Admin action
              </p>
              <h2 className="text-[15px] font-semibold" style={{ fontFamily: 'var(--font-display)' }}>
                Change Company Admin login email
              </h2>
              <p className="mt-1 text-[12px] text-[#8891B8]">
                {emailTarget.firstName} {emailTarget.lastName} · {emailTarget.company?.name ?? 'Company'}
              </p>
            </div>
            <form onSubmit={handleEmailChange} className="space-y-4 px-5 py-5">
              {emailError && (
                <div className="rounded-lg border border-[#FF6B6B]/25 bg-[#FF6B6B]/10 px-3 py-2.5 text-[12.5px] text-[#FF6B6B]">
                  {emailError}
                </div>
              )}
              <div>
                <label htmlFor="company-admin-login-email" className="mb-1.5 block text-[11.5px] font-medium text-[#AAB2D4]">
                  New login email
                </label>
                <input
                  id="company-admin-login-email"
                  type="email"
                  autoComplete="email"
                  required
                  maxLength={254}
                  value={emailDraft}
                  onChange={(event) => setEmailDraft(event.target.value)}
                  disabled={emailSubmitting}
                  className="w-full rounded-lg border border-white/[0.08] bg-[#0F1330] px-3 py-2.5 text-[13.5px] text-[#F2F4FA] outline-none transition-colors focus:border-[var(--primary)]/50 focus:ring-1 focus:ring-[var(--primary)]/30 disabled:opacity-50"
                />
                <p className="mt-1 text-[11px] text-[#565F8C]">
                  Only the login email will change. The password and other account details stay the same.
                </p>
              </div>
              <div className="flex items-center gap-2.5 pt-1">
                <button
                  type="submit"
                  disabled={emailSubmitting || emailDraft.trim().toLowerCase() === emailTarget.email.toLowerCase()}
                  className="flex-1 rounded-lg bg-[var(--primary)] py-2.5 text-[13.5px] font-semibold text-[var(--primary-foreground)] transition-colors hover:bg-[var(--primary)]/90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {emailSubmitting ? 'Saving…' : 'Change email'}
                </button>
                <button
                  type="button"
                  onClick={closeEmailChange}
                  disabled={emailSubmitting}
                  className="rounded-lg border border-white/[0.1] px-4 py-2.5 text-[13.5px] font-medium text-[#AAB2D4] transition-colors hover:bg-white/[0.05] disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete user?"
          description={`This will deactivate ${deleteTarget.firstName} ${deleteTarget.lastName} (${deleteTarget.email}) and revoke their access. This can be reversed by an admin.`}
          confirmLabel="Delete user"
          submitting={deleting}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}