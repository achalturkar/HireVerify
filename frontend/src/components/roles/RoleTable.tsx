'use client';

import { Eye, Pencil, Trash2 } from 'lucide-react';
import type { Role } from '@/src/types/role';

interface RoleTableProps {
  roles: Role[];
  showCompanyColumn: boolean;
  isSuperAdmin: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  onEdit: (role: Role) => void;
  onDelete: (role: Role) => void;
  onSortChange: (sortBy: 'name' | 'createdAt') => void;
  sortBy: 'name' | 'createdAt';
  sortOrder: 'asc' | 'desc';
}

// Status-style badges use low-opacity fills rather than solid light-mode
// colors (bg-violet-100 etc.), so the same classes read correctly whether
// the page's --surface token is light or dark.
function RoleBadge({ role }: { role: Role }) {
  if (role.isSuperAdmin) {
    return (
      <span className="inline-flex items-center rounded-full bg-violet-500/15 px-2 py-0.5 text-[11px] font-medium text-violet-400">
        Super Admin
      </span>
    );
  }
  if (role.isCompanyAdmin) {
    return (
      <span className="inline-flex items-center rounded-full bg-indigo-500/15 px-2 py-0.5 text-[11px] font-medium text-indigo-400">
        Company Admin
      </span>
    );
  }
  if (role.isSystem) {
    return (
      <span className="inline-flex items-center rounded-full bg-[var(--surface-muted)] px-2 py-0.5 text-[11px] font-medium text-[var(--muted)]">
        System
      </span>
    );
  }
  return null;
}

function SortHeader({
  label,
  field,
  sortBy,
  sortOrder,
  onSortChange,
}: {
  label: string;
  field: 'name' | 'createdAt';
  sortBy: string;
  sortOrder: string;
  onSortChange: (field: 'name' | 'createdAt') => void;
}) {
  const active = sortBy === field;
  return (
    <button
      type="button"
      onClick={() => onSortChange(field)}
      className={`flex items-center gap-1 text-left text-[11px] font-medium uppercase tracking-wide transition-colors ${
        active ? 'text-[var(--primary)]' : 'text-[var(--muted)] hover:text-[var(--foreground)]'
      }`}
    >
      {label}
      {active && <span className="text-[10px]">{sortOrder === 'asc' ? '▲' : '▼'}</span>}
    </button>
  );
}

export function RoleTable({
  roles,
  showCompanyColumn,
  isSuperAdmin,
  canUpdate,
  canDelete,
  onEdit,
  onDelete,
  onSortChange,
  sortBy,
  sortOrder,
}: RoleTableProps) {
  if (!roles.length) {
    return (
      <div className="flex flex-col items-center justify-center border border-dashed border-[var(--border)] m-4 rounded-lg py-16 text-center">
        <p className="text-[13.5px] font-medium text-[var(--foreground)]">No roles match your filters</p>
        <p className="mt-1 text-[13px] text-[var(--muted)]">Try a different search term, or create a new role.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-[640px] w-full text-left">
        <thead>
          <tr
            className="text-[11px] uppercase tracking-wide text-[var(--muted)] border-b border-[var(--border)]"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            <th className="px-5 py-3 font-medium">
              <SortHeader label="Role" field="name" sortBy={sortBy} sortOrder={sortOrder} onSortChange={onSortChange} />
            </th>
            {showCompanyColumn && <th className="px-5 py-3 font-medium">Company</th>}
            <th className="px-5 py-3 font-medium">Permissions</th>
            <th className="px-5 py-3 font-medium">
              <SortHeader
                label="Created"
                field="createdAt"
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSortChange={onSortChange}
              />
            </th>
            <th className="px-5 py-3 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {roles.map((role) => {
            const protectedRole = role.isSuperAdmin || role.isCompanyAdmin;
            const viewOnly = role.isSuperAdmin || (role.isCompanyAdmin && !isSuperAdmin);
            const editLabel = viewOnly ? `View ${role.name}` : role.isCompanyAdmin ? `Edit permissions for ${role.name}` : `Edit ${role.name}`;
            return (
              <tr key={role.id} className="border-t border-[var(--border)] hover:bg-[var(--surface-muted)] transition-colors">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[13.5px] font-medium text-[var(--foreground)]">{role.name}</span>
                    <RoleBadge role={role} />
                  </div>
                  {role.description && (
                    <p className="mt-0.5 max-w-sm truncate text-[12px] text-[var(--muted)]">{role.description}</p>
                  )}
                </td>
                {showCompanyColumn && (
                  <td className="px-5 py-3 text-[13px] text-[var(--muted)]">
                    {role.company?.name ?? (role.companyId ? role.companyId : '—')}
                  </td>
                )}
                <td className="px-5 py-3 text-[13px] text-[var(--muted)]">
                  {role.permissions.length} {role.permissions.length === 1 ? 'permission' : 'permissions'}
                </td>
                <td className="px-5 py-3 text-[12.5px] text-[var(--muted)]" style={{ fontFamily: 'var(--font-mono)' }}>
                  {new Date(role.createdAt).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => onEdit(role)}
                      disabled={!viewOnly && !canUpdate}
                      className="w-7 h-7 rounded-md flex items-center justify-center text-[var(--muted)] hover:text-[var(--primary)] hover:bg-[var(--primary)]/10 transition-colors disabled:opacity-30 disabled:pointer-events-none"
                      aria-label={editLabel}
                      title={viewOnly ? 'View' : role.isCompanyAdmin ? 'Edit permissions' : 'Edit'}
                    >
                      {viewOnly ? <Eye size={13} /> : <Pencil size={13} />}
                    </button>
                    {!protectedRole && (
                      <button
                        type="button"
                        onClick={() => onDelete(role)}
                        disabled={!canDelete}
                        className="w-7 h-7 rounded-md flex items-center justify-center text-[var(--muted)] hover:text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-30 disabled:pointer-events-none"
                        aria-label={`Delete ${role.name}`}
                        title="Delete"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}