'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Search, Pencil, Trash2, Users } from 'lucide-react';
import { useAuth } from '@/src/auth/AuthProvider';
import CandidateFormModal from '@/src/components/layout/company/candidate/CandidateFormModal';
import CandidateConfirmDialog from '@/src/components/layout/company/candidate/CandidateConfirmDialog';
import { createCandidate, deleteCandidate, listCandidates, updateCandidate, ApiError } from '@/src/lib/api/candidates';
import { listClients } from '@/src/lib/api/clients';
import type { Candidate, CandidateFormValues, CandidateStatus, PaginationMeta } from '@/src/types/candidate';
import type { Client } from '@/src/types/client';

const PAGE_SIZE = 10;
const statusStyle: Record<CandidateStatus, string> = {
  PENDING: 'bg-[var(--surface-muted)] text-[var(--muted)]', INVITED: 'bg-[#F2AE55]/15 text-[#F2AE55]', IN_PROGRESS: 'bg-[var(--primary)]/15 text-[var(--primary)]', VERIFICATION_IN_PROGRESS: 'bg-[var(--primary)]/15 text-[var(--primary)]', COMPLETED: 'bg-[var(--primary)]/15 text-[var(--primary)]', WITHDRAWN: 'bg-[#FF6B6B]/15 text-[#FF6B6B]', ON_HOLD: 'bg-[#F2AE55]/15 text-[#F2AE55]',
};

export default function CandidatesPage() {
  const { accessToken } = useAuth();
  const [items, setItems] = useState<Candidate[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, limit: PAGE_SIZE, total: 0, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [clientId, setClientId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [active, setActive] = useState<Candidate | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Candidate | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const result = await listCandidates({ page, limit: PAGE_SIZE, search, clientId: clientId || undefined, sortBy: 'createdAt', sortOrder: 'desc' }, accessToken);
      setItems(result.items); setMeta(result.meta);
    } catch (err) { setError(err instanceof ApiError ? err.message : 'Failed to load candidates.'); } finally { setLoading(false); }
  }, [accessToken, page, search, clientId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { listClients({ page: 1, limit: 200, sortBy: 'name', sortOrder: 'asc' }, accessToken).then((result) => setClients(result.items)).catch(() => setClients([])); }, [accessToken]);

  const submit = async (values: CandidateFormValues) => {
    setSubmitting(true);
    try {
      if (modal === 'create') await createCandidate({ ...values, firstName: values.firstName.trim(), lastName: values.lastName.trim(), email: values.email.trim(), phone: values.phone.trim() || undefined }, accessToken);
      else if (active) await updateCandidate(active.id, { ...values, firstName: values.firstName.trim(), lastName: values.lastName.trim(), email: values.email.trim(), phone: values.phone.trim() || undefined }, accessToken);
      setModal(null); setActive(null); await load();
    } finally { setSubmitting(false); }
  };

  const remove = async () => { if (!deleteTarget) return; setSubmitting(true); try { await deleteCandidate(deleteTarget.id, accessToken); setDeleteTarget(null); await load(); } finally { setSubmitting(false); } };
  const clientMap = new Map(clients.map((client) => [client.id, client.name]));

  return <div className="max-w-6xl mx-auto space-y-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[11px] uppercase tracking-[0.14em] text-[var(--primary)]">Verification subjects</p><h1 className="text-[26px] font-semibold">Candidates</h1><p className="text-[13px] text-[var(--muted)] mt-1">People linked to background verification cases.</p></div><button onClick={() => { setActive(null); setModal('create'); }} className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2.5 text-[13px] font-semibold text-[var(--primary-foreground)]"><Plus size={15} /> Add candidate</button></div>
    <div className="flex flex-col sm:flex-row gap-3"><label className="relative flex-1"><Search size={15} className="absolute left-3 top-3 text-[var(--muted)]" /><input value={search} onChange={(event) => { setPage(1); setSearch(event.target.value); }} placeholder="Search candidates" className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] py-2.5 pl-9 pr-3 text-[13px]" /></label><select value={clientId} onChange={(event) => { setPage(1); setClientId(event.target.value); }} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-[13px]"><option value="">All clients</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></div>
    <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]"><div className="overflow-x-auto"><table className="w-full text-left text-[13px]"><thead className="border-b border-[var(--border)] text-[11px] uppercase tracking-wider text-[var(--muted)]"><tr><th className="px-5 py-3">Reference</th><th className="px-5 py-3">Candidate</th><th className="px-5 py-3">Client</th><th className="px-5 py-3">Cases</th><th className="px-5 py-3">Status</th><th className="px-5 py-3 text-right">Actions</th></tr></thead><tbody className="divide-y divide-[var(--border)]">{loading ? <tr><td colSpan={6} className="px-5 py-12 text-center text-[var(--muted)]">Loading candidates...</td></tr> : error ? <tr><td colSpan={6} className="px-5 py-12 text-center text-[#FF6B6B]">{error}</td></tr> : items.length === 0 ? <tr><td colSpan={6} className="px-5 py-12 text-center text-[var(--muted)]"><Users size={24} className="mx-auto mb-2" />No candidates found.</td></tr> : items.map((candidate) => <tr key={candidate.id}><td className="px-5 py-4 font-mono text-[12px] text-[var(--muted)]">{candidate.candidateCode}</td><td className="px-5 py-4"><p className="font-medium">{candidate.firstName} {candidate.lastName}</p><p className="text-[11px] text-[var(--muted)]">{candidate.email}</p></td><td className="px-5 py-4 text-[var(--muted)]">{clientMap.get(candidate.clientId) ?? '—'}</td><td className="px-5 py-4">{candidate.bgvCaseCount ?? 0}</td><td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${statusStyle[candidate.status]}`}>{candidate.status.replaceAll('_', ' ')}</span></td><td className="px-5 py-4 text-right"><button aria-label="Edit candidate" onClick={() => { setActive(candidate); setModal('edit'); }} className="mr-2 rounded-md p-2 text-[var(--muted)] hover:bg-[var(--surface-muted)]"><Pencil size={15} /></button><button aria-label="Delete candidate" onClick={() => setDeleteTarget(candidate)} className="rounded-md p-2 text-[#FF6B6B] hover:bg-[#FF6B6B]/10"><Trash2 size={15} /></button></td></tr>)}</tbody></table></div><div className="flex items-center justify-between border-t border-[var(--border)] px-5 py-3 text-[12px] text-[var(--muted)]"><span>{meta.total} candidates</span><div className="flex gap-2"><button disabled={page <= 1} onClick={() => setPage((current) => current - 1)} className="rounded-md border border-[var(--border)] px-3 py-1.5 disabled:opacity-40">Previous</button><button disabled={page >= meta.totalPages} onClick={() => setPage((current) => current + 1)} className="rounded-md border border-[var(--border)] px-3 py-1.5 disabled:opacity-40">Next</button></div></div></div>
    {modal && <CandidateFormModal mode={modal} candidate={active} submitting={submitting} error={null} onClose={() => { setModal(null); setActive(null); }} onSubmit={submit} />}{deleteTarget && <CandidateConfirmDialog title="Delete candidate?" description="This hides the candidate from active BGV workflows." confirmLabel="Delete" submitting={submitting} onConfirm={remove} onCancel={() => setDeleteTarget(null)} />}
  </div>;
}
