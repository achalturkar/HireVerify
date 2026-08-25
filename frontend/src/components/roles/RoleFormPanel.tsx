'use client';

import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import type { Role } from '@/src/types/role';
import type { Permission } from '@/src/types/permission';
import type { CompanyOption } from '@/src/types/company';
import { PermissionMatrix } from './PermissionMatrix';
import { ApiError } from '@/src/lib/api/http';

export interface RoleFormSubmitValues {
  name: string;
  description: string;
  companyId?: string;
  permissionIds: string[];
}

interface RoleFormPanelProps {
  open: boolean;
  mode: 'create' | 'edit';
  role: Role | null;
  allPermissions: Permission[];
  companies: CompanyOption[];
  isSuperAdmin: boolean;
  onClose: () => void;
  onSubmit: (values: RoleFormSubmitValues) => Promise<void>;
}

const emptyState = { name: '', description: '', companyId: '' };

export function RoleFormPanel({
  open,
  mode,
  role,
  allPermissions,
  companies,
  isSuperAdmin,
  onClose,
  onSubmit,
}: RoleFormPanelProps) {
  const [form, setForm] = useState(emptyState);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setError(null);
    setFieldErrors({});
    if (mode === 'edit' && role) {
      setForm({ name: role.name ?? '', description: role.description ?? '', companyId: role.companyId ?? '' });
      setSelectedIds(new Set((role.permissions ?? []).map((p) => p.id)));
    } else {
      setForm(emptyState);
      setSelectedIds(new Set());
    }
  }, [open, mode, role]);

  const isProtected = mode === 'edit' && (role?.isSuperAdmin || role?.isCompanyAdmin);

  const title = mode === 'create' ? 'New role' : `Edit ${role?.name ?? 'role'}`;

  const scopedPermissions = useMemo(() => allPermissions, [allPermissions]);

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (form.name.trim().length < 2) errs.name = 'Name must be at least 2 characters.';
    if (form.description.length > 1000) errs.description = 'Description must be 1000 characters or fewer.';
    if (mode === 'create' && isSuperAdmin && !form.companyId) errs.companyId = 'Choose a company for this role.';
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        name: form.name.trim(),
        description: form.description.trim(),
        ...(mode === 'create' && isSuperAdmin ? { companyId: form.companyId } : {}),
        permissionIds: Array.from(selectedIds),
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong saving this role.');
    } finally {
      setSubmitting(false);
    }
  }

  function togglePermission(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleModule(ids: string[], nextState: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => (nextState ? next.add(id) : next.delete(id)));
      return next;
    });
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <button
        aria-label="Close panel"
        onClick={submitting ? undefined : onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-[1px]"
      />
      <form
        onSubmit={handleSubmit}
        className="relative flex h-full w-full max-w-xl flex-col bg-[var(--surface)] shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
          <div>
            <h2 className="text-[15px] font-semibold text-[var(--foreground)]" style={{ fontFamily: 'var(--font-display)' }}>
              {title}
            </h2>
            {isProtected && (
              <p className="mt-0.5 text-[12px] text-amber-500">System role — name and permissions are locked.</p>
            )}
          </div>
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

        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
          {error && (
            <div className="rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-[13px] text-red-500">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="role-name" className="text-[13px] font-medium text-[var(--foreground)]">
              Name
            </label>
            <input
              id="role-name"
              type="text"
              value={form.name}
              disabled={isProtected}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[13.5px] text-[var(--foreground)] outline-none focus:border-[var(--primary)]/50 focus:ring-1 focus:ring-[var(--primary)]/30 disabled:bg-[var(--surface-muted)] disabled:text-[var(--muted)] transition-colors"
              placeholder="e.g. Billing Manager"
              maxLength={100}
            />
            {fieldErrors.name && <p className="text-[12px] text-red-500">{fieldErrors.name}</p>}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="role-description" className="text-[13px] font-medium text-[var(--foreground)]">
              Description <span className="font-normal text-[var(--muted)]">(optional)</span>
            </label>
            <textarea
              id="role-description"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={2}
              className="w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[13.5px] text-[var(--foreground)] outline-none focus:border-[var(--primary)]/50 focus:ring-1 focus:ring-[var(--primary)]/30 transition-colors"
              placeholder="What this role is for"
              maxLength={1000}
            />
            {fieldErrors.description && <p className="text-[12px] text-red-500">{fieldErrors.description}</p>}
          </div>

          {mode === 'create' && isSuperAdmin && (
            <div className="space-y-1.5">
              <label htmlFor="role-company" className="text-[13px] font-medium text-[var(--foreground)]">
                Company
              </label>
              <select
                id="role-company"
                value={form.companyId}
                onChange={(e) => setForm((f) => ({ ...f, companyId: e.target.value }))}
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

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-medium text-[var(--foreground)]">Permissions</span>
              <span className="text-[12px] text-[var(--muted)]">{selectedIds.size} selected</span>
            </div>
            <PermissionMatrix
              allPermissions={scopedPermissions}
              selectedIds={selectedIds}
              onToggle={togglePermission}
              onToggleModule={toggleModule}
              disabled={isProtected}
            />
          </div>
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
            disabled={submitting || isProtected}
            className="rounded-lg bg-[var(--primary)] px-4 py-2 text-[13px] font-semibold text-[#0B0F26] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 transition-opacity"
          >
            {submitting ? 'Saving…' : mode === 'create' ? 'Create role' : 'Save changes'}
          </button>
        </div>
      </form>
    </div>
  );
}