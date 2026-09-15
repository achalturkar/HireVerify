'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, ClipboardList, RefreshCw, Search } from 'lucide-react';
import { useAuth } from '@/src/auth/AuthProvider';
import { listAuditLogs, type AuditLog } from '@/src/lib/api/audit';

const PAGE_SIZE = 20;

function formatDate(value: string) {
  return new Date(value).toLocaleString(undefined, {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function actorName(log: AuditLog) {
  return log.user ? `${log.user.firstName} ${log.user.lastName}`.trim() : 'System';
}

export default function AuditPage() {
  const { accessToken } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [action, setAction] = useState('');
  const [entity, setEntity] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadLogs = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const result = await listAuditLogs({ page, limit: PAGE_SIZE, search, companyId, action, entity, from, to }, accessToken);
      setLogs(result.items);
      setTotal(result.meta.total);
      setTotalPages(Math.max(1, result.meta.totalPages));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load audit logs');
    } finally {
      setLoading(false);
    }
  }, [accessToken, page, search, companyId, action, entity, from, to]);

  useEffect(() => {
    const task = Promise.resolve().then(loadLogs);
    return () => { void task; };
  }, [loadLogs]);

  useEffect(() => {
    if (!accessToken) return;
    fetch(`${process.env.NEXT_PUBLIC_API || '/api/v1'}/companies?limit=100`, { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((res) => res.json())
      .then((body) => setCompanies((body.data?.data || []).map((company: { id: string; name: string }) => ({ id: company.id, name: company.name }))))
      .catch(() => setCompanies([]));
  }, [accessToken]);

  const resetFilters = () => {
    setSearch(''); setCompanyId(''); setAction(''); setEntity(''); setFrom(''); setTo(''); setPage(1);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.14em] text-[#3FDCC0] mb-2" style={{ fontFamily: 'var(--font-mono)' }}>Governance / Audit</p>
          <h1 className="text-[28px] font-semibold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>Enterprise audit log</h1>
          <p className="text-[13px] text-[#8891B8] mt-1">Every platform event, grouped by company and actor.</p>
        </div>
        <button onClick={loadLogs} className="inline-flex items-center gap-2 self-start rounded-lg border border-white/[0.12] px-3 py-2 text-[12px] text-[#C7CBE0] hover:bg-white/[0.06]" aria-label="Refresh audit logs">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div className="rounded-2xl border border-white/[0.08] bg-[#161C3A] p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-6">
          <label className="relative lg:col-span-2"><Search size={15} className="absolute left-3 top-3 text-[#565F8C]" /><input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search activity, actor, entity" className="w-full rounded-lg border border-white/[0.1] bg-[#0F1430] py-2.5 pl-9 pr-3 text-[12px] text-white outline-none focus:border-[#3FDCC0]" /></label>
          <select value={companyId} onChange={(e) => { setCompanyId(e.target.value); setPage(1); }} className="rounded-lg border border-white/[0.1] bg-[#0F1430] px-3 py-2.5 text-[12px] text-[#C7CBE0]"><option value="">All companies</option>{companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select>
          <input value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} placeholder="Action" className="rounded-lg border border-white/[0.1] bg-[#0F1430] px-3 py-2.5 text-[12px] text-white outline-none focus:border-[#3FDCC0]" />
          <input value={entity} onChange={(e) => { setEntity(e.target.value); setPage(1); }} placeholder="Entity" className="rounded-lg border border-white/[0.1] bg-[#0F1430] px-3 py-2.5 text-[12px] text-white outline-none focus:border-[#3FDCC0]" />
          <button onClick={resetFilters} className="rounded-lg border border-white/[0.1] px-3 py-2.5 text-[12px] text-[#8891B8] hover:text-white">Clear filters</button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-[12px] text-[#8891B8]">
          <span>Date range</span><input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className="rounded-lg border border-white/[0.1] bg-[#0F1430] px-3 py-2 text-white" />
          <span>to</span><input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} className="rounded-lg border border-white/[0.1] bg-[#0F1430] px-3 py-2 text-white" />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#161C3A]">
        <div className="flex items-center gap-3 border-b border-white/[0.08] px-5 py-4"><ClipboardList size={18} className="text-[#3FDCC0]" /><h2 className="text-[14px] font-semibold">Audit events</h2><span className="ml-auto text-[11px] text-[#565F8C]" style={{ fontFamily: 'var(--font-mono)' }}>{total.toLocaleString()} total</span></div>
        {error && <div className="px-5 py-4 text-[13px] text-[#F48787]">{error}</div>}
        <div className="overflow-x-auto"><table className="w-full min-w-[920px] text-left"><thead><tr className="border-b border-white/[0.08] text-[10px] uppercase tracking-[0.12em] text-[#565F8C]" style={{ fontFamily: 'var(--font-mono)' }}><th className="px-5 py-3">Time</th><th className="px-5 py-3">Company</th><th className="px-5 py-3">Actor</th><th className="px-5 py-3">Action</th><th className="px-5 py-3">Entity</th><th className="px-5 py-3">Details</th></tr></thead>
          <tbody className="divide-y divide-white/[0.06]">{loading ? <tr><td colSpan={6} className="px-5 py-12 text-center text-[13px] text-[#8891B8]">Loading audit events...</td></tr> : logs.length === 0 ? <tr><td colSpan={6} className="px-5 py-12 text-center text-[13px] text-[#8891B8]">No audit events match these filters.</td></tr> : logs.map((log) => <tr key={log.id} className="hover:bg-white/[0.025]"><td className="whitespace-nowrap px-5 py-4 text-[12px] text-[#8891B8]">{formatDate(log.createdAt)}</td><td className="px-5 py-4"><div className="text-[12px] font-semibold text-white">{log.company?.name || 'Platform'}</div><div className="text-[10px] text-[#565F8C]">{log.company?.shortCode || 'SYSTEM'}</div></td><td className="px-5 py-4"><div className="text-[12px] text-[#C7CBE0]">{actorName(log)}</div><div className="text-[10px] text-[#565F8C]">{log.user?.email || 'Automated event'}</div></td><td className="px-5 py-4"><span className="rounded-md bg-[#3FDCC0]/10 px-2 py-1 text-[11px] font-medium text-[#3FDCC0]">{log.action}</span></td><td className="px-5 py-4 text-[12px] text-[#C7CBE0]">{log.entity}<div className="text-[10px] text-[#565F8C]">{log.entityId || '—'}</div></td><td className="max-w-[220px] truncate px-5 py-4 text-[11px] text-[#8891B8]">{log.metadata ? JSON.stringify(log.metadata) : '—'}</td></tr>)}</tbody>
        </table></div>
        <div className="flex items-center justify-between border-t border-white/[0.08] px-5 py-3"><span className="text-[11px] text-[#565F8C]">Page {page} of {totalPages}</span><div className="flex gap-2"><button disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="rounded-md border border-white/[0.1] p-2 text-[#C7CBE0] disabled:opacity-30" aria-label="Previous page"><ChevronLeft size={15} /></button><button disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)} className="rounded-md border border-white/[0.1] p-2 text-[#C7CBE0] disabled:opacity-30" aria-label="Next page"><ChevronRight size={15} /></button></div></div>
      </div>
    </div>
  );
}