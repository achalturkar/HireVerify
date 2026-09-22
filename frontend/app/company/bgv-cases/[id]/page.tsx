'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Eye, FileDown, FilePlus2, ListChecks, Lock, Save, Unlock } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/src/auth/AuthProvider';
import { updateCandidate } from '@/src/lib/api/candidates';
import {
  ApiError, downloadBGVReport, getBGVCase, listVerifications, lockVerification,
  transitionBGVCase, updateBGVCaseChecks, updateBGVCaseMeta, updateVerificationResult,
} from '@/src/lib/api/bgv';
import type { BGVCase, BGVCaseStatus, VerificationCheck, VerificationStatus, VerificationType } from '@/src/types/bgv';
import FileUploadField from '@/src/components/layout/company/bgv/FileUploadField';

type TabKey = 'overview' | VerificationType;
const tabs: { key: TabKey; label: string }[] = [
  { key: 'overview', label: 'Candidate' }, { key: 'PAN', label: 'PAN' }, { key: 'IDENTITY', label: 'Identity' },
  { key: 'ADDRESS', label: 'Address' }, { key: 'ADDRESS_PHYSICAL', label: 'Address (Physical)' }, { key: 'UAN', label: 'UAN' },
  { key: 'EDUCATION', label: 'Education' }, { key: 'EMPLOYMENT', label: 'Employment' }, { key: 'GAP', label: 'Gap Check' }, { key: 'REFERENCE', label: 'Reference Check' }, { key: 'CV', label: 'CV Validation' }, { key: 'SOCIAL_MEDIA', label: 'Social Media' }, { key: 'COURT', label: 'Criminal Record' },
  { key: 'CIBIL', label: 'CIBIL' }, { key: 'TWENTY_SIX_AS', label: '26AS' }, { key: 'POLICE', label: 'Police Verification' }, { key: 'POLICE_RECORD', label: 'Police Record' },
];
const inputClass = 'w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-[13px] disabled:opacity-60';
const statuses: VerificationStatus[] = ['PENDING', 'QUEUED', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'RETRYING', 'CANCELLED'];
const outcomes = ['CLEAR', 'MINOR_DISCREPANCY', 'MAJOR_DISCREPANCY', 'UNABLE_TO_VERIFY', 'REQUIRES_REVIEW'];
const verificationModes = ['Physical', 'Digital', 'Online', 'Offline', 'Online (GPS)', 'EPFO Government Verification', 'Court Search', 'Document Review', 'Other'];
const editableCheckTypes: { type: VerificationType; label: string; provider: 'SUREPASS' | 'MANUAL' }[] = [
  { type: 'PAN', label: 'PAN', provider: 'SUREPASS' },
  { type: 'IDENTITY', label: 'Identity', provider: 'MANUAL' },
  { type: 'ADDRESS', label: 'Address', provider: 'MANUAL' },
  { type: 'ADDRESS_PHYSICAL', label: 'Address (Physical)', provider: 'MANUAL' },
  { type: 'UAN', label: 'UAN', provider: 'SUREPASS' },
  { type: 'EDUCATION', label: 'Education', provider: 'MANUAL' },
  { type: 'EMPLOYMENT', label: 'Employment', provider: 'MANUAL' },
  { type: 'GAP', label: 'Gap Check', provider: 'MANUAL' },
  { type: 'REFERENCE', label: 'Reference Check', provider: 'MANUAL' },
  { type: 'CV', label: 'CV Validation', provider: 'MANUAL' },
  { type: 'SOCIAL_MEDIA', label: 'Social Media', provider: 'MANUAL' },
  { type: 'COURT', label: 'Criminal record', provider: 'SUREPASS' },
  { type: 'CIBIL', label: 'CIBIL', provider: 'MANUAL' },
  { type: 'TWENTY_SIX_AS', label: '26AS', provider: 'MANUAL' },
  { type: 'POLICE', label: 'Police verification', provider: 'MANUAL' },
  { type: 'POLICE_RECORD', label: 'Police record', provider: 'MANUAL' },
];

export default function BGVCaseWorkspacePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { accessToken } = useAuth();
  const [caseData, setCaseData] = useState<BGVCase | null>(null);
  const [checks, setChecks] = useState<VerificationCheck[]>([]);
  const [tab, setTab] = useState<TabKey>('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reporting, setReporting] = useState(false);
  const [editingChecks, setEditingChecks] = useState(false);
  const [savingChecks, setSavingChecks] = useState(false);
  const [originalChecks, setOriginalChecks] = useState<VerificationCheck[]>([]);
  const [statusDraft, setStatusDraft] = useState<BGVCaseStatus>('DRAFT');
  const [savingStatus, setSavingStatus] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true); setError(null);
    try {
      const [loadedCase, loadedChecks] = await Promise.all([getBGVCase(id, accessToken), listVerifications(id, accessToken)]);
      setCaseData(loadedCase); setChecks(loadedChecks); setStatusDraft(loadedCase.status);
    } catch (err) { setError(err instanceof ApiError ? err.message : 'Failed to load case.'); }
    finally { setLoading(false); }
  }, [id, accessToken]);
  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  if (loading) return <div className="mx-auto max-w-5xl py-16 text-center text-[13px] text-[var(--muted)]">Loading case...</div>;
  if (error || !caseData) return <div className="mx-auto max-w-5xl py-16 text-center"><p className="mb-3 text-[13px] text-[#FF6B6B]">{error || 'Case not found.'}</p><button onClick={() => router.push('/company/bgv-cases')} className="text-[13px] text-[var(--primary)] underline">Back to cases</button></div>;
  const visibleTabs = tabs.filter((item) => item.key === 'overview' || checks.some((check) => check.type === item.key));
  const activeTab = visibleTabs.some((item) => item.key === tab) ? tab : 'overview';
  const selectedCheck = activeTab === 'overview' ? undefined : checks.find((check) => check.type === activeTab);
  const downloadReport = async () => { setReporting(true); try { const blob = await downloadBGVReport(caseData.id, accessToken); const candidateName = `${caseData.candidate?.firstName || ''}_${caseData.candidate?.lastName || ''}`.replace(/^_+|_+$/g, '').replace(/\s+/g, '_') || 'Candidate'; const fileName = `${caseData.caseNumber}_${candidateName}_BGV_FinalReport.pdf`; const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = fileName; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); } catch (err) { setError(err instanceof ApiError ? err.message : 'Could not generate report.'); } finally { setReporting(false); } };
  const viewReport = async () => { const reportWindow = window.open('', '_blank'); if (!reportWindow) { setError('Allow pop-ups to view the report.'); return; } setReporting(true); setError(null); try { const blob = await downloadBGVReport(caseData.id, accessToken); const url = URL.createObjectURL(blob); reportWindow.location.href = url; setTimeout(() => URL.revokeObjectURL(url), 60000); } catch (err) { reportWindow.close(); setError(err instanceof ApiError ? err.message : 'Could not open report.'); } finally { setReporting(false); } };
  const addToReport = () => router.push(`/company/reports?case=${encodeURIComponent(caseData.caseNumber)}`);
  const saveStatus = async () => {
    if (statusDraft === caseData.status) return;
    setSavingStatus(true); setError(null);
    try { setCaseData(await transitionBGVCase(caseData.id, statusDraft, caseData.remarks ?? undefined, accessToken)); }
    catch (err) { setStatusDraft(caseData.status); setError(err instanceof ApiError ? err.message : 'Could not update case status.'); }
    finally { setSavingStatus(false); }
  };
  const saveCheck = (updated: VerificationCheck) => setChecks((current) => current.map((check) => check.id === updated.id ? updated : check));
  const openChecksEditor = () => { setOriginalChecks(checks); setEditingChecks(true); };
  const cancelChecksEditor = () => { setChecks(originalChecks); setEditingChecks(false); };
  const toggleRequiredCheck = (type: VerificationType) => setChecks((current) => current.some((check) => check.type === type)
    ? current.filter((check) => check.type !== type)
    : [...current, { id: `new-${type}`, caseId: caseData.id, type, provider: editableCheckTypes.find((item) => item.type === type)?.provider || 'MANUAL', status: 'PENDING', result: 'PENDING', priority: 0, retryCount: 0 } as VerificationCheck]);
  const saveRequiredChecks = async () => {
    if (!checks.length) return setError('Select at least one verification check.');
    setSavingChecks(true); setError(null);
    try {
      const updated = await updateBGVCaseChecks(caseData.id, checks.map((check) => ({ type: check.type, provider: check.provider, priority: check.priority })), accessToken);
      setCaseData(updated); setChecks(updated.checks || []); setEditingChecks(false);
    } catch (err) { setError(err instanceof ApiError ? err.message : 'Could not update required checks.'); }
    finally { setSavingChecks(false); }
  };

  return <div className="mx-auto max-w-5xl space-y-6">
    <button onClick={() => router.push('/company/bgv-cases')} className="inline-flex items-center gap-1.5 text-[13px] text-[var(--muted)]"><ArrowLeft size={14} /> Back to cases</button>
    <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"><div><p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#3FDCC0]">{caseData.caseNumber}</p><h1 className="text-[20px] font-semibold">{caseData.candidate?.firstName} {caseData.candidate?.lastName}</h1><p className="text-[12.5px] text-[var(--muted)]">{caseData.client?.name}</p></div><div className="flex flex-wrap gap-2"><button onClick={() => editingChecks ? cancelChecksEditor() : openChecksEditor()} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3.5 py-2.5 text-[12.5px] font-semibold"><ListChecks size={14} />{editingChecks ? 'Close checks' : 'Edit checks'}</button><button onClick={addToReport} disabled={caseData.status !== 'COMPLETED'} title={caseData.status === 'COMPLETED' ? 'Add this case to reports' : 'Only completed cases can be added to reports'} className="inline-flex items-center gap-1.5 rounded-lg border border-[#3FDCC0]/50 bg-[#3FDCC0]/10 px-3.5 py-2.5 text-[12.5px] font-semibold text-[#147A68] transition-colors hover:bg-[#3FDCC0]/20 disabled:cursor-not-allowed disabled:opacity-45"><FilePlus2 size={14} />Add to report</button><button onClick={viewReport} disabled={reporting} title="View report" className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3.5 py-2.5 text-[12.5px] font-semibold disabled:opacity-50"><Eye size={14} />View report</button><button onClick={downloadReport} disabled={reporting} title="Download report" className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3.5 py-2.5 text-[12.5px] font-semibold text-[var(--primary-foreground)] disabled:opacity-50"><FileDown size={14} />{reporting ? 'Generating...' : 'Generate report'}</button></div></header>
    <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3"><div><p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Candidate status</p><p className="mt-1 text-[12px] text-[var(--muted)]">Update the case workflow status at any time.</p></div><div className="flex items-center gap-2"><select value={statusDraft} onChange={(event) => setStatusDraft(event.target.value as BGVCaseStatus)} className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-[12.5px] font-semibold">{['DRAFT', 'INITIATED', 'CONSENT_PENDING', 'IN_PROGRESS', 'UNDER_REVIEW', 'COMPLETED', 'ON_HOLD', 'CANCELLED'].map((value) => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}</select><button type="button" onClick={saveStatus} disabled={savingStatus || statusDraft === caseData.status} className="rounded-lg bg-[var(--primary)] px-3.5 py-2 text-[12.5px] font-semibold text-[var(--primary-foreground)] disabled:opacity-50">{savingStatus ? 'Updating...' : 'Update status'}</button></div></section>
    <nav className="flex gap-1 overflow-x-auto border-b border-[var(--border)]">{visibleTabs.map((item) => <button key={item.key} onClick={() => setTab(item.key)} className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-[13px] font-medium ${activeTab === item.key ? 'border-[var(--primary)] text-[var(--foreground)]' : 'border-transparent text-[var(--muted)]'}`}>{item.label}</button>)}</nav>
    {editingChecks && <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"><div className="mb-4"><h2 className="text-[15px] font-semibold">Required verification checks</h2><p className="mt-1 text-[12px] text-[var(--muted)]">Choose which checks belong to this case. Checks with saved work cannot be removed.</p></div><div className="grid gap-2 sm:grid-cols-5">{editableCheckTypes.map((item) => { const selected = checks.some((check) => check.type === item.type); const locked = checks.some((check) => check.type === item.type && (check.status !== 'PENDING' || check.resultData || check.remarks || check.documents?.length)); return <label key={item.type} className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-[12px] ${selected ? 'border-[#3FDCC0]/60 bg-[#3FDCC0]/10 text-[#3FDCC0]' : 'border-[var(--border)] text-[var(--muted)]'} ${locked ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}><input type="checkbox" checked={selected} disabled={locked} onChange={() => toggleRequiredCheck(item.type)} className="accent-[#0E8C78]" />{item.label}{locked && <Lock size={12} />}</label>; })}</div><div className="mt-4 flex justify-end gap-2"><button type="button" onClick={cancelChecksEditor} disabled={savingChecks} className="rounded-lg px-3.5 py-2.5 text-[12.5px] text-[var(--muted)]">Cancel</button><button type="button" onClick={saveRequiredChecks} disabled={savingChecks} className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-4 py-2.5 text-[12.5px] font-semibold text-[var(--primary-foreground)] disabled:opacity-50">{savingChecks ? 'Saving...' : 'Save checks'}</button></div></section>}
    {activeTab === 'overview' ? <CaseOverview caseData={caseData} token={accessToken} onSaved={setCaseData} /> : selectedCheck ? <VerificationEditor key={selectedCheck.id} check={selectedCheck} candidateId={caseData.candidateId} token={accessToken} onSaved={saveCheck} /> : <p className="text-[13px] text-[var(--muted)]">This verification is not included in this case.</p>}
  </div>;
}

const verifierOptions = ['Achal Turkar', 'Niraj Chaudhary', 'Prasanna Yadav', 'Suhas Birewar', 'Ruchita Narange', 'Neha Thakre', 'Prof. Pawar', 'Adv. Rishabh Vakharia', 'Nandini Deulkar'];

function Field({ label, value, onChange, disabled = false, type = 'text' }: { label: string; value: string; onChange?: (value: string) => void; disabled?: boolean; type?: string }) { const [manual, setManual] = useState(Boolean(value && !verifierOptions.includes(value))); return <label><span className="mb-1.5 block text-[12.5px] font-medium">{label}</span>{label === 'Verified by' ? <><select value={manual ? '__manual__' : value} disabled={disabled} onChange={(event) => { const selected = event.target.value; setManual(selected === '__manual__'); onChange?.(selected === '__manual__' ? '' : selected); }} className={inputClass}><option value="">Select verifier</option>{verifierOptions.map((name) => <option key={name} value={name}>{name}</option>)}<option value="__manual__">Other / enter manually</option></select>{manual && <input type="text" value={value} placeholder="Enter verifier name" disabled={disabled} onChange={(event) => onChange?.(event.target.value)} className={`${inputClass} mt-2`} />}</> : <input type={type} value={value} disabled={disabled} onChange={(event) => onChange?.(event.target.value)} className={inputClass} />}</label>; }
function TextArea({ label, value, onChange, disabled = false, rows = 3 }: { label: string; value: string; onChange?: (value: string) => void; disabled?: boolean; rows?: number }) { return <label className="block"><span className="mb-1.5 block text-[12.5px] font-medium">{label}</span><textarea value={value} disabled={disabled} rows={rows} onChange={(event) => onChange?.(event.target.value)} className={inputClass} /></label>; }

function CaseOverview({ caseData, token, onSaved }: { caseData: BGVCase; token: string | null; onSaved: (value: BGVCase) => void }) {
  const [form, setForm] = useState({ packageName: caseData.packageName || '', clientReference: caseData.clientReference || '', remarks: caseData.remarks || '', initiatedAt: caseData.initiatedAt?.slice(0, 10) || '', completedAt: caseData.completedAt?.slice(0, 10) || '', dateOfBirth: caseData.candidate?.dateOfBirth?.slice(0, 10) || '' });
  const [saving, setSaving] = useState(false); const [error, setError] = useState<string | null>(null);
  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const save = async () => { setSaving(true); setError(null); try { const updatedCandidate = caseData.candidate ? await updateCandidate(caseData.candidate.id, { dateOfBirth: form.dateOfBirth || null }, token) : null; const updated = await updateBGVCaseMeta(caseData.id, form, token); if (updatedCandidate) onSaved({ ...updated, candidate: { ...updated.candidate, ...updatedCandidate } }); else onSaved(updated); } catch (err) { setError(err instanceof ApiError ? err.message : 'Could not save case.'); } finally { setSaving(false); } };
  return <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"><h2 className="mb-4 text-[15px] font-semibold">Candidate information</h2>{error && <p className="mb-3 text-[13px] text-[#FF6B6B]">{error}</p>}<div className="grid gap-4 sm:grid-cols-2"><Field label="Candidate name" value={`${caseData.candidate?.firstName || ''} ${caseData.candidate?.lastName || ''}`} disabled /><Field label="Gender" value={caseData.candidate?.gender || ''} disabled /><Field label="Date of birth" type="date" value={form.dateOfBirth} onChange={(value) => update('dateOfBirth', value)} /><Field label="Email" value={caseData.candidate?.email || ''} disabled /><Field label="Phone" value={caseData.candidate?.phone || ''} disabled /><Field label="BVPL reference" value={caseData.caseNumber} disabled /><Field label="Client reference" value={form.clientReference} onChange={(value) => update('clientReference', value)} /><Field label="Entity / package" value={form.packageName} onChange={(value) => update('packageName', value)} /><Field label="Date initiated" type="date" value={form.initiatedAt} onChange={(value) => update('initiatedAt', value)} /><Field label="Date completed" type="date" value={form.completedAt} onChange={(value) => update('completedAt', value)} /></div><button onClick={save} disabled={saving} className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-4 py-2.5 text-[13px] font-semibold text-[var(--primary-foreground)] disabled:opacity-50"><Save size={14} />{saving ? 'Saving...' : 'Save case'}</button></section>;
}

const defaultRemarks: Record<VerificationType, string> = {
  PAN: 'PAN verified successfully.',
  UAN: 'UAN verified successfully.',
  COURT: 'Court record verification completed successfully.',
  IDENTITY: 'Identity documents verified successfully.',
  ADDRESS: 'Address verified successfully.',
  ADDRESS_PHYSICAL: 'Physical address verification completed successfully.',
  EDUCATION: 'Education documents verified successfully.',
  EMPLOYMENT: 'Employment documents verified successfully.',
  GAP: 'Employment gap verification completed successfully.',
  REFERENCE: 'Reference verification completed successfully.',
  CV: 'CV validation completed successfully.',
  SOCIAL_MEDIA: 'Social media review completed successfully.',
  DOCUMENT: 'Document verified successfully.',
  DOCUMENT_FORGERY: 'Document authenticity verified successfully.',
  CIBIL: 'CIBIL verification completed successfully.',
  TWENTY_SIX_AS: '26AS verification completed successfully.',
  POLICE: 'Police verification completed successfully.',
  POLICE_RECORD: 'Police record verification completed successfully.',
};

const initialData = (check: VerificationCheck) => { const value = check.resultData && typeof check.resultData === 'object' ? check.resultData as Record<string, unknown> : {}; return { ...value, verifierName: String(value.verifierName || value.verifiedBy || ''), remarks: String(value.remarks || check.remarks || defaultRemarks[check.type]), outcome: String(value.outcome || value.status || (check.result === 'VERIFIED' ? 'CLEAR' : '')) }; };

function VerificationEditor({ check, candidateId, token, onSaved }: { check: VerificationCheck; candidateId: string; token: string | null; onSaved: (value: VerificationCheck) => void }) {
  const initialFormData = initialData(check);
  const [data, setData] = useState<Record<string, unknown>>(initialFormData); const [savedData, setSavedData] = useState<Record<string, unknown>>(initialFormData); const [status, setStatus] = useState(check.status); const [savedStatus, setSavedStatus] = useState(check.status); const [saving, setSaving] = useState(false); const [locking, setLocking] = useState(false); const [error, setError] = useState<string | null>(null);
  const set = (key: string, value: string) => setData((current) => ({ ...current, [key]: value }));
  const text = (key: string) => String(data[key] || '');
  const hasUnsavedChanges = status !== savedStatus || JSON.stringify(data) !== JSON.stringify(savedData);
  const save = async () => { setSaving(true); setError(null); try { const outcome = text('outcome'); const updated = await updateVerificationResult(check.id, { status, result: outcome === 'CLEAR' ? 'VERIFIED' : outcome === 'UNABLE_TO_VERIFY' ? 'UNABLE_TO_VERIFY' : outcome === 'MAJOR_DISCREPANCY' ? 'REQUIRES_REVIEW' : outcome === 'MINOR_DISCREPANCY' ? 'REQUIRES_REVIEW' : undefined, resultData: data, remarks: text('remarks') }, token); setSavedData(data); setSavedStatus(status); onSaved(updated); } catch (err) { setError(err instanceof ApiError ? err.message : 'Could not save verification.'); } finally { setSaving(false); } };
  const toggleLock = async () => { setLocking(true); try { onSaved(await lockVerification(check.id, !check.isLocked, token)); } catch (err) { setError(err instanceof ApiError ? err.message : 'Could not update lock.'); } finally { setLocking(false); } };
  const locked = !!check.isLocked;
  const common = <><Field label="Verified by" value={text('verifierName')} onChange={(value) => set('verifierName', value)} disabled={locked} /><label><span className="mb-1.5 block text-[12.5px] font-medium">Mode of verification</span><select value={text('modeOfVerification')} disabled={locked} onChange={(event) => set('modeOfVerification', event.target.value)} className={inputClass}><option value="">Select mode</option>{verificationModes.map((value) => <option key={value} value={value}>{value}</option>)}</select></label><label><span className="mb-1.5 block text-[12.5px] font-medium">Processing status</span><select value={status} disabled={locked} onChange={(event) => setStatus(event.target.value as VerificationStatus)} className={inputClass}>{statuses.map((value) => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}</select></label><label><span className="mb-1.5 block text-[12.5px] font-medium">Verification status</span><select value={text('outcome')} disabled={locked} onChange={(event) => set('outcome', event.target.value)} className={inputClass}><option value="">Select status</option>{outcomes.map((value) => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}</select></label></>;
  return <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"><div className="mb-4 flex items-center justify-between"><h2 className="text-[15px] font-semibold">{check.type.replaceAll('_', ' ')} verification</h2><span className="text-[12px] text-[var(--muted)]">{locked ? 'Locked' : 'Editable'}</span></div>{hasUnsavedChanges && <p className="mb-3 rounded-md border border-[#FF6B6B]/30 bg-[#FF6B6B]/10 px-3 py-2 text-[12.5px] font-medium text-[#FF6B6B]">Unsaved changes</p>}{error && <p className="mb-3 text-[13px] text-[#FF6B6B]">{error}</p>}<div className="grid gap-4 sm:grid-cols-2">{common}{check.type === 'IDENTITY' && <Field label="Aadhaar card number" value={text('aadhaarNumber')} onChange={(value) => set('aadhaarNumber', value)} disabled={locked} />}{(check.type === 'ADDRESS' || check.type === 'ADDRESS_PHYSICAL') && <><TextArea label={check.type === 'ADDRESS_PHYSICAL' ? 'Physical address visited' : 'Current address'} value={text('currentAddress')} onChange={(value) => set('currentAddress', value)} disabled={locked} /><TextArea label={check.type === 'ADDRESS_PHYSICAL' ? 'Visit findings' : 'Permanent address (PAN card)'} value={text('permanentAddress')} onChange={(value) => set('permanentAddress', value)} disabled={locked} /></>}{check.type === 'UAN' && <Field label="UAN number" value={text('uanNumber') || text('uan')} onChange={(value) => set('uanNumber', value)} disabled={locked} />}{check.type === 'COURT' && <><Field label="Civil proceedings" value={text('civilProceedings')} onChange={(value) => set('civilProceedings', value)} disabled={locked} /><Field label="Criminal proceedings" value={text('criminalProceedings')} onChange={(value) => set('criminalProceedings', value)} disabled={locked} /></>}{check.type === 'EMPLOYMENT' && <RepeatableEntries data={data} setData={setData} disabled={locked} kind="Employment" />}{check.type === 'EDUCATION' && <RepeatableEntries data={data} setData={setData} disabled={locked} kind="Education" />}{['GAP', 'REFERENCE', 'CV', 'SOCIAL_MEDIA', 'CIBIL', 'TWENTY_SIX_AS', 'POLICE', 'POLICE_RECORD'].includes(check.type) && <DynamicCheckFields type={check.type} data={data} set={set} disabled={locked} />}<div className="sm:col-span-2"><TextArea label="Remarks" value={text('remarks')} onChange={(value) => set('remarks', value)} disabled={locked} /></div></div><FileUploadField check={check} candidateId={candidateId} token={token} onSaved={onSaved} /><div className="mt-4 flex gap-2"><button onClick={toggleLock} disabled={locking} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3.5 py-2.5 text-[12.5px] font-semibold disabled:opacity-50">{locked ? <Unlock size={14} /> : <Lock size={14} />}{locked ? 'Unlock section' : 'Lock section'}</button><button onClick={save} disabled={saving || locked} className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-4 py-2.5 text-[13px] font-semibold text-[var(--primary-foreground)] disabled:opacity-50"><Save size={14} />{saving ? 'Saving...' : 'Save verification'}</button></div></section>;
}

const dynamicFields: Partial<Record<VerificationType, { key: string; label: string }[]>> = {
  GAP: [{ key: 'gapFrom', label: 'Gap from' }, { key: 'gapTo', label: 'Gap to' }, { key: 'gapReason', label: 'Gap reason' }],
  REFERENCE: [{ key: 'refereeName', label: 'Referee name' }, { key: 'relationship', label: 'Relationship' }, { key: 'contact', label: 'Contact' }],
  CV: [{ key: 'candidateName', label: 'Candidate name on CV' }, { key: 'cvReference', label: 'CV reference' }],
  SOCIAL_MEDIA: [{ key: 'platform', label: 'Platform' }, { key: 'profileUrl', label: 'Profile URL' }],
  CIBIL: [{ key: 'creditScore', label: 'Credit score' }],
  TWENTY_SIX_AS: [{ key: 'assessmentYear', label: 'Assessment year' }],
  POLICE: [{ key: 'policeStation', label: 'Police station' }],
  POLICE_RECORD: [{ key: 'policeStation', label: 'Police station' }, { key: 'policeReportNumber', label: 'Police report number' }],
};

function DynamicCheckFields({ type, data, set, disabled }: { type: VerificationType; data: Record<string, unknown>; set: (key: string, value: string) => void; disabled: boolean }) {
  return <>{(dynamicFields[type] || []).map((field) => <Field key={field.key} label={field.label} value={String(data[field.key] || '')} onChange={(value) => set(field.key, value)} disabled={disabled} type={field.key.endsWith('From') || field.key.endsWith('To') ? 'date' : 'text'} />)}</>;
}

function RepeatableEntries({ data, setData, disabled, kind }: { data: Record<string, unknown>; setData: (value: Record<string, unknown>) => void; disabled: boolean; kind: 'Employment' | 'Education' }) {
  const entries = Array.isArray(data.entries) ? data.entries as Record<string, string>[] : [{}];
  const fields = kind === 'Employment' ? ['companyName', 'designation', 'employeeId', 'periodFrom', 'periodTo', 'reasonForLeaving'] : ['educationType', 'qualification', 'institute', 'yearOfPassing', 'boardOrUniversity', 'percentage'];
  const update = (index: number, key: string, value: string) => setData({ ...data, entries: entries.map((entry, entryIndex) => entryIndex === index ? { ...entry, [key]: value } : entry) });
  return <div className="sm:col-span-2 space-y-4"><div className="flex items-center justify-between"><h3 className="text-[13px] font-semibold">{kind} records</h3><button type="button" disabled={disabled} onClick={() => setData({ ...data, entries: [...entries, {}] })} className="rounded-lg bg-[var(--primary)] px-3 py-2 text-[12px] font-semibold text-[var(--primary-foreground)]">Add {kind}</button></div>{entries.map((entry, index) => <div key={index} className="rounded-xl border border-[var(--border)] p-4"><div className="mb-3 flex items-center justify-between"><h4 className="text-[13px] font-semibold">{kind} #{index + 1}</h4>{entries.length > 1 && <button type="button" disabled={disabled} onClick={() => setData({ ...data, entries: entries.filter((_, entryIndex) => entryIndex !== index) })} className="text-[12px] text-[#FF6B6B]">Remove</button>}</div><div className="grid gap-3 sm:grid-cols-2">{fields.map((field) => <Field key={field} label={field.replaceAll(/([A-Z])/g, ' $1')} value={entry[field] || ''} onChange={(value) => update(index, field, value)} disabled={disabled} type={field.toLowerCase().includes('period') ? 'date' : 'text'} />)}</div></div>)}</div>;
}