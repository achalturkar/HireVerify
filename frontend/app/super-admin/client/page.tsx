'use client';

import { useCallback, useEffect, useState } from 'react';
import { Building2, ChevronLeft, ChevronRight, RefreshCw, Search } from 'lucide-react';
import { useAuth } from '@/src/auth/AuthProvider';
import { listPlatformClients, type PlatformClient } from '@/src/lib/api/platform-clients';
import type { ClientStatus } from '@/src/types/client';

const PAGE_SIZE = 20;

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function SuperAdminClientPage() {
  const { accessToken } = useAuth();
  const [clients, setClients] = useState<PlatformClient[]>([]);
  const [summary, setSummary] = useState<{ total: number; companies: { id: string; name: string; shortCode: string | null; clientCount: number }[] }>({ total: 0, companies: [] });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [status, setStatus] = useState<ClientStatus | ''>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadClients = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true); setError(null);
    try {
      const result = await listPlatformClients({ page, limit: PAGE_SIZE, search, companyId, status }, accessToken);
      setClients(result.items); setSummary(result.meta.summary); setTotalPages(Math.max(1, result.meta.totalPages));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load clients');
    } finally { setLoading(false); }
  }, [accessToken, page, search, companyId, status]);

  useEffect(() => {
    const task = Promise.resolve().then(loadClients);
    return () => { void task; };
  }, [loadClients]);

  const clearFilters = () => { setSearch(''); setCompanyId(''); setStatus(''); setPage(1); };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><p className="mb-2 text-[11px] uppercase tracking-[0.14em] text-[#3FDCC0]" style={{ fontFamily: 'var(--font-mono)' }}>Administration / Clients</p><h1 className="text-[28px] font-semibold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>Enterprise clients</h1><p className="mt-1 text-[13px] text-[#8891B8]">View every client account with its owning company.</p></div><button onClick={loadClients} className="inline-flex items-center gap-2 self-start rounded-lg border border-white/[0.12] px-3 py-2 text-[12px] text-[#C7CBE0] hover:bg-white/[0.06]"><RefreshCw size={14} /> Refresh</button></div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"><div className="rounded-2xl border border-[#3FDCC0]/25 bg-[#161C3A] p-5"><div className="mb-3 flex items-center justify-between"><p className="text-[11px] uppercase tracking-wide text-[#8891B8]">Total clients</p><Building2 size={17} className="text-[#3FDCC0]" /></div><p className="text-[30px] font-semibold" style={{ fontFamily: 'var(--font-display)' }}>{summary.total.toLocaleString()}</p><p className="mt-1 text-[11px] text-[#565F8C]">Matching current filters</p></div>{summary.companies.map((company) => <button key={company.id} onClick={() => { setCompanyId(company.id === companyId ? '' : company.id); setPage(1); }} className={`rounded-2xl border p-5 text-left transition-colors ${company.id === companyId ? 'border-[#3FDCC0]/60 bg-[#1B2946]' : 'border-white/[0.08] bg-[#161C3A] hover:border-white/[0.2]'}`}><p className="truncate text-[11px] uppercase tracking-wide text-[#8891B8]">{company.name}</p><p className="mt-3 text-[30px] font-semibold" style={{ fontFamily: 'var(--font-display)' }}>{company.clientCount.toLocaleString()}</p><p className="mt-1 text-[11px] text-[#565F8C]">{company.shortCode || 'Company'} clients</p></button>)}</div>

      <div className="rounded-2xl border border-white/[0.08] bg-[#161C3A] p-4"><div className="grid grid-cols-1 gap-3 md:grid-cols-4"><label className="relative md:col-span-2"><Search size={15} className="absolute left-3 top-3 text-[#565F8C]" /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search client, code, contact or company" className="w-full rounded-lg border border-white/[0.1] bg-[#0F1430] py-2.5 pl-9 pr-3 text-[12px] text-white outline-none focus:border-[#3FDCC0]" /></label><select value={companyId} onChange={(event) => { setCompanyId(event.target.value); setPage(1); }} className="rounded-lg border border-white/[0.1] bg-[#0F1430] px-3 py-2.5 text-[12px] text-[#C7CBE0]"><option value="">All companies</option>{summary.companies.map((company) => <option key={company.id} value={company.id}>{company.name} ({company.clientCount})</option>)}</select><select value={status} onChange={(event) => { setStatus(event.target.value as ClientStatus | ''); setPage(1); }} className="rounded-lg border border-white/[0.1] bg-[#0F1430] px-3 py-2.5 text-[12px] text-[#C7CBE0]"><option value="">All statuses</option><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select><button onClick={clearFilters} className="rounded-lg border border-white/[0.1] px-3 py-2.5 text-[12px] text-[#8891B8] hover:text-white">Clear filters</button></div></div>

      <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#161C3A]"><div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-4"><h2 className="text-[14px] font-semibold">Client directory</h2><span className="text-[11px] text-[#565F8C]" style={{ fontFamily: 'var(--font-mono)' }}>{summary.companies.length} companies</span></div>{error && <p className="px-5 py-4 text-[13px] text-[#F48787]">{error}</p>}<div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left"><thead><tr className="border-b border-white/[0.08] text-[10px] uppercase tracking-[0.12em] text-[#565F8C]" style={{ fontFamily: 'var(--font-mono)' }}><th className="px-5 py-3">Client</th><th className="px-5 py-3">Company</th><th className="px-5 py-3">Industry</th><th className="px-5 py-3">Contact</th><th className="px-5 py-3">Usage</th><th className="px-5 py-3">Status</th></tr></thead><tbody className="divide-y divide-white/[0.06]">{loading ? <tr><td colSpan={6} className="px-5 py-12 text-center text-[13px] text-[#8891B8]">Loading clients...</td></tr> : clients.length === 0 ? <tr><td colSpan={6} className="px-5 py-12 text-center text-[13px] text-[#8891B8]">No clients match these filters.</td></tr> : clients.map((client) => <tr key={client.id} className="hover:bg-white/[0.025]"><td className="px-5 py-4"><div className="text-[12px] font-semibold text-white">{client.name}</div><div className="text-[10px] text-[#565F8C]">{client.clientCode}</div></td><td className="px-5 py-4"><div className="text-[12px] text-[#C7CBE0]">{client.company.name}</div><div className="text-[10px] text-[#565F8C]">{client.company.shortCode || '—'}</div></td><td className="px-5 py-4 text-[12px] text-[#C7CBE0]">{client.industry || '—'}</td><td className="px-5 py-4"><div className="text-[12px] text-[#C7CBE0]">{client.contactName || '—'}</div><div className="text-[10px] text-[#565F8C]">{client.contactEmail || client.contactPhone || '—'}</div></td><td className="px-5 py-4 text-[12px] text-[#8891B8]">{client._count.candidates} candidates · {client._count.bgvCases} cases</td><td className="px-5 py-4"><span className="rounded-md bg-[#3FDCC0]/10 px-2 py-1 text-[11px] text-[#3FDCC0]">{client.status}</span><div className="mt-1 text-[10px] text-[#565F8C]">{formatDate(client.createdAt)}</div></td></tr>)}</tbody></table></div><div className="flex items-center justify-between border-t border-white/[0.08] px-5 py-3"><span className="text-[11px] text-[#565F8C]">Page {page} of {totalPages}</span><div className="flex gap-2"><button disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="rounded-md border border-white/[0.1] p-2 text-[#C7CBE0] disabled:opacity-30" aria-label="Previous page"><ChevronLeft size={15} /></button><button disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)} className="rounded-md border border-white/[0.1] p-2 text-[#C7CBE0] disabled:opacity-30" aria-label="Next page"><ChevronRight size={15} /></button></div></div></div>
    </div>
  );
}