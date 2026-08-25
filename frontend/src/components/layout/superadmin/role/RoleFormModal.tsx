'use client';

import { useEffect, useMemo, useState } from 'react';
import { X, Loader2, ShieldCheck, Building2, KeyRound } from 'lucide-react';
import { useAuth } from '@/src/auth/AuthProvider';
import { listPermissions } from '@/src/lib/api/permissions';
import type { Permission } from '@/src/types/permission';
import type { Role, RoleFormValues, CompanyRef } from '@/src/types/role';

interface RoleFormModalProps {
  mode: 'create' | 'edit';
  role: Role | null;
  companies: CompanyRef[];
  isSuperAdmin: boolean;
  submitting: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (values: RoleFormValues) => void;
}

const ACTION_STYLES: Record<string, string> = {
  create: 'text-[#3FDCC0]',
  view: 'text-[#8891B8]',
  update: 'text-[#F2AE55]',
  delete: 'text-[#FF6B6B]',
  suspend: 'text-[#FF6B6B]',
};

function moduleLabel(module: string) {
  return module.charAt(0).toUpperCase() + module.slice(1);
}

export default function RoleFormModal({
  mode,
  role,
  companies,
  isSuperAdmin,
  submitting,
  error,
  onClose,
  onSubmit,
}: RoleFormModalProps) {
  const [name, setName] = useState(role?.name ?? '');
  const [description, setDescription] = useState(role?.description ?? '');
  const [companyId, setCompanyId] = useState(role?.companyId ?? '');
  const [permissionIds, setPermissionIds] = useState<string[]>(
    role?.permissions?.map((p) => p.id) ?? []
  );

  const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
  const { accessToken } = useAuth();
  const [permsLoading, setPermsLoading] = useState(true);
  const [permsError, setPermsError] = useState<string | null>(null);

  const [validationError, setValidationError] = useState<string | null>(null);

  const isProtected = mode === 'edit' && (role?.isSuperAdmin || role?.isCompanyAdmin);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setPermsLoading(true);
      setPermsError(null);
      try {
        if (!accessToken) {
          throw new Error('Authorization token is missing.');
        }
        const items = await listPermissions(accessToken);
        if (!cancelled) setAllPermissions(items);
      } catch {
        if (!cancelled) setPermsError('Could not load permissions.');
      } finally {
        if (!cancelled) setPermsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  const grouped = useMemo(() => {
    const map = new Map<string, Permission[]>();
    allPermissions.forEach((p) => {
      if (!map.has(p.module)) map.set(p.module, []);
      map.get(p.module)!.push(p);
    });
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([module, items]) => ({
        module,
        permissions: items.sort((a, b) => a.action.localeCompare(b.action)),
      }));
  }, [allPermissions]);

  const togglePermission = (id: string) => {
    setPermissionIds((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  };

  const toggleModule = (modulePermissions: Permission[]) => {
    const ids = modulePermissions.map((p) => p.id);
    const allSelected = ids.every((id) => permissionIds.includes(id));
    setPermissionIds((prev) =>
      allSelected ? prev.filter((id) => !ids.includes(id)) : Array.from(new Set([...prev, ...ids]))
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!name.trim() || name.trim().length < 2) {
      setValidationError('Role name must be at least 2 characters.');
      return;
    }
    if (mode === 'create' && isSuperAdmin && !companyId) {
      setValidationError('Select a company for this role.');
      return;
    }

    onSubmit({
      name: name.trim(),
      description: description.trim(),
      companyId,
      permissionIds,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl border border-white/[0.08] bg-[#161C3A] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08] shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-[#3FDCC0]/15 text-[#3FDCC0] flex items-center justify-center">
              <ShieldCheck size={16} />
            </span>
            <div>
              <h2 className="text-[15px] font-semibold text-[#F2F4FA]" style={{ fontFamily: 'var(--font-display)' }}>
                {mode === 'create' ? 'Create role' : 'Edit role'}
              </h2>
              {isProtected && (
                <p className="text-[11.5px] text-[#565F8C]">System role — name and permissions are locked</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-md flex items-center justify-center text-[#8891B8] hover:text-[#F2F4FA] hover:bg-white/[0.06] transition-colors"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="px-6 py-5 space-y-4">
            {(error || validationError) && (
              <div className="rounded-lg bg-[#FF6B6B]/10 border border-[#FF6B6B]/25 text-[#FF6B6B] text-[13px] px-3.5 py-2.5">
                {validationError || error}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[12px] text-[#8891B8]">Role name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isProtected}
                  placeholder="e.g. Interview Coordinator"
                  className="w-full rounded-lg bg-[#0B0F26] border border-white/[0.08] px-3 py-2.5 text-[13.5px] text-[#F2F4FA] placeholder:text-[#565F8C] outline-none focus:border-[#3FDCC0]/50 focus:ring-1 focus:ring-[#3FDCC0]/30 transition-colors disabled:opacity-50"
                />
              </div>

              {mode === 'create' && isSuperAdmin && (
                <div className="space-y-1.5">
                  <label className="text-[12px] text-[#8891B8] flex items-center gap-1.5">
                    <Building2 size={12} />
                    Company
                  </label>
                  <select
                    value={companyId}
                    onChange={(e) => setCompanyId(e.target.value)}
                    className="w-full rounded-lg bg-[#0B0F26] border border-white/[0.08] px-3 py-2.5 text-[13.5px] text-[#F2F4FA] outline-none focus:border-[#3FDCC0]/50 transition-colors"
                  >
                    <option value="">Select company…</option>
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {mode === 'edit' && role?.company && (
                <div className="space-y-1.5">
                  <label className="text-[12px] text-[#8891B8] flex items-center gap-1.5">
                    <Building2 size={12} />
                    Company
                  </label>
                  <div className="w-full rounded-lg bg-[#0B0F26]/60 border border-white/[0.06] px-3 py-2.5 text-[13.5px] text-[#565F8C]">
                    {role.company.name}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-[12px] text-[#8891B8]">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isProtected}
                rows={2}
                placeholder="What this role is for…"
                className="w-full rounded-lg bg-[#0B0F26] border border-white/[0.08] px-3 py-2.5 text-[13.5px] text-[#F2F4FA] placeholder:text-[#565F8C] outline-none focus:border-[#3FDCC0]/50 focus:ring-1 focus:ring-[#3FDCC0]/30 transition-colors resize-none disabled:opacity-50"
              />
            </div>

            {/* Permissions */}
            <div className="space-y-2">
              <label className="text-[12px] text-[#8891B8] flex items-center gap-1.5">
                <KeyRound size={12} />
                Permissions
                {permissionIds.length > 0 && (
                  <span
                    className="rounded-full bg-[#3FDCC0]/15 text-[#3FDCC0] px-2 py-0.5 text-[10.5px]"
                    style={{ fontFamily: 'var(--font-mono)' }}
                  >
                    {permissionIds.length} selected
                  </span>
                )}
              </label>

              {permsLoading && (
                <div className="rounded-lg border border-white/[0.08] px-4 py-6 text-center text-[13px] text-[#565F8C]">
                  Loading permissions…
                </div>
              )}
              {!permsLoading && permsError && (
                <div className="rounded-lg border border-white/[0.08] px-4 py-6 text-center text-[13px] text-[#FF6B6B]">
                  {permsError}
                </div>
              )}

              {!permsLoading && !permsError && (
                <div className="rounded-lg border border-white/[0.08] divide-y divide-white/[0.06] max-h-72 overflow-y-auto">
                  {grouped.map(({ module, permissions: items }) => {
                    const ids = items.map((p) => p.id);
                    const allSelected = ids.every((id) => permissionIds.includes(id));
                    const someSelected = !allSelected && ids.some((id) => permissionIds.includes(id));
                    return (
                      <div key={module} className="px-4 py-3">
                        <label className="flex items-center gap-2.5 cursor-pointer select-none mb-2">
                          <input
                            type="checkbox"
                            checked={allSelected}
                            ref={(el) => {
                              if (el) el.indeterminate = someSelected;
                            }}
                            disabled={isProtected}
                            onChange={() => toggleModule(items)}
                            className="w-3.5 h-3.5 rounded accent-[#3FDCC0]"
                          />
                          <span className="text-[13px] font-medium text-[#F2F4FA]">{moduleLabel(module)}</span>
                        </label>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 pl-6">
                          {items.map((p) => (
                            <label
                              key={p.id}
                              className="flex items-center gap-2 cursor-pointer select-none py-0.5"
                            >
                              <input
                                type="checkbox"
                                checked={permissionIds.includes(p.id)}
                                disabled={isProtected}
                                onChange={() => togglePermission(p.id)}
                                className="w-3.5 h-3.5 rounded accent-[#3FDCC0]"
                              />
                              <span
                                className={`text-[12px] uppercase tracking-wide ${
                                  ACTION_STYLES[p.action] ?? 'text-[#AAB2D4]'
                                }`}
                                style={{ fontFamily: 'var(--font-mono)' }}
                              >
                                {p.action}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-white/[0.08] shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-lg px-4 py-2.5 text-[13px] font-medium text-[#AAB2D4] hover:bg-white/[0.05] transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || isProtected}
              className="flex items-center gap-2 rounded-lg bg-[#3FDCC0] text-[#0B0F26] text-[13px] font-semibold px-4 py-2.5 hover:bg-[#3FDCC0]/90 transition-colors disabled:opacity-50"
            >
              {submitting && <Loader2 size={14} className="animate-spin" />}
              {mode === 'create' ? 'Create role' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}