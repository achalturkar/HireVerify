'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Download, FileCheck2, FileSpreadsheet, Loader2, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useAuth } from '@/src/auth/AuthProvider';
import { createBGVCase, deleteBGVCase, downloadBGVReport, exportBGVCases, listBGVCases, transitionBGVCase, ApiError } from '@/src/lib/api/bgv';
import BGVCaseFormModal from '@/src/components/layout/company/bgv/BGVCaseFormModal';
import CandidateConfirmDialog from '@/src/components/layout/company/candidate/CandidateConfirmDialog';
import type { BGVCase, BGVCaseStatus, BGVOverallResult } from '@/src/types/bgv';
import type { CreateBGVCasePayload } from '@/src/types/bgv';
import type { PaginationMeta } from '@/src/types/user';

const statuses: BGVCaseStatus[] = ['DRAFT', 'INITIATED', 'CONSENT_PENDING', 'IN_PROGRESS', 'UNDER_REVIEW', 'COMPLETED', 'ON_HOLD', 'CANCELLED'];
const resultStyle: Record<BGVOverallResult, string> = { PENDING: 'text-[var(--muted)]', CLEAR: 'text-[var(--primary)]', MINOR_DISCREPANCY: 'text-[#F2AE55]', MAJOR_DISCREPANCY: 'text-[#FF6B6B]', UNABLE_TO_VERIFY: 'text-[#FF6B6B]', REQUIRES_REVIEW: 'text-[#F2AE55]' };

export default function BGVCaseListPage() {
  const { accessToken } = useAuth();
  const [items, setItems] = useState<BGVCase[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<BGVCaseStatus | ''>('');
  const [initiatedFrom, setInitiatedFrom] = useState('');
  const [initiatedTo, setInitiatedTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BGVCase | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listBGVCases({ page, limit: 20, search, status, initiatedFrom, initiatedTo }, accessToken);
      setItems(data.items);
      setMeta(data.meta);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load BGV cases.');
    } finally {
      setLoading(false);
    }
  }, [accessToken, page, search, status, initiatedFrom, initiatedTo]);

  useEffect(() => { load(); }, [load]);

  const move = async (item: BGVCase, next: BGVCaseStatus) => {
    try {
      await transitionBGVCase(item.id, next, undefined, accessToken);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update case.');
    }
  };

  const createCase = async (payload: CreateBGVCasePayload) => {
    setSubmitting(true);
    setError(null);
    try {
      await createBGVCase(payload, accessToken);
      setShowCreate(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create BGV case.');
    } finally {
      setSubmitting(false);
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
      const blob = await exportBGVCases({ search, status, initiatedFrom, initiatedTo }, accessToken);
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
          <button type="button" onClick={() => setShowCreate(true)} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2.5 text-[13px] font-semibold text-[var(--primary-foreground)]">
            <Plus size={15} /> New case
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
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
        <label className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-[11px] text-[var(--muted)]">
          Initiated from
          <input type="date" value={initiatedFrom} onChange={(event) => { setPage(1); setInitiatedFrom(event.target.value); }} className="bg-transparent text-[13px] text-[var(--foreground)] outline-none" />
        </label>
        <label className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-[11px] text-[var(--muted)]">
          Initiated to
          <input type="date" value={initiatedTo} onChange={(event) => { setPage(1); setInitiatedTo(event.target.value); }} className="bg-transparent text-[13px] text-[var(--foreground)] outline-none" />
        </label>
      </div>

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
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {loading ? (
                <tr><td colSpan={7} className="px-5 py-12 text-center text-[var(--muted)]">Loading cases...</td></tr>
              ) : error ? (
                <tr><td colSpan={7} className="px-5 py-12 text-center text-[#FF6B6B]">{error}</td></tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-[var(--muted)]">
                    <FileCheck2 size={24} className="mx-auto mb-2" />
                    No BGV cases found.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-5 py-4 font-mono text-[12px]"><Link href={`/company/bgv-cases/${item.id}`} className="text-[var(--primary)] hover:underline">{item.caseNumber}</Link></td>
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
                        <button onClick={() => move(item, 'INITIATED')} className="text-[12px] font-semibold text-[var(--primary)]">
                          Initiate
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
                        <Link href={`/company/bgv-cases/${item.id}`} className="rounded-md p-2 text-[var(--muted)] hover:bg-[var(--primary)]/10 hover:text-[var(--primary)]" aria-label={`Edit case ${item.caseNumber}`} title="Edit case">
                          <Pencil size={15} />
                        </Link>
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
        <BGVCaseFormModal
          token={accessToken}
          submitting={submitting}
          error={error}
          onClose={() => setShowCreate(false)}
          onSubmit={createCase}
        />
      )}
      {deleteTarget && <CandidateConfirmDialog title="Delete this BGV case?" description={`This permanently removes ${deleteTarget.caseNumber} and its checks. Only draft or cancelled cases can be deleted.`} confirmLabel="Delete case" submitting={actionId === `delete-${deleteTarget.id}`} onConfirm={deleteCase} onCancel={() => setDeleteTarget(null)} />}
    </div>
  );
}