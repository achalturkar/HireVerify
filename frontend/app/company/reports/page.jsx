'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Download, Eye, FileText, Loader2 } from 'lucide-react';
import { useAuth } from '@/src/auth/AuthProvider';
import { ApiError, downloadBGVReport, listBGVCases } from '@/src/lib/api/bgv';

export default function Reports() {
    const { accessToken } = useAuth();
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [action, setAction] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await listBGVCases({ page: 1, limit: 100, status: 'COMPLETED' }, accessToken);
            setReports(result.items);
        } catch (err) {
            setError(err instanceof ApiError ? err.message : 'Could not load reports.');
        } finally {
            setLoading(false);
        }
    }, [accessToken]);

    useEffect(() => {
        const timer = window.setTimeout(() => { void load(); }, 0);
        return () => window.clearTimeout(timer);
    }, [load]);

    const reportFile = (report) => `${report.caseNumber}_${report.candidate ? `${report.candidate.firstName}_${report.candidate.lastName}` : 'Candidate'}_BGV_FinalReport.pdf`.replace(/\s+/g, '_');
    const openReport = async (report) => {
        setAction(`view-${report.id}`);
        setError(null);
        try {
            const blob = await downloadBGVReport(report.id, accessToken);
            window.open(URL.createObjectURL(blob), '_blank', 'noopener,noreferrer');
        } catch (err) {
            setError(err instanceof ApiError ? err.message : 'Could not open report.');
        } finally {
            setAction(null);
        }
    };

    const downloadReport = async (report) => {
        setAction(`download-${report.id}`);
        setError(null);
        try {
            const blob = await downloadBGVReport(report.id, accessToken);
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = reportFile(report);
            link.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            setError(err instanceof ApiError ? err.message : 'Could not download report.');
        } finally {
            setAction(null);
        }
    };

    return <div className="mx-auto max-w-6xl space-y-6">
        <div><p className="text-[11px] uppercase tracking-[0.14em] text-[var(--primary)]">Completed verifications</p><h1 className="text-[26px] font-semibold">Reports</h1><p className="mt-1 text-[13px] text-[var(--muted)]">Completed BGV cases ready to review or download.</p></div>
        {error && <div className="rounded-lg border border-[#FF6B6B]/25 bg-[#FF6B6B]/10 px-3 py-2.5 text-[13px] text-[#FF6B6B]">{error}</div>}
        <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]"><div className="overflow-x-auto"><table className="w-full text-left text-[13px]"><thead className="border-b border-[var(--border)] text-[11px] uppercase tracking-wider text-[var(--muted)]"><tr><th className="px-5 py-3">Case</th><th className="px-5 py-3">Candidate</th><th className="px-5 py-3">Client</th><th className="px-5 py-3">Completed</th><th className="px-5 py-3">Result</th><th className="px-5 py-3 text-right">Actions</th></tr></thead><tbody className="divide-y divide-[var(--border)]">{loading ? <tr><td colSpan={6} className="px-5 py-14 text-center text-[var(--muted)]"><Loader2 size={20} className="mx-auto mb-2 animate-spin" />Loading reports...</td></tr> : reports.length === 0 ? <tr><td colSpan={6} className="px-5 py-14 text-center text-[var(--muted)]"><FileText size={24} className="mx-auto mb-2" />No completed reports yet.</td></tr> : reports.map((report) => <tr key={report.id}><td className="px-5 py-4"><Link href={`/company/bgv-cases/${report.id}`} className="font-mono text-[12px] text-[var(--primary)] hover:underline">{report.caseNumber}</Link></td><td className="px-5 py-4 font-medium">{report.candidate ? `${report.candidate.firstName} ${report.candidate.lastName}` : report.candidateId}</td><td className="px-5 py-4 text-[var(--muted)]">{report.client?.name || report.clientId}</td><td className="px-5 py-4 text-[var(--muted)]">{report.completedAt ? new Date(report.completedAt).toLocaleDateString() : '—'}</td><td className="px-5 py-4"><span className="rounded-full bg-[var(--surface-muted)] px-2.5 py-1 text-[11px]">{report.overallResult.replaceAll('_', ' ')}</span></td><td className="px-5 py-4 text-right"><div className="flex justify-end gap-2"><button type="button" onClick={() => void openReport(report)} disabled={!!action} title="View report" aria-label={`View report ${report.caseNumber}`} className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] px-3 py-2 text-[12px] font-semibold disabled:opacity-50"><Eye size={14} />{action === `view-${report.id}` ? 'Opening...' : 'View'}</button><button type="button" onClick={() => void downloadReport(report)} disabled={!!action} title="Download report" aria-label={`Download report ${report.caseNumber}`} className="inline-flex items-center gap-1.5 rounded-md bg-[var(--primary)] px-3 py-2 text-[12px] font-semibold text-[var(--primary-foreground)] disabled:opacity-50"><Download size={14} />{action === `download-${report.id}` ? 'Preparing...' : 'Download'}</button></div></td></tr>)}</tbody></table></div></div>
    </div>;
}