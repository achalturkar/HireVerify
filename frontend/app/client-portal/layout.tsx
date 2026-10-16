'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { Building2, FileCheck2, FileText, KeyRound, LayoutDashboard, LogOut, Menu, MessageSquareText, Receipt, Users, X } from 'lucide-react';
import { useAuth } from '@/src/auth/AuthProvider';
import { listClients } from '@/src/lib/api/clients';
import { ThemeToggle } from '@/src/components/layout/theme-toggle';
import BrandMark from '@/src/components/ui/BrandMark';
import { getClientPortalScope, hasPortalPermission, setClientPortalScope } from '@/src/lib/api/client-portal';
import { resolveLogoUrl } from '@/src/lib/logo';
import type { Client, ClientPortalPermission } from '@/src/types/client';

const sections: { id: string; label: string; icon: typeof Users; permission?: ClientPortalPermission }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'subclients', label: 'Subclients', icon: Building2, permission: 'clientportal.subclients.view' },
  { id: 'candidates', label: 'Candidates', icon: Users, permission: 'clientportal.candidates.view' },
  { id: 'cases', label: 'BGV cases', icon: FileCheck2, permission: 'clientportal.cases.view' },
  { id: 'reports', label: 'Reports', icon: FileText, permission: 'clientportal.reports.view' },
  { id: 'invoices', label: 'Invoices', icon: Receipt, permission: 'clientportal.invoices.view' },
  { id: 'requests', label: 'My requests', icon: MessageSquareText },
];

function Brand({ src, name, fallback }: { src: string | null | undefined; name: string; fallback: ReactNode }) {
  const logoUrl = resolveLogoUrl(src);
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      {logoUrl
        ? <Image src={logoUrl} alt={`${name} logo`} width={34} height={34} unoptimized className="h-8 w-8 shrink-0 rounded-lg border border-[var(--border)] bg-white object-contain p-0.5" />
        : <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--primary)]/10 text-[var(--primary)]">{fallback}</span>}
      <span className="truncate text-[12px] font-semibold text-[var(--foreground)]">{name}</span>
    </div>
  );
}

export default function ClientPortalLayout({ children }: { children: ReactNode }) {
  const { user, loading, permissions, logout, accessToken } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isCompanyAdmin = user?.role.isCompanyAdmin ?? false;
  const [availableClients, setAvailableClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientScopeLoading, setClientScopeLoading] = useState(true);
  const [clientScopeError, setClientScopeError] = useState<string | null>(null);
  const client = isCompanyAdmin ? selectedClient : user?.client;
  const company = user?.company;
  const links = sections.filter((item) =>
    !item.permission ||
    hasPortalPermission(permissions, item.permission, isCompanyAdmin) ||
    (item.id === 'subclients' && hasPortalPermission(permissions, 'clientportal.subclients.manage', isCompanyAdmin)),
  );
  const section = pathname.split('/')[2] || 'dashboard';
  const configuredColor = company?.primaryColor || '#3FDCC0';
  const primaryColor = /^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i.test(configuredColor) ? configuredColor : '#3FDCC0';
  const normalizedColor = primaryColor.length === 4 ? primaryColor.slice(1).split('').map((part) => part + part).join('') : primaryColor.slice(1);
  const [red, green, blue] = [0, 2, 4].map((offset) => parseInt(normalizedColor.slice(offset, offset + 2), 16));
  const primaryForeground = 0.299 * red + 0.587 * green + 0.114 * blue > 150 ? '#0B0F26' : '#FFFFFF';
  const activeLabel = pathname.includes('/candidates/') ? 'Candidate details' : pathname.includes('/cases/') ? 'Case details' : section === 'account' ? 'Account settings' : sections.find((item) => item.id === section)?.label || 'Client workspace';

  useEffect(() => {
    if (!isCompanyAdmin) return;
    let active = true;
    const loadClients = async () => {
      try {
        const firstPage = await listClients({ page: 1, limit: 200, status: 'ACTIVE', sortBy: 'name', sortOrder: 'asc' }, accessToken);
        const allClients = firstPage.items.filter((item) => !item.parentClientId);
        for (let page = 2; page <= firstPage.meta.totalPages; page += 1) {
          const result = await listClients({ page, limit: 200, status: 'ACTIVE', sortBy: 'name', sortOrder: 'asc' }, accessToken);
          allClients.push(...result.items.filter((item) => !item.parentClientId));
        }
        if (!active) return;
        setAvailableClients(allClients);
        const savedId = getClientPortalScope();
        const nextClient = allClients.find((item) => item.id === savedId) || allClients[0] || null;
        setSelectedClient(nextClient);
        setClientPortalScope(nextClient?.id || null);
      } catch (error) {
        if (active) setClientScopeError(error instanceof Error ? error.message : 'Could not load clients for portal access.');
      } finally {
        if (active) setClientScopeLoading(false);
      }
    };
    void loadClients();
    return () => { active = false; };
  }, [accessToken, isCompanyAdmin]);

  if (loading || (!user?.role.isClientUser && !isCompanyAdmin)) return <div className="flex min-h-screen items-center justify-center text-sm text-[var(--muted)]">Loading client portal…</div>;
  if (isCompanyAdmin && clientScopeLoading) return <div className="flex min-h-screen items-center justify-center text-sm text-[var(--muted)]">Loading company clients…</div>;
  if (isCompanyAdmin && !selectedClient) return <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-3 px-6 text-center"><Building2 size={28} className="text-[var(--muted)]" /><h1 className="text-lg font-semibold">Client portal unavailable</h1><p className="text-sm text-[var(--muted)]">{clientScopeError || 'No active clients are available in your company.'}</p><Link href="/company/dashboard" className="text-sm font-semibold text-[var(--primary)] hover:underline">Return to company dashboard</Link></div>;

  const sidebar = (
    <div className="flex h-full flex-col bg-[var(--surface)]">
      <div className="shrink-0 space-y-3 border-b border-[var(--border)] px-4 py-4">
        <Brand src={company?.logoUrl} name={company?.name || 'Verification provider'} fallback={<Building2 size={17} />} />
        <div className="flex items-center gap-2 pl-1">
          <span className="h-px flex-1 bg-[var(--border)]" />
          <span className="text-[9px] font-semibold uppercase tracking-[0.13em] text-[var(--muted)]">Client workspace</span>
          <span className="h-px flex-1 bg-[var(--border)]" />
        </div>
        <Brand src={client?.logoUrl} name={client?.name || 'Client'} fallback={<Building2 size={17} />} />
      </div>
      <nav aria-label="Client portal navigation" className="min-h-0 flex-1 space-y-1 overflow-y-auto p-3">
        <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Workspace</p>
        {links.map(({ id, label, icon: Icon }) => (
          <Link key={id} href={id === 'dashboard' ? '/client-portal' : `/client-portal/${id}`} onClick={() => setMobileOpen(false)} aria-current={section === id ? 'page' : undefined} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-colors ${section === id ? 'bg-[var(--primary)]/10 text-[var(--primary)]' : 'text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]'}`}>
            <Icon size={17} /><span className="flex-1">{label}</span>{section === id && <span className="h-1.5 w-1.5 rounded-full bg-[var(--primary)]" />}
          </Link>
        ))}
        <p className="px-3 pb-1 pt-5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Account</p>
        <Link href="/client-portal/account" onClick={() => setMobileOpen(false)} aria-current={section === 'account' ? 'page' : undefined} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-colors ${section === 'account' ? 'bg-[var(--primary)]/10 text-[var(--primary)]' : 'text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]'}`}>
          <KeyRound size={17} /><span className="flex-1">Account settings</span>{section === 'account' && <span className="h-1.5 w-1.5 rounded-full bg-[var(--primary)]" />}
        </Link>
      </nav>
      <div className="shrink-0 border-t border-[var(--border)] px-4 py-3">
        <div className="truncate text-[11px] font-semibold text-[var(--foreground)]">{client?.contactName || client?.contactEmail || user?.email}</div>
        <div className="mt-1 truncate text-[10px] text-[var(--muted)]">{client?.industry || client?.clientCode || 'Client account'}</div>
        <div className="mt-3 flex items-center gap-2 border-t border-[var(--border)] pt-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--primary)]/15" title="HireVerify">
            <BrandMark size={16} />
          </span>
          <span className="text-[12px] font-semibold tracking-tight text-[var(--foreground)]">HireVerify</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-[var(--background)] text-[var(--foreground)]" style={{ '--primary': primaryColor, '--primary-foreground': primaryForeground } as CSSProperties}>
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-[var(--border)] md:block">{sidebar}</aside>
      {mobileOpen && <div className="fixed inset-0 z-50 md:hidden"><button type="button" aria-label="Close navigation" className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} /><div className="absolute inset-y-0 left-0 w-72 shadow-xl"><button type="button" onClick={() => setMobileOpen(false)} className="absolute right-3 top-3 z-10 rounded-md p-1 text-[var(--muted)]" aria-label="Close menu"><X size={18} /></button>{sidebar}</div></div>}
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-[var(--border)] bg-[var(--surface)]/90 px-4 backdrop-blur md:px-6">
          <button type="button" onClick={() => setMobileOpen(true)} aria-label="Open navigation" className="rounded-md p-1.5 text-[var(--muted)] md:hidden"><Menu size={20} /></button>
          <h1 className="text-[14px] font-semibold">{activeLabel}</h1>
          <div className="ml-auto flex items-center gap-3">
            {isCompanyAdmin && <label className="flex items-center gap-2 text-[10px] text-[var(--muted)]">
              <span className="hidden sm:inline">Client portal</span>
              <select aria-label="Choose client portal account" value={selectedClient?.id || ''} onChange={(event) => {
                const nextClient = availableClients.find((item) => item.id === event.target.value) || null;
                setSelectedClient(nextClient);
                setClientPortalScope(nextClient?.id || null);
                window.location.reload();
              }} className="max-w-40 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-[11px] font-medium text-[var(--foreground)]">
                {availableClients.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>}
            <div className="hidden items-center gap-2 border-r border-[var(--border)] pr-3 sm:flex">
              <span className="max-w-36 truncate text-[11px] text-[var(--muted)]">{company?.name}</span><span className="text-[var(--muted)]">/</span><span className="max-w-36 truncate text-[11px] font-medium">{client?.name}</span>
            </div>
            <ThemeToggle />
            {isCompanyAdmin
              ? <Link href="/company/dashboard" className="hidden rounded-lg border border-[var(--border)] px-3 py-2 text-[11px] font-medium hover:bg-[var(--surface-muted)] sm:block">Company admin</Link>
              : <button type="button" onClick={() => router.push('/client-portal/account')} className="rounded-lg border border-[var(--border)] px-3 py-2 text-[11px] font-medium hover:bg-[var(--surface-muted)]">Account</button>}
            <button type="button" onClick={() => void logout()} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-2 text-[11px] text-rose-600 hover:bg-rose-500/10"><LogOut size={15} /><span className="hidden sm:inline">Sign out</span></button>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1400px] px-4 py-6 md:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
