'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import {
  Menu,
  Search,
  Bell,
  ChevronDown,
  Settings,
  LogOut,
} from "lucide-react";
import { ThemeToggle } from '@/src/components/layout/theme-toggle';

function titleFromPath(pathname: string): string {
  const segments = pathname.split('/').filter(Boolean);
  const last = segments[segments.length - 1] || 'dashboard';
  return last.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function Navbar({ onOpenMobileMenu }: { onOpenMobileMenu: () => void }) {
  const { user, logout, accessToken } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [readIds, setReadIds] = useState<string[]>([]);
  const menuRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);

  const loadNotifications = useCallback(async () => {
    if (!accessToken) return;
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API || '/api/v1'}/audit-logs?page=1&limit=6`, { headers: { Authorization: `Bearer ${accessToken}` } });
      const body = await response.json().catch(() => null);
      if (!response.ok) return;
      setNotifications((body?.data?.data || []).map((item: AuditResponse): NotificationItem => ({
        id: item.id,
        action: item.action,
        entity: item.entity,
        companyName: item.company?.name || 'Platform',
        actorName: item.user ? `${item.user.firstName} ${item.user.lastName}` : 'System',
        createdAt: item.createdAt,
      })));
    } catch {
      setNotifications([]);
    }
  }, [accessToken]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('hireverify-read-notifications') : null;
    const task = Promise.resolve().then(() => {
      if (stored) setReadIds(JSON.parse(stored));
      return loadNotifications();
    });
    return () => { void task; };
  }, [loadNotifications]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (notificationsRef.current && !notificationsRef.current.contains(e.target as Node)) setNotificationsOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const initials = user ? `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase() : '';

  return (
    <header className="sticky top-0 z-30 flex items-center gap-4 h-16 px-4 md:px-6 border-b border-[var(--border)] bg-[var(--surface)]/90 backdrop-blur">
      <button onClick={onOpenMobileMenu} className="md:hidden text-[var(--muted)] hover:text-[var(--foreground)]" aria-label="Open menu">
        <Menu width={22} height={22} />
      </button>

      <h1 className="text-[15px] font-semibold text-[var(--foreground)]" style={{ fontFamily: 'var(--font-display)' }}>
        {titleFromPath(pathname)}
      </h1>

      <div className="hidden sm:flex items-center gap-2 ml-4 flex-1 max-w-sm">
        <div className="flex items-center gap-2 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2">
          <Search width={15} height={15} className="text-[var(--muted)] shrink-0" />
          <input
            placeholder="Search…"
            className="w-full bg-transparent text-[13px] outline-none placeholder:text-[var(--muted)] text-[var(--foreground)]"
          />
        </div>
      </div>

      <div className="ml-auto flex items-center gap-3">
        <ThemeToggle />
        <div className="relative" ref={notificationsRef}>
          <button onClick={() => { setNotificationsOpen((value) => !value); setMenuOpen(false); }} className="relative flex h-9 w-9 items-center justify-center rounded-lg text-[var(--muted)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]" aria-label="Notifications" title="Notifications">
            <Bell width={18} height={18} />
            {unreadCount(notifications, readIds) > 0 && <span className="absolute -right-1 -top-1 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-[#F2AE55] px-1 text-[9px] font-bold text-[#0B0F26]">{unreadCount(notifications, readIds) > 9 ? '9+' : unreadCount(notifications, readIds)}</span>}
          </button>
          {notificationsOpen && <div className="absolute right-0 z-40 mt-2 w-80 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl"><div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3"><div><p className="text-[13px] font-semibold text-[var(--foreground)]">Notifications</p><p className="text-[11px] text-[var(--muted)]">Recent platform activity</p></div><button onClick={() => markAllRead(notifications, setReadIds)} className="text-[11px] text-[var(--primary)] hover:underline">Mark all read</button></div><div className="max-h-80 overflow-y-auto">{notifications.length === 0 ? <p className="px-4 py-8 text-center text-[12px] text-[var(--muted)]">No recent notifications</p> : notifications.map((notification) => { const isRead = readIds.includes(notification.id); return <button key={notification.id} onClick={() => { markRead(notification.id, readIds, setReadIds); setNotificationsOpen(false); router.push('/super-admin/audit'); }} className={`flex w-full gap-3 border-b border-[var(--border)] px-4 py-3 text-left transition hover:bg-[var(--surface-muted)] ${isRead ? 'opacity-60' : ''}`}><span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${isRead ? 'bg-[var(--muted)]' : 'bg-[var(--primary)]'}`} /><span className="min-w-0"><span className="block truncate text-[12px] font-medium text-[var(--foreground)]">{formatNotificationAction(notification.action)}</span><span className="mt-0.5 block truncate text-[11px] text-[var(--muted)]">{notification.companyName} · {notification.actorName}</span><span className="mt-1 block text-[10px] text-[var(--muted)]">{relativeTime(notification.createdAt)}</span></span></button>; })}</div><button onClick={() => { setNotificationsOpen(false); router.push('/super-admin/audit'); }} className="w-full px-4 py-3 text-center text-[12px] font-medium text-[var(--primary)] hover:bg-[var(--surface-muted)]">View full audit log</button></div>}
        </div>

        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2 rounded-lg pl-1 pr-2 py-1 hover:bg-[var(--surface-muted)] transition-colors"
          >
            <div
              className="w-8 h-8 rounded-full bg-[var(--primary)]/15 text-[var(--primary)] text-[12px] font-semibold flex items-center justify-center"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {initials || '—'}
            </div>
            <ChevronDown width={14} height={14} className={`hidden sm:block text-[#8891B8] transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-2 w-56 rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-[var(--border)]">
                <p className="text-[13px] font-medium text-[var(--foreground)] truncate">
                  {user ? `${user.firstName} ${user.lastName}` : ''}
                </p>
                <p className="text-[12px] text-[var(--muted)] truncate">{user?.email}</p>
              </div>
              <button onClick={() => { setMenuOpen(false); router.push('/super-admin/settings'); }} className="flex w-full items-center gap-2.5 px-4 py-2.5 text-[13px] text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)] transition-colors">
                <Settings width={16} height={16} />
                Account settings
              </button>
              <button
                onClick={logout}
                className="flex w-full items-center gap-2.5 px-4 py-2.5 text-[13px] text-[#FF6B6B] hover:bg-[#FF6B6B]/[0.08] transition-colors"
              >
                <LogOut width={16} height={16} />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

interface AuditResponse {
  id: string;
  action: string;
  entity: string;
  createdAt: string;
  company: { name: string } | null;
  user: { firstName: string; lastName: string } | null;
}

interface NotificationItem {
  id: string;
  action: string;
  entity: string;
  createdAt: string;
  companyName: string;
  actorName: string;
}

function unreadCount(items: NotificationItem[], readIds: string[]) {
  return items.filter((item) => !readIds.includes(item.id)).length;
}

function markRead(id: string, readIds: string[], setReadIds: (ids: string[]) => void) {
  const next = Array.from(new Set([...readIds, id]));
  setReadIds(next);
  localStorage.setItem('hireverify-read-notifications', JSON.stringify(next));
}

function markAllRead(items: NotificationItem[], setReadIds: (ids: string[]) => void) {
  const next = items.map((item) => item.id);
  setReadIds(next);
  localStorage.setItem('hireverify-read-notifications', JSON.stringify(next));
}

function formatNotificationAction(action: string) {
  return action.replaceAll('_', ' ').replaceAll('.', ' ').replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
}

function relativeTime(value: string) {
  const minutes = Math.max(1, Math.round((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}