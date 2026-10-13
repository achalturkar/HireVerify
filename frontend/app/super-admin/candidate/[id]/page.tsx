'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Save } from 'lucide-react';
import { useAuth } from '@/src/auth/AuthProvider';
import { getPlatformCandidate, updatePlatformCandidate, type PlatformCandidateDetail } from '@/src/lib/api/platform-candidates';
import type { Candidate, CandidateStatus } from '@/src/types/candidate';

type CandidateField = Exclude<keyof Candidate, 'id' | 'companyId' | 'clientId' | 'client' | 'candidateCode' | 'createdById' | 'updatedById' | 'createdAt' | 'updatedAt' | 'status' | 'bgvCaseCount' | 'portalInvitation'>;
type FormValues = Record<CandidateField, string>;
type CandidateTab = 'overview' | 'personal' | 'family' | 'identity' | 'education' | 'employment' | 'addresses' | 'documents';
type FieldSpec = { key: CandidateField; label: string; type?: 'text' | 'email' | 'date' | 'number' | 'textarea' };

const fields: Record<Exclude<CandidateTab, 'overview' | 'documents'>, FieldSpec[]> = {
  personal: [
    { key: 'firstName', label: 'First name' }, { key: 'lastName', label: 'Last name' },
    { key: 'email', label: 'Email', type: 'email' }, { key: 'phone', label: 'Phone' },
    { key: 'dateOfBirth', label: 'Date of birth', type: 'date' }, { key: 'gender', label: 'Gender' },
  ],
  family: [{ key: 'fatherName', label: "Father's name" }, { key: 'motherName', label: "Mother's name" }],
  identity: [
    { key: 'aadhaarNumber', label: 'Aadhaar number' }, { key: 'panNumber', label: 'PAN number' },
    { key: 'uanNumber', label: 'UAN number' }, { key: 'passportNumber', label: 'Passport number' },
    { key: 'drivingLicenseNumber', label: 'Driving licence number' }, { key: 'voterIdNumber', label: 'Voter ID' },
  ],
  education: [
    { key: 'highestQualification', label: 'Highest qualification' }, { key: 'courseName', label: 'Course or degree' },
    { key: 'institutionName', label: 'College or school' }, { key: 'universityName', label: 'University or board' },
    { key: 'yearOfPassing', label: 'Year of passing', type: 'number' }, { key: 'gradeOrPercentage', label: 'Percentage or CGPA' },
  ],
  employment: [
    { key: 'currentEmployer', label: 'Current employer' }, { key: 'employeeId', label: 'Employee ID' },
    { key: 'employeeDesignation', label: 'Designation' }, { key: 'employeeDepartment', label: 'Department' },
    { key: 'employmentType', label: 'Employment type' }, { key: 'joiningDate', label: 'Joining date', type: 'date' },
    { key: 'workLocation', label: 'Work location' },
  ],
  addresses: [
    { key: 'currentAddress', label: 'Current address', type: 'textarea' },
    { key: 'permanentAddress', label: 'Permanent address', type: 'textarea' },
  ],
};

const TABS: { id: CandidateTab; label: string }[] = [
  { id: 'overview', label: 'Overview' }, { id: 'personal', label: 'Personal' }, { id: 'family', label: 'Family' },
  { id: 'identity', label: 'Identity' }, { id: 'education', label: 'Education' }, { id: 'employment', label: 'Employment' },
  { id: 'addresses', label: 'Addresses' }, { id: 'documents', label: 'Documents' },
];
const STATUSES: CandidateStatus[] = ['PENDING', 'INVITED', 'IN_PROGRESS', 'VERIFICATION_IN_PROGRESS', 'COMPLETED', 'WITHDRAWN', 'ON_HOLD'];
const inputClass = 'mt-1.5 w-full rounded-lg border border-white/10 bg-[#0F1430] px-3 py-2.5 text-[13px] text-white';

function draftFrom(candidate: Candidate): FormValues {
  const keys = Object.values(fields).flat().map(({ key }) => key);
  return Object.fromEntries(keys.map((key) => [
    key,
    ['dateOfBirth', 'joiningDate'].includes(key) ? String(candidate[key] || '').slice(0, 10) : String(candidate[key] ?? ''),
  ])) as FormValues;
}

export default function SuperAdminCandidateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { accessToken } = useAuth();
  const [candidate, setCandidate] = useState<PlatformCandidateDetail | null>(null);
  const [values, setValues] = useState<FormValues | null>(null);
  const [status, setStatus] = useState<CandidateStatus>('PENDING');
  const [activeTab, setActiveTab] = useState<CandidateTab>('overview');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await getPlatformCandidate(id, accessToken);
      setCandidate(result);
      setValues(draftFrom(result));
      setStatus(result.status);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load this candidate.');
    } finally {
      setLoading(false);
    }
  }, [accessToken, id]);

  useEffect(() => {
    const task = Promise.resolve().then(load);
    return () => { void task; };
  }, [load]);

  const save = async () => {
    if (!values) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const payload = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value.trim() || null]));
      const updated = await updatePlatformCandidate(id, { ...payload, status }, accessToken);
      setCandidate(updated);
      setValues(draftFrom(updated));
      setStatus(updated.status);
      setNotice('Candidate details saved.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save candidate details.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="py-12 text-center text-sm text-[#8891B8]">Loading candidate…</p>;
  if (!candidate || !values) return <section className="rounded-xl border border-white/10 bg-[#161C3A] p-5"><p role="alert" className="text-sm text-rose-300">{error || 'Candidate not found.'}</p><Link href="/super-admin/candidate" className="mt-4 inline-flex items-center gap-2 text-sm text-[var(--primary)]"><ArrowLeft size={15} />Candidates</Link></section>;

  return (
    <main className="mx-auto max-w-6xl space-y-5 text-white">
      <Link href="/super-admin/candidate" className="inline-flex items-center gap-2 text-[12px] text-[#8891B8] hover:text-white"><ArrowLeft size={15} />Candidate directory</Link>
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/[0.08] bg-[#161C3A] p-5">
        <div><p className="font-mono text-[10px] text-[#8891B8]">{candidate.candidateCode}</p><h1 className="mt-1 text-xl font-semibold">{values.firstName} {values.lastName}</h1><p className="mt-1 text-[12px] text-[#8891B8]">{candidate.client?.name || 'Client'} · {candidate.email || 'No email'}</p></div>
        <button type="button" onClick={() => void save()} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2.5 text-[12px] font-semibold text-[var(--primary-foreground)] disabled:opacity-50"><Save size={14} />{saving ? 'Saving…' : 'Save all changes'}</button>
      </header>
      {error && <p role="alert" className="rounded-lg border border-rose-500/20 bg-rose-500/5 px-4 py-3 text-[12px] text-rose-300">{error}</p>}
      {notice && <p role="status" className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-[12px] text-emerald-300">{notice}</p>}
      <nav className="flex gap-1 overflow-x-auto rounded-xl border border-white/[0.08] bg-[#161C3A] p-1" aria-label="Candidate sections">
        {TABS.map((tab) => <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} aria-current={activeTab === tab.id ? 'page' : undefined} className={`shrink-0 rounded-lg px-3 py-2.5 text-[11px] font-semibold ${activeTab === tab.id ? 'bg-[var(--primary)] text-[var(--primary-foreground)]' : 'text-[#8891B8] hover:bg-white/[0.05] hover:text-white'}`}>{tab.label}</button>)}
      </nav>
      {activeTab === 'overview' && (
        <section className="grid gap-4 rounded-2xl border border-white/[0.08] bg-[#161C3A] p-5 sm:grid-cols-2">
          <div><p className="text-[10px] uppercase text-[#8891B8]">Company</p><p className="mt-1 text-[13px]">{candidate.company.name} {candidate.company.shortCode ? `(${candidate.company.shortCode})` : ''}</p></div>
          <div><p className="text-[10px] uppercase text-[#8891B8]">Client</p><p className="mt-1 text-[13px]">{candidate.client?.name || '—'}</p></div>
          <label className="text-[10px] uppercase text-[#8891B8]">Status<select value={status} onChange={(event) => setStatus(event.target.value as CandidateStatus)} className={inputClass}>{STATUSES.map((item) => <option key={item} value={item}>{item.replaceAll('_', ' ')}</option>)}</select></label>
          <div><p className="text-[10px] uppercase text-[#8891B8]">Created</p><p className="mt-1 text-[13px]">{new Date(candidate.createdAt).toLocaleString()}</p></div>
        </section>
      )}
      {activeTab !== 'overview' && activeTab !== 'documents' && (
        <section className="rounded-2xl border border-white/[0.08] bg-[#161C3A] p-5">
          <h2 className="text-[14px] font-semibold">{TABS.find(({ id: tabId }) => tabId === activeTab)?.label} details</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {fields[activeTab].map(({ key, label, type = 'text' }) => <label key={key} className={`text-[11px] text-[#8891B8] ${type === 'textarea' ? 'sm:col-span-2 lg:col-span-3' : ''}`}>{label}
              {type === 'textarea' ? <textarea rows={3} value={values[key]} onChange={(event) => setValues((current) => current ? { ...current, [key]: event.target.value } : current)} className={inputClass} />
                : <input type={type} value={values[key]} onChange={(event) => setValues((current) => current ? { ...current, [key]: event.target.value } : current)} className={inputClass} />}
            </label>)}
          </div>
        </section>
      )}
      {activeTab === 'documents' && <section className="rounded-2xl border border-white/[0.08] bg-[#161C3A] p-5"><h2 className="text-[14px] font-semibold">Candidate documents</h2><p className="mt-1 text-[11px] text-[#8891B8]">Documents are reviewed and managed from the verification workflow.</p>{candidate.documents?.length ? <ul className="mt-4 divide-y divide-white/[0.08]">{candidate.documents.map((document) => <li key={document.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-[12px]"><span>{document.documentType?.replaceAll('_', ' ')} · {document.fileName}</span><span>{document.verificationStatus?.replaceAll('_', ' ')}</span><a href={document.fileUrl} target="_blank" rel="noreferrer" className="text-[var(--primary)] hover:underline">Open</a></li>)}</ul> : <p className="mt-4 text-[12px] text-[#8891B8]">No uploaded documents.</p>}</section>}
    </main>
  );
}
