'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Activity, Building, ClipboardList, RefreshCw, Users } from 'lucide-react';
import { useAuth } from '@/src/auth/AuthProvider';
import { getPlatformDashboard, type PlatformDashboardData } from '@/src/lib/api/platform-dashboard';

function formatDate(value: string) {
  return new Date(value).toLocaleString(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function relativeDate(value: string) {
  const minutes = Math.max(1, Math.round((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function titleCase(value: string) {
  return value.replaceAll('_', ' ').replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function DashboardHome() {
  const { user, accessToken } = useAuth();
  const [data, setData] = useState<PlatformDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<'monthly' | 'yearly'>('monthly');

  const loadDashboard = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      setData(await getPlatformDashboard(accessToken, period));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load platform dashboard');
    } finally {
      setLoading(false);
    }
  }, [accessToken, period]);

  useEffect(() => {
    const task = Promise.resolve().then(loadDashboard);
    return () => { void task; };
  }, [loadDashboard]);

  const stats = data?.stats;
  const cards = stats ? [
    { label: 'Total companies', value: stats.companies, detail: `${stats.activeCompanies} active · ${stats.suspendedCompanies} suspended`, icon: Building, color: 'teal' },
    { label: 'Platform users', value: stats.users, detail: `${stats.activeUsers} active users`, icon: Users, color: 'amber' },
    { label: 'Candidates', value: stats.candidates, detail: `${stats.clients} client accounts`, icon: Activity, color: 'teal' },
    { label: 'BGV cases', value: stats.bgvCases, detail: `${stats.auditEvents24h} audit events in 24h`, icon: ClipboardList, color: 'amber' },
  ] : [];
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const companyTotal = stats?.companies || 1;
  const activeAngle = ((stats?.activeCompanies || 0) / companyTotal) * 360;
  const suspendedAngle = activeAngle + ((stats?.suspendedCompanies || 0) / companyTotal) * 360;
  const series = useMemo(() => [
    { key: 'companies', label: 'Companies', color: '#3FDCC0' },
    { key: 'users', label: 'Users', color: '#F2AE55' },
    { key: 'candidates', label: 'Candidates', color: '#7C9CFF' },
    { key: 'bgvCases', label: 'BGV cases', color: '#D98CFF' },
    { key: 'auditEvents', label: 'Audit events', color: '#FF8B8B' },
  ], []);

  return (
    <div className="mx-auto max-w-7xl space-y-7">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="mb-1.5 text-[11px] uppercase tracking-[0.14em] text-[#3FDCC0]" style={{ fontFamily: 'var(--font-mono)' }}>Super Admin Overview</p>
          <h1 className="text-[26px] font-semibold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>{greeting()}, {user?.firstName ?? '—'}</h1>
          <p className="mt-1 text-[13.5px] text-[#8891B8]">{today} · live platform-wide operating view</p>
        </div>
        <button onClick={loadDashboard} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-white/[0.12] px-3 py-2 text-[12px] text-[#C7CBE0] hover:bg-white/[0.06] disabled:opacity-50" aria-label="Refresh dashboard">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {error && <div className="flex items-center justify-between rounded-xl border border-[#FF6B6B]/25 bg-[#FF6B6B]/10 px-4 py-3 text-[13px] text-[#FF8B8B]"><span>{error}</span><button onClick={loadDashboard} className="font-semibold underline">Retry</button></div>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loading && !data ? Array.from({ length: 4 }, (_, index) => <div key={index} className="h-36 animate-pulse rounded-2xl border border-white/[0.08] bg-[#161C3A]" />) : cards.map((card) => <div key={card.label} className="rounded-2xl border border-white/[0.08] bg-[#161C3A] p-5"><div className="mb-4 flex items-center justify-between"><div className={`flex h-9 w-9 items-center justify-center rounded-lg ${card.color === 'teal' ? 'bg-[#3FDCC0]/15 text-[#3FDCC0]' : 'bg-[#F2AE55]/15 text-[#F2AE55]'}`}><card.icon size={17} /></div><span className="text-[10px] uppercase tracking-wide text-[#565F8C]">Live</span></div><p className="text-[26px] font-semibold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>{card.value.toLocaleString()}</p><p className="mt-1 text-[12.5px] text-[#8891B8]">{card.label}</p><p className="mt-2 text-[11px] text-[#565F8C]" style={{ fontFamily: 'var(--font-mono)' }}>{card.detail}</p></div>)}
      </div>

      <section className="rounded-2xl border border-white/[0.08] bg-[#161C3A] p-5">
        <div className="flex flex-col gap-4 border-b border-white/[0.08] pb-5 sm:flex-row sm:items-start sm:justify-between"><div><h2 className="text-[15px] font-semibold" style={{ fontFamily: 'var(--font-display)' }}>Platform performance</h2><p className="mt-1 text-[11px] text-[#565F8C]">Growth compared with the previous equivalent period</p></div><div className="flex rounded-lg border border-white/[0.1] bg-[#0F1430] p-1"><button onClick={() => { setPeriod('monthly'); setData(null); }} className={`rounded-md px-3 py-1.5 text-[11px] ${period === 'monthly' ? 'bg-[#3FDCC0]/15 text-[#3FDCC0]' : 'text-[#8891B8]'}`}>Monthly</button><button onClick={() => { setPeriod('yearly'); setData(null); }} className={`rounded-md px-3 py-1.5 text-[11px] ${period === 'yearly' ? 'bg-[#3FDCC0]/15 text-[#3FDCC0]' : 'text-[#8891B8]'}`}>Yearly</button></div></div>
        <div className="grid grid-cols-1 gap-5 pt-5 xl:grid-cols-[1fr_230px]"><div className="min-w-0"><div className="flex h-64 items-end gap-2 overflow-x-auto pb-7 sm:gap-3">{data?.analytics?.trends?.companies?.map((bucket, index) => { const values = series.map((item) => data.analytics.trends[item.key]?.[index]?.value || 0); const max = Math.max(1, ...values); return <div key={bucket.key} className="flex min-w-[42px] flex-1 items-end justify-center gap-1 self-stretch"><div className="flex h-full w-full items-end justify-center gap-0.5">{series.map((item) => { const value = data.analytics.trends[item.key]?.[index]?.value || 0; return <div key={item.key} title={`${item.label}: ${value}`} className="min-h-[2px] w-full max-w-3 rounded-t-sm" style={{ height: `${Math.max(2, value / max * 100)}%`, backgroundColor: item.color }} />; })}</div><span className="-mb-6 whitespace-nowrap text-[10px] text-[#565F8C]" style={{ fontFamily: 'var(--font-mono)' }}>{bucket.label}</span></div>; })}</div><div className="mt-3 flex flex-wrap gap-3">{series.map((item) => <span key={item.key} className="flex items-center gap-1.5 text-[10px] text-[#8891B8]"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />{item.label}</span>)}</div></div><div className="space-y-2">{series.map((item) => { const comparison = data?.analytics?.comparison?.[item.key]; return <div key={item.key} className="rounded-lg border border-white/[0.07] bg-[#0F1430]/60 p-3"><div className="flex items-center justify-between"><span className="text-[11px] text-[#8891B8]">{item.label}</span><span className={`text-[11px] font-semibold ${comparison && comparison.percent >= 0 ? 'text-[#3FDCC0]' : 'text-[#FF8B8B]'}`}>{comparison ? `${comparison.percent >= 0 ? '+' : ''}${comparison.percent}%` : '—'}</span></div><p className="mt-1 text-[16px] font-semibold text-[#F2F4FA]">{comparison?.current.toLocaleString() || '0'} <span className="text-[10px] font-normal text-[#565F8C]">vs {comparison?.previous.toLocaleString() || '0'}</span></p></div>; })}</div></div>
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <section className="rounded-2xl border border-white/[0.08] bg-[#161C3A] p-5 lg:col-span-1"><div className="mb-5"><h2 className="text-[15px] font-semibold" style={{ fontFamily: 'var(--font-display)' }}>Company health</h2><p className="mt-1 text-[11px] text-[#565F8C]">Tenant status distribution</p></div><div className="flex items-center gap-6"><div className="relative h-36 w-36 shrink-0 rounded-full" style={{ background: `conic-gradient(#3FDCC0 0deg ${activeAngle}deg, #F2AE55 ${activeAngle}deg ${suspendedAngle}deg, #64748B ${suspendedAngle}deg 360deg)` }}><div className="absolute inset-5 flex items-center justify-center rounded-full bg-[#161C3A]"><div className="text-center"><p className="text-2xl font-semibold">{stats?.companies || 0}</p><p className="text-[10px] text-[#8891B8]">companies</p></div></div></div><div className="space-y-3 text-[12px]"><div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-[#3FDCC0]" /><span className="text-[#AAB2D4]">Active</span><strong className="ml-auto text-[#F2F4FA]">{stats?.activeCompanies || 0}</strong></div><div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-[#F2AE55]" /><span className="text-[#AAB2D4]">Suspended</span><strong className="ml-auto text-[#F2F4FA]">{stats?.suspendedCompanies || 0}</strong></div><div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-[#64748B]" /><span className="text-[#AAB2D4]">Inactive</span><strong className="ml-auto text-[#F2F4FA]">{stats?.inactiveCompanies || 0}</strong></div></div></div></section>
        <section className="rounded-2xl border border-white/[0.08] bg-[#161C3A] p-5 lg:col-span-1"><div className="mb-4"><h2 className="text-[15px] font-semibold" style={{ fontFamily: 'var(--font-display)' }}>Operational snapshot</h2><p className="mt-1 text-[11px] text-[#565F8C]">Platform workload at a glance</p></div><div className="space-y-4"><div><div className="mb-1.5 flex justify-between text-[11px]"><span className="text-[#8891B8]">Active users</span><span className="text-[#F2F4FA]">{stats?.activeUsers || 0} / {stats?.users || 0}</span></div><div className="h-2 rounded-full bg-white/[0.08]"><div className="h-full rounded-full bg-[#3FDCC0]" style={{ width: `${stats?.users ? Math.min(100, (stats.activeUsers / stats.users) * 100) : 0}%` }} /></div></div><div className="grid grid-cols-2 gap-3"><div className="rounded-lg bg-[#0F1430] p-3"><p className="text-[10px] uppercase text-[#565F8C]">Clients</p><p className="mt-1 text-xl font-semibold text-[#F2F4FA]">{stats?.clients || 0}</p></div><div className="rounded-lg bg-[#0F1430] p-3"><p className="text-[10px] uppercase text-[#565F8C]">Roles</p><p className="mt-1 text-xl font-semibold text-[#F2F4FA]">{stats?.roles || 0}</p></div></div></div></section>
        <section className="rounded-2xl border border-white/[0.08] bg-[#161C3A] p-5 lg:col-span-1"><div className="mb-4"><h2 className="text-[15px] font-semibold" style={{ fontFamily: 'var(--font-display)' }}>Quick actions</h2><p className="mt-1 text-[11px] text-[#565F8C]">Jump into common platform workflows</p></div><div className="grid grid-cols-2 gap-2"><Link href="/super-admin/companies" className="rounded-lg border border-white/[0.08] p-3 text-[12px] text-[#AAB2D4] transition hover:border-[#3FDCC0]/40 hover:text-[#3FDCC0]">Manage companies</Link><Link href="/super-admin/users" className="rounded-lg border border-white/[0.08] p-3 text-[12px] text-[#AAB2D4] transition hover:border-[#3FDCC0]/40 hover:text-[#3FDCC0]">Review users</Link><Link href="/super-admin/candidate" className="rounded-lg border border-white/[0.08] p-3 text-[12px] text-[#AAB2D4] transition hover:border-[#3FDCC0]/40 hover:text-[#3FDCC0]">Candidate directory</Link><Link href="/super-admin/audit" className="rounded-lg border border-white/[0.08] p-3 text-[12px] text-[#AAB2D4] transition hover:border-[#3FDCC0]/40 hover:text-[#3FDCC0]">Audit trail</Link></div></section>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
        <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#161C3A] lg:col-span-3">
          <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-4"><div><h2 className="text-[14px] font-semibold" style={{ fontFamily: 'var(--font-display)' }}>Recent companies</h2><p className="mt-1 text-[11px] text-[#565F8C]">Latest tenants onboarded to the platform</p></div><Link href="/super-admin/companies" className="text-[12px] text-[#3FDCC0] hover:underline">View all</Link></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left"><thead><tr className="border-b border-white/[0.08] text-[10px] uppercase tracking-wide text-[#565F8C]" style={{ fontFamily: 'var(--font-mono)' }}><th className="px-5 py-3 font-medium">Company</th><th className="px-5 py-3 font-medium">Status</th><th className="px-5 py-3 text-right font-medium">Users</th><th className="px-5 py-3 text-right font-medium">Candidates</th></tr></thead><tbody>{data?.recentCompanies.map((company) => <tr key={company.id} className="border-t border-white/[0.06] hover:bg-white/[0.03]"><td className="px-5 py-3"><p className="text-[13px] text-[#F2F4FA]">{company.name}</p><p className="text-[11px] text-[#565F8C]">{company.slug} · {formatDate(company.createdAt)}</p></td><td className="px-5 py-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ${company.status === 'ACTIVE' ? 'bg-[#3FDCC0]/15 text-[#3FDCC0]' : 'bg-[#FF6B6B]/15 text-[#FF6B6B]'}`}>{company.status}</span></td><td className="px-5 py-3 text-right text-[13px] text-[#AAB2D4]">{company._count.users}</td><td className="px-5 py-3 text-right text-[13px] text-[#AAB2D4]">{company._count.candidates}</td></tr>)}</tbody></table></div>
          {!loading && data?.recentCompanies.length === 0 && <p className="px-5 py-10 text-center text-[13px] text-[#8891B8]">No companies available.</p>}
        </section>

        <section className="rounded-2xl border border-white/[0.08] bg-[#161C3A] p-5 lg:col-span-2"><div className="mb-4 flex items-center justify-between"><div><h2 className="text-[14px] font-semibold" style={{ fontFamily: 'var(--font-display)' }}>System activity</h2><p className="mt-1 text-[11px] text-[#565F8C]">Most recent audit events</p></div><Link href="/super-admin/audit" className="text-[12px] text-[#3FDCC0] hover:underline">Open log</Link></div><ul className="space-y-4">{data?.recentActivity.map((activity) => <li key={activity.id} className="flex gap-3"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#3FDCC0]" /><div className="min-w-0"><p className="text-[13px] leading-snug text-[#F2F4FA]"><span className="font-medium">{activity.user ? `${activity.user.firstName} ${activity.user.lastName}` : 'System'}</span>{' '}<span className="text-[#AAB2D4]">{titleCase(activity.action)}</span></p><p className="mt-0.5 truncate text-[11px] text-[#565F8C]">{activity.company?.name || 'Platform'} · {activity.entity}{activity.entityId ? ` · ${activity.entityId}` : ''}</p><p className="mt-0.5 text-[10px] text-[#565F8C]" style={{ fontFamily: 'var(--font-mono)' }}>{relativeDate(activity.createdAt)}</p></div></li>)}</ul>{!loading && data?.recentActivity.length === 0 && <p className="py-8 text-center text-[13px] text-[#8891B8]">No activity recorded.</p>}</section>
      </div>
    </div>
  );
}
