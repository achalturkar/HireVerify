'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock3, FileCheck2, Loader2, RefreshCw, Search, ShieldCheck, XCircle } from 'lucide-react';
import { useAuth } from '@/src/auth/AuthProvider';
import { createVerification, downloadVerificationPdf, executePan, listBGVCases, listVerifications, retryVerification, ApiError } from '@/src/lib/api/bgv';
import type { BGVCase, VerificationCheck, VerificationStatus, VerificationType } from '@/src/types/bgv';

const tabs: { type: VerificationType | ''; label: string }[] = [
  { type: '', label: 'All checks' },
  { type: 'PAN', label: 'PAN check' },
  { type: 'UAN', label: 'UAN check' },
  { type: 'COURT', label: 'Court check' },
  { type: 'IDENTITY', label: 'Identity' },
  { type: 'ADDRESS', label: 'Address' },
  { type: 'ADDRESS_PHYSICAL', label: 'Address (Physical)' },
  { type: 'EDUCATION', label: 'Education' },
  { type: 'EMPLOYMENT', label: 'Employment' },
  { type: 'GAP', label: 'Gap Check' },
  { type: 'REFERENCE', label: 'Reference Check' },
  { type: 'CV', label: 'CV Validation' },
  { type: 'SOCIAL_MEDIA', label: 'Social Media' },
  { type: 'DOCUMENT', label: 'Documents' },
  { type: 'DOCUMENT_FORGERY', label: 'Forgery' },
  { type: 'CIBIL', label: 'CIBIL' },
  { type: 'TWENTY_SIX_AS', label: '26AS' },
  { type: 'POLICE', label: 'Police' },
  { type: 'POLICE_RECORD', label: 'Police Record' },
];

const formFields: Partial<Record<VerificationType, { key: string; label: string; placeholder: string }[]>> = {
  UAN: [{ key: 'uan', label: 'UAN number', placeholder: '12 digit UAN number' }],
  COURT: [{ key: 'name', label: 'Candidate name', placeholder: 'Full legal name' }, { key: 'state', label: 'State', placeholder: 'State or jurisdiction' }, { key: 'dob', label: 'Date of birth', placeholder: 'YYYY-MM-DD' }],
  IDENTITY: [{ key: 'documentNumber', label: 'Document number', placeholder: 'Government ID number' }, { key: 'documentType', label: 'Document type', placeholder: 'Aadhaar, passport, driving license...' }],
  ADDRESS: [{ key: 'address', label: 'Address to verify', placeholder: 'Complete address' }],
  ADDRESS_PHYSICAL: [{ key: 'address', label: 'Address to visit', placeholder: 'Complete physical address' }],
  EDUCATION: [{ key: 'institution', label: 'Institution', placeholder: 'College or university' }, { key: 'qualification', label: 'Qualification', placeholder: 'Degree or certification' }],
  EMPLOYMENT: [{ key: 'employer', label: 'Employer', placeholder: 'Company name' }, { key: 'employeeId', label: 'Employee ID', placeholder: 'Employee reference' }],
  GAP: [{ key: 'gapFrom', label: 'Gap from', placeholder: 'YYYY-MM-DD' }, { key: 'gapTo', label: 'Gap to', placeholder: 'YYYY-MM-DD' }, { key: 'gapReason', label: 'Gap reason', placeholder: 'Reason for employment gap' }],
  REFERENCE: [{ key: 'refereeName', label: 'Referee name', placeholder: 'Reference contact name' }, { key: 'relationship', label: 'Relationship', placeholder: 'Manager, colleague, client...' }, { key: 'contact', label: 'Contact', placeholder: 'Phone or email' }],
  CV: [{ key: 'candidateName', label: 'Candidate name', placeholder: 'Name shown on CV' }, { key: 'cvReference', label: 'CV reference', placeholder: 'Uploaded document or file reference' }],
  SOCIAL_MEDIA: [{ key: 'platform', label: 'Platform', placeholder: 'LinkedIn, X, Facebook...' }, { key: 'profileUrl', label: 'Profile URL', placeholder: 'Public profile URL' }],
  DOCUMENT: [{ key: 'documentType', label: 'Document type', placeholder: 'Select or enter document type' }, { key: 'documentNumber', label: 'Document number', placeholder: 'Document reference' }],
  DOCUMENT_FORGERY: [{ key: 'documentType', label: 'Document type', placeholder: 'PAN, Aadhaar, passport...' }, { key: 'documentUrl', label: 'Private document reference', placeholder: 'Upload through document workflow' }],
  CIBIL: [{ key: 'creditScore', label: 'Credit score', placeholder: 'Score or report reference' }],
  TWENTY_SIX_AS: [{ key: 'assessmentYear', label: 'Assessment year', placeholder: '2025-26' }],
  POLICE: [{ key: 'policeStation', label: 'Police station', placeholder: 'Police station name' }],
  POLICE_RECORD: [{ key: 'name', label: 'Candidate name', placeholder: 'Full legal name' }, { key: 'state', label: 'State', placeholder: 'State or jurisdiction' }, { key: 'policeStation', label: 'Police station', placeholder: 'Police station name' }],
};

const statusStyle: Record<VerificationStatus, string> = {
  PENDING: 'text-[var(--muted)]', QUEUED: 'text-[#F2AE55]', IN_PROGRESS: 'text-[#F2AE55]', COMPLETED: 'text-[var(--primary)]', FAILED: 'text-[#FF6B6B]', RETRYING: 'text-[#F2AE55]', CANCELLED: 'text-[var(--muted)]',
};

function StatusIcon({ status }: { status: VerificationStatus }) {
  if (status === 'COMPLETED') return <CheckCircle2 size={15} />;
  if (status === 'FAILED' || status === 'CANCELLED') return <XCircle size={15} />;
  return <Clock3 size={15} />;
}

export default function VerificationsPage() {
  const { accessToken } = useAuth();
  const [cases, setCases] = useState<BGVCase[]>([]);
  const [caseId, setCaseId] = useState('');
  const [checks, setChecks] = useState<VerificationCheck[]>([]);
  const [activeType, setActiveType] = useState<VerificationType | ''>('');
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pan, setPan] = useState('');
  const [panCheck, setPanCheck] = useState<VerificationCheck | null>(null);
  const [panLoading, setPanLoading] = useState(false);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [queueLoading, setQueueLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [apiVersion, setApiVersion] = useState('v1');

  useEffect(() => {
    listBGVCases({ page: 1, limit: 200 }, accessToken)
      .then((result) => setCases(result.items))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load BGV cases.'));
  }, [accessToken]);

  useEffect(() => {
    const loadingTask = Promise.resolve().then(() => setLoading(true));
    listVerifications(caseId || undefined, accessToken)
      .then(setChecks)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load verification checks.'))
      .finally(() => setLoading(false));
    return () => { void loadingTask; };
  }, [accessToken, caseId]);

  const counts = useMemo(() => checks.reduce<Record<string, number>>((result, check) => { result[check.type] = (result[check.type] || 0) + 1; return result; }, {}), [checks]);
  const caseMap = useMemo(() => new Map(cases.map((item) => [item.id, item])), [cases]);
  const visibleChecks = (activeType ? checks.filter((check) => check.type === activeType) : checks).filter((check) => {
    const candidate = caseMap.get(check.caseId)?.candidate;
    const haystack = JSON.stringify({ check, candidate }).toLowerCase();
    return !search.trim() || haystack.includes(search.trim().toLowerCase());
  });

  const handleRetry = async (check: VerificationCheck) => {
    setRetrying(check.id); setError(null);
    try { const updated = await retryVerification(check.id, accessToken); setChecks((current) => current.map((item) => item.id === updated.id ? updated : item)); }
    catch (err) { setError(err instanceof ApiError ? err.message : 'Could not retry verification.'); }
    finally { setRetrying(null); }
  };

  const handlePanVerify = async () => {
    const normalizedPan = pan.trim().toUpperCase();
    if (!caseId) return setError('Select a BGV case before verifying PAN.');
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(normalizedPan)) return setError('Enter a valid PAN number.');
    setPanLoading(true); setError(null);
    try {
      const check = await createVerification({ caseId, type: 'PAN', provider: 'SUREPASS', inputData: { apiVersion } }, accessToken);
      const result = await executePan(check.id, normalizedPan, accessToken);
      setPanCheck(result); setChecks((current) => [result, ...current.filter((item) => item.id !== result.id)]);
    } catch (err) { setError(err instanceof ApiError ? err.message : 'PAN verification failed.'); }
    finally { setPanLoading(false); }
  };

  const handlePanPdf = async () => {
    if (!panCheck) return;
    const blob = await downloadVerificationPdf(panCheck.id, accessToken);
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `PAN-verification-${panCheck.id}.pdf`; anchor.click(); URL.revokeObjectURL(url);
  };

  const handleQueueCheck = async () => {
    if (!activeType || activeType === 'PAN') return;
    if (!caseId) return setError('Select a BGV case before creating a verification check.');
    const requiredFields = formFields[activeType] || [];
    const missing = requiredFields.find((field) => !formData[field.key]?.trim());
    if (missing) return setError(`${missing.label} is required.`);
    setQueueLoading(true); setError(null);
    try {
      const check = await createVerification({ caseId, type: activeType, provider: activeType === 'COURT' || activeType === 'UAN' ? 'SUREPASS' : 'MANUAL', inputData: formData }, accessToken);
      setChecks((current) => [check, ...current]);
      setFormData({});
    } catch (err) { setError(err instanceof ApiError ? err.message : 'Could not create verification check.'); }
    finally { setQueueLoading(false); }
  };

  return <div className="mx-auto max-w-6xl space-y-6"><div><p className="text-[11px] uppercase tracking-[0.14em] text-[var(--primary)]">Company admin</p><h1 className="text-[26px] font-semibold">Verification Checks</h1><p className="mt-1 text-[13px] text-[var(--muted)]">Run provider checks, inspect normalized outcomes, and find previous candidate responses.</p></div>
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center"><label className="text-[12px] text-[var(--muted)]">BGV case<select value={caseId} onChange={(event) => setCaseId(event.target.value)} className="mt-1 block w-full min-w-72 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-[13px] text-[var(--foreground)]"><option value="">All cases</option>{cases.map((item) => <option key={item.id} value={item.id}>{item.caseNumber} {item.candidate ? `- ${item.candidate.firstName} ${item.candidate.lastName}` : ''}</option>)}</select></label><div className="text-[12px] text-[var(--muted)] sm:ml-auto">{checks.length} total checks</div></div>
    <div className="flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:flex-row sm:items-center"><label className="relative flex-1"><span className="sr-only">Search previous candidate JSON</span><Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search candidate, case, PAN result, or JSON response" className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] py-2.5 pl-9 pr-3 text-[13px] text-[var(--foreground)] outline-none focus:border-[var(--primary)]" /></label><p className="text-[12px] text-[var(--muted)]">{visibleChecks.length} matching saved response{visibleChecks.length === 1 ? '' : 's'}</p></div>
    <div className="overflow-x-auto border-b border-[var(--border)]"><div className="flex min-w-max gap-1">{tabs.map((tab) => <button key={tab.type || 'all'} type="button" onClick={() => setActiveType(tab.type)} className={`rounded-t-lg px-3.5 py-2.5 text-[12px] font-medium transition-colors ${activeType === tab.type ? 'border-b-2 border-[var(--primary)] text-[var(--primary)]' : 'text-[var(--muted)] hover:bg-[var(--surface-muted)]'}`}>{tab.label}<span className="ml-2 rounded-full bg-[var(--surface-muted)] px-1.5 py-0.5 text-[10px]">{tab.type ? counts[tab.type] || 0 : checks.length}</span></button>)}</div></div>
    {error && <div className="rounded-lg border border-[#FF6B6B]/25 bg-[#FF6B6B]/10 px-4 py-3 text-[13px] text-[#FF6B6B]">{error}</div>}
    {activeType === 'PAN' && <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"><div className="mb-4 flex items-center gap-2"><ShieldCheck size={18} className="text-[var(--primary)]" /><div><h2 className="text-[15px] font-semibold">PAN verification</h2><p className="text-[12px] text-[var(--muted)]">Input, send to Surepass, normalize the response, and generate a report.</p></div></div><div className="grid gap-3 sm:grid-cols-[1fr_140px_auto_auto] sm:items-end"><label className="text-[12px] text-[var(--muted)]">PAN number<input value={pan} onChange={(event) => setPan(event.target.value.toUpperCase())} maxLength={10} placeholder="ABCDE1234F" className="mt-1 block w-full rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2.5 text-[13px] uppercase text-[var(--foreground)]" /></label><label className="text-[12px] text-[var(--muted)]">API version<select value={apiVersion} onChange={(event) => setApiVersion(event.target.value)} className="mt-1 block w-full rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2.5 text-[13px] text-[var(--foreground)]"><option value="v1">v1</option></select></label><button type="button" onClick={handlePanVerify} disabled={panLoading || !caseId} className="inline-flex min-w-[130px] items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2.5 text-[13px] font-semibold text-white disabled:opacity-50">{panLoading && <Loader2 size={14} className="animate-spin" />}Verify</button>{panCheck && <button type="button" onClick={handlePanPdf} className="rounded-lg border border-[var(--border)] px-4 py-2.5 text-[13px] font-semibold">Generate PDF</button>}</div>{panCheck && <div className="mt-5 grid gap-4 lg:grid-cols-2"><div><p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">Normalized result: <span className={panCheck.result === 'VERIFIED' ? 'text-[var(--primary)]' : 'text-[#F2AE55]'}>{panCheck.result.replaceAll('_', ' ')}</span></p><div className="grid gap-3 sm:grid-cols-2">{Object.entries((panCheck.resultData || {}) as Record<string, unknown>).map(([key, value]) => <div key={key} className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-3"><p className="text-[10px] uppercase tracking-wider text-[var(--muted)]">{key.replaceAll('_', ' ')}</p><p className="mt-1 text-[13px] font-medium">{value === null || value === undefined ? 'Not available' : String(value)}</p></div>)}</div></div><pre className="max-h-64 overflow-auto rounded-lg bg-[#0B0F26] p-4 text-[11px] leading-5 text-[#C9D1F5]">{JSON.stringify(panCheck.rawResponse || { message: 'No raw provider response stored.' }, null, 2)}</pre></div>}</section>}
    {activeType && activeType !== 'PAN' && <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"><div className="mb-4 flex items-center gap-2"><FileCheck2 size={18} className="text-[var(--primary)]" /><div><h2 className="text-[15px] font-semibold">{tabs.find((tab) => tab.type === activeType)?.label}</h2><p className="text-[12px] text-[var(--muted)]">Enter the individual verification details to create a protected check for this case.</p></div></div><div className="grid gap-4 sm:grid-cols-2">{(formFields[activeType] || []).map((field) => <label key={field.key} className="text-[12px] text-[var(--muted)]">{field.label}<input value={formData[field.key] || ''} onChange={(event) => setFormData((current) => ({ ...current, [field.key]: event.target.value }))} placeholder={field.placeholder} className="mt-1 block w-full rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2.5 text-[13px] text-[var(--foreground)]" /></label>)}</div><div className="mt-4 flex justify-end"><button type="button" onClick={handleQueueCheck} disabled={queueLoading || !caseId} className="inline-flex min-w-[170px] items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2.5 text-[13px] font-semibold text-white disabled:opacity-50">{queueLoading && <Loader2 size={14} className="animate-spin" />}Create verification check</button></div></section>}
    <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]"><div className="overflow-x-auto"><table className="w-full text-left text-[13px]"><thead className="border-b border-[var(--border)] text-[11px] uppercase tracking-wider text-[var(--muted)]"><tr><th className="px-5 py-3">Check</th><th className="px-5 py-3">Case</th><th className="px-5 py-3">Provider</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Result</th><th className="px-5 py-3">Started</th><th className="px-5 py-3 text-right">Action</th></tr></thead><tbody className="divide-y divide-[var(--border)]">{loading ? <tr><td colSpan={7} className="px-5 py-12 text-center text-[var(--muted)]"><Loader2 size={18} className="mx-auto mb-2 animate-spin" />Loading checks...</td></tr> : visibleChecks.length === 0 ? <tr><td colSpan={7} className="px-5 py-12 text-center text-[var(--muted)]"><FileCheck2 size={24} className="mx-auto mb-2" />No checks in this tab.</td></tr> : visibleChecks.map((check) => <tr key={check.id}><td className="px-5 py-4"><span className="font-semibold">{check.type}</span><p className="text-[11px] text-[var(--muted)]">ID: {check.id.slice(0, 8)}</p></td><td className="px-5 py-4 font-mono text-[12px]">{caseMap.get(check.caseId)?.caseNumber ?? check.caseId.slice(0, 8)}</td><td className="px-5 py-4">{check.provider}</td><td className={`px-5 py-4 ${statusStyle[check.status]}`}><span className="inline-flex items-center gap-1.5"><StatusIcon status={check.status} />{check.status.replaceAll('_', ' ')}</span></td><td className="px-5 py-4">{check.result.replaceAll('_', ' ')}</td><td className="px-5 py-4 text-[var(--muted)]">{check.startedAt ? new Date(check.startedAt).toLocaleString() : 'Not started'}</td><td className="px-5 py-4 text-right">{(check.status === 'FAILED' || check.status === 'COMPLETED') && <button type="button" onClick={() => handleRetry(check)} disabled={retrying === check.id} className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] text-[var(--primary)] hover:bg-[var(--primary)]/10 disabled:opacity-50"><RefreshCw size={13} className={retrying === check.id ? 'animate-spin' : ''} />Retry</button>}</td></tr>)}</tbody></table></div></div>
  </div>;
}
