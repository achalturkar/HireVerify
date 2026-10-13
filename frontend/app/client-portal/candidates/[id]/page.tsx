'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, BriefcaseBusiness, Check, Copy, FileText, GraduationCap, Hash, Home, LayoutDashboard, Lock, Mail, Pencil, ShieldCheck, Unlock, Users, Save, X } from 'lucide-react';
import { useAuth } from '@/src/auth/AuthProvider';
import { ClientPortalApiError, getPortalCandidate, getPortalCandidateAccess, invitePortalCandidate, remindPortalCandidate, savePortalCandidate, setPortalCandidateAccess, type PortalCandidateAccess, type PortalCandidateDetail } from '@/src/lib/api/client-portal';
import { hasPortalPermission } from '@/src/lib/api/client-portal';
import { CANDIDATE_IDENTITY_FIELDS, DEFAULT_CANDIDATE_FORM_CONFIG } from '@/src/types/client';

const profileFields = [
  ['firstName', 'First name'], ['lastName', 'Last name'], ['email', 'Email'], ['phone', 'Phone'],
  ['dateOfBirth', 'Date of birth'], ['gender', 'Gender'], ['fatherName', 'Father name'], ['motherName', 'Mother name'],
  ['aadhaarNumber', 'Aadhaar number'], ['panNumber', 'PAN number'], ['uanNumber', 'UAN number'],
  ['passportNumber', 'Passport number'], ['drivingLicenseNumber', 'Driving licence'], ['voterIdNumber', 'Voter ID'],
  ['highestQualification', 'Highest qualification'], ['courseName', 'Course'], ['institutionName', 'Institution'],
  ['universityName', 'University'], ['yearOfPassing', 'Year of passing'], ['gradeOrPercentage', 'Grade / percentage'],
  ['employeeId', 'Employee ID'], ['employeeDesignation', 'Designation'], ['employeeDepartment', 'Department'],
  ['employmentType', 'Employment type'], ['joiningDate', 'Joining date'], ['workLocation', 'Work location'],
  ['currentEmployer', 'Current employer'], ['currentAddress', 'Current address'], ['permanentAddress', 'Permanent address'],
] as const;

const inputClass = 'mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[12px] text-[var(--foreground)]';
type CandidateTab = 'summary' | 'personal' | 'family' | 'identity' | 'education' | 'employment' | 'addresses' | 'documents' | 'portal';
const TAB_FIELDS: Record<Exclude<CandidateTab, 'summary' | 'documents' | 'portal'>, string[]> = {
  personal: ['firstName', 'lastName', 'email', 'phone', 'dateOfBirth', 'gender'],
  family: ['fatherName', 'motherName'],
  identity: ['aadhaarNumber', 'panNumber', 'uanNumber', 'passportNumber', 'drivingLicenseNumber', 'voterIdNumber'],
  education: ['highestQualification', 'courseName', 'institutionName', 'universityName', 'yearOfPassing', 'gradeOrPercentage'],
  employment: ['employeeId', 'currentEmployer', 'employeeDesignation', 'employeeDepartment', 'employmentType', 'joiningDate', 'workLocation'],
  addresses: ['currentAddress', 'permanentAddress'],
};

function dateLabel(value: string | null | undefined) {
  return value ? new Date(value).toLocaleDateString() : '—';
}

export default function ClientPortalCandidatePage() {
  const { id } = useParams<{ id: string }>();
  const { accessToken, permissions } = useAuth();
  const [candidate, setCandidate] = useState<PortalCandidateDetail | null>(null);
  const [portal, setPortal] = useState<PortalCandidateAccess | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<CandidateTab>('summary');
  const [revealedIds, setRevealedIds] = useState(false);
  const [copied, setCopied] = useState(false);
  const canUpdate = hasPortalPermission(permissions, 'clientportal.candidates.update');
  const canInvite = hasPortalPermission(permissions, 'clientportal.candidates.invite') || hasPortalPermission(permissions, 'clientportal.candidates.create');
  const canManagePortal = hasPortalPermission(permissions, 'clientportal.candidates.portal.manage');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getPortalCandidate(id, accessToken);
      setCandidate(data);
      if (data.bgvCases.length > 0 || ['COMPLETED', 'VERIFICATION_IN_PROGRESS'].includes(data.status)) setEditing(false);
      const portalStatus = canInvite || canManagePortal
        ? await getPortalCandidateAccess(id, accessToken)
        : data.portalInvitation
          ? { ...data.portalInvitation, reminderCount: data.portalInvitation.reminderCount, lastRemindedAt: null, url: null }
          : null;
      setPortal(portalStatus);
      setValues(Object.fromEntries(profileFields.map(([key]) => [key, key === 'dateOfBirth' || key === 'joiningDate' ? String(data[key] || '').slice(0, 10) : String(data[key] ?? '')])));
    } catch (loadError) {
      setError(loadError instanceof ClientPortalApiError ? loadError.message : 'Could not load candidate profile.');
    } finally {
      setLoading(false);
    }
  }, [accessToken, canInvite, canManagePortal, id]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, key === 'yearOfPassing' ? (value ? Number(value) : null) : value.trim() || null]));
      await savePortalCandidate(payload, accessToken, id);
      setEditing(false);
      await load();
    } catch (saveError) {
      setError(saveError instanceof ClientPortalApiError ? saveError.message : 'Could not update candidate.');
    } finally {
      setSaving(false);
    }
  };

  const sendInvitation = async () => {
    setInviting(true);
    setMessage(null);
    setError(null);
    try {
      const result = await invitePortalCandidate(id, accessToken);
      setPortal({ activatedAt: null, lastSentAt: new Date().toISOString(), expiresAt: result.expiresAt, revokedAt: null, reminderCount: 0, lastRemindedAt: null, url: result.url });
      setMessage(result.emailSent ? 'Candidate portal invitation sent successfully.' : 'The secure invitation was created, but email delivery failed. Please retry or contact support.');
      await load();
    } catch (inviteError) {
      setError(inviteError instanceof ClientPortalApiError ? inviteError.message : 'Could not send candidate invitation.');
    } finally {
      setInviting(false);
    }
  };

  const remindCandidate = async () => {
    setInviting(true);
    setMessage(null);
    setError(null);
    try {
      const result = await remindPortalCandidate(id, accessToken);
      setMessage(result.emailSent ? 'Candidate portal reminder sent successfully.' : 'Reminder email could not be delivered.');
      await load();
    } catch (reminderError) {
      setError(reminderError instanceof ClientPortalApiError ? reminderError.message : 'Could not send a reminder.');
    } finally {
      setInviting(false);
    }
  };

  const togglePortalLock = async () => {
    if (!portal) return;
    setInviting(true);
    setError(null);
    try {
      const updated = await setPortalCandidateAccess(id, !portal.revokedAt, accessToken);
      setPortal(updated);
      setMessage(updated.revokedAt ? 'Candidate portal access locked.' : 'Candidate portal access unlocked.');
    } catch (accessError) {
      setError(accessError instanceof ClientPortalApiError ? accessError.message : 'Could not update candidate portal access.');
    } finally {
      setInviting(false);
    }
  };

  const copyInvitationLink = async () => {
    if (!portal?.url) return;
    try {
      await navigator.clipboard.writeText(portal.url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setError('Could not copy the link. Check clipboard permissions.');
    }
  };

  if (loading) return <p className="py-12 text-center text-sm text-[var(--muted)]">Loading candidate…</p>;
  if (error && !candidate) return <section className="rounded-xl border border-rose-500/20 bg-[var(--surface)] p-5"><p role="alert" className="text-sm text-rose-700">{error}</p><Link href="/client-portal/candidates" className="mt-4 inline-flex items-center gap-2 text-sm text-[var(--primary)]"><ArrowLeft size={15} />Candidates</Link></section>;
  if (!candidate) return null;

  const formConfig = candidate.client?.candidateFormConfig ?? DEFAULT_CANDIDATE_FORM_CONFIG;
  const enabledIdentityKeys = CANDIDATE_IDENTITY_FIELDS.filter((field) => formConfig[field.key].enabled).map((field) => field.key);
  const tabItems: { id: CandidateTab; label: string; icon: typeof Users }[] = [
    { id: 'summary', label: 'Summary', icon: LayoutDashboard },
    { id: 'personal', label: 'Personal', icon: Users },
    { id: 'family', label: 'Family', icon: Users },
    ...(enabledIdentityKeys.length ? [{ id: 'identity' as const, label: 'Identity', icon: Hash }] : []),
    { id: 'education', label: 'Education', icon: GraduationCap },
    { id: 'employment', label: 'Employment', icon: BriefcaseBusiness },
    { id: 'addresses', label: 'Addresses', icon: Home },
    { id: 'documents', label: 'Documents', icon: FileText },
    { id: 'portal', label: 'Portal access', icon: ShieldCheck },
  ];
  const dateFields = new Set(['dateOfBirth', 'joiningDate']);
  const identityFields = new Set<string>(enabledIdentityKeys);
  const activeFields: readonly string[] = activeTab in TAB_FIELDS
    ? activeTab === 'identity' ? enabledIdentityKeys : TAB_FIELDS[activeTab as keyof typeof TAB_FIELDS]
    : [];
  const candidatePortalStatus = portal?.revokedAt || candidate.portalInvitation?.revokedAt ? 'Locked' : (portal?.expiresAt || candidate.portalInvitation?.expiresAt) && new Date(portal?.expiresAt || candidate.portalInvitation?.expiresAt || '') < new Date() ? 'Expired' : portal?.activatedAt || candidate.portalInvitation?.activatedAt ? 'Active' : portal || candidate.portalInvitation ? 'Invitation sent' : 'Not activated';
  const profileLocked = candidate.bgvCases.length > 0 || ['COMPLETED', 'VERIFICATION_IN_PROGRESS'].includes(candidate.status);

  return (
    <div className="space-y-5">
      <Link href="/client-portal/candidates" className="inline-flex items-center gap-2 text-[12px] text-[var(--muted)] hover:text-[var(--foreground)]"><ArrowLeft size={15} />Back to candidates</Link>
      <section className="flex flex-col gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4"><span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-[var(--primary)]/10 text-lg font-semibold text-[var(--primary)]">{`${candidate.firstName[0] || ''}${candidate.lastName[0] || ''}`.toUpperCase()}</span><div><p className="font-mono text-[10px] text-[var(--muted)]">{candidate.candidateCode}</p><h2 className="mt-1 text-xl font-semibold">{candidate.firstName} {candidate.lastName}</h2><p className="mt-1 text-[12px] text-[var(--muted)]">{candidate.email || 'No email'} · {candidate.phone || 'No phone'}</p></div></div>
        <div className="flex flex-wrap gap-2">
          <span className="self-center rounded-full bg-[var(--surface-muted)] px-2.5 py-1 text-[10px] font-semibold">{candidate.status.replaceAll('_', ' ')}</span>
          {canInvite && <button type="button" onClick={() => void sendInvitation()} disabled={inviting || !candidate.email} className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-3 py-2 text-[11px] font-semibold text-[var(--primary-foreground)] disabled:opacity-50"><Mail size={14} />{inviting ? 'Sending…' : portal ? 'Resend invitation link' : 'Invite to candidate portal'}</button>}
          {canUpdate && !profileLocked && !editing && <button type="button" onClick={() => { setEditing(true); setMessage(null); }} className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-[11px] font-medium hover:bg-[var(--surface-muted)]"><Pencil size={14} />Edit profile</button>}
          {editing && !profileLocked && <><button type="button" onClick={() => { setEditing(false); void load(); }} className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-[11px]"><X size={14} />Cancel</button><button type="button" onClick={() => void save()} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-3 py-2 text-[11px] font-semibold text-[var(--primary-foreground)] disabled:opacity-50"><Save size={14} />{saving ? 'Saving…' : 'Save changes'}</button></>}
        </div>
      </section>
      {profileLocked && <p role="status" className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-[12px] text-amber-800">Candidate details are locked because the candidate is {candidate.status.replaceAll('_', ' ').toLowerCase()}{candidate.bgvCases.length > 0 ? ' and a BGV case has been created' : ''}. Contact the company administrator for corrections.</p>}
      {error && <p role="alert" className="rounded-lg border border-rose-500/20 bg-rose-500/5 px-4 py-3 text-[12px] text-rose-700">{error}</p>}
      {message && <p role="status" className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-[12px] text-emerald-700">{message}</p>}
      <nav className="flex gap-1 overflow-x-auto border-b border-[var(--border)]" aria-label="Candidate sections">
        {tabItems.map(({ id: tabId, label, icon: Icon }) => <button key={tabId} type="button" onClick={() => { setActiveTab(tabId); setEditing(false); }} className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-[11px] font-medium ${activeTab === tabId ? 'border-[var(--primary)] text-[var(--foreground)]' : 'border-transparent text-[var(--muted)] hover:text-[var(--foreground)]'}`}><Icon size={14} />{label}</button>)}
      </nav>

      {activeTab === 'summary' && <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 lg:col-span-2"><h3 className="text-[14px] font-semibold">Candidate overview</h3><dl className="mt-4 grid gap-4 sm:grid-cols-2">{[['Candidate reference', candidate.candidateCode], ['Status', candidate.status.replaceAll('_', ' ')], ['Email', candidate.email], ['Phone', candidate.phone], ['Created', dateLabel(candidate.createdAt)], ['Last updated', dateLabel(candidate.updatedAt)]].map(([label, value]) => <div key={label}><dt className="text-[10px] uppercase tracking-wide text-[var(--muted)]">{label}</dt><dd className="mt-1 break-words text-[12px]">{value || '—'}</dd></div>)}</dl></section>
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"><h3 className="text-[14px] font-semibold">BGV cases</h3><p className="mt-2 text-3xl font-semibold">{candidate.bgvCases.length}</p><p className="text-[11px] text-[var(--muted)]">linked verification cases</p><div className="mt-4 space-y-2">{candidate.bgvCases.slice(0, 3).map((item) => <Link key={item.id} href={`/client-portal/cases/${item.id}`} className="flex items-center justify-between gap-2 rounded-lg bg-[var(--surface-muted)] px-3 py-2 text-[11px] hover:text-[var(--primary)]"><span className="font-mono">{item.caseNumber}</span><span>{item.status.replaceAll('_', ' ')}</span></Link>)}</div></section>
      </div>}

      {TAB_FIELDS[activeTab as keyof typeof TAB_FIELDS] && <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-[14px] font-semibold">{tabItems.find((item) => item.id === activeTab)?.label} details</h3><p className="mt-1 text-[11px] text-[var(--muted)]">Candidate information for this section.</p></div>{canUpdate && !profileLocked && !editing && <button type="button" onClick={() => { setEditing(true); setMessage(null); }} className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-[11px] font-medium hover:bg-[var(--surface-muted)]"><Pencil size={14} />Edit details</button>}{editing && !profileLocked && <div className="flex gap-2"><button type="button" onClick={() => { setEditing(false); void load(); }} className="rounded-lg border border-[var(--border)] px-3 py-2 text-[11px]">Cancel</button><button type="button" onClick={() => void save()} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-3 py-2 text-[11px] font-semibold text-[var(--primary-foreground)] disabled:opacity-50"><Save size={14} />{saving ? 'Saving…' : 'Save changes'}</button></div>}</div>
        {editing ? <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{profileFields.filter(([key]) => activeFields.includes(key)).map(([key, label]) => <label key={key} className={`text-[10px] font-medium text-[var(--muted)] ${key.endsWith('Address') ? 'sm:col-span-2 lg:col-span-3' : ''}`}>{label}{key.endsWith('Address') ? <textarea rows={3} value={values[key]} onChange={(event) => setValues((value) => ({ ...value, [key]: event.target.value }))} className={inputClass} /> : key === 'gender' ? <select value={values[key]} onChange={(event) => setValues((value) => ({ ...value, [key]: event.target.value }))} className={inputClass}><option value="">Prefer not to say</option><option value="FEMALE">Female</option><option value="MALE">Male</option><option value="NON_BINARY">Non-binary</option><option value="OTHER">Other</option></select> : <input type={dateFields.has(key) ? 'date' : key === 'email' ? 'email' : key === 'yearOfPassing' ? 'number' : 'text'} value={values[key]} onChange={(event) => setValues((value) => ({ ...value, [key]: event.target.value }))} className={inputClass} />}</label>)}</div>
          : <dl className="mt-5 grid gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">{profileFields.filter(([key]) => activeFields.includes(key)).map(([key, label]) => { const raw = candidate[key as keyof PortalCandidateDetail]; const value = raw ? String(raw) : ''; const display = identityFields.has(key) && value && !revealedIds && value.length > 4 ? `${'•'.repeat(value.length - 4)}${value.slice(-4)}` : value || '—'; return <div key={key} className={key.endsWith('Address') ? 'sm:col-span-2 lg:col-span-3' : ''}><dt className="text-[10px] uppercase tracking-wide text-[var(--muted)]">{label}</dt><dd className="mt-1 break-words text-[12px]">{display}</dd></div>; })}</dl>}
        {activeTab === 'identity' && !editing && <button type="button" onClick={() => setRevealedIds((value) => !value)} className="mt-4 rounded-lg border border-[var(--border)] px-3 py-2 text-[11px]">{revealedIds ? 'Hide identity numbers' : 'Reveal identity numbers'}</button>}
      </section>}

      {activeTab === 'documents' && <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"><h3 className="text-[14px] font-semibold">Candidate documents</h3>{candidate.documents.length ? <div className="mt-4 divide-y divide-[var(--border)]">{candidate.documents.map((document) => <div key={document.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-[12px]"><div><p className="font-medium">{document.documentType.replaceAll('_', ' ')}</p><p className="mt-0.5 text-[10px] text-[var(--muted)]">{document.fileName} · {dateLabel(document.uploadedAt)}</p></div><span className="rounded-full bg-[var(--surface-muted)] px-2 py-1 text-[10px]">{document.verificationStatus.replaceAll('_', ' ')}</span><a href=      {document.fileUrl.startsWith('http') ? document.fileUrl : document.fileUrl} target="_blank" rel="noreferrer" className="text-[11px] font-medium text-[var(--primary)] hover:underline">Open document</a></div>)}</div> : <p className="mt-4 text-[12px] text-[var(--muted)]">No documents uploaded.</p>}</section>}

      {activeTab === 'portal' && <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-[14px] font-semibold">Candidate portal access</h3><p className="mt-1 text-[11px] text-[var(--muted)]">Send the secure candidate link to {candidate.email || 'the candidate'}.</p></div><span className="rounded-full bg-[var(--surface-muted)] px-2.5 py-1 text-[10px] font-semibold">{candidatePortalStatus}</span></div>
        <dl className="mt-5 grid gap-4 text-[11px] sm:grid-cols-3"><div><dt className="text-[var(--muted)]">Last sent</dt><dd className="mt-1 font-medium">{dateLabel(portal?.lastSentAt)}</dd></div><div><dt className="text-[var(--muted)]">Expires</dt><dd className="mt-1 font-medium">{dateLabel(portal?.expiresAt)}</dd></div><div><dt className="text-[var(--muted)]">Reminders sent</dt><dd className="mt-1 font-medium">{portal?.reminderCount ?? 0}</dd></div></dl>
        <div className="mt-5 flex flex-wrap gap-2">{canInvite && <><button type="button" onClick={() => void sendInvitation()} disabled={inviting || !candidate.email} className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-3 py-2 text-[11px] font-semibold text-[var(--primary-foreground)] disabled:opacity-50"><Mail size={14} />{portal ? 'Create new link and send' : 'Create link and send'}</button>        {portal && !portal.revokedAt && <button type="button" onClick={() => void remindCandidate()} disabled={inviting || Boolean(portal.expiresAt && new Date(portal.expiresAt) <= new Date())} className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-[11px] font-medium disabled:opacity-50"><Mail size={14} />Send reminder</button>}</>}{canManagePortal && portal && <button type="button" onClick={() => void togglePortalLock()} disabled={inviting} className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-[11px] font-medium disabled:opacity-50">{portal.revokedAt ? <Unlock size={14} /> : <Lock size={14} />}{portal.revokedAt ? 'Unlock candidate link' : 'Lock candidate link'}</button>}{portal?.url && <button type="button" onClick={() => void copyInvitationLink()} className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-[11px] font-medium"><Copy size={14} />{copied ? <><Check size={13} />Copied</> : 'Copy candidate link'}</button>}</div>
      </section>}
    </div>
  );
}
