'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Download } from 'lucide-react';
import { useAuth } from '@/src/auth/AuthProvider';
import { ClientPortalApiError, downloadPortalReport, getPortalCase, hasPortalPermission, type PortalCaseDetail } from '@/src/lib/api/client-portal';
import { formatCandidateName } from '@/src/lib/candidate-name';

function dateLabel(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString() : '—';
}

function badgeClass(value: string) {
  if (['COMPLETED', 'CLEAR', 'VERIFIED', 'MATCH', 'NO_RECORD_FOUND'].includes(value)) return 'bg-emerald-500/10 text-emerald-700';
  if (['FAILED', 'MAJOR_DISCREPANCY', 'NOT_VERIFIED', 'MISMATCH'].includes(value)) return 'bg-rose-500/10 text-rose-700';
  if (value.includes('PENDING') || value.includes('PROGRESS') || value === 'QUEUED' || value === 'ON_HOLD') return 'bg-amber-500/10 text-amber-700';
  return 'bg-[var(--surface-muted)] text-[var(--muted)]';
}

export default function ClientPortalCasePage() {
  const { id } = useParams<{ id: string }>();
  const { accessToken, permissions, user } = useAuth();
  const [caseData, setCaseData] = useState<PortalCaseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const canDownload = hasPortalPermission(permissions, 'clientportal.reports.download', user?.role.isCompanyAdmin ?? false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setCaseData(await getPortalCase(id, accessToken));
    } catch (loadError) {
      setError(loadError instanceof ClientPortalApiError ? loadError.message : 'Could not load BGV case.');
    } finally {
      setLoading(false);
    }
  }, [accessToken, id]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const downloadReport = async () => {
    if (!caseData) return;
    setDownloading(true);
    setError(null);
    try {
      const blob = await downloadPortalReport(caseData.id, accessToken);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${caseData.caseNumber}_BGV_Report.pdf`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (downloadError) {
      setError(downloadError instanceof ClientPortalApiError ? downloadError.message : 'Could not download report.');
    } finally {
      setDownloading(false);
    }
  };

  if (loading) return <p className="py-12 text-center text-sm text-[var(--muted)]">Loading case…</p>;
  if (error && !caseData) return <section className="rounded-xl border border-rose-500/20 bg-[var(--surface)] p-5"><p role="alert" className="text-sm text-rose-700">{error}</p><Link href="/client-portal/cases" className="mt-4 inline-flex items-center gap-2 text-sm text-[var(--primary)]"><ArrowLeft size={15} />BGV cases</Link></section>;
  if (!caseData) return null;

  return (
    <div className="space-y-5">
      <Link href="/client-portal/cases" className="inline-flex items-center gap-2 text-[12px] text-[var(--muted)] hover:text-[var(--foreground)]"><ArrowLeft size={15} />Back to BGV cases</Link>
      {error && <p role="alert" className="rounded-lg border border-rose-500/20 bg-rose-500/5 px-4 py-3 text-[12px] text-rose-700">{error}</p>}
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <div><p className="font-mono text-[11px] text-[var(--muted)]">{caseData.caseNumber}</p><h2 className="mt-1 text-xl font-semibold">BGV case status</h2><p className="mt-1 text-[12px] text-[var(--muted)]">{caseData.candidate ? formatCandidateName(caseData.candidate) : 'Candidate'} · {caseData.candidate?.candidateCode}</p></div>
        {caseData.status === 'COMPLETED' && canDownload && <button type="button" disabled={downloading} onClick={() => void downloadReport()} className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-3 py-2 text-[11px] font-semibold text-[var(--primary-foreground)] disabled:opacity-50"><Download size={14} />{downloading ? 'Preparing…' : 'Download report'}</button>}
      </section>
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[['Status', caseData.status], ['Overall result', caseData.overallResult || 'PENDING'], ['Initiated', dateLabel(caseData.initiatedAt)], ['Completed', dateLabel(caseData.completedAt)]].map(([label, value]) => <div key={label} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"><p className="text-[10px] uppercase tracking-wide text-[var(--muted)]">{label}</p><span className={`mt-2 inline-flex rounded-full px-2 py-1 text-[10px] font-semibold ${label === 'Status' || label === 'Overall result' ? badgeClass(value) : ''}`}>{value.replaceAll('_', ' ')}</span></div>)}
      </section>
      <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
        <div className="border-b border-[var(--border)] px-5 py-4"><h3 className="text-[14px] font-semibold">Verification checks</h3><p className="mt-1 text-[11px] text-[var(--muted)]">{caseData.checks.length} check{caseData.checks.length === 1 ? '' : 's'}</p></div>
        {!caseData.checks.length ? <p className="px-5 py-10 text-center text-[12px] text-[var(--muted)]">No checks have been added to this case.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[600px] text-left text-[12px]"><thead className="bg-[var(--surface-muted)]/60 text-[10px] uppercase tracking-wide text-[var(--muted)]"><tr><th className="px-5 py-3">Check</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Result</th><th className="px-5 py-3">Started</th><th className="px-5 py-3">Completed</th><th className="px-5 py-3">Notes</th></tr></thead><tbody className="divide-y divide-[var(--border)]">{caseData.checks.map((check) => <tr key={check.id}><td className="px-5 py-3.5 font-medium">{check.type.replaceAll('_', ' ')}</td><td className="px-5 py-3.5"><span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${badgeClass(check.status)}`}>{check.status.replaceAll('_', ' ')}</span></td><td className="px-5 py-3.5">{check.result ? check.result.replaceAll('_', ' ') : '—'}</td><td className="px-5 py-3.5">{dateLabel(check.startedAt)}</td><td className="px-5 py-3.5">{dateLabel(check.completedAt)}</td><td className="max-w-56 truncate px-5 py-3.5 text-[var(--muted)]" title={check.remarks || ''}>{check.remarks || '—'}</td></tr>)}</tbody></table></div>}
      </section>
    </div>
  );
}
