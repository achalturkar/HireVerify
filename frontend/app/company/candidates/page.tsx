'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Clock3, Mail, Pencil, Plus, Search, Trash2, UserRound, Users } from 'lucide-react';
import { useAuth } from '@/src/auth/AuthProvider';
import CandidateConfirmDialog from '@/src/components/layout/company/candidate/CandidateConfirmDialog';
import CandidateFormModal from '@/src/components/layout/company/candidate/CandidateFormModal';
import { ApiError, createCandidate, deleteCandidate, listCandidates, updateCandidate } from '@/src/lib/api/candidates';
import { listClients } from '@/src/lib/api/clients';
import type { Candidate, CandidateFormValues, CandidateStatus, PaginationMeta } from '@/src/types/candidate';
import type { Client } from '@/src/types/client';

const PAGE_SIZE = 10;
const candidateSummaryCards = [
  { label: 'All candidates', status: '' as const, accent: 'var(--primary)', icon: Users },
  { label: 'Pending', status: 'PENDING' as const, accent: '#8891B8', icon: Clock3 },
  { label: 'In progress', status: 'IN_PROGRESS' as const, accent: '#5EA8D9', icon: UserRound },
  { label: 'Completed', status: 'COMPLETED' as const, accent: '#269A78', icon: CheckCircle2 },
];
const statusStyle: Record<CandidateStatus, string> = {
  PENDING: 'bg-[var(--surface-muted)] text-[var(--muted)]',
  INVITED: 'bg-[#F2AE55]/15 text-[#F2AE55]',
  IN_PROGRESS: 'bg-[var(--primary)]/15 text-[var(--primary)]',
  VERIFICATION_IN_PROGRESS: 'bg-[var(--primary)]/15 text-[var(--primary)]',
  COMPLETED: 'bg-[var(--primary)]/15 text-[var(--primary)]',
  WITHDRAWN: 'bg-[#FF6B6B]/15 text-[#FF6B6B]',
  ON_HOLD: 'bg-[#F2AE55]/15 text-[#F2AE55]',
};

export default function CandidatesPage() {
  const { accessToken } = useAuth();
  const [items, setItems] = useState<Candidate[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, limit: PAGE_SIZE, total: 0, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [clientId, setClientId] = useState('');
  const [status, setStatus] = useState<CandidateStatus | ''>('');
  const [summaryCounts, setSummaryCounts] = useState<Record<string, number | null>>({ '': null, PENDING: null, IN_PROGRESS: null, COMPLETED: null });
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [active, setActive] = useState<Candidate | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Candidate | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const result = await listCandidates({ page, limit: PAGE_SIZE, search, clientId: clientId || undefined, status, sortBy: 'createdAt', sortOrder: 'desc' }, accessToken);
      setItems(result.items); setMeta(result.meta);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load candidates.');
    } finally { setLoading(false); }
  }, [accessToken, page, search, clientId, status]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    let active = true;
    const loadSummary = async () => {
      setSummaryLoading(true);
      setSummaryError(null);
      const results = await Promise.all(candidateSummaryCards.map(({ status: cardStatus }) =>
        listCandidates({
          page: 1,
          limit: 1,
          search,
          clientId: clientId || undefined,
          status: cardStatus || undefined,
          sortBy: 'createdAt',
          sortOrder: 'desc',
        }, accessToken)
          .then((result) => ({ status: cardStatus, count: result.meta.total }))
          .catch(() => ({ status: cardStatus, count: null })),
      ));
      if (active) {
        setSummaryCounts(Object.fromEntries(results.map((result) => [result.status, result.count])));
        if (results.some((result) => result.count === null)) setSummaryError('Some candidate summary counts could not be loaded. Check your access and try again.');
        setSummaryLoading(false);
      }
    };
    void loadSummary();
    return () => { active = false; };
  }, [accessToken, clientId, search]);

  useEffect(() => {
    listClients({ page: 1, limit: 200, sortBy: 'name', sortOrder: 'asc' }, accessToken)
      .then((result) => setClients(result.items)).catch(() => setClients([]));
  }, [accessToken]);

  const submit = async (values: CandidateFormValues) => {
    setSubmitting(true);
    try {
      const payload = { ...values, firstName: values.firstName.trim(), lastName: values.lastName.trim(), email: values.email.trim(), phone: values.phone.trim() || undefined };
      if (modal === 'create') await createCandidate(payload, accessToken);
      else if (active) await updateCandidate(active.id, payload, accessToken);
      setModal(null); setActive(null); await load();
    } finally { setSubmitting(false); }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    setSubmitting(true); setError(null);
    try { await deleteCandidate(deleteTarget.id, accessToken); setDeleteTarget(null); await load(); }
    catch (err) { setError(err instanceof ApiError ? err.message : 'Could not delete candidate.'); }
    finally { setSubmitting(false); }
  };

  const clientMap = new Map(clients.map((client) => [client.id, client.name]));

  return <div className="mx-auto max-w-6xl space-y-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[11px] uppercase tracking-[0.14em] text-[var(--primary)]">Verification subjects</p><h1 className="text-[26px] font-semibold">Candidates</h1><p className="mt-1 text-[13px] text-[var(--muted)]">People linked to background verification cases.</p></div><button onClick={() => { setActive(null); setModal('create'); }} className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2.5 text-[13px] font-semibold text-[var(--primary-foreground)]"><Plus size={15} />Add candidate</button></div>
    <section aria-label="Candidate summary" className="space-y-3">
      <div>
        <h2 className="text-[15px] font-semibold text-[var(--foreground)]">Candidate overview</h2>
        <p className="mt-0.5 text-[11px] text-[var(--muted)]">Select a card to filter candidates. Counts follow the search and client filters.</p>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {candidateSummaryCards.map((card) => {
          const selected = status === card.status;
          const Icon = card.icon;
          return <button key={card.label} type="button" onClick={() => { setPage(1); setStatus(card.status); }} aria-pressed={selected} className={`group relative isolate overflow-hidden rounded-xl border bg-[var(--surface)] p-3 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 ${selected ? 'ring-2 ring-[var(--primary)]/40 ring-offset-1' : 'hover:border-[var(--primary)]/40'}`} style={{ borderColor: selected ? card.accent : undefined, boxShadow: selected ? `0 4px 14px ${card.accent}20` : undefined }}>
            <span className="absolute inset-x-0 top-0 h-0.5" style={{ background: card.accent }} />
            <span className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: `${card.accent}18`, color: card.accent }}><Icon size={16} /></span><span className="truncate text-[11px] font-semibold text-[var(--muted)]">{card.label}</span></span>
              {selected && <span className="text-[10px] font-semibold" style={{ color: card.accent }}>Active</span>}
            </span>
            <span className="mt-2 block text-[24px] font-bold leading-none tabular-nums text-[var(--foreground)]">{summaryLoading ? <span className="inline-block h-6 w-10 animate-pulse rounded-md bg-[var(--surface-muted)] align-middle" /> : summaryCounts[card.status] ?? '—'}</span>
          </button>;
        })}
      </div>
      {summaryError && <p role="alert" className="text-[12px] text-[#FF6B6B]">{summaryError}</p>}
    </section>
    <div className="flex flex-col gap-3 sm:flex-row"><label className="relative flex-1"><Search size={15} className="absolute left-3 top-3 text-[var(--muted)]" /><input value={search} onChange={(event) => { setPage(1); setSearch(event.target.value); }} placeholder="Search candidates" className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] py-2.5 pl-9 pr-3 text-[13px]" /></label><select value={status} onChange={(event) => { setPage(1); setStatus(event.target.value as CandidateStatus | ''); }} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-[13px]" aria-label="Filter by candidate status"><option value="">All statuses</option>{Object.keys(statusStyle).map((value) => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}</select><select value={clientId} onChange={(event) => { setPage(1); setClientId(event.target.value); }} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-[13px]" aria-label="Filter candidates by client"><option value="">All clients</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></div>
    <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]"><div className="overflow-x-auto"><table className="w-full text-left text-[13px]"><thead className="border-b border-[var(--border)] text-[11px] uppercase tracking-wider text-[var(--muted)]"><tr><th className="px-5 py-3">Reference</th><th className="px-5 py-3">Candidate</th><th className="px-5 py-3">Client</th><th className="px-5 py-3">Cases</th><th className="px-5 py-3">Status</th><th className="px-5 py-3 text-right">Actions</th></tr></thead><tbody className="divide-y divide-[var(--border)]">
      {loading ? <tr><td colSpan={6} className="px-5 py-12 text-center text-[var(--muted)]">Loading candidates...</td></tr> : error ? <tr><td colSpan={6} className="px-5 py-12 text-center text-[#FF6B6B]">{error}</td></tr> : items.length === 0 ? <tr><td colSpan={6} className="px-5 py-12 text-center text-[var(--muted)]"><Users size={24} className="mx-auto mb-2" />No candidates found.</td></tr> : items.map((candidate) => <tr key={candidate.id} onClick={() => { window.location.href = `/company/candidate/${candidate.id}`; }} className="cursor-pointer transition-colors hover:bg-[var(--surface-muted)]"><td className="px-5 py-4 font-mono text-[12px] text-[var(--muted)]">{candidate.candidateCode}</td><td className="px-5 py-4"><Link href={`/company/candidate/${candidate.id}`} className="font-medium hover:text-[var(--primary)]">{candidate.firstName} {candidate.lastName}</Link><p className="text-[11px] text-[var(--muted)]">{candidate.email}</p></td><td className="px-5 py-4 text-[var(--muted)]">{clientMap.get(candidate.clientId) ?? '—'}</td><td className="px-5 py-4">{candidate.bgvCaseCount ?? 0}</td><td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${statusStyle[candidate.status]}`}>{candidate.status.replaceAll('_', ' ')}</span></td><td className="px-5 py-4 text-right"><button aria-label="Send candidate portal link" title="Send or resend candidate portal link" onClick={(event) => { event.stopPropagation(); setActive(candidate); setModal('edit'); }} className="mr-2 rounded-md p-2 text-[var(--muted)] hover:bg-[var(--surface-muted)]"><Mail size={15} /></button><button aria-label="Edit candidate" onClick={(event) => { event.stopPropagation(); setActive(candidate); setModal('edit'); }} className="mr-2 rounded-md p-2 text-[var(--muted)] hover:bg-[var(--surface-muted)]"><Pencil size={15} /></button><button aria-label="Delete candidate" onClick={(event) => { event.stopPropagation(); setDeleteTarget(candidate); }} className="rounded-md p-2 text-[#FF6B6B] hover:bg-[#FF6B6B]/10"><Trash2 size={15} /></button></td></tr>)}</tbody></table></div><div className="flex items-center justify-between border-t border-[var(--border)] px-5 py-3 text-[12px] text-[var(--muted)]"><span>{meta.total} candidates</span><div className="flex gap-2"><button disabled={page <= 1} onClick={() => setPage((current) => current - 1)} className="rounded-md border border-[var(--border)] px-3 py-1.5 disabled:opacity-40">Previous</button><button disabled={page >= meta.totalPages} onClick={() => setPage((current) => current + 1)} className="rounded-md border border-[var(--border)] px-3 py-1.5 disabled:opacity-40">Next</button></div></div></div>
    {modal && <CandidateFormModal mode={modal} candidate={active} submitting={submitting} error={null} onClose={() => { setModal(null); setActive(null); }} onSubmit={submit} />}{deleteTarget && <CandidateConfirmDialog title="Delete candidate?" description="This hides the candidate from active BGV workflows." confirmLabel="Delete" submitting={submitting} onConfirm={remove} onCancel={() => setDeleteTarget(null)} />}
  </div>;
}
