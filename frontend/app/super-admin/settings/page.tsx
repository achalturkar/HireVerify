'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell, Check, ChevronRight, KeyRound, Monitor, Palette, RotateCcw, ShieldCheck, UserRound } from 'lucide-react';
import { useAuth } from '@/src/auth/AuthProvider';
import { useTheme } from '@/src/lib/theme-context';

type Preferences = {
  securityAlerts: boolean;
  companyActivity: boolean;
  auditActivity: boolean;
  weeklySummary: boolean;
};

const defaults: Preferences = {
  securityAlerts: true,
  companyActivity: true,
  auditActivity: true,
  weeklySummary: false,
};

const labels: Array<{ key: keyof Preferences; title: string; description: string }> = [
  { key: 'securityAlerts', title: 'Security alerts', description: 'Password changes and suspicious access events.' },
  { key: 'companyActivity', title: 'Company activity', description: 'New companies, suspensions, activations, and admin changes.' },
  { key: 'auditActivity', title: 'Audit activity', description: 'Important platform actions in the audit trail.' },
  { key: 'weeklySummary', title: 'Weekly platform summary', description: 'A weekly overview of companies, users, and BGV activity.' },
];

export default function SettingsPage() {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [preferences, setPreferences] = useState(defaults);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const task = Promise.resolve().then(() => {
      const stored = localStorage.getItem('hireverify-account-preferences');
      if (stored) {
        try { setPreferences({ ...defaults, ...JSON.parse(stored) }); } catch { setPreferences(defaults); }
      }
    });
    return () => { void task; };
  }, []);

  const save = (next: Preferences) => {
    setPreferences(next);
    localStorage.setItem('hireverify-account-preferences', JSON.stringify(next));
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <p className="mb-2 text-[11px] uppercase tracking-[0.14em] text-[var(--primary)]" style={{ fontFamily: 'var(--font-mono)' }}>Account / Settings</p>
        <h1 className="text-[28px] font-semibold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>Account settings</h1>
        <p className="mt-1 text-[13px] text-[var(--muted)]">Control your portal appearance, notifications, and account security.</p>
      </header>

      {saved && <div className="flex items-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-[13px] text-emerald-600 dark:text-emerald-400"><Check size={15} /> Preferences saved on this browser.</div>}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--primary)]/15 text-[var(--primary)]"><Palette size={17} /></span><div><h2 className="text-[15px] font-semibold">Appearance</h2><p className="text-[11px] text-[var(--muted)]">Personalize your workspace</p></div></div>
          <button onClick={toggleTheme} className="flex w-full items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-left hover:border-[var(--primary)]"><span className="flex items-center gap-3"><Monitor size={16} className="text-[var(--primary)]" /><span><span className="block text-[13px] font-medium text-[var(--foreground)]">Color theme</span><span className="block text-[11px] text-[var(--muted)]">Currently using {theme} mode</span></span></span><span className="text-[11px] text-[var(--primary)]">Switch</span></button>
        </section>

        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400"><Bell size={17} /></span><div><h2 className="text-[15px] font-semibold">Notification preferences</h2><p className="text-[11px] text-[var(--muted)]">Choose your alert categories</p></div></div>
          <div className="space-y-1">{labels.map((item) => <button key={item.key} onClick={() => save({ ...preferences, [item.key]: !preferences[item.key] })} className="flex w-full items-center justify-between gap-4 rounded-xl px-2 py-3 text-left hover:bg-[var(--surface-muted)]"><span><span className="block text-[13px] font-medium text-[var(--foreground)]">{item.title}</span><span className="mt-0.5 block text-[11px] text-[var(--muted)]">{item.description}</span></span><span className={`relative h-5 w-9 shrink-0 rounded-full ${preferences[item.key] ? 'bg-[var(--primary)]' : 'bg-slate-300 dark:bg-slate-700'}`}><span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${preferences[item.key] ? 'translate-x-4' : 'translate-x-0.5'}`} /></span></button>)}</div>
        </section>

        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-500/15 text-rose-600 dark:text-rose-400"><ShieldCheck size={17} /></span><div><h2 className="text-[15px] font-semibold">Security controls</h2><p className="text-[11px] text-[var(--muted)]">Manage your identity and credentials</p></div></div>
          <div className="space-y-2"><Link href="/super-admin/profile" className="flex items-center justify-between rounded-xl border border-[var(--border)] px-3.5 py-3 hover:border-[var(--primary)]"><span className="flex items-center gap-3"><UserRound size={16} className="text-[var(--primary)]" /><span><span className="block text-[13px] text-[var(--foreground)]">Profile details</span><span className="block text-[11px] text-[var(--muted)]">{user?.email || 'Manage your identity'}</span></span></span><ChevronRight size={16} className="text-[var(--muted)]" /></Link><Link href="/super-admin/change-password" className="flex items-center justify-between rounded-xl border border-[var(--border)] px-3.5 py-3 hover:border-[var(--primary)]"><span className="flex items-center gap-3"><KeyRound size={16} className="text-[var(--primary)]" /><span><span className="block text-[13px] text-[var(--foreground)]">Change password</span><span className="block text-[11px] text-[var(--muted)]">Rotate your Super Admin password</span></span></span><ChevronRight size={16} className="text-[var(--muted)]" /></Link></div>
        </section>

        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm"><div className="mb-5 flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-500/15 text-sky-600 dark:text-sky-400"><UserRound size={17} /></span><div><h2 className="text-[15px] font-semibold">Session information</h2><p className="text-[11px] text-[var(--muted)]">Current account context</p></div></div><dl className="space-y-3 text-[12px]"><div className="flex justify-between gap-4"><dt className="text-[var(--muted)]">Account</dt><dd className="truncate text-right text-[var(--foreground)]">{user?.firstName} {user?.lastName}</dd></div><div className="flex justify-between gap-4"><dt className="text-[var(--muted)]">Role</dt><dd className="text-right text-[var(--foreground)]">{user?.role?.name || 'Super Admin'}</dd></div><div className="flex justify-between gap-4"><dt className="text-[var(--muted)]">Status</dt><dd className="font-medium text-emerald-600 dark:text-emerald-400">{user?.status || 'ACTIVE'}</dd></div></dl></section>
      </div>

      <div className="flex justify-end"><button onClick={() => save(defaults)} className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-3.5 py-2.5 text-[12px] text-[var(--muted)] hover:border-[var(--primary)] hover:text-[var(--foreground)]"><RotateCcw size={14} /> Reset preferences</button></div>
    </div>
  );
}
