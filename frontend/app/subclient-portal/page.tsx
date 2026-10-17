'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, FileCheck2, FileText, Users } from 'lucide-react';
import { useAuth } from '@/src/auth/AuthProvider';
import { getSubclientDashboard, type SubclientDashboard } from '@/src/lib/api/subclient-portal';

export default function SubclientPortalPage() {
  const { accessToken, user } = useAuth();
  const [dashboard, setDashboard] = useState<SubclientDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setDashboard(await getSubclientDashboard(accessToken));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load the dashboard.');
    } finally {
      setLoading(false);
    }
  }, [accessToken]);
  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const stats = [
    { label: 'Candidates', value: dashboard?.counts.candidates, href: '/subclient-portal/candidates', icon: Users },
    { label: 'BGV cases', value: dashboard?.counts.cases, href: '/subclient-portal/cases', icon: FileCheck2 },
    { label: 'Open cases', value: dashboard?.counts.openCases, href: '/subclient-portal/cases', icon: FileCheck2 },
    { label: 'Completed reports', value: dashboard?.counts.completedCases, href: '/subclient-portal/reports', icon: FileText },
  ];

  return <div className="space-y-7">
    <header><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--primary)]">Subclient portal</p><h2 className="mt-1 text-2xl font-semibold">Welcome, {user?.firstName}</h2><p className="mt-1 text-sm text-[var(--muted)]">{user?.client?.name} · View the candidates and verification cases assigned to your subclient.</p></header>
    {error && <p role="alert" className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 text-sm text-rose-700">{error}</p>}
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Subclient summary">
      {stats.map(({ label, value, href, icon: Icon }) => <Link key={label} href={href} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 transition hover:border-[var(--primary)]/40"><div className="flex items-center justify-between"><span className="text-xs text-[var(--muted)]">{label}</span><Icon size={17} className="text-[var(--primary)]" /></div><p className="mt-3 text-2xl font-semibold">{loading ? '—' : value ?? 0}</p><span className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold text-[var(--primary)]">Open <ArrowRight size={12} /></span></Link>)}
    </section>
    <section className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
      <div className="flex items-center justify-between border-b border-[var(--border)] p-4"><div><h3 className="text-sm font-semibold">Recent cases</h3><p className="mt-1 text-xs text-[var(--muted)]">The latest cases assigned to this subclient.</p></div><Link href="/subclient-portal/cases" className="text-xs font-semibold text-[var(--primary)] hover:underline">View all</Link></div>
      {loading ? <p className="p-8 text-center text-xs text-[var(--muted)]">Loading cases…</p>
        : !dashboard?.recentCases.length ? <p className="p-8 text-center text-xs text-[var(--muted)]">No cases are available yet.</p>
          : <div className="divide-y divide-[var(--border)]">{dashboard.recentCases.map((item) => <Link key={item.id} href={`/subclient-portal/cases/${item.id}`} className="flex flex-wrap items-center justify-between gap-3 p-4 hover:bg-[var(--surface-muted)]"><div><p className="font-mono text-xs font-semibold">{item.caseNumber}</p><p className="mt-1 text-xs text-[var(--muted)]">{item.candidate.fullName || [item.candidate.firstName, item.candidate.middleName, item.candidate.lastName].filter(Boolean).join(' ')}</p></div><span className="rounded-full bg-[var(--surface-muted)] px-2.5 py-1 text-[10px] font-semibold">{item.status.replaceAll('_', ' ')}</span></Link>)}</div>}
    </section>
  </div>;
}
