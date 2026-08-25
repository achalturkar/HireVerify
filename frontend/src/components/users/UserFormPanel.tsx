'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { User, UserStatus, RoleRef, CompanyRef } from '@/src/types/user';
import { ApiError } from '@/src/lib/api/http';

export interface UserFormSubmitValues {
  firstName: string;
  lastName: string;
  email?: string; // create only
  phone: string;
  roleId: string;
  companyId?: string; // create only, super admin only
  password?: string; // create only, optional
  status?: UserStatus; // edit only
}

interface UserFormPanelProps {
  open: boolean;
  mode: 'create' | 'edit';
  user: User | null;
  companies: CompanyRef[]; // empty when not super admin
  isSuperAdmin: boolean;
  defaultCompanyId: string | null; // current user's company, for non-super-admins
  onClose: () => void;
  onSubmit: (values: UserFormSubmitValues) => Promise<void>;
  onFetchRoles: (companyId: string) => Promise<RoleRef[]>;
}

const emptyState = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  roleId: '',
  companyId: '',
  status: 'ACTIVE' as UserStatus,
};

export function UserFormPanel({
  open,
  mode,
  user,
  companies,
  isSuperAdmin,
  defaultCompanyId,
  onClose,
  onSubmit,
  onFetchRoles,
}: UserFormPanelProps) {
  const [form, setForm] = useState(emptyState);
  const [setPasswordManually, setSetPasswordManually] = useState(false);
  const [password, setPassword] = useState('');
  const [roles, setRoles] = useState<RoleRef[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const effectiveCompanyId = mode === 'create' ? form.companyId || defaultCompanyId || '' : user?.companyId ?? '';

  useEffect(() => {
    if (!open) return;
    setError(null);
    setFieldErrors({});
    setSetPasswordManually(false);
    setPassword('');
    if (mode === 'edit' && user) {
      setForm({
        firstName: user.firstName ?? '',
        lastName: user.lastName ?? '',
        email: user.email ?? '',
        phone: user.phone ?? '',
        roleId: user.role?.id ?? '',
        companyId: user.companyId ?? '',
        status: user.status ?? 'ACTIVE',
      });
    } else {
      setForm({ ...emptyState, companyId: isSuperAdmin ? '' : defaultCompanyId ?? '' });
    }
  }, [open, mode, user, isSuperAdmin, defaultCompanyId]);

  useEffect(() => {
    if (!open || !effectiveCompanyId) {
      setRoles([]);
      return;
    }
    setRolesLoading(true);
    onFetchRoles(effectiveCompanyId)
      .then(setRoles)
      .catch(() => setRoles([]))
      .finally(() => setRolesLoading(false));
  }, [open, effectiveCompanyId, onFetchRoles]);

  const title = mode === 'create' ? 'Invite user' : `Edit ${user?.firstName ?? 'user'}`;

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (form.firstName.trim().length < 1) errs.firstName = 'First name is required.';
    if (form.lastName.trim().length < 1) errs.lastName = 'Last name is required.';
    if (mode === 'create') {
      if (!/^\S+@\S+\.\S+$/.test(form.email)) errs.email = 'Enter a valid email address.';
      if (isSuperAdmin && !form.companyId) errs.companyId = 'Choose a company.';
      if (!form.roleId) errs.roleId = 'Choose a role.';
      if (setPasswordManually && password.length < 8) errs.password = 'Password must be at least 8 characters.';
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    setError(null);
    try {
      if (mode === 'create') {
        await onSubmit({
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          roleId: form.roleId,
          companyId: isSuperAdmin ? form.companyId : undefined,
          password: setPasswordManually ? password : undefined,
        });
      } else {
        await onSubmit({
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          phone: form.phone.trim(),
          roleId: form.roleId,
          status: form.status,
        });
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong saving this user.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <button
        aria-label="Close panel"
        onClick={submitting ? undefined : onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-[1px]"
      />
      <form onSubmit={handleSubmit} className="relative flex h-full w-full max-w-lg flex-col bg-[var(--surface)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
          <h2 className="text-[15px] font-semibold text-[var(--foreground)]" style={{ fontFamily: 'var(--font-display)' }}>
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-md p-1.5 text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)] disabled:opacity-50 transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {error && (
            <div className="rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-[13px] text-red-500">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-[var(--foreground)]">First name</label>
              <input
                type="text"
                value={form.firstName}
                onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[13.5px] text-[var(--foreground)] outline-none focus:border-[var(--primary)]/50 focus:ring-1 focus:ring-[var(--primary)]/30 transition-colors"
                maxLength={100}
              />
              {fieldErrors.firstName && <p className="text-[12px] text-red-500">{fieldErrors.firstName}</p>}
            </div>
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-[var(--foreground)]">Last name</label>
              <input
                type="text"
                value={form.lastName}
                onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[13.5px] text-[var(--foreground)] outline-none focus:border-[var(--primary)]/50 focus:ring-1 focus:ring-[var(--primary)]/30 transition-colors"
                maxLength={100}
              />
              {fieldErrors.lastName && <p className="text-[12px] text-red-500">{fieldErrors.lastName}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-[var(--foreground)]">Email</label>
            <input
              type="email"
              value={form.email}
              disabled={mode === 'edit'}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[13.5px] text-[var(--foreground)] outline-none focus:border-[var(--primary)]/50 focus:ring-1 focus:ring-[var(--primary)]/30 disabled:bg-[var(--surface-muted)] disabled:text-[var(--muted)] transition-colors"
              placeholder="name@company.com"
            />
            {mode === 'edit' && (
              <p className="text-[12px] text-[var(--muted)]">Email can't be changed after the account is created.</p>
            )}
            {fieldErrors.email && <p className="text-[12px] text-red-500">{fieldErrors.email}</p>}
          </div>

          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-[var(--foreground)]">
              Phone <span className="font-normal text-[var(--muted)]">(optional)</span>
            </label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[13.5px] text-[var(--foreground)] outline-none focus:border-[var(--primary)]/50 focus:ring-1 focus:ring-[var(--primary)]/30 transition-colors"
              maxLength={50}
            />
          </div>

          {mode === 'create' && isSuperAdmin && (
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-[var(--foreground)]">Company</label>
              <select
                value={form.companyId}
                onChange={(e) => setForm((f) => ({ ...f, companyId: e.target.value, roleId: '' }))}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[13.5px] text-[var(--foreground)] outline-none focus:border-[var(--primary)]/50 focus:ring-1 focus:ring-[var(--primary)]/30 transition-colors"
              >
                <option value="">Select a company…</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {fieldErrors.companyId && <p className="text-[12px] text-red-500">{fieldErrors.companyId}</p>}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-[var(--foreground)]">Role</label>
            <select
              value={form.roleId}
              disabled={!effectiveCompanyId || rolesLoading}
              onChange={(e) => setForm((f) => ({ ...f, roleId: e.target.value }))}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[13.5px] text-[var(--foreground)] outline-none focus:border-[var(--primary)]/50 focus:ring-1 focus:ring-[var(--primary)]/30 disabled:bg-[var(--surface-muted)] transition-colors"
            >
              <option value="">{rolesLoading ? 'Loading roles…' : 'Select a role…'}</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
            {fieldErrors.roleId && <p className="text-[12px] text-red-500">{fieldErrors.roleId}</p>}
          </div>

          {mode === 'edit' && (
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-[var(--foreground)]">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as UserStatus }))}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[13.5px] text-[var(--foreground)] outline-none focus:border-[var(--primary)]/50 focus:ring-1 focus:ring-[var(--primary)]/30 transition-colors"
              >
                <option value="ACTIVE">Active</option>
                <option value="SUSPENDED">Suspended</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>
          )}

          {mode === 'create' && (
            <div className="space-y-2 rounded-lg border border-[var(--border)] p-3">
              <label className="flex items-center gap-2 text-[13px] text-[var(--foreground)]">
                <input
                  type="checkbox"
                  checked={setPasswordManually}
                  onChange={(e) => setSetPasswordManually(e.target.checked)}
                  className="h-4 w-4 rounded border-[var(--border)] accent-[var(--primary)]"
                />
                Set a password manually
              </label>
              <p className="text-[12px] text-[var(--muted)]">
                {setPasswordManually
                  ? 'The user can sign in with this password right away.'
                  : "A strong password will be generated and emailed to the user's inbox."}
              </p>
              {setPasswordManually && (
                <div className="space-y-1.5 pt-1">
                  <input
                    type="text"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[13.5px] text-[var(--foreground)] outline-none focus:border-[var(--primary)]/50 focus:ring-1 focus:ring-[var(--primary)]/30 transition-colors"
                  />
                  {fieldErrors.password && <p className="text-[12px] text-red-500">{fieldErrors.password}</p>}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-[var(--border)] px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg px-4 py-2 text-[13px] font-medium text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)] disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-[var(--primary)] px-4 py-2 text-[13px] font-semibold text-[#0B0F26] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 transition-opacity"
          >
            {submitting ? 'Saving…' : mode === 'create' ? 'Send invite' : 'Save changes'}
          </button>
        </div>
      </form>
    </div>
  );
}