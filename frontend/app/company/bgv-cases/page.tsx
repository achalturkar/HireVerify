'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Activity, CheckCircle2, ChevronRight, Download, FileCheck2, FileSpreadsheet, Layers3, Loader2, Pencil, Plus, Search, Send, Trash2 } from 'lucide-react';
import { useAuth } from '@/src/auth/AuthProvider';
import { listClients } from '@/src/lib/api/clients';
import { createBGVCase, deleteBGVCase, downloadBGVReport, exportBGVCases, getBGVCase, listBGVCases, transitionBGVCase, updateBGVCaseChecks, updateBGVCaseMeta, ApiError } from '@/src/lib/api/bgv';
import BGVCaseWizardModal from '@/src/components/layout/company/bgv/BGVCaseWizardModal';
import CandidateConfirmDialog from '@/src/components/layout/company/candidate/CandidateConfirmDialog';
import type { BGVCase, BGVCaseStatus, BGVOverallResult } from '@/src/types/bgv';
import type { CreateBGVCasePayload } from '@/src/types/bgv';
import type { Client } from '@/src/types/client';
import type { PaginationMeta } from '@/src/types/user';

const statuses: BGVCaseStatus[] = ['DRAFT', 'INITIATED', 'CONSENT_PENDING', 'IN_PROGRESS', 'UNDER_REVIEW', 'COMPLETED', 'ON_HOLD', 'CANCELLED'];
const resultStyle: Record<BGVOverallResult, string> = { PENDING: 'text-[var(--muted)]', CLEAR: 'text-[var(--primary)]', MINOR_DISCREPANCY: 'text-[#F2AE55]', MAJOR_DISCREPANCY: 'text-[#FF6B6B]', UNABLE_TO_VERIFY: 'text-[#FF6B6B]', REQUIRES_REVIEW: 'text-[#F2AE55]' };
const caseSummaryCards = [
  { label: 'All cases', status: '' as const, accent: 'var(--primary)', icon: Layers3, hint: 'Every verification case' },
  { label: 'Initiated', status: 'INITIATED' as const, accent: '#5EA8D9', icon: Send, hint: 'Recently started' },
  { label: 'In progress', status: 'IN_PROGRESS' as const, accent: '#F2AE55', icon: Activity, hint: 'Checks underway' },
  { label: 'Completed', status: 'COMPLETED' as const, accent: '#269A78', icon: CheckCircle2, hint: 'Ready to review' },
];

export default function BGVCaseListPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialStatus = statuses.find((value) => value === searchParams.get('status')) ?? '';
  const { accessToken } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [clientLoadError, setClientLoadError] = useState<string | null>(null);
  const [items, setItems] = useState<BGVCase[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [clientId, setClientId] = useState('');
  const [status, setStatus] = useState<BGVCaseStatus | ''>(initialStatus);
  const [initiatedFrom, setInitiatedFrom] = useState('');
  const [initiatedTo, setInitiatedTo] = useState('');
  const [summaryCounts, setSummaryCounts] = useState<Record<string, number | null>>({ '': null, INITIATED: null, IN_PROGRESS: null, COMPLETED: null });
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [draftToResume, setDraftToResume] = useState<BGVCase | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BGVCase | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listBGVCases({ page, limit: 20, search, clientId: clientId || undefined, status, initiatedFrom, initiatedTo }, accessToken);
      setItems(data.items);
      setMeta(data.meta);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load BGV cases.');
    } finally {
      setLoading(false);
    }
  }, [accessToken, page, search, clientId, status, initiatedFrom, initiatedTo]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    let active = true;
    const loadClients = async () => {
      setClientsLoading(true);
      setClientLoadError(null);
      try {
        const result = await listClients({ page: 1, limit: 200, sortBy: 'name', sortOrder: 'asc' }, accessToken);
        if (active) setClients(result.items);
      } catch (cause) {
        if (active) setClientLoadError(cause instanceof Error ? cause.message : 'Could not load clients for filtering.');
      } finally {
        if (active) setClientsLoading(false);
      }
    };
    void loadClients();
    return () => { active = false; };
  }, [accessToken]);

  useEffect(() => {
    let active = true;
    const loadSummary = async () => {
      setSummaryLoading(true);
      setSummaryError(null);
      const results = await Promise.all(caseSummaryCards.map(({ status: cardStatus }) =>
        listBGVCases({
          page: 1,
          limit: 1,
          clientId: clientId || undefined,
          status: cardStatus || undefined,
          initiatedFrom: initiatedFrom || undefined,
          initiatedTo: initiatedTo || undefined,
        }, accessToken)
          .then((result) => ({ status: cardStatus, count: result.meta.total }))
          .catch(() => ({ status: cardStatus, count: null })),
      ));
      if (active) {
        setSummaryCounts(Object.fromEntries(results.map((result) => [result.status, result.count])));
        if (results.some((result) => result.count === null)) setSummaryError('Some summary counts could not be loaded. Check your access and try again.');
        setSummaryLoading(false);
      }
    };
    void loadSummary();
    return () => { active = false; };
  }, [accessToken, clientId, initiatedFrom, initiatedTo]);

  const move = async (item: BGVCase, next: BGVCaseStatus) => {
    try {
      await transitionBGVCase(item.id, next, undefined, accessToken);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update case.');
    }
  };

  const saveCase = async (payload: CreateBGVCasePayload, intent: 'draft' | 'create', draftId?: string) => {
    setSubmitting(true);
    setError(null);
    try {
      if (draftId) {
        await updateBGVCaseMeta(draftId, { clientReference: payload.clientReference || '', packageName: payload.packageName || '', remarks: payload.remarks || '' }, accessToken);
        await updateBGVCaseChecks(draftId, payload.checks || [], accessToken);
        if (intent === 'create') await transitionBGVCase(draftId, 'INITIATED', undefined, accessToken);
      } else {
        await createBGVCase(payload, accessToken);
      }
      setShowCreate(false);
      setDraftToResume(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create BGV case.');
    } finally {
      setSubmitting(false);
    }
  };

  const resumeDraft = async (item: BGVCase) => {
    setActionId(`resume-${item.id}`);
    setError(null);
    try {
      setDraftToResume(await getBGVCase(item.id, accessToken));
      setShowCreate(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load this draft.');
    } finally {
      setActionId(null);
    }
  };

  const downloadReport = async (item: BGVCase) => {
    setActionId(`download-${item.id}`);
    setError(null);
    try {
      const blob = await downloadBGVReport(item.id, accessToken);
      const candidateName = item.candidate ? `${item.candidate.firstName}_${item.candidate.lastName}`.replace(/\s+/g, '_') : 'Candidate';
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${item.caseNumber}_${candidateName}_BGV_FinalReport.pdf`;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not download report.');
    } finally {
      setActionId(null);
    }
  };

  const deleteCase = async () => {
    if (!deleteTarget) return;
    setActionId(`delete-${deleteTarget.id}`);
    setError(null);
    try {
      await deleteBGVCase(deleteTarget.id, accessToken);
      setDeleteTarget(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not delete case.');
    } finally {
      setActionId(null);
    }
  };

  const exportCases = async () => {
    setActionId('export');
    setError(null);
    try {
      const blob = await exportBGVCases({ search, clientId: clientId || undefined, status, initiatedFrom, initiatedTo }, accessToken);
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `bgv-cases-${initiatedFrom || 'all'}-to-${initiatedTo || 'all'}.xlsx`;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not export BGV cases.');
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--primary)]">Verification operations</p>
          <h1 className="text-[26px] font-semibold">BGV Cases</h1>
          <p className="mt-1 text-[13px] text-[var(--muted)]">Track candidates through consent, verification, review, and completion.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={exportCases} disabled={actionId !== null} className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--border)] px-4 py-2.5 text-[13px] font-semibold text-[var(--foreground)] hover:border-[var(--primary)] hover:text-[var(--primary)] disabled:opacity-50">
            {actionId === 'export' ? <Loader2 size={15} className="animate-spin" /> : <FileSpreadsheet size={15} />} Export Excel
          </button>
          <button type="button" onClick={() => { setDraftToResume(null); setShowCreate(true); }} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2.5 text-[13px] font-semibold text-[var(--primary-foreground)]">
            <Plus size={15} /> New case
          </button>
        </div>
      </div>

      <section aria-label="BGV case summary" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-[15px] font-semibold">Case overview</h2>
            <p className="mt-0.5 text-[11px] text-[var(--muted)]">Choose a stage to filter the case list. Counts follow the selected initiation dates.</p>
          </div>
          {(status || clientId || initiatedFrom || initiatedTo) && (
            <button
              type="button"
              onClick={() => { setPage(1); setStatus(''); setClientId(''); setInitiatedFrom(''); setInitiatedTo(''); }}
              className="text-[11px] font-semibold text-[var(--primary)] hover:underline"
            >
              Clear overview filters
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {caseSummaryCards.map((card) => {
            const selected = status === card.status;
            const Icon = card.icon;
            return (
              <button
                key={card.label}
                type="button"
                onClick={() => { setPage(1); setStatus(card.status); }}
                aria-pressed={selected}
                className={`group relative isolate overflow-hidden rounded-xl border bg-[var(--surface)] p-3 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 ${selected ? 'ring-2 ring-[var(--primary)]/40 ring-offset-1' : 'hover:border-[var(--primary)]/40'}`}
                style={{
                  borderColor: selected ? card.accent : undefined,
                  boxShadow: selected ? `0 4px 14px ${card.accent}20` : undefined,
                }}
              >
                <span className="absolute inset-x-0 top-0 h-0.5" style={{ background: card.accent }} />
                <span className="pointer-events-none absolute -right-5 -top-7 -z-10 h-20 w-20 rounded-full opacity-[0.07] transition-transform duration-300 group-hover:scale-125" style={{ background: card.accent }} />
                <span className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: `${card.accent}18`, color: card.accent }}>
                      <Icon size={16} strokeWidth={2.1} />
                    </span>
                    <span className="truncate text-[11px] font-semibold text-[var(--muted)]">{card.label}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1 text-[10px] font-semibold" style={{ color: selected ? card.accent : 'var(--muted)' }}>
                    {selected ? 'Active' : <ChevronRight size={14} className="transition-transform group-hover:translate-x-0.5" />}
                  </span>
                </span>
                <span className="mt-2 block text-[24px] font-bold leading-none tracking-tight tabular-nums text-[var(--foreground)]">
                  {summaryLoading ? <span className="inline-block h-6 w-10 animate-pulse rounded-md bg-[var(--surface-muted)] align-middle" /> : summaryCounts[card.status] ?? '—'}
                </span>
                <span className="mt-1 block truncate text-[10px] text-[var(--muted)]">{card.hint}</span>
              </button>
            );
          })}
        </div>
      </section>
      {summaryError && <p role="alert" className="text-[12px] text-[#FF6B6B]">{summaryError}</p>}

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <label className="relative flex-1">
          <Search size={15} className="absolute left-3 top-3 text-[var(--muted)]" />
          <input
            value={search}
            onChange={(event) => { setPage(1); setSearch(event.target.value); }}
            placeholder="Search case number or candidate"
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] py-2.5 pl-9 pr-3 text-[13px]"
          />
        </label>
        <select
          value={status}
          onChange={(event) => { setPage(1); setStatus(event.target.value as BGVCaseStatus | ''); }}
          className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-[13px]"
        >
          <option value="">All statuses</option>
          {statuses.map((value) => (
            <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>
          ))}
        </select>
        <select
          value={clientId}
          onChange={(event) => { setPage(1); setClientId(event.target.value); }}
          className="min-w-48 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-[13px]"
          aria-label="Filter cases by client"
          disabled={clientsLoading}
        >
          <option value="">{clientsLoading ? 'Loading clients...' : 'All clients'}</option>
          {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
        </select>
        <label className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-[11px] text-[var(--muted)]">
          Initiated from
          <input type="date" value={initiatedFrom} onChange={(event) => { setPage(1); setInitiatedFrom(event.target.value); }} className="bg-transparent text-[13px] text-[var(--foreground)] outline-none" />
        </label>
        <label className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-[11px] text-[var(--muted)]">
          Initiated to
          <input type="date" value={initiatedTo} onChange={(event) => { setPage(1); setInitiatedTo(event.target.value); }} className="bg-transparent text-[13px] text-[var(--foreground)] outline-none" />
        </label>
      </div>
      {clientLoadError && <p role="alert" className="text-[12px] text-[#FF6B6B]">{clientLoadError}</p>}

      <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead className="border-b border-[var(--border)] text-[11px] uppercase tracking-wider text-[var(--muted)]">
              <tr>
                <th className="px-5 py-3">Case</th>
                <th className="px-5 py-3">Candidate</th>
                <th className="px-5 py-3">Client</th>
                <th className="px-5 py-3">Checks</th>
                <th className="px-5 py-3">Result</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Next step</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {loading ? (
                <tr><td colSpan={8} className="px-5 py-12 text-center text-[var(--muted)]">Loading cases...</td></tr>
              ) : error ? (
                <tr><td colSpan={8} className="px-5 py-12 text-center text-[#FF6B6B]">{error}</td></tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-[var(--muted)]">
                    <FileCheck2 size={24} className="mx-auto mb-2" />
                    No BGV cases found.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} onClick={() => router.push(`/company/bgv-cases/${item.id}`)} className="cursor-pointer transition-colors hover:bg-[var(--surface-muted)]/50">
                    <td className="px-5 py-4 font-mono text-[12px]"><button type="button" onClick={(event) => { event.stopPropagation(); router.push(`/company/bgv-cases/${item.id}`); }} className="text-[var(--primary)] hover:underline">{item.caseNumber}</button></td>
                    <td className="px-5 py-4">
                      {item.candidate ? `${item.candidate.firstName} ${item.candidate.lastName}` : item.candidateId}
                    </td>
                    <td className="px-5 py-4 text-[var(--muted)]">{item.client?.name ?? item.clientId}</td>
                    <td className="px-5 py-4">{item._count?.checks ?? item.checks?.length ?? 0}</td>
                    <td className={`px-5 py-4 font-medium ${resultStyle[item.overallResult]}`}>
                      {item.overallResult.replaceAll('_', ' ')}
                    </td>
                    <td className="px-5 py-4">
                      <span className="rounded-full bg-[var(--surface-muted)] px-2.5 py-1 text-[11px]">
                        {item.status.replaceAll('_', ' ')}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      {item.status === 'DRAFT' && (
                        <button type="button" onClick={() => void resumeDraft(item)} disabled={actionId !== null} className="text-[12px] font-semibold text-[var(--primary)] disabled:opacity-50">
                          {actionId === `resume-${item.id}` ? 'Opening...' : 'Resume draft'}
                        </button>
                      )}
                      {item.status === 'IN_PROGRESS' && (
                        <button onClick={() => move(item, 'UNDER_REVIEW')} className="text-[12px] font-semibold text-[var(--primary)]">
                          Review
                        </button>
                      )}
                      {item.status === 'UNDER_REVIEW' && (
                        <button onClick={() => move(item, 'COMPLETED')} className="text-[12px] font-semibold text-[var(--primary)]">
                          Complete
                        </button>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button type="button" onClick={() => router.push(`/company/bgv-cases/${item.id}`)} className="rounded-md p-2 text-[var(--muted)] hover:bg-[var(--primary)]/10 hover:text-[var(--primary)]" aria-label={`Edit case ${item.caseNumber}`} title="Edit case">
                          <Pencil size={15} />
                        </button>
                        <button type="button" onClick={() => downloadReport(item)} disabled={actionId !== null} className="rounded-md p-2 text-[var(--muted)] hover:bg-[var(--primary)]/10 hover:text-[var(--primary)] disabled:opacity-40" aria-label={`Download report for ${item.caseNumber}`} title="Download report">
                          {actionId === `download-${item.id}` ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                        </button>
                        {(item.status === 'DRAFT' || item.status === 'CANCELLED') && <button type="button" onClick={() => setDeleteTarget(item)} disabled={actionId !== null} className="rounded-md p-2 text-[var(--muted)] hover:bg-[#FF6B6B]/10 hover:text-[#FF6B6B] disabled:opacity-40" aria-label={`Delete case ${item.caseNumber}`} title="Delete case"><Trash2 size={15} /></button>}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-[var(--border)] px-5 py-3 text-[12px] text-[var(--muted)]">
          <span>{meta.total} cases</span>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="rounded-md border border-[var(--border)] px-3 py-1.5 disabled:opacity-40">
              Previous
            </button>
            <button disabled={page >= meta.totalPages} onClick={() => setPage((value) => value + 1)} className="rounded-md border border-[var(--border)] px-3 py-1.5 disabled:opacity-40">
              Next
            </button>
          </div>
        </div>
      </div>

      {showCreate && (
        <BGVCaseWizardModal
          token={accessToken}
          submitting={submitting}
          error={error}
          initialDraft={draftToResume}
          onClose={() => { if (!submitting) { setShowCreate(false); setDraftToResume(null); } }}
          onSubmit={saveCase}
        />
      )}
      {deleteTarget && <CandidateConfirmDialog title="Delete this BGV case?" description={`This permanently removes ${deleteTarget.caseNumber} and its checks. Only draft or cancelled cases can be deleted.`} confirmLabel="Delete case" submitting={actionId === `delete-${deleteTarget.id}`} onConfirm={deleteCase} onCancel={() => setDeleteTarget(null)} />}
    </div>
  );
}