'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo, type SVGProps } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { buildAdminMenu } from '@/src/lib/permissions';
import { FileCheck2, LayoutDashboard, ChevronLeft, Settings, X } from 'lucide-react';

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export default function Sidebar({ collapsed, onToggleCollapse, mobileOpen, onCloseMobile }: SidebarProps) {
  const { user, permissions } = useAuth();
  const pathname = usePathname();
  const adminItems = useMemo(() => buildAdminMenu(permissions), [permissions]);

  const initials = user ? `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase() : '';

  const content = (
    <div className="flex h-full flex-col bg-[var(--surface)] text-[var(--foreground)]">
      {/* Logo row */}
      <div className={`flex items-center gap-2.5 h-16 shrink-0 border-b border-[var(--border)] bg-[var(--surface)] ${collapsed ? 'justify-between px-3' : 'px-5'}`}>
        <svg width="26" height="26" viewBox="0 0 30 30" fill="none" className="shrink-0">
          <rect x="3" y="12" width="7" height="15" rx="2" fill="#3FDCC0" />
          <rect x="12.5" y="4" width="7" height="23" rx="2" fill="#F2AE55" />
          <rect x="22" y="9" width="5" height="18" rx="2" fill="#3FDCC0" opacity="0.55" />
        </svg>
        {!collapsed && (
          <span className="text-[16px] font-semibold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
            HireVerify
          </span>
        )}
        <button
          onClick={onToggleCollapse}
          className={`hidden md:flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--muted)] transition-all hover:border-[var(--primary)] hover:bg-[var(--primary)]/[0.08] hover:text-[var(--primary)] ${collapsed ? '' : 'ml-auto'}`}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <ChevronLeft width={16} height={16} className={`transition-transform duration-200 ${collapsed ? 'rotate-180' : ''}`} />
        </button>
        <button
          onClick={onCloseMobile}
          className="ml-auto md:hidden text-[var(--muted)] hover:text-[var(--foreground)]"
          aria-label="Close menu"
        >
          <X width={20} height={20} />
        </button>
      </div>

      {/* Menu */}
      <nav className="flex-1 overflow-y-auto px-3 py-5 space-y-6">
        <div>
          {!collapsed && (
            <p className="px-3 mb-2 text-[10.5px] font-medium uppercase tracking-[0.12em] text-[#565F8C]" style={{ fontFamily: 'var(--font-mono)' }}>
              Main
            </p>
          )}
          <SidebarLink
            href="/super-admin/dashboard"
            label="Dashboard"
            icon={LayoutDashboard}
            active={pathname === '/super-admin/dashboard'}
            collapsed={collapsed}
            onClick={onCloseMobile}
          />
        </div>

        {adminItems.length > 0 && (
          <div>
            {!collapsed && (
              <p className="px-3 mb-2 text-[10.5px] font-medium uppercase tracking-[0.12em] text-[var(--muted)]" style={{ fontFamily: 'var(--font-mono)' }}>
                Administration
              </p>
            )}
            <div className="space-y-1">
              {adminItems.map((item) => (
                <SidebarLink
                  key={item.key}
                  href={item.path}
                  label={item.label}
                  icon={item.icon}
                  active={pathname.startsWith(item.path)}
                  collapsed={collapsed}
                  onClick={onCloseMobile}
                />
              ))}
            </div>
          </div>
        )}

        <div>
          {!collapsed && <p className="mb-2 px-3 text-[10.5px] font-medium uppercase tracking-[0.12em] text-[var(--muted)]" style={{ fontFamily: 'var(--font-mono)' }}>Operations</p>}
          <div className="space-y-1">
            <SidebarLink href="/super-admin/bgv" label="BGV Operations" icon={FileCheck2} active={pathname.startsWith('/super-admin/bgv')} collapsed={collapsed} onClick={onCloseMobile} />
            <SidebarLink href="/super-admin/settings" label="Settings" icon={Settings} active={pathname.startsWith('/super-admin/settings')} collapsed={collapsed} onClick={onCloseMobile} />
          </div>
        </div>
      </nav>

      {/* User + collapse toggle */}
      <div className="shrink-0 border-t border-[var(--border)] p-3">
        <div className={`flex items-center gap-2.5 rounded-lg px-2 py-2 ${collapsed ? 'justify-center' : ''}`}>
          <div className="w-8 h-8 shrink-0 rounded-full bg-[var(--primary)]/15 text-[var(--primary)] text-[12px] font-semibold flex items-center justify-center" style={{ fontFamily: 'var(--font-display)' }}>
            {initials || '—'}
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <Link href="/super-admin/profile" onClick={onCloseMobile} className="block truncate text-[13px] font-medium text-[var(--foreground)] hover:text-[var(--primary)]">
                {user ? `${user.firstName} ${user.lastName}` : 'Loading…'}
              </Link>
              <p className="text-[11px] text-[var(--muted)] truncate">{user?.role.name ?? ''}</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );

  return (
    <>
      {/* Desktop */}
      <aside
        className={`hidden md:block shrink-0 border-r border-[var(--border)] transition-[width] duration-200 ${
          collapsed ? 'w-[76px]' : 'w-64'
        }`}
      >
        {content}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/60" onClick={onCloseMobile} />
          <div className="absolute inset-y-0 left-0 w-72 shadow-2xl">{content}</div>
        </div>
      )}
    </>
  );
}

function SidebarLink({
  href,
  label,
  icon: Icon,
  active,
  collapsed,
  onClick,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<SVGProps<SVGSVGElement>>;
  active: boolean;
  collapsed: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] transition-all ${
        collapsed ? 'justify-center' : ''
      } ${
        active
          ? 'bg-[var(--primary)]/[0.12] text-[var(--primary)] shadow-sm shadow-[var(--primary)]/[0.08]'
          : 'text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]'
      }`}
    >
      <Icon width={18} height={18} className={active ? 'text-[var(--primary)]' : 'text-[var(--muted)] group-hover:text-[var(--foreground)]'} />
      {!collapsed && <span className="truncate">{label}</span>}
      {active && !collapsed && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[var(--primary)]" />}
    </Link>
  );
}