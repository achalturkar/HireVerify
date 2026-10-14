'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Copy, Download, FileCheck2, FileText, KeyRound, Plus, RefreshCw, Users, X, Eye } from 'lucide-react';
import { useAuth } from '@/src/auth/AuthProvider';
import { changePassword } from '@/src/lib/api/users';
import { getReportVerificationStatus, getVerificationStatus } from '@/src/lib/verification-status';
import {
  ClientPortalApiError,
  downloadPortalReport,
  hasPortalPermission,
  listPortalCandidates,
  listPortalCases,
  listPortalReports,
  invitePortalCandidate,
  savePortalCandidate,
  type PortalCandidate,
  type PortalCase,
  type PortalReport,
} from '@/src/lib/api/client-portal';
import type { ClientPortalPermission } from '@/src/types/client';

type PortalTab = 'candidates' | 'cases' | 'reports';
type CandidateValues = Record<string, string>;

const PERMISSION_TAB: Record<PortalTab, ClientPortalPermission> = {
  candidates: 'clientportal.candidates.view',
  cases: 'clientportal.cases.view',
  reports: 'clientportal.reports.view',
};
const EMPTY_CANDIDATE: CandidateValues = {
  firstName: '', lastName: '', email: '', phone: '', dateOfBirth: '', gender: '',
};

function errorMessage(error: unknown, fallback: string) {
  return error instanceof ClientPortalApiError ? error.message : fallback;
}

function dateText(value: string | null | undefined) {
  return value ? new Date(value).toLocaleDateString() : '—';
}

function statusClass(status: string) {
  if (status === 'COMPLETED' || status === 'CLEAR') return 'bg-emerald-500/10 text-emerald-700';
  if (status.includes('PENDING') || status.includes('PROGRESS') || status === 'ON_HOLD') return 'bg-amber-500/10 text-amber-700';
  if (status === 'FAILED' || status === 'CONSIDER' || status === 'WITHDRAWN') return 'bg-rose-500/10 text-rose-700';
  return 'bg-[var(--surface-muted)] text-[var(--muted)]';
}

export default function ClientPortalPage() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading: authLoading, accessToken, permissions } = useAuth();
  const availableTabs = useMemo(
    () => (['candidates', 'cases', 'reports'] as const).filter((key) => hasPortalPermission(permissions, PERMISSION_TAB[key])),
    [permissions],
  );
  const section = pathname.split('/')[2] || 'candidates';
  const tab = (['candidates', 'cases', 'reports'].includes(section) ? section : 'candidates') as PortalTab;
  const activeTab = availableTabs.includes(tab) ? tab : availableTabs[0] ?? 'candidates';
  const [page, setPage] = useState(1);
  const [candidates, setCandidates] = useState<PortalCandidate[]>([]);
  const [cases, setCases] = useState<PortalCase[]>([]);
  const [reports, setReports] = useState<PortalReport[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [candidateModal, setCandidateModal] = useState(false);
  const [candidateValues, setCandidateValues] = useState<CandidateValues>(EMPTY_CANDIDATE);
  const [savingCandidate, setSavingCandidate] = useState(false);
  const [candidateError, setCandidateError] = useState<string | null>(null);
  const [portalNotice, setPortalNotice] = useState<string | null>(null);
  const [candidateInviteUrl, setCandidateInviteUrl] = useState<string | null>(null);
  const [inviteAfterCreate, setInviteAfterCreate] = useState(true);
  const [downloadingReport, setDownloadingReport] = useState<string | null>(null);
  const [passwordValues, setPasswordValues] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace('/login');
    } else if (!user.role.isClientUser) {
      router.replace(user.role.isSuperAdmin ? '/super-admin/dashboard' : '/company/dashboard');
    }
  }, [authLoading, router, user]);

  const loadTab = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (activeTab === 'candidates' && hasPortalPermission(permissions, 'clientportal.candidates.view')) {
        const result = await listPortalCandidates(page, accessToken);
        setCandidates(result.items);
        setTotal(result.total);
        setTotalPages(result.totalPages);
      } else if (activeTab === 'cases' && hasPortalPermission(permissions, 'clientportal.cases.view')) {
        const result = await listPortalCases(page, accessToken);
        setCases(result.items);
        setTotal(result.total);
        setTotalPages(result.totalPages);
      } else if (activeTab === 'reports' && hasPortalPermission(permissions, 'clientportal.reports.view')) {
        const result = await listPortalReports(page, accessToken);
        setReports(result.items);
        setTotal(result.total);
        setTotalPages(result.totalPages);
      } else {
        setTotal(0);
        setTotalPages(1);
      }
    } catch (loadError) {
      setError(errorMessage(loadError, 'Could not load portal data.'));
    } finally {
      setLoading(false);
    }
  }, [accessToken, activeTab, page, permissions]);

  useEffect(() => {
    if (authLoading || !user?.role.isClientUser || !availableTabs.includes(activeTab)) return;
    const timer = window.setTimeout(() => { void loadTab(); }, 0);
    return () => window.clearTimeout(timer);
  }, [activeTab, authLoading, availableTabs, loadTab, user]);

  const openCreateCandidate = () => {
    setCandidateValues(EMPTY_CANDIDATE);
    setInviteAfterCreate(true);
    setCandidateError(null);
    setPortalNotice(null);
    setCandidateInviteUrl(null);
    setCandidateModal(true);
  };

  const submitCandidate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSavingCandidate(true);
    setCandidateError(null);
    try {
      const payload = Object.fromEntries(Object.entries(candidateValues).map(([key, value]) => [key, value.trim() || null]));
      const candidate = await savePortalCandidate(payload, accessToken);
      setCandidateModal(false);
      if (inviteAfterCreate && canInviteCandidates) {
        try {
          const invitation = await invitePortalCandidate(candidate.id, accessToken);
          setCandidateInviteUrl(invitation.url);
          setPortalNotice(invitation.emailSent ? 'Candidate profile created and invitation sent.' : 'Candidate profile created, but invitation email delivery failed. Open the profile to retry.');
        } catch (inviteError) {
          setPortalNotice(`Candidate profile created, but invitation failed: ${errorMessage(inviteError, 'Please retry from the candidate profile.')}`);
        }
      } else {
        setPortalNotice('Candidate profile created successfully.');
      }
      await loadTab();
    } catch (saveError) {
      setCandidateError(errorMessage(saveError, 'Could not save candidate.'));
    } finally {
      setSavingCandidate(false);
    }
  };

  const copyCandidateInvite = async () => {
    if (!candidateInviteUrl) return;
    try {
      await navigator.clipboard.writeText(candidateInviteUrl);
      setPortalNotice('Candidate invitation link copied.');
    } catch {
      setPortalNotice('Could not copy the invitation link. Check clipboard permissions and try again.');
    }
  };

  const submitPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);
    if (passwordValues.newPassword !== passwordValues.confirmPassword) {
      setPasswordError('New password and confirmation do not match.');
      return;
    }
    setSavingPassword(true);
    try {
      await changePassword(accessToken, passwordValues);
      setPasswordValues({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setPasswordSuccess(true);
    } catch (passwordChangeError) {
      setPasswordError(errorMessage(passwordChangeError, 'Could not change your password.'));
    } finally {
      setSavingPassword(false);
    }
  };

  const downloadReport = async (report: PortalReport) => {
    setDownloadingReport(report.id);
    setError(null);
    try {
      const blob = await downloadPortalReport(report.id, accessToken);
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = `${report.caseNumber}_BGV_Report.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (downloadError) {
      setError(errorMessage(downloadError, 'Could not download this report.'));
    } finally {
      setDownloadingReport(null);
    }
  };

  if (authLoading || !user || !user.role.isClientUser) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-[var(--muted)]">Loading client portal…</div>;
  }

  const canCreateCandidates = hasPortalPermission(permissions, 'clientportal.candidates.create');
  const canInviteCandidates = hasPortalPermission(permissions, 'clientportal.candidates.invite') || canCreateCandidates;
  const canDownloadReports = hasPortalPermission(permissions, 'clientportal.reports.download');
  const client = user.client;
  if (section === 'account') {
    return (
      <section className="mx-auto max-w-3xl space-y-5">
        <div><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--primary)]">Account security</p><h2 className="mt-1 text-2xl font-semibold">Change password</h2><p className="mt-1 text-[12px] text-[var(--muted)]">Update the password for {user.email}.</p></div>
        <form onSubmit={submitPassword} className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <label className="block text-[12px] text-[var(--muted)]">Current password<input required autoComplete="current-password" type="password" value={passwordValues.currentPassword} onChange={(event) => setPasswordValues((value) => ({ ...value, currentPassword: event.target.value }))} className={inputClass} /></label>
          <label className="block text-[12px] text-[var(--muted)]">New password<input required minLength={8} maxLength={128} autoComplete="new-password" type="password" value={passwordValues.newPassword} onChange={(event) => setPasswordValues((value) => ({ ...value, newPassword: event.target.value }))} className={inputClass} /><span className="mt-1 block text-[10px]">Use at least 8 characters.</span></label>
          <label className="block text-[12px] text-[var(--muted)]">Confirm new password<input required minLength={8} maxLength={128} autoComplete="new-password" type="password" value={passwordValues.confirmPassword} onChange={(event) => setPasswordValues((value) => ({ ...value, confirmPassword: event.target.value }))} className={inputClass} /></label>
          {passwordError && <p role="alert" className="text-[12px] text-rose-700">{passwordError}</p>}
          {passwordSuccess && <p role="status" className="text-[12px] text-emerald-700">Password changed successfully.</p>}
          <button type="submit" disabled={savingPassword} className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2.5 text-[12px] font-semibold text-[var(--primary-foreground)] disabled:opacity-50"><KeyRound size={14} />{savingPassword ? 'Saving…' : 'Change password'}</button>
        </form>
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <h3 className="text-[14px] font-semibold">{client?.name || 'Client'} details</h3>
          <dl className="mt-4 grid gap-4 text-[12px] sm:grid-cols-2">{[['Client code', client?.clientCode], ['Industry', client?.industry], ['Contact', client?.contactName], ['Email', client?.contactEmail], ['Phone', client?.contactPhone], ['Website', client?.website], ['Address', [client?.addressLine1, client?.addressLine2, client?.city, client?.state, client?.postalCode, client?.country].filter(Boolean).join(', ') || null]].map(([label, value]) => <div key={label}><dt className="text-[10px] uppercase tracking-wide text-[var(--muted)]">{label}</dt><dd className="mt-1 break-words">{value || '—'}</dd></div>)}</dl>
        </section>
      </section>
    );
  }

  return (
    <div className="space-y-5">
        <section className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--primary)]">Secure client workspace</p><h2 className="mt-1 text-2xl font-semibold">Background verification</h2><p className="mt-1 text-[12px] text-[var(--muted)]">Signed in as {user.firstName} {user.lastName}. Records are limited to {client?.name ?? 'your organization'}.</p></div>
          <button type="button" onClick={() => void loadTab()} disabled={loading} className="inline-flex items-center justify-center gap-2 self-start rounded-lg border border-[var(--border)] px-3 py-2 text-[12px] font-medium hover:bg-[var(--surface-muted)] disabled:opacity-50"><RefreshCw size={13} className={loading ? 'animate-spin' : ''} />Refresh</button>
        </section>

        {availableTabs.length === 0 ? (
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-5 py-12 text-center"><ShieldCheckIcon /><h2 className="mt-3 text-[15px] font-semibold">No portal permissions assigned</h2><p className="mt-1 text-[12px] text-[var(--muted)]">Ask your client administrator to grant access to candidates, cases, or reports.</p></section>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3">{portalNotice && <div role="status" className="flex flex-wrap items-center gap-3 text-[12px] text-emerald-700"><span>{portalNotice}</span>{candidateInviteUrl && <button type="button" onClick={copyCandidateInvite} className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/20 px-2.5 py-1.5 font-semibold"><Copy size={13} />Copy invitation link</button>}</div>}{activeTab === 'candidates' && canCreateCandidates && <button type="button" onClick={openCreateCandidate} className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3 py-2 text-[11px] font-semibold text-[var(--primary-foreground)]"><Plus size={14} />Add candidate</button>}</div>

            {error && <p role="alert" className="rounded-lg border border-rose-500/20 bg-rose-500/5 px-4 py-3 text-[12px] text-rose-700">{error}</p>}
            <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
              <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4"><div><h2 className="text-[14px] font-semibold">{activeTab === 'candidates' ? 'Candidates' : activeTab === 'cases' ? 'BGV case progress' : 'Completed reports'}</h2><p className="mt-0.5 text-[11px] text-[var(--muted)]">{total} record{total === 1 ? '' : 's'}</p></div></div>
              {loading ? <p className="px-5 py-12 text-center text-[12px] text-[var(--muted)]">Loading…</p>
                : activeTab === 'candidates' ? (
                  candidates.length === 0 ? <EmptyState icon={<Users size={19} />} message="No candidates are available." />
                    : <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-[12px]"><thead className="bg-[var(--surface-muted)]/60 text-[10px] uppercase tracking-wide text-[var(--muted)]"><tr><th className="px-5 py-3">Reference</th><th className="px-5 py-3">Candidate</th><th className="px-5 py-3">Email / phone</th><th className="px-5 py-3">Status</th><th className="px-5 py-3 text-right">Details</th></tr></thead><tbody className="divide-y divide-[var(--border)]">{candidates.map((candidate) => <tr key={candidate.id}><td className="px-5 py-3.5 font-mono text-[11px] text-[var(--muted)]">{candidate.candidateCode}</td><td className="px-5 py-3.5 font-medium">{candidate.firstName} {candidate.lastName}</td><td className="px-5 py-3.5 text-[var(--muted)]">{candidate.email || '—'}<span className="block text-[10px]">{candidate.phone || ''}</span></td><td className="px-5 py-3.5"><Status value={candidate.status} /></td><td className="px-5 py-3.5 text-right"><button type="button" onClick={() => router.push(`/client-portal/candidates/${candidate.id}`)} className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] px-2.5 py-1.5 text-[11px] hover:bg-[var(--surface-muted)]"><Eye size={13} />View</button></td></tr>)}</tbody></table></div>
                ) : activeTab === 'cases' ? (
                  cases.length === 0 ? <EmptyState icon={<FileCheck2 size={19} />} message="No BGV cases are available." />
                    : <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-[12px]"><thead className="bg-[var(--surface-muted)]/60 text-[10px] uppercase tracking-wide text-[var(--muted)]"><tr><th className="px-5 py-3">Case</th><th className="px-5 py-3">Candidate</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Verification status</th><th className="px-5 py-3">Initiated</th><th className="px-5 py-3">Completed</th><th className="px-5 py-3 text-right">Progress</th></tr></thead><tbody className="divide-y divide-[var(--border)]">{cases.map((item) => { const verification = getVerificationStatus(item.verificationStatuses); return <tr key={item.id}><td className="px-5 py-3.5 font-mono">{item.caseNumber}</td><td className="px-5 py-3.5">{item.candidate.firstName} {item.candidate.lastName}<span className="block text-[10px] text-[var(--muted)]">{item.candidate.candidateCode}</span></td><td className="px-5 py-3.5"><Status value={item.status} /></td><td className="px-5 py-3.5"><span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold ${verification.className}`}>{verification.label}</span></td><td className="px-5 py-3.5">{dateText(item.initiatedAt)}</td><td className="px-5 py-3.5">{dateText(item.completedAt)}</td><td className="px-5 py-3.5 text-right"><button type="button" onClick={() => router.push(`/client-portal/cases/${item.id}`)} className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] px-2.5 py-1.5 text-[11px] hover:bg-[var(--surface-muted)]"><Eye size={13} />View</button></td></tr>; })}</tbody></table></div>
                ) : reports.length === 0 ? <EmptyState icon={<FileText size={19} />} message="No completed reports are available." />
                  : <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-[12px]"><thead className="bg-[var(--surface-muted)]/60 text-[10px] uppercase tracking-wide text-[var(--muted)]"><tr><th className="px-5 py-3">Case</th><th className="px-5 py-3">Candidate</th><th className="px-5 py-3">Completed</th><th className="px-5 py-3">Verification status</th><th className="px-5 py-3 text-right">Report</th></tr></thead><tbody className="divide-y divide-[var(--border)]">{reports.map((report) => { const verification = getReportVerificationStatus(report.reportVerificationStatus); return <tr key={report.id}><td className="px-5 py-3.5 font-mono">{report.caseNumber}</td><td className="px-5 py-3.5">{report.candidate.firstName} {report.candidate.lastName}<span className="block text-[10px] text-[var(--muted)]">{report.candidate.candidateCode}</span></td><td className="px-5 py-3.5">{dateText(report.completedAt)}</td><td className="px-5 py-3.5"><span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold ${verification.className}`}>{verification.label}</span></td><td className="px-5 py-3.5 text-right">{canDownloadReports && <button type="button" disabled={downloadingReport === report.id} onClick={() => void downloadReport(report)} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-[11px] font-medium hover:bg-[var(--surface-muted)] disabled:opacity-50"><Download size={13} />{downloadingReport === report.id ? 'Downloading…' : 'PDF'}</button>}</td></tr>; })}</tbody></table></div>}
              <div className="flex items-center justify-between border-t border-[var(--border)] px-5 py-3 text-[11px] text-[var(--muted)]"><span>Page {page} of {Math.max(1, totalPages)}</span><div className="flex gap-2"><button type="button" disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)} className="rounded-md border border-[var(--border)] px-3 py-1.5 disabled:opacity-40">Previous</button><button type="button" disabled={page >= totalPages || loading} onClick={() => setPage((value) => value + 1)} className="rounded-md border border-[var(--border)] px-3 py-1.5 disabled:opacity-40">Next</button></div></div>
            </section>
          </>
        )}
      {candidateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <form onSubmit={submitCandidate} className="w-full max-w-3xl space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl">
            <div className="flex items-center justify-between"><div><h2 className="text-[15px] font-semibold">Add candidate</h2><p className="mt-1 text-[11px] text-[var(--muted)]">Enter the candidate&apos;s personal information.</p></div><button type="button" onClick={() => setCandidateModal(false)} aria-label="Close"><X size={17} /></button></div>
            <div className="border-b border-[var(--border)] pb-4">
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">Personal information</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-[12px] text-[var(--muted)]">First name<input required autoComplete="given-name" type="text" value={candidateValues.firstName} onChange={(event) => setCandidateValues((value) => ({ ...value, firstName: event.target.value }))} className={inputClass} /></label>
                <label className="text-[12px] text-[var(--muted)]">Last name<input required autoComplete="family-name" type="text" value={candidateValues.lastName} onChange={(event) => setCandidateValues((value) => ({ ...value, lastName: event.target.value }))} className={inputClass} /></label>
                <label className="text-[12px] text-[var(--muted)]">Email<input required={canInviteCandidates && inviteAfterCreate} autoComplete="email" type="email" value={candidateValues.email} onChange={(event) => setCandidateValues((value) => ({ ...value, email: event.target.value }))} className={inputClass} /></label>
                <label className="text-[12px] text-[var(--muted)]">Phone<input autoComplete="tel" type="tel" value={candidateValues.phone} onChange={(event) => setCandidateValues((value) => ({ ...value, phone: event.target.value }))} className={inputClass} /></label>
                <label className="text-[12px] text-[var(--muted)]">Date of birth<input type="date" value={candidateValues.dateOfBirth} onChange={(event) => setCandidateValues((value) => ({ ...value, dateOfBirth: event.target.value }))} className={inputClass} /></label>
                <label className="text-[12px] text-[var(--muted)]">Gender<select value={candidateValues.gender} onChange={(event) => setCandidateValues((value) => ({ ...value, gender: event.target.value }))} className={inputClass}><option value="">Prefer not to say</option><option value="FEMALE">Female</option><option value="MALE">Male</option><option value="NON_BINARY">Non-binary</option><option value="OTHER">Other</option></select></label>
              </div>
            </div>
            {canInviteCandidates && <label className="flex items-center gap-2 text-[11px] text-[var(--muted)]"><input type="checkbox" checked={inviteAfterCreate} onChange={(event) => setInviteAfterCreate(event.target.checked)} />Send candidate portal invitation after creating profile</label>}
            {candidateError && <p role="alert" className="text-[12px] text-rose-700">{candidateError}</p>}
            <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-4"><button type="button" onClick={() => setCandidateModal(false)} className="rounded-lg border border-[var(--border)] px-3.5 py-2 text-[12px]">Cancel</button><button type="submit" disabled={savingCandidate} className="rounded-lg bg-[var(--primary)] px-4 py-2 text-[12px] font-semibold text-[var(--primary-foreground)] disabled:opacity-50">{savingCandidate ? 'Saving…' : 'Save candidate'}</button></div>
          </form>
        </div>
      )}
    </div>
  );
}

const inputClass = 'mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2.5 text-[13px] text-[var(--foreground)] outline-none focus:border-[var(--primary)]';

function Status({ value }: { value: string }) {
  return <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-semibold ${statusClass(value)}`}>{value.replaceAll('_', ' ')}</span>;
}

function EmptyState({ icon, message }: { icon: React.ReactNode; message: string }) {
  return <div className="px-5 py-14 text-center"><span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--primary)]/10 text-[var(--primary)]">{icon}</span><p className="mt-3 text-[12px] text-[var(--muted)]">{message}</p></div>;
}

function ShieldCheckIcon() {
  return <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--primary)]/10 text-[var(--primary)]"><FileCheck2 size={20} /></span>;
}
