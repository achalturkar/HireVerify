'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Activity, ArrowRight, BriefcaseBusiness, FileCheck2, Users } from 'lucide-react';
import { useAuth } from '@/src/auth/AuthProvider';
import { getPlatformDashboard, type PlatformDashboardData } from '@/src/lib/api/platform-dashboard';

export default function SuperAdminBgvPage() {
  const { accessToken } = useAuth();
  const [data, setData] = useState<PlatformDashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    try { setData(await getPlatformDashboard(accessToken)); } catch (err) { setError(err instanceof Error ? err.message : 'Unable to load BGV operations'); }
  }, [accessToken]);

  useEffect(() => {
    const task = Promise.resolve().then(load);
    return () => { void task; };
  }, [load]);

  const stats = data?.stats;
  const metrics = [
    { label: 'Total BGV cases', value: stats?.bgvCases || 0, detail: 'All companies', icon: FileCheck2, color: 'text-[#D98CFF]' },
    { label: 'Candidates', value: stats?.candidates || 0, detail: 'In the platform directory', icon: Users, color: 'text-[#7C9CFF]' },
    { label: 'Client accounts', value: stats?.clients || 0, detail: 'Across all tenants', icon: BriefcaseBusiness, color: 'text-[#F2AE55]' },
    { label: 'Audit events', value: stats?.auditEvents24h || 0, detail: 'Recorded in the last 24 hours', icon: Activity, color: 'text-[#3FDCC0]' },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header><p className="mb-2 text-[11px] uppercase tracking-[0.14em] text-[var(--primary)]" style={{ fontFamily: 'var(--font-mono)' }}>Operations / BGV</p><h1 className="text-[28px] font-semibold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>BGV operations</h1><p className="mt-1 text-[13px] text-[var(--muted)]">Platform-wide visibility into background verification workload and records.</p></header>
      {error && <div className="rounded-xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-[13px] text-rose-600 dark:text-rose-400">{error}</div>}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">{metrics.map((metric) => <div key={metric.label} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm"><metric.icon size={19} className={metric.color} /><p className="mt-4 text-[28px] font-semibold" style={{ fontFamily: 'var(--font-display)' }}>{metric.value.toLocaleString()}</p><p className="mt-1 text-[13px] font-medium text-[var(--foreground)]">{metric.label}</p><p className="mt-1 text-[11px] text-[var(--muted)]">{metric.detail}</p></div>)}</div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2"><section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm"><h2 className="text-[16px] font-semibold">Verification command center</h2><p className="mt-1 text-[12px] text-[var(--muted)]">Use the platform directories to investigate records by tenant, candidate, client, and audit history.</p><div className="mt-5 space-y-2"><Link href="/super-admin/candidate" className="flex items-center justify-between rounded-xl border border-[var(--border)] p-3 text-[13px] hover:border-[var(--primary)]"><span className="flex items-center gap-3"><Users size={16} className="text-[#7C9CFF]" /> Candidate directory</span><ArrowRight size={15} className="text-[var(--muted)]" /></Link><Link href="/super-admin/client" className="flex items-center justify-between rounded-xl border border-[var(--border)] p-3 text-[13px] hover:border-[var(--primary)]"><span className="flex items-center gap-3"><BriefcaseBusiness size={16} className="text-[#F2AE55]" /> Client directory</span><ArrowRight size={15} className="text-[var(--muted)]" /></Link><Link href="/super-admin/audit" className="flex items-center justify-between rounded-xl border border-[var(--border)] p-3 text-[13px] hover:border-[var(--primary)]"><span className="flex items-center gap-3"><Activity size={16} className="text-[#3FDCC0]" /> Verification audit trail</span><ArrowRight size={15} className="text-[var(--muted)]" /></Link></div></section><section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm"><h2 className="text-[16px] font-semibold">Tenant operations</h2><p className="mt-1 text-[12px] text-[var(--muted)]">BGV data is tenant-owned. Open a company workspace to inspect its detailed case and report metrics.</p><Link href="/super-admin/companies" className="mt-5 flex items-center justify-between rounded-xl bg-[var(--primary)]/10 p-4 text-[13px] font-medium text-[var(--primary)] hover:bg-[var(--primary)]/15">Open company workspaces<ArrowRight size={16} /></Link></section></div>
    </div>
  );
}