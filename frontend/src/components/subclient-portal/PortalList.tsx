'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Download, FileCheck2, Loader2 } from 'lucide-react';
import { useAuth } from '@/src/auth/AuthProvider';
import { downloadSubclientReport, listSubclientCandidates, listSubclientCases, listSubclientReports, type SubclientCandidate, type SubclientCase, type SubclientReport } from '@/src/lib/api/subclient-portal';

type Section = 'candidates' | 'cases' | 'reports';

const names: Record<Section, string> = { candidates: 'Candidates', cases: 'BGV cases', reports: 'Completed reports' };
const dateText = (value: string | null) => value ? new Date(value).toLocaleDateString('en-IN') : '—';

export default function PortalList({ section }: { section: Section }) {
  const { accessToken } = useAuth();
  const [candidates, setCandidates] = useState<SubclientCandidate[]>([]);
  const [cases, setCases] = useState<SubclientCase[]>([]);
  const [reports, setReports] = useState<SubclientReport[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = section === 'candidates'
        ? await listSubclientCandidates(page, accessToken)
        : section === 'cases'
          ? await listSubclientCases(page, accessToken)
          : await listSubclientReports(page, accessToken);
      setTotal(result.total);
      setTotalPages(result.totalPages);
      if (section === 'candidates') setCandidates(result.items as SubclientCandidate[]);
      else if (section === 'cases') setCases(result.items as SubclientCase[]);
      else setReports(result.items as SubclientReport[]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : `Could not load ${names[section].toLowerCase()}.`);
    } finally {
      setLoading(false);
    }
  }, [accessToken, page, section]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const saveReport = async (report: SubclientReport) => {
    setDownloading(report.id);
    setError(null);
    try {
      const blob = await downloadSubclientReport(report.id, accessToken);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${report.caseNumber}_BGV_FinalReport.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not download the report.');
    } finally {
      setDownloading(null);
    }
  };

  return (
    <section className="space-y-4">
      <header><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--primary)]">Subclient workspace</p><h2 className="mt-1 text-2xl font-semibold">{names[section]}</h2><p className="mt-1 text-sm text-[var(--muted)]">Records are limited to your subclient account.</p></header>
      {error && <p role="alert" className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 text-sm text-rose-700">{error}</p>}
      <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
        {loading ? <div className="flex items-center justify-center gap-2 p-12 text-sm text-[var(--muted)]"><Loader2 size={16} className="animate-spin" />Loading…</div>
          : section === 'candidates' ? candidates.length ? <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead className="bg-[var(--surface-muted)] text-[10px] uppercase tracking-wide text-[var(--muted)]"><tr><th className="px-4 py-3">Candidate</th><th className="px-4 py-3">Reference</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Added</th></tr></thead><tbody className="divide-y divide-[var(--border)]">{candidates.map((candidate) => <tr key={candidate.id}><td className="px-4 py-3 font-medium">{candidate.fullName || [candidate.firstName, candidate.middleName, candidate.lastName].filter(Boolean).join(' ')}</td><td className="px-4 py-3 font-mono text-xs text-[var(--muted)]">{candidate.candidateCode}</td><td className="px-4 py-3 text-[var(--muted)]">{candidate.email || '—'}</td><td className="px-4 py-3">{candidate.status.replaceAll('_', ' ')}</td><td className="px-4 py-3 text-[var(--muted)]">{dateText(candidate.createdAt)}</td></tr>)}</tbody></table></div> : <Empty text="No candidates have been assigned to this subclient yet." />
          : section === 'cases' ? cases.length ? <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm"><thead className="bg-[var(--surface-muted)] text-[10px] uppercase tracking-wide text-[var(--muted)]"><tr><th className="px-4 py-3">Case</th><th className="px-4 py-3">Candidate</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Created</th><th className="px-4 py-3"></th></tr></thead><tbody className="divide-y divide-[var(--border)]">{cases.map((item) => <tr key={item.id}><td className="px-4 py-3 font-mono text-xs">{item.caseNumber}</td><td className="px-4 py-3 font-medium">{item.candidate.fullName || [item.candidate.firstName, item.candidate.middleName, item.candidate.lastName].filter(Boolean).join(' ')}</td><td className="px-4 py-3">{item.status.replaceAll('_', ' ')}</td><td className="px-4 py-3 text-[var(--muted)]">{dateText(item.createdAt)}</td><td className="px-4 py-3 text-right"><Link href={`/subclient-portal/cases/${item.id}`} className="font-semibold text-[var(--primary)] hover:underline">View</Link></td></tr>)}</tbody></table></div> : <Empty text="No BGV cases are available for this subclient." />
          : reports.length ? <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm"><thead className="bg-[var(--surface-muted)] text-[10px] uppercase tracking-wide text-[var(--muted)]"><tr><th className="px-4 py-3">Report</th><th className="px-4 py-3">Candidate</th><th className="px-4 py-3">Result</th><th className="px-4 py-3">Completed</th><th className="px-4 py-3 text-right">Download</th></tr></thead><tbody className="divide-y divide-[var(--border)]">{reports.map((report) => <tr key={report.id}><td className="px-4 py-3 font-mono text-xs">{report.caseNumber}</td><td className="px-4 py-3 font-medium">{report.candidate.fullName || [report.candidate.firstName, report.candidate.middleName, report.candidate.lastName].filter(Boolean).join(' ')}</td><td className="px-4 py-3">{report.reportVerificationStatus.replaceAll('_', ' ')}</td><td className="px-4 py-3 text-[var(--muted)]">{dateText(report.completedAt)}</td><td className="px-4 py-3 text-right"><button type="button" onClick={() => void saveReport(report)} disabled={downloading === report.id} className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] px-2.5 py-1.5 text-xs font-semibold disabled:opacity-50">{downloading === report.id ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}PDF</button></td></tr>)}</tbody></table></div> : <Empty text="Completed reports will appear here." />}
      </div>
      {!loading && totalPages > 1 && <div className="flex items-center justify-between text-xs"><span className="text-[var(--muted)]">{total} records · Page {page} of {totalPages}</span><div className="flex gap-2"><button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="rounded-lg border border-[var(--border)] px-3 py-2 disabled:opacity-40">Previous</button><button type="button" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)} className="rounded-lg border border-[var(--border)] px-3 py-2 disabled:opacity-40">Next</button></div></div>}
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="p-12 text-center"><FileCheck2 size={24} className="mx-auto text-[var(--muted)]" /><p className="mt-3 text-sm font-medium">Nothing to show yet</p><p className="mt-1 text-xs text-[var(--muted)]">{text}</p></div>;
}
