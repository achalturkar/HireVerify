'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Download, FileCheck2, Loader2 } from 'lucide-react';
import { useAuth } from '@/src/auth/AuthProvider';
import { downloadSubclientReport, getSubclientCase, type SubclientCaseDetail } from '@/src/lib/api/subclient-portal';

export default function SubclientCasePage() {
  const params = useParams<{ id: string }>();
  const { accessToken } = useAuth();
  const [item, setItem] = useState<SubclientCaseDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItem(await getSubclientCase(params.id, accessToken));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load this case.');
    } finally {
      setLoading(false);
    }
  }, [accessToken, params.id]);
  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const downloadReport = async () => {
    if (!item) return;
    setDownloading(true);
    setError(null);
    try {
      const blob = await downloadSubclientReport(item.id, accessToken);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${item.caseNumber}_BGV_FinalReport.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not download the report.');
    } finally {
      setDownloading(false);
    }
  };

  if (loading) return <div className="flex justify-center py-16 text-sm text-[var(--muted)]"><Loader2 className="mr-2 animate-spin" size={16} />Loading case…</div>;
  if (error && !item) return <div><p role="alert" className="rounded-lg bg-rose-500/10 p-4 text-sm text-rose-700">{error}</p><Link href="/subclient-portal/cases" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[var(--primary)]"><ArrowLeft size={15} />Back to cases</Link></div>;
  if (!item) return null;
  const candidateName = item.candidate.fullName || [item.candidate.firstName, item.candidate.middleName, item.candidate.lastName].filter(Boolean).join(' ');

  return <div className="space-y-5">
    <Link href="/subclient-portal/cases" className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--primary)]"><ArrowLeft size={14} />All cases</Link>
    <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--primary)]">BGV case</p><h2 className="mt-1 font-mono text-xl font-semibold">{item.caseNumber}</h2><p className="mt-1 text-sm text-[var(--muted)]">{candidateName} · {item.candidate.candidateCode}</p></div><div className="flex items-center gap-2"><span className="rounded-full bg-[var(--surface-muted)] px-3 py-1.5 text-xs font-semibold">{item.status.replaceAll('_', ' ')}</span>{item.status === 'COMPLETED' && <button type="button" onClick={() => void downloadReport()} disabled={downloading} className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-3 py-2 text-xs font-semibold text-[var(--primary-foreground)] disabled:opacity-50">{downloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}Report PDF</button>}</div></div>
    </section>
    {error && <p role="alert" className="rounded-lg bg-rose-500/10 p-3 text-sm text-rose-700">{error}</p>}
    <section className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
      <div className="border-b border-[var(--border)] p-4"><h3 className="text-sm font-semibold">Verification checks</h3><p className="mt-1 text-xs text-[var(--muted)]">Progress and findings recorded for this case.</p></div>
      {item.checks.length ? <div className="divide-y divide-[var(--border)]">{item.checks.map((check) => <article key={check.id} className="p-4"><div className="flex items-start justify-between gap-3"><div className="flex items-start gap-3"><span className="mt-0.5 text-[var(--primary)]"><FileCheck2 size={16} /></span><div><h4 className="text-sm font-medium">{check.label}</h4><p className="mt-1 text-xs text-[var(--muted)]">{[check.result?.replaceAll('_', ' '), check.remarks].filter(Boolean).join(' · ') || 'No additional details available.'}</p></div></div><span className="shrink-0 rounded-full bg-[var(--surface-muted)] px-2.5 py-1 text-[10px] font-semibold">{check.status.replaceAll('_', ' ')}</span></div></article>)}</div> : <p className="p-8 text-center text-xs text-[var(--muted)]">No verification checks are recorded.</p>}
    </section>
  </div>;
}
