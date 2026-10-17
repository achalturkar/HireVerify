'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity, ArrowDownRight, ArrowUpRight, CalendarRange, CheckCircle2, Clock3,
  Download, FileCheck2, FileText, IndianRupee, Loader2, RefreshCw, Users,
} from 'lucide-react';
import {
  CartesianGrid, ComposedChart, Bar, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { useAuth } from '@/src/auth/AuthProvider';
import { ApiError, downloadClientAnalyticsReport, getClientAnalytics, type ClientAnalytics } from '@/src/lib/api/clients';
import type { Client } from '@/src/types/client';

const monthValue = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
const defaultFrom = () => {
  const date = new Date();
  date.setMonth(date.getMonth() - 11);
  return monthValue(date);
};
const number = (value: number) => new Intl.NumberFormat('en-IN').format(value);
const money = (value: number, currency = 'INR') =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);
const readable = (value: string) => value.replaceAll('_', ' ').toLocaleLowerCase().replace(/(^|\s)\S/g, (letter) => letter.toLocaleUpperCase());
const dateLabel = (value: string | null) => value ? new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value)) : '—';
const palette = ['#315B9A', '#12A889', '#DF9A35', '#8263CA', '#DD6571', '#4996C5', '#6E8D6D'];

function Panel({ title, detail, children, className = '' }: { title: string; detail?: string; children: React.ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm ${className}`}>
    <div className="mb-5"><h3 className="text-sm font-semibold">{title}</h3>{detail && <p className="mt-1 text-xs text-[var(--muted)]">{detail}</p>}</div>
    {children}
  </section>;
}

function Metric({ icon: Icon, title, value, detail, color, trend }: {
  icon: typeof Activity; title: string; value: string; detail: string; color: string; trend?: 'up' | 'down';
}) {
  const TrendIcon = trend === 'up' ? ArrowUpRight : ArrowDownRight;
  return <article className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
    <div className="flex items-start justify-between gap-2">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: `${color}18`, color }}><Icon size={19} /></span>
      {trend && <TrendIcon size={15} className={trend === 'up' ? 'text-emerald-600' : 'text-amber-600'} />}
    </div>
    <p className="mt-4 text-xs text-[var(--muted)]">{title}</p>
    <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
    <p className="mt-1 text-[11px] text-[var(--muted)]">{detail}</p>
  </article>;
}

function StatusList({ title, items }: { title: string; items: { name: string; value: number }[] }) {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  return <Panel title={title}>
    {items.length ? <div className="space-y-3">{items.slice(0, 7).map((item, index) => {
      const percent = total ? Math.round(item.value / total * 100) : 0;
      return <div key={item.name}>
        <div className="mb-1.5 flex items-center justify-between gap-3 text-xs"><span className="truncate">{readable(item.name || 'Unknown')}</span><span className="shrink-0 text-[var(--muted)]">{number(item.value)} <span className="ml-1 text-[10px]">({percent}%)</span></span></div>
        <div className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-muted)]"><div className="h-full rounded-full" style={{ width: `${percent}%`, backgroundColor: palette[index % palette.length] }} /></div>
      </div>;
    })}</div> : <p className="py-5 text-center text-xs text-[var(--muted)]">No records in this period.</p>}
  </Panel>;
}

export default function ClientAnalyticsPanel({ client }: { client: Client }) {
  const { accessToken } = useAuth();
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(() => monthValue(new Date()));
  const [groupBy, setGroupBy] = useState<'month' | 'year'>('month');
  const [data, setData] = useState<ClientAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      setData(await getClientAnalytics(client.id, { from, to, groupBy }, accessToken));
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Could not load client analytics.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [accessToken, client.id, from, groupBy, to]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const trend = useMemo(() => data?.trend ?? [], [data]);
  const exportReport = async () => {
    setExporting(true);
    setError(null);
    try {
      const blob = await downloadClientAnalyticsReport(client.id, { from, to }, accessToken);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${client.clientCode}-analytics-${from}-to-${to}.csv`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Could not generate the analytics report.');
    } finally {
      setExporting(false);
    }
  };

  const isRangeValid = from !== '' && to !== '' && from <= to;
  const summary = data?.summary;

  return <div className="space-y-5">
    <section className="overflow-hidden rounded-2xl border border-[#24477F]/15 bg-gradient-to-br from-[#24477F]/[0.08] via-[var(--surface)] to-[#10A889]/[0.06]">
      <div className="flex flex-col gap-5 p-5 lg:flex-row lg:items-end lg:justify-between lg:p-6">
        <div className="max-w-xl">
          <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-[#24477F]"><Activity size={13} />Client intelligence</p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight">Analytics for {client.name}</h2>
          <p className="mt-1.5 text-xs leading-relaxed text-[var(--muted)]">A client-only view of candidate intake, verification progress, completed reports, and billing. Choose a reporting window to update every chart and metric.</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-[10px] font-medium text-[var(--muted)]">From month<input aria-label="Analytics start month" type="month" value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} className="mt-1 block rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-2 text-xs text-[var(--foreground)] outline-none focus:border-[#315B9A]" /></label>
          <span className="pb-2 text-xs text-[var(--muted)]">to</span>
          <label className="text-[10px] font-medium text-[var(--muted)]">To month<input aria-label="Analytics end month" type="month" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} className="mt-1 block rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-2 text-xs text-[var(--foreground)] outline-none focus:border-[#315B9A]" /></label>
          <button type="button" onClick={() => void load(true)} disabled={!isRangeValid || loading || refreshing} aria-label="Refresh analytics" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-xs font-semibold hover:bg-[var(--surface-muted)] disabled:opacity-50"><RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />Refresh</button>
          <button type="button" onClick={() => void exportReport()} disabled={!isRangeValid || exporting || loading} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#24477F] px-3 text-xs font-semibold text-white hover:bg-[#1d3b6c] disabled:opacity-50">{exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}Export report</button>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)]/70 px-5 py-3 lg:px-6">
        <p className="flex items-center gap-1.5 text-[10px] text-[var(--muted)]"><CalendarRange size={13} />{from && to ? `${from} — ${to}` : 'Choose a date range'} <span>· all metrics follow this range</span></p>
        <div className="flex rounded-lg border border-[var(--border)] bg-[var(--surface)] p-0.5" aria-label="Chart grouping">
          {(['month', 'year'] as const).map((value) => <button key={value} type="button" aria-pressed={groupBy === value} onClick={() => setGroupBy(value)} className={`rounded-md px-3 py-1.5 text-[10px] font-semibold capitalize ${groupBy === value ? 'bg-[#24477F] text-white' : 'text-[var(--muted)] hover:text-[var(--foreground)]'}`}>{value}ly</button>)}
        </div>
      </div>
    </section>

    {error && <div role="alert" className="flex items-start justify-between gap-3 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-xs text-rose-700"><span>{error}</span>{data && <button type="button" onClick={() => void load()} className="shrink-0 font-semibold underline">Retry</button>}</div>}
    {!isRangeValid && <p role="alert" className="rounded-lg bg-amber-500/10 px-4 py-3 text-xs text-amber-800">The start month must be earlier than or equal to the end month.</p>}
    {loading && !data ? <div className="flex min-h-72 items-center justify-center gap-2 text-sm text-[var(--muted)]"><Loader2 size={17} className="animate-spin" />Preparing client analytics…</div>
      : data && <>
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Metric icon={Users} title="Candidates added" value={number(summary?.candidates || 0)} detail="New candidate profiles in range" color="#315B9A" trend="up" />
          <Metric icon={FileCheck2} title="BGV cases" value={number(summary?.cases || 0)} detail={`${number(summary?.openCases || 0)} still in progress`} color="#12A889" />
          <Metric icon={CheckCircle2} title="Cases completed" value={number(summary?.completedCases || 0)} detail={`Completed in range · ${summary?.completionRate || 0}% of created cases now complete`} color="#8263CA" trend="up" />
          <Metric icon={FileText} title="Completed reports" value={number(summary?.reports || 0)} detail="Completed cases available to report" color="#4996C5" />
          <Metric icon={IndianRupee} title="Invoiced" value={money(summary?.invoicedAmount || 0)} detail={`${number(summary?.invoices || 0)} non-draft invoices issued`} color="#DF9A35" />
          <Metric icon={Clock3} title="Outstanding" value={money(summary?.outstandingAmount || 0)} detail={`Payments received in range: ${money(summary?.collectedAmount || 0)}`} color="#DD6571" />
        </section>

        <Panel title="Client activity" detail="Monthly or yearly candidate intake, BGV workload, and invoiced value for the selected period.">
          <div className="mb-3 flex flex-wrap gap-x-4 gap-y-2 text-[10px] text-[var(--muted)]">
            <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#12A889]" />Candidates</span>
            <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#315B9A]" />BGV cases</span>
            <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#8263CA]" />Completed reports</span>
            <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#DF9A35]" />Invoiced</span>
          </div>
          <div className="h-[290px] w-full">
            {trend.length ? <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={trend} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="label" tick={{ fill: 'var(--muted)', fontSize: 10 }} axisLine={false} tickLine={false} minTickGap={16} />
                <YAxis yAxisId="records" tick={{ fill: 'var(--muted)', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis yAxisId="money" orientation="right" tick={{ fill: 'var(--muted)', fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={(value: number) => value >= 100000 ? `₹${(value / 100000).toFixed(0)}L` : value >= 1000 ? `₹${(value / 1000).toFixed(0)}k` : `₹${value}`} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)', fontSize: 11 }} labelStyle={{ color: 'var(--foreground)', fontWeight: 600 }} formatter={(value, name) => [name === 'Invoiced' ? money(Number(value)) : number(Number(value)), name]} />
                <Bar yAxisId="money" dataKey="invoicedAmount" name="Invoiced" fill="#DF9A35" fillOpacity={0.7} radius={[4, 4, 0, 0]} maxBarSize={34} />
                <Line yAxisId="records" type="monotone" dataKey="cases" name="BGV cases" stroke="#315B9A" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                <Line yAxisId="records" type="monotone" dataKey="candidates" name="Candidates" stroke="#12A889" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                <Line yAxisId="records" type="monotone" dataKey="completedCases" name="Completed reports" stroke="#8263CA" strokeWidth={2} strokeDasharray="5 4" dot={{ r: 2 }} activeDot={{ r: 4 }} />
              </ComposedChart>
            </ResponsiveContainer> : <p className="flex h-full items-center justify-center text-xs text-[var(--muted)]">No activity in this period.</p>}
          </div>
        </Panel>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatusList title="Candidate status" items={data.distributions.candidatesByStatus} />
          <StatusList title="Case pipeline" items={data.distributions.casesByStatus} />
          <StatusList title="Verification outcomes" items={data.distributions.casesByResult} />
          <StatusList title="Invoice status" items={data.distributions.invoicesByStatus} />
        </section>

        <Panel title="Verification check workload" detail="Checks on cases created in this reporting period.">
          {data.distributions.checksByType.length ? <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-xs">
            <thead className="border-b border-[var(--border)] text-[10px] uppercase tracking-wide text-[var(--muted)]"><tr><th className="pb-3">Check type</th><th className="pb-3 text-right">Total</th><th className="pb-3 text-right">Completed</th><th className="pb-3 text-right">Failed</th><th className="pb-3 text-right">In progress</th><th className="pb-3 pl-4">Completion</th></tr></thead>
            <tbody className="divide-y divide-[var(--border)]">{data.distributions.checksByType.map((item) => {
              const pct = item.total ? Math.round(item.completed / item.total * 100) : 0;
              return <tr key={item.type}><td className="py-3 font-medium">{readable(item.type)}</td><td className="py-3 text-right">{number(item.total)}</td><td className="py-3 text-right text-emerald-700">{number(item.completed)}</td><td className="py-3 text-right text-rose-600">{number(item.failed)}</td><td className="py-3 text-right text-amber-700">{number(item.pending)}</td><td className="py-3 pl-4"><div className="flex items-center gap-2"><div className="h-1.5 min-w-16 flex-1 overflow-hidden rounded-full bg-[var(--surface-muted)]"><div className="h-full rounded-full bg-[#12A889]" style={{ width: `${pct}%` }} /></div><span className="w-8 text-right text-[10px] text-[var(--muted)]">{pct}%</span></div></td></tr>;
            })}</tbody>
          </table></div> : <p className="py-6 text-center text-xs text-[var(--muted)]">Verification checks will appear when cases are created.</p>}
        </Panel>

        <section className="grid gap-4 xl:grid-cols-2">
          <Panel title="Recent BGV cases" detail="Latest cases for this client, across all dates." className="min-w-0">
            {data.recentCases.length ? <div className="divide-y divide-[var(--border)]">{data.recentCases.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"><div className="min-w-0"><p className="truncate text-xs font-semibold">{item.candidateName}</p><p className="mt-1 text-[10px] text-[var(--muted)]">{item.caseNumber} · {item.candidate.candidateCode}</p></div><div className="shrink-0 text-right"><span className="rounded-full bg-[var(--surface-muted)] px-2 py-1 text-[9px] font-semibold">{readable(item.status)}</span><p className="mt-1 text-[10px] text-[var(--muted)]">{dateLabel(item.createdAt)}</p></div></div>)}</div> : <p className="py-5 text-center text-xs text-[var(--muted)]">No cases yet.</p>}
          </Panel>
          <Panel title="Latest invoices" detail="Most recent non-draft invoices for this client." className="min-w-0">
            {data.recentInvoices.length ? <div className="divide-y divide-[var(--border)]">{data.recentInvoices.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"><div className="min-w-0"><p className="truncate text-xs font-semibold">{item.invoiceNumber}</p><p className="mt-1 text-[10px] text-[var(--muted)]">{dateLabel(item.invoiceDate)} · {readable(item.status)}</p></div><div className="shrink-0 text-right"><p className="text-xs font-semibold">{money(item.total, item.currency)}</p><p className="mt-1 text-[10px] text-[var(--muted)]">Due {money(item.balance, item.currency)}</p></div></div>)}</div> : <p className="py-5 text-center text-xs text-[var(--muted)]">No issued invoices yet.</p>}
          </Panel>
        </section>
        <p className="text-center text-[10px] text-[var(--muted)]">All figures are scoped to {client.name}. Analytics data updates when you refresh.</p>
      </>}
  </div>;
}
