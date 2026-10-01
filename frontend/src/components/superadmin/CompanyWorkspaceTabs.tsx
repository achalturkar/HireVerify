'use client';

import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Activity,
  BriefcaseBusiness,
  Building2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  KeyRound,
  Receipt,
  ShieldCheck,
  UserRound,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { listAuditLogs } from '@/src/lib/api/audit';
import { listBGVCases } from '@/src/lib/api/bgv';
import { listPlatformCandidates } from '@/src/lib/api/platform-candidates';
import { listPlatformClients } from '@/src/lib/api/platform-clients';
import { listPlatformInvoices } from '@/src/lib/api/invoices';
import { listPermissions } from '@/src/lib/api/permissions';
import { listRoles } from '@/src/lib/api/roles';
import { listUsers } from '@/src/lib/api/users';
import type { AuditLog } from '@/src/lib/api/audit';
import type { BGVCase } from '@/src/types/bgv';
import type { PlatformCandidate } from '@/src/lib/api/platform-candidates';
import type { PlatformClient } from '@/src/lib/api/platform-clients';
import type { Invoice } from '@/src/lib/api/invoices';
import type { Permission } from '@/src/types/permission';
import type { Role } from '@/src/types/role';
import type { PaginationMeta, User } from '@/src/types/user';

type TabId = 'company' | 'users' | 'clients' | 'candidates' | 'invoices' | 'bgv' | 'roles' | 'permissions' | 'audit';
type DataTab = Exclude<TabId, 'company'>;

interface TabDefinition {
  id: TabId;
  label: string;
  icon: LucideIcon;
}

const TABS: TabDefinition[] = [
  { id: 'company', label: 'Company Info', icon: Building2 },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'clients', label: 'Clients', icon: BriefcaseBusiness },
  { id: 'candidates', label: 'Candidates', icon: UserRound },
  { id: 'invoices', label: 'Invoices', icon: Receipt },
  { id: 'bgv', label: 'BGV Cases', icon: ClipboardCheck },
  { id: 'roles', label: 'Roles', icon: ShieldCheck },
  { id: 'permissions', label: 'Permissions', icon: KeyRound },
  { id: 'audit', label: 'Audit', icon: Activity },
];

const PAGE_SIZE = 10;

interface PermissionAssignment {
  permission: Permission;
  roles: string[];
}

type WorkspaceData =
  | { tab: 'users'; items: User[]; meta: PaginationMeta }
  | { tab: 'clients'; items: PlatformClient[]; meta: PaginationMeta }
  | { tab: 'candidates'; items: PlatformCandidate[]; meta: PaginationMeta }
  | { tab: 'invoices'; items: Invoice[]; meta: PaginationMeta }
  | { tab: 'bgv'; items: BGVCase[]; meta: PaginationMeta }
  | { tab: 'roles'; items: Role[]; meta: PaginationMeta }
  | { tab: 'permissions'; items: PermissionAssignment[]; meta: PaginationMeta }
  | { tab: 'audit'; items: AuditLog[]; meta: PaginationMeta };

interface Column<T> {
  label: string;
  render: (row: T) => ReactNode;
  className?: string;
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString();
}

function formatAmount(value: number | string, currency: string) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return `${currency} ${value}`;
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount);
}

function StatusLabel({ value }: { value: string }) {
  return (
    <span className="inline-flex rounded-md border border-[var(--border)] bg-[var(--surface-muted)] px-2 py-1 text-[11px] font-medium text-[var(--foreground)]">
      {value.replaceAll('_', ' ')}
    </span>
  );
}

function WorkspaceTable<T extends { id: string }>({
  columns,
  rows,
}: {
  columns: Column<T>[];
  rows: T[];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left">
        <thead className="border-b border-[var(--border)] bg-[var(--surface-muted)] text-[11px] uppercase text-[var(--muted)]">
          <tr>
            {columns.map((column) => (
              <th key={column.label} className={`px-4 py-3 font-semibold ${column.className ?? ''}`}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)]">
          {rows.map((row) => (
            <tr key={row.id} className="hover:bg-[var(--surface-muted)]/60">
              {columns.map((column) => (
                <td key={column.label} className={`px-4 py-3 text-[13px] text-[var(--foreground)] ${column.className ?? ''}`}>
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function CompanyWorkspaceTabs({
  companyId,
  accessToken,
  children,
}: {
  companyId: string;
  accessToken: string | null;
  children: ReactNode;
}) {
  const [activeTab, setActiveTab] = useState<TabId>('company');
  const [data, setData] = useState<WorkspaceData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef(0);

  const loadTab = async (tab: DataTab, page = 1) => {
    const requestId = ++requestRef.current;
    setLoading(true);
    setError(null);
    setData(null);

    try {
      let result: WorkspaceData;
      switch (tab) {
        case 'users': {
          const response = await listUsers(accessToken, { page, limit: PAGE_SIZE, companyId, sortBy: 'createdAt', sortOrder: 'desc' });
          result = { tab, ...response };
          break;
        }
        case 'clients': {
          const response = await listPlatformClients({ page, limit: PAGE_SIZE, companyId }, accessToken);
          result = { tab, items: response.items, meta: response.meta };
          break;
        }
        case 'candidates': {
          const response = await listPlatformCandidates({ page, limit: PAGE_SIZE, companyId }, accessToken);
          result = { tab, items: response.items, meta: response.meta };
          break;
        }
        case 'invoices': {
          const response = await listPlatformInvoices({ page, limit: PAGE_SIZE, companyId }, accessToken);
          result = { tab, items: response.items, meta: response.meta };
          break;
        }
        case 'bgv': {
          const response = await listBGVCases({ page, limit: PAGE_SIZE, companyId }, accessToken);
          result = { tab, ...response };
          break;
        }
        case 'roles': {
          const response = await listRoles(accessToken, { page, limit: PAGE_SIZE, companyId, sortBy: 'name', sortOrder: 'asc' });
          result = { tab, ...response };
          break;
        }
        case 'permissions': {
          const [roleResponse, permissions] = await Promise.all([
            listRoles(accessToken, { page: 1, limit: 100, companyId, sortBy: 'name', sortOrder: 'asc' }),
            listPermissions(accessToken),
          ]);
          const items = permissions.map((permission) => ({
            permission,
            roles: roleResponse.items
              .filter((role) => role.permissions.some((assigned) => assigned.key === permission.key))
              .map((role) => role.name),
          }));
          result = {
            tab,
            items,
            meta: { page: 1, limit: items.length || 1, total: items.length, totalPages: 1 },
          };
          break;
        }
        case 'audit': {
          const response = await listAuditLogs({ page, limit: PAGE_SIZE, companyId }, accessToken);
          result = { tab, items: response.items, meta: response.meta };
          break;
        }
      }

      if (requestId === requestRef.current) setData(result);
    } catch (loadError) {
      if (requestId === requestRef.current) {
        setError(loadError instanceof Error ? loadError.message : 'Could not load company data.');
      }
    } finally {
      if (requestId === requestRef.current) setLoading(false);
    }
  };

  const selectTab = (tab: TabId) => {
    setActiveTab(tab);
    if (tab === 'company') {
      requestRef.current += 1;
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }
    void loadTab(tab, 1);
  };

  const currentData = data?.tab === activeTab ? data : null;
  const meta = currentData?.meta;

  const renderTable = () => {
    if (!currentData) return null;

    switch (currentData.tab) {
      case 'users':
        return (
          <WorkspaceTable<User>
            rows={currentData.items}
            columns={[
              { label: 'User', render: (user) => <div><p className="font-medium">{user.firstName} {user.lastName}</p><p className="mt-0.5 text-[11px] text-[var(--muted)]">{user.email}</p></div> },
              { label: 'Role', render: (user) => user.role?.name ?? '—' },
              { label: 'Status', render: (user) => <StatusLabel value={user.status} /> },
              { label: 'Last Login', render: (user) => formatDate(user.lastLoginAt) },
              { label: 'Created', render: (user) => formatDate(user.createdAt) },
            ]}
          />
        );
      case 'clients':
        return (
          <WorkspaceTable<PlatformClient>
            rows={currentData.items}
            columns={[
              { label: 'Client', render: (client) => <div><p className="font-medium">{client.name}</p><p className="mt-0.5 text-[11px] text-[var(--muted)]">{client.clientCode}</p></div> },
              { label: 'Contact', render: (client) => <div>{client.contactName || '—'}<p className="mt-0.5 text-[11px] text-[var(--muted)]">{client.contactEmail || ''}</p></div> },
              { label: 'Candidates', render: (client) => client._count.candidates },
              { label: 'BGV Cases', render: (client) => client._count.bgvCases },
              { label: 'Status', render: (client) => <StatusLabel value={client.status} /> },
            ]}
          />
        );
      case 'candidates':
        return (
          <WorkspaceTable<PlatformCandidate>
            rows={currentData.items}
            columns={[
              { label: 'Candidate', render: (candidate) => <div><p className="font-medium">{candidate.firstName} {candidate.lastName}</p><p className="mt-0.5 text-[11px] text-[var(--muted)]">{candidate.candidateCode}</p></div> },
              { label: 'Email', render: (candidate) => candidate.email || '—' },
              { label: 'Client', render: (candidate) => candidate.client?.name ?? '—' },
              { label: 'Status', render: (candidate) => <StatusLabel value={candidate.status} /> },
              { label: 'Created', render: (candidate) => formatDate(candidate.createdAt) },
            ]}
          />
        );
      case 'invoices':
        return (
          <WorkspaceTable<Invoice>
            rows={currentData.items}
            columns={[
              { label: 'Invoice', render: (invoice) => <span className="font-medium">{invoice.invoiceNumber}</span> },
              { label: 'Client', render: (invoice) => invoice.clientName },
              { label: 'Total', render: (invoice) => formatAmount(invoice.total, invoice.currency) },
              { label: 'Balance Due', render: (invoice) => formatAmount(invoice.balanceDue, invoice.currency) },
              { label: 'Due Date', render: (invoice) => formatDate(invoice.dueDate) },
              { label: 'Status', render: (invoice) => <StatusLabel value={invoice.status} /> },
            ]}
          />
        );
      case 'bgv':
        return (
          <WorkspaceTable<BGVCase>
            rows={currentData.items}
            columns={[
              { label: 'Case', render: (item) => <span className="font-medium">{item.caseNumber}</span> },
              { label: 'Candidate', render: (item) => item.candidate ? `${item.candidate.firstName} ${item.candidate.lastName}` : '—' },
              { label: 'Client', render: (item) => item.client?.name ?? '—' },
              { label: 'Status', render: (item) => <StatusLabel value={item.status} /> },
              { label: 'Result', render: (item) => <StatusLabel value={item.overallResult} /> },
              { label: 'Initiated', render: (item) => formatDate(item.initiatedAt) },
            ]}
          />
        );
      case 'roles':
        return (
          <WorkspaceTable<Role>
            rows={currentData.items}
            columns={[
              { label: 'Role', render: (role) => <div><p className="font-medium">{role.name}</p><p className="mt-0.5 text-[11px] text-[var(--muted)]">{role.description || 'No description'}</p></div> },
              { label: 'Type', render: (role) => role.isCompanyAdmin ? 'Company Admin' : role.isSystem ? 'System' : 'Custom' },
              { label: 'Permissions', render: (role) => role.permissions.length },
              { label: 'Updated', render: (role) => formatDate(role.updatedAt) },
            ]}
          />
        );
      case 'permissions':
        return (
          <WorkspaceTable<PermissionAssignment & { id: string }>
            rows={currentData.items.map((item) => ({ ...item, id: item.permission.id }))}
            columns={[
              { label: 'Module', render: (item) => item.permission.module },
              { label: 'Action', render: (item) => <StatusLabel value={item.permission.action} /> },
              { label: 'Permission Key', render: (item) => <span className="font-mono text-[11px]">{item.permission.key}</span> },
              { label: 'Assigned To Roles', render: (item) => item.roles.length ? item.roles.join(', ') : <span className="text-[var(--muted)]">Not assigned</span> },
            ]}
          />
        );
      case 'audit':
        return (
          <WorkspaceTable<AuditLog>
            rows={currentData.items}
            columns={[
              { label: 'Action', render: (log) => <span className="font-medium">{log.action}</span> },
              { label: 'Entity', render: (log) => <div>{log.entity}<p className="mt-0.5 text-[11px] text-[var(--muted)]">{log.entityId || ''}</p></div> },
              { label: 'Actor', render: (log) => log.user ? <div>{log.user.firstName} {log.user.lastName}<p className="mt-0.5 text-[11px] text-[var(--muted)]">{log.user.email}</p></div> : 'System' },
              { label: 'Date', render: (log) => formatDate(log.createdAt) },
            ]}
          />
        );
    }
  };

  return (
    <section className="space-y-5">
      <div role="tablist" aria-label="Company information" className="flex gap-1 overflow-x-auto border-b border-[var(--border)]">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={activeTab === id}
            onClick={() => selectTab(id)}
            className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-[13px] font-medium transition-colors ${
              activeTab === id
                ? 'border-[var(--primary)] text-[var(--primary)]'
                : 'border-transparent text-[var(--muted)] hover:text-[var(--foreground)]'
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'company' ? (
        <div role="tabpanel">{children}</div>
      ) : (
        <div role="tabpanel" className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
            <div>
              <h2 className="text-[16px] font-semibold text-[var(--foreground)]">{TABS.find((tab) => tab.id === activeTab)?.label}</h2>
              <p className="mt-1 text-[12px] text-[var(--muted)]">Records for this company</p>
            </div>
            {meta && <span className="text-[12px] text-[var(--muted)]">{meta.total} total</span>}
          </div>

          {loading ? (
            <div className="px-5 py-12 text-center text-[13px] text-[var(--muted)]">Loading company data…</div>
          ) : error ? (
            <div className="px-5 py-12 text-center text-[13px] text-[var(--danger)]">{error}</div>
          ) : !currentData || currentData.items.length === 0 ? (
            <div className="px-5 py-12 text-center text-[13px] text-[var(--muted)]">No records found for this company.</div>
          ) : (
            <>
              {renderTable()}
              {meta && meta.totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-[var(--border)] px-5 py-3">
                  <span className="text-[12px] text-[var(--muted)]">
                    Page {meta.page} of {meta.totalPages}
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      aria-label="Previous page"
                      disabled={meta.page <= 1 || loading}
                      onClick={() => void loadTab(activeTab as DataTab, meta.page - 1)}
                      className="flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border)] text-[var(--foreground)] disabled:opacity-40"
                    >
                      <ChevronLeft size={15} />
                    </button>
                    <button
                      type="button"
                      aria-label="Next page"
                      disabled={meta.page >= meta.totalPages || loading}
                      onClick={() => void loadTab(activeTab as DataTab, meta.page + 1)}
                      className="flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border)] text-[var(--foreground)] disabled:opacity-40"
                    >
                      <ChevronRight size={15} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}