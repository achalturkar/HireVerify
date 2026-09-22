'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Menu, LogOut, ChevronDown, Settings } from 'lucide-react';
import { Bell, ClipboardList } from 'lucide-react';
import { useAuth } from '@/src/auth/AuthProvider';
import { ThemeToggle } from '@/src/components/layout/theme-toggle';
import { listRecentAuditLogs } from '@/src/lib/api/audit';
import type { AuditLog } from '@/src/lib/api/audit';

function titleFromPath(pathname: string): string {
  const segments = pathname.split('/').filter(Boolean);
  const last = segments[segments.length - 1] || 'dashboard';

  return last
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function CompanyNavbar({
  onOpenMobileMenu,
}: {
  onOpenMobileMenu: () => void;
}) {
  const { user, logout } = useAuth();
  const { accessToken } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const [menuOpen, setMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AuditLog[]>([]);
  const menuRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!accessToken) return;
    void listRecentAuditLogs(accessToken).then(setNotifications).catch(() => setNotifications([]));
  }, [accessToken]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node)
      ) {
        setMenuOpen(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(e.target as Node)) setNotificationsOpen(false);
    }

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const initials = user
    ? `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase()
    : '';

  const handleAccountSettings = () => {
    setMenuOpen(false);
    router.push('/company/settings');
  };
  const handleHelpAndSupport = () => {
    setMenuOpen(false);
    router.push('/company/help');
  };

  return (
    <header className="sticky top-0 z-30 flex items-center gap-4 h-16 px-4 md:px-6 border-b border-[var(--border)] bg-[var(--surface)]/90 backdrop-blur">
      
      <button
        onClick={onOpenMobileMenu}
        className="md:hidden text-[var(--muted)] hover:text-[var(--foreground)]"
        aria-label="Open menu"
      >
        <Menu size={22} />
      </button>

      <h1
        className="text-[15px] font-semibold text-[var(--foreground)]"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {titleFromPath(pathname)}
      </h1>

      <div className="ml-auto flex items-center gap-3">
        <ThemeToggle />

        <div className="relative" ref={notificationsRef}>
          <button type="button" onClick={() => setNotificationsOpen((value) => !value)} aria-label="Recent activity" title="Recent activity" className="relative flex h-9 w-9 items-center justify-center rounded-lg text-[var(--muted)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]">
            <Bell size={18} />
            {notifications.length > 0 && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-[#F2AE55]" />}
          </button>
          {notificationsOpen && <div className="absolute right-0 mt-2 w-80 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3"><div><p className="text-[13px] font-semibold">Recent activity</p><p className="text-[11px] text-[var(--muted)]">Latest company events</p></div><button type="button" onClick={() => { setNotificationsOpen(false); router.push('/company/audit'); }} className="text-[11px] font-semibold text-[var(--primary)]">View all</button></div>
            {notifications.length === 0 ? <p className="px-4 py-6 text-center text-[12px] text-[var(--muted)]">No recent activity.</p> : <div className="divide-y divide-[var(--border)]">{notifications.map((item) => <button type="button" key={item.id} onClick={() => { setNotificationsOpen(false); router.push('/company/audit'); }} className="flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--surface-muted)]"><span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--primary)]/10 text-[var(--primary)]"><ClipboardList size={14} /></span><span className="min-w-0"><span className="block truncate text-[12px] font-semibold">{item.action.replaceAll('_', ' ')}</span><span className="mt-0.5 block truncate text-[11px] text-[var(--muted)]">{item.user ? `${item.user.firstName} ${item.user.lastName}` : 'System'} · {new Date(item.createdAt).toLocaleString()}</span></span></button>)}</div>}
          </div>}
        </div>

        <div className="relative" ref={menuRef}>
          
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2.5 rounded-lg pl-2 pr-2.5 py-1.5 hover:bg-[var(--surface-muted)] transition-colors"
          >
            <div
              className="w-8 h-8 rounded-full bg-[var(--primary)]/15 text-[var(--primary)] text-[12px] font-semibold flex items-center justify-center shrink-0"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {initials || '—'}
            </div>

            <div className="hidden sm:block text-left">
              <p className="text-[13px] text-[var(--foreground)] leading-tight">
                {user?.firstName} {user?.lastName}
              </p>

              <p className="text-[11px] text-[var(--muted)] leading-tight">
                {user?.role?.name}
              </p>
            </div>

            <ChevronDown
              size={14}
              className={`text-[#8891B8] transition-transform ${
                menuOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-2 w-56 rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl overflow-hidden">
              
              <div className="px-4 py-3 border-b border-[var(--border)]">
                <p className="text-[13px] font-medium text-[var(--foreground)] truncate">
                  {user?.firstName} {user?.lastName}
                </p>

                <p className="text-[12px] text-[var(--muted)] truncate">
                  {user?.email}
                </p>
              </div>

              {/* Account Settings */}
              <button
                onClick={handleAccountSettings}
                className="flex w-full items-center gap-2.5 px-4 py-2.5 text-[13px] text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)] transition-colors"
              >
                <Settings size={16} />
                Account settings
              </button>
              <button
                onClick={handleHelpAndSupport}
                className="flex w-full items-center gap-2.5 px-4 py-2.5 text-[13px] text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)] transition-colors"
              >
                <Settings size={16} />
                Help & Support
              </button>

              {/* Sign Out */}
              <button
                onClick={logout}
                className="flex w-full items-center gap-2.5 px-4 py-2.5 text-[13px] text-[#FF6B6B] hover:bg-[#FF6B6B]/[0.08] transition-colors"
              >
                <LogOut size={16} />
                Sign out
              </button>

            </div>
          )}
        </div>
      </div>
    </header>
  );
}