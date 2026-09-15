'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, RefreshCw, Search, Users } from 'lucide-react';
import { useAuth } from '@/src/auth/AuthProvider';
import { listPlatformCandidates, type PlatformCandidate } from '@/src/lib/api/platform-candidates';
import type { CandidateStatus } from '@/src/types/candidate';

const PAGE_SIZE = 20;
const STATUSES: CandidateStatus[] = ['PENDING', 'INVITED', 'IN_PROGRESS', 'VERIFICATION_IN_PROGRESS', 'COMPLETED', 'WITHDRAWN', 'ON_HOLD'];

function label(value: string) {
  return value.replaceAll('_', ' ').toLowerCase().replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function SuperAdminCandidatesPage() {
  const { accessToken } = useAuth();
  const [candidates, setCandidates] = useState<PlatformCandidate[]>([]);
  const [summary, setSummary] = useState<{ total: number; companies: { id: string; name: string; shortCode: string | null; candidateCount: number }[] }>({ total: 0, companies: [] });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [status, setStatus] = useState<CandidateStatus | ''>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCandidates = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true); setError(null);
    try {
      const result = await listPlatformCandidates({ page, limit: PAGE_SIZE, search, companyId, status }, accessToken);
      setCandidates(result.items); setSummary(result.meta.summary); setTotalPages(Math.max(1, result.meta.totalPages));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load candidates');
    } finally { setLoading(false); }
  }, [accessToken, page, search, companyId, status]);

  useEffect(() => {
    const task = Promise.resolve().then(loadCandidates);
    return () => { void task; };
  }, [loadCandidates]);

  const clearFilters = () => { setSearch(''); setCompanyId(''); setStatus(''); setPage(1); };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="mb-2 text-[11px] uppercase tracking-[0.14em] text-[#3FDCC0]" style={{ fontFamily: 'var(--font-mono)' }}>Governance / Candidates</p><h1 className="text-[28px] font-semibold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>Enterprise candidates</h1><p className="mt-1 text-[13px] text-[#8891B8]">Review candidates across every company from one tenant-aware view.</p></div>
        <button onClick={loadCandidates} className="inline-flex items-center gap-2 self-start rounded-lg border border-white/[0.12] px-3 py-2 text-[12px] text-[#C7CBE0] hover:bg-white/[0.06]"><RefreshCw size={14} /> Refresh</button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-[#3FDCC0]/25 bg-[#161C3A] p-5"><div className="mb-3 flex items-center justify-between"><p className="text-[11px] uppercase tracking-wide text-[#8891B8]">Total candidates</p><Users size={17} className="text-[#3FDCC0]" /></div><p className="text-[30px] font-semibold" style={{ fontFamily: 'var(--font-display)' }}>{summary.total.toLocaleString()}</p><p className="mt-1 text-[11px] text-[#565F8C]">Matching current filters</p></div>
        {summary.companies.map((company) => <button key={company.id} onClick={() => { setCompanyId(company.id === companyId ? '' : company.id); setPage(1); }} className={`rounded-2xl border p-5 text-left transition-colors ${company.id === companyId ? 'border-[#3FDCC0]/60 bg-[#1B2946]' : 'border-white/[0.08] bg-[#161C3A] hover:border-white/[0.2]'}`}><p className="truncate text-[11px] uppercase tracking-wide text-[#8891B8]">{company.name}</p><p className="mt-3 text-[30px] font-semibold" style={{ fontFamily: 'var(--font-display)' }}>{company.candidateCount.toLocaleString()}</p><p className="mt-1 text-[11px] text-[#565F8C]">{company.shortCode || 'Company'} candidates</p></button>)}
      </div>

      <div className="rounded-2xl border border-white/[0.08] bg-[#161C3A] p-4"><div className="grid grid-cols-1 gap-3 md:grid-cols-3"><label className="relative md:col-span-2"><Search size={15} className="absolute left-3 top-3 text-[#565F8C]" /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search candidate, code, email or company" className="w-full rounded-lg border border-white/[0.1] bg-[#0F1430] py-2.5 pl-9 pr-3 text-[12px] text-white outline-none focus:border-[#3FDCC0]" /></label><select value={companyId} onChange={(event) => { setCompanyId(event.target.value); setPage(1); }} className="rounded-lg border border-white/[0.1] bg-[#0F1430] px-3 py-2.5 text-[12px] text-[#C7CBE0]"><option value="">All companies</option>{summary.companies.map((company) => <option key={company.id} value={company.id}>{company.name} ({company.candidateCount})</option>)}</select><select value={status} onChange={(event) => { setStatus(event.target.value as CandidateStatus | ''); setPage(1); }} className="rounded-lg border border-white/[0.1] bg-[#0F1430] px-3 py-2.5 text-[12px] text-[#C7CBE0]"><option value="">All statuses</option>{STATUSES.map((value) => <option key={value} value={value}>{label(value)}</option>)}</select><button onClick={clearFilters} className="rounded-lg border border-white/[0.1] px-3 py-2.5 text-[12px] text-[#8891B8] hover:text-white">Clear filters</button></div></div>

      <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#161C3A]
      "><div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-4"><h2 className="text-[14px] font-semibold">Candidate directory</h2><span className="text-[11px] text-[#565F8C]" style={{ fontFamily: 'var(--font-mono)' }}>{summary.companies.length} companies</span></div>{error && <p className="px-5 py-4 text-[13px] text-[#F48787]">{error}</p>}<div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left"><thead><tr className="border-b border-white/[0.08] text-[10px] uppercase tracking-[0.12em] text-[#565F8C]" style={{ fontFamily: 'var(--font-mono)' }}><th className="px-5 py-3">Candidate</th><th className="px-5 py-3">Company</th><th className="px-5 py-3">Client</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Added</th></tr></thead><tbody className="divide-y divide-white/[0.06]">{loading ? <tr><td colSpan={5} className="px-5 py-12 text-center text-[13px] text-[#8891B8]">Loading candidates...</td></tr> : candidates.length === 0 ? <tr><td colSpan={5} className="px-5 py-12 text-center text-[13px] text-[#8891B8]">No candidates match these filters.</td></tr> : candidates.map((candidate) => <tr key={candidate.id} className="hover:bg-white/[0.025]"><td className="px-5 py-4"><div className="text-[12px] font-semibold text-white">{candidate.firstName} {candidate.lastName}</div><div className="text-[10px] text-[#565F8C]">{candidate.candidateCode} · {candidate.email}</div></td><td className="px-5 py-4"><div className="text-[12px] text-[#C7CBE0]">{candidate.company.name}</div><div className="text-[10px] text-[#565F8C]">{candidate.company.shortCode || '—'}</div></td><td className="px-5 py-4 text-[12px] text-[#C7CBE0]">{candidate.client.name}</td><td className="px-5 py-4"><span className="rounded-md bg-[#F2AE55]/10 px-2 py-1 text-[11px] text-[#F2AE55]">{label(candidate.status)}</span></td><td className="px-5 py-4 text-[12px] text-[#8891B8]">{formatDate(candidate.createdAt)}</td></tr>)}</tbody></table></div><div className="flex items-center justify-between border-t border-white/[0.08] px-5 py-3"><span className="text-[11px] text-[#565F8C]">Page {page} of {totalPages}</span><div className="flex gap-2"><button disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="rounded-md border border-white/[0.1] p-2 text-[#C7CBE0] disabled:opacity-30" aria-label="Previous page"><ChevronLeft size={15} /></button><button disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)} className="rounded-md border border-white/[0.1] p-2 text-[#C7CBE0] disabled:opacity-30" aria-label="Next page"><ChevronRight size={15} /></button></div></div></div>
    </div>
  );
}