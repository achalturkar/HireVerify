'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { Building2, FileCheck2, FileText, KeyRound, LayoutDashboard, LogOut, Users } from 'lucide-react';
import { useAuth } from '@/src/auth/AuthProvider';
import { ThemeToggle } from '@/src/components/layout/theme-toggle';
import BrandMark from '@/src/components/ui/BrandMark';

const navigation = [
  { href: '/subclient-portal', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/subclient-portal/candidates', label: 'Candidates', icon: Users },
  { href: '/subclient-portal/cases', label: 'BGV cases', icon: FileCheck2 },
  { href: '/subclient-portal/reports', label: 'Reports', icon: FileText },
  { href: '/subclient-portal/account', label: 'Account settings', icon: KeyRound },
];

export default function SubclientPortalLayout({ children }: { children: ReactNode }) {
  const { user, loading, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isSubclientUser = Boolean(user?.role.isClientUser && user.client?.parentClientId);

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace('/login');
    else if (user.role.isClientUser && !user.client?.parentClientId) router.replace('/client-portal');
    else if (!user.role.isClientUser) router.replace(user.role.isSuperAdmin ? '/super-admin/dashboard' : '/company/dashboard');
  }, [loading, router, user]);

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-[var(--muted)]">Loading subclient portal…</div>;
  }
  if (!user || !isSubclientUser) return null;

  return (
    <div className="flex min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--surface)] md:flex">
        <div className="border-b border-[var(--border)] p-5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--primary)]/10"><Building2 size={18} className="text-[var(--primary)]" /></span>
            <div className="min-w-0"><p className="truncate text-sm font-semibold">{user.client?.name || 'Subclient'}</p><p className="text-[10px] uppercase tracking-wider text-[var(--muted)]">Subclient portal</p></div>
          </div>
        </div>
        <nav aria-label="Subclient portal navigation" className="flex-1 space-y-1 p-3">
          {navigation.map(({ href, label, icon: Icon }) => {
            const active = href === '/subclient-portal' ? pathname === href : pathname.startsWith(href);
            return <Link key={href} href={href} aria-current={active ? 'page' : undefined} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium ${active ? 'bg-[var(--primary)]/10 text-[var(--primary)]' : 'text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]'}`}><Icon size={17} />{label}</Link>;
          })}
        </nav>
        <div className="border-t border-[var(--border)] p-4">
          <p className="truncate text-xs font-medium">{user.firstName} {user.lastName}</p><p className="mt-1 truncate text-[10px] text-[var(--muted)]">{user.email}</p>
          <div className="mt-3 flex items-center gap-2 border-t border-[var(--border)] pt-3"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--primary)]/10"><BrandMark size={16} /></span><span className="text-xs font-semibold">HireVerify</span></div>
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-[var(--border)] bg-[var(--surface)]/90 px-4 backdrop-blur md:px-6">
          <h1 className="truncate text-sm font-semibold">{navigation.find((item) => item.href === pathname)?.label || (pathname.includes('/cases/') ? 'Case details' : 'Subclient workspace')}</h1>
          <span className="ml-auto hidden max-w-56 truncate text-xs text-[var(--muted)] sm:block">{user.client?.name}</span>
          <ThemeToggle />
          <button type="button" onClick={() => void logout()} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-medium hover:bg-[var(--surface-muted)]"><LogOut size={14} /><span className="hidden sm:inline">Sign out</span></button>
        </header>
        <nav aria-label="Subclient portal navigation" className="flex gap-1 overflow-x-auto border-b border-[var(--border)] bg-[var(--surface)] px-3 py-2 md:hidden">
          {navigation.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-2 text-[11px] font-medium text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"><Icon size={14} />{label}</Link>)}
        </nav>
        <main className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
