'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckSquare, Download, Eye, FileText, Loader2, Mail, Square } from 'lucide-react';
import { useAuth } from '@/src/auth/AuthProvider';
import { ApiError, downloadBGVReport, emailBGVReports, listBGVCases } from '@/src/lib/api/bgv';
import { listClients } from '@/src/lib/api/clients';

export default function Reports() {
  const { accessToken } = useAuth();
  const [reports, setReports] = useState([]);
  const [clients, setClients] = useState([]);
  const [clientId, setClientId] = useState('');
  const [completedFrom, setCompletedFrom] = useState('');
  const [completedTo, setCompletedTo] = useState('');
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [action, setAction] = useState(null);
  const [sent, setSent] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const result = await listBGVCases({ page: 1, limit: 200, status: 'COMPLETED', clientId: clientId || undefined, completedFrom: completedFrom || undefined, completedTo: completedTo || undefined }, accessToken);
      setReports(result.items); setSelected([]);
    } catch (err) { setError(err instanceof ApiError ? err.message : 'Could not load reports.'); }
    finally { setLoading(false); }
  }, [accessToken, clientId, completedFrom, completedTo]);

  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);
  useEffect(() => { listClients({ page: 1, limit: 200, status: 'ACTIVE', sortBy: 'name', sortOrder: 'asc' }, accessToken).then((result) => setClients(result.items)).catch(() => setClients([])); }, [accessToken]);

  const reportFile = (report) => `${report.caseNumber}_${report.candidate ? `${report.candidate.firstName}_${report.candidate.lastName}` : 'Candidate'}_BGV_FinalReport.pdf`.replace(/\s+/g, '_');
  const runReportAction = async (report, mode) => { setAction(`${mode}-${report.id}`); setError(null); try { const blob = await downloadBGVReport(report.id, accessToken); const url = URL.createObjectURL(blob); if (mode === 'view') { window.open(url, '_blank', 'noopener,noreferrer'); setTimeout(() => URL.revokeObjectURL(url), 60000); } else { const link = document.createElement('a'); link.href = url; link.download = reportFile(report); link.click(); URL.revokeObjectURL(url); } } catch (err) { setError(err instanceof ApiError ? err.message : `Could not ${mode} report.`); } finally { setAction(null); } };
  const sendSelected = async () => { if (!selected.length || !clientId) return; if (selected.length > 10) { setError('Select a maximum of 10 reports per email.'); return; } setAction('email'); setError(null); setSent(null); try { await emailBGVReports(selected, accessToken); setSent(`Sent ${selected.length} report${selected.length === 1 ? '' : 's'} to the selected client.`); setSelected([]); } catch (err) { setError(err instanceof ApiError ? err.message : 'Could not send selected reports.'); } finally { setAction(null); } };
  const allSelected = reports.length > 0 && selected.length === reports.length;
  const toggleAll = () => setSelected(allSelected ? [] : reports.slice(0, 10).map((report) => report.id));
  const toggle = (id) => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : current.length >= 10 ? current : [...current, id]);

  return <div className="mx-auto max-w-6xl space-y-6">
    <div><p className="text-[11px] uppercase tracking-[0.14em] text-[var(--primary)]">Completed verifications</p><h1 className="text-[26px] font-semibold">Reports</h1><p className="mt-1 text-[13px] text-[var(--muted)]">Filter completed cases, select reports for one client, and send them by email.</p></div>
    <section className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:flex-row sm:items-end"><label className="flex-1 text-[12px] text-[var(--muted)]">Client<select value={clientId} onChange={(event) => setClientId(event.target.value)} className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2.5 text-[13px]"><option value="">Select client to send reports</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name} ({client.clientCode})</option>)}</select></label><label className="text-[12px] text-[var(--muted)]">Completed from<input type="date" value={completedFrom} onChange={(event) => setCompletedFrom(event.target.value)} className="mt-1 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2.5 text-[13px]" /></label><label className="text-[12px] text-[var(--muted)]">Completed to<input type="date" value={completedTo} onChange={(event) => setCompletedTo(event.target.value)} className="mt-1 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2.5 text-[13px]" /></label></section>
    {error && <div className="rounded-lg border border-[#FF6B6B]/25 bg-[#FF6B6B]/10 px-3 py-2.5 text-[13px] text-[#FF6B6B]">{error}</div>}{sent && <div className="rounded-lg border border-[#3FDCC0]/25 bg-[#3FDCC0]/10 px-3 py-2.5 text-[13px] text-[#147A68]">{sent}</div>}
    <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]"><div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3"><span className="text-[12px] text-[var(--muted)]">{selected.length} selected</span><button type="button" onClick={sendSelected} disabled={!clientId || !selected.length || !!action} className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3.5 py-2.5 text-[12.5px] font-semibold text-[var(--primary-foreground)] disabled:opacity-50"><Mail size={14} />{action === 'email' ? 'Sending...' : 'Send selected to client'}</button></div><div className="overflow-x-auto"><table className="w-full text-left text-[13px]"><thead className="border-b border-[var(--border)] text-[11px] uppercase tracking-wider text-[var(--muted)]"><tr><th className="w-12 px-5 py-3"><button type="button" onClick={toggleAll} disabled={!reports.length} aria-label="Select all reports">{allSelected ? <CheckSquare size={16} /> : <Square size={16} />}</button></th><th className="px-5 py-3">Case</th><th className="px-5 py-3">Candidate</th><th className="px-5 py-3">Client</th><th className="px-5 py-3">Completed</th><th className="px-5 py-3">Result</th><th className="px-5 py-3 text-right">Actions</th></tr></thead><tbody className="divide-y divide-[var(--border)]">{loading ? <tr><td colSpan={7} className="px-5 py-14 text-center text-[var(--muted)]"><Loader2 size={20} className="mx-auto mb-2 animate-spin" />Loading reports...</td></tr> : reports.length === 0 ? <tr><td colSpan={7} className="px-5 py-14 text-center text-[var(--muted)]"><FileText size={24} className="mx-auto mb-2" />No completed reports found.</td></tr> : reports.map((report) => <tr key={report.id}><td className="px-5 py-4"><button type="button" onClick={() => toggle(report.id)} aria-label={`Select ${report.caseNumber}`}>{selected.includes(report.id) ? <CheckSquare size={16} className="text-[var(--primary)]" /> : <Square size={16} />}</button></td><td className="px-5 py-4"><Link href={`/company/bgv-cases/${report.id}`} className="font-mono text-[12px] text-[var(--primary)] hover:underline">{report.caseNumber}</Link></td><td className="px-5 py-4 font-medium">{report.candidate ? `${report.candidate.firstName} ${report.candidate.lastName}` : report.candidateId}</td><td className="px-5 py-4 text-[var(--muted)]">{report.client?.name || report.clientId}</td><td className="px-5 py-4 text-[var(--muted)]">{report.completedAt ? new Date(report.completedAt).toLocaleDateString() : '—'}</td><td className="px-5 py-4"><span className="rounded-full bg-[var(--surface-muted)] px-2.5 py-1 text-[11px]">{report.overallResult.replaceAll('_', ' ')}</span></td><td className="px-5 py-4 text-right"><div className="flex justify-end gap-2"><button type="button" onClick={() => void runReportAction(report, 'view')} disabled={!!action} className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] px-3 py-2 text-[12px] font-semibold disabled:opacity-50"><Eye size={14} />View</button><button type="button" onClick={() => void runReportAction(report, 'download')} disabled={!!action} className="inline-flex items-center gap-1.5 rounded-md bg-[var(--primary)] px-3 py-2 text-[12px] font-semibold text-[var(--primary-foreground)] disabled:opacity-50"><Download size={14} />Download</button></div></td></tr>)}</tbody></table></div></div>
  </div>;
}
