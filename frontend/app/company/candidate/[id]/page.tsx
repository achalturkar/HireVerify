'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  BriefcaseBusiness,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  GraduationCap,
  Hash,
  Home,
  LayoutDashboard,
  Link2,
  Loader2,
  Lock,
  Mail,
  Send,
  ShieldCheck,
  Unlock,
  UserRound,
  XCircle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuth } from '@/src/auth/AuthProvider';
import { ApiError, activateCandidatePortal, getCandidate, getCandidatePortalStatus, sendCandidatePortalReminder, setCandidatePortalLocked, type CandidatePortalStatus } from '@/src/lib/api/candidates';
import type { Candidate } from '@/src/types/candidate';

/* ------------------------------------------------------------------ */
/* Types and configuration                                             */
/* ------------------------------------------------------------------ */
type CandidateDocument = { id: string; documentType: string; documentNumber?: string | null; fileName: string; fileUrl: string; verificationStatus: string; uploadedAt: string };
type CandidateDetail = Candidate & { documents?: CandidateDocument[] };
type Tab = 'summary' | 'personal' | 'identity' | 'education' | 'employment' | 'addresses' | 'documents' | 'portal';
type PortalState = 'none' | 'active' | 'expiring' | 'expired' | 'locked';
type Category = 'identity' | 'education' | 'employment' | 'address' | 'other';

/** The longest link lifetime the admin UI offers. Keep this in line with the limit your API enforces. */
const MAX_PORTAL_DAYS = 30;
const DAY_PRESETS = [1, 3, 7, 14, 30];
const EXPIRING_SOON_MS = 24 * 60 * 60 * 1000;

const IDENTITY_ITEMS = [
  { title: 'Aadhaar card', docType: 'AADHAAR', fieldKey: 'aadhaarNumber' },
  { title: 'PAN card', docType: 'PAN', fieldKey: 'panNumber' },
  { title: 'UAN (EPFO)', docType: 'UAN', fieldKey: 'uanNumber' },
  { title: 'Passport', docType: 'PASSPORT', fieldKey: 'passportNumber' },
  { title: 'Driving licence', docType: 'DRIVING_LICENSE', fieldKey: 'drivingLicenseNumber' },
  { title: 'Voter ID', docType: 'VOTER_ID', fieldKey: 'voterIdNumber' },
];

const CATEGORY_TYPES: Record<Exclude<Category, 'other'>, string[]> = {
  identity: IDENTITY_ITEMS.map((item) => item.docType),
  education: ['EDUCATION_CERTIFICATE'],
  employment: ['EXPERIENCE_LETTER', 'SALARY_SLIP'],
  address: ['ADDRESS_PROOF'],
};
const CATEGORY_LABEL: Record<Category, string> = { identity: 'Identity', education: 'Education', employment: 'Employment', address: 'Address', other: 'Other' };

const PROFILE_SECTIONS: { label: string; fields: string[] }[] = [
  { label: 'Personal', fields: ['firstName', 'lastName', 'email', 'phone', 'dateOfBirth', 'gender'] },
  { label: 'Identity', fields: IDENTITY_ITEMS.map((item) => item.fieldKey) },
  { label: 'Education', fields: ['highestQualification', 'courseName', 'institutionName', 'universityName', 'yearOfPassing', 'gradeOrPercentage'] },
  { label: 'Employment', fields: ['employeeId', 'currentEmployer', 'employeeDesignation', 'employeeDepartment', 'employmentType', 'joiningDate', 'workLocation'] },
  { label: 'Addresses', fields: ['currentAddress', 'permanentAddress'] },
];

const PORTAL_STATES: Record<PortalState, { label: string; badge: string; panel: string; icon: LucideIcon }> = {
  none: { label: 'Not activated', badge: 'bg-slate-100 text-slate-700 ring-slate-200', panel: 'border-slate-200 bg-slate-50', icon: Link2 },
  active: { label: 'Active', badge: 'bg-emerald-50 text-emerald-700 ring-emerald-200', panel: 'border-emerald-200 bg-emerald-50', icon: CheckCircle2 },
  expiring: { label: 'Active (expires soon)', badge: 'bg-amber-50 text-amber-800 ring-amber-200', panel: 'border-amber-200 bg-amber-50', icon: Clock },
  expired: { label: 'Expired', badge: 'bg-red-50 text-red-700 ring-red-200', panel: 'border-red-200 bg-red-50', icon: AlertTriangle },
  locked: { label: 'Locked', badge: 'bg-slate-800 text-white ring-slate-800', panel: 'border-slate-300 bg-slate-100', icon: Lock },
};

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */
const humanize = (value: string) => value.replaceAll('_', ' ').toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase());
const isFilled = (value: unknown) => value !== null && value !== undefined && String(value).trim() !== '';
const valueOrDash = (value: unknown) => (isFilled(value) ? String(value) : 'Not provided');

const parseDate = (value: unknown): Date | null => {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value as string | number);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};
const formatDate = (value: unknown) => parseDate(value)?.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) ?? null;
const formatDateTime = (value: unknown) =>
  parseDate(value)?.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) ?? null;

const formatDuration = (ms: number) => {
  const minutes = Math.max(1, Math.round(Math.abs(ms) / 60000));
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  if (days > 0) return `${days} day${days === 1 ? '' : 's'}${hours ? ` ${hours} hr` : ''}`;
  if (hours > 0) return `${hours} hr ${minutes % 60} min`;
  return `${minutes} min`;
};

const getPortalState = (portal: CandidatePortalStatus | null, now: number): PortalState => {
  if (!portal) return 'none';
  if (portal.revokedAt) return 'locked';
  const remaining = new Date(portal.expiresAt).getTime() - now;
  if (remaining <= 0) return 'expired';
  return remaining < EXPIRING_SOON_MS ? 'expiring' : 'active';
};

const categoryOf = (documentType: string): Category => {
  const match = (Object.keys(CATEGORY_TYPES) as Exclude<Category, 'other'>[]).find((key) => CATEGORY_TYPES[key].includes(documentType));
  return match ?? 'other';
};

const statusStyle = (status: string): { className: string; icon: LucideIcon } => {
  const value = status.toUpperCase();
  if (/(VERIFIED|APPROVED|ACCEPTED|COMPLETED)/.test(value)) return { className: 'bg-emerald-50 text-emerald-700 ring-emerald-200', icon: CheckCircle2 };
  if (/(REJECT|FAIL|INVALID)/.test(value)) return { className: 'bg-red-50 text-red-700 ring-red-200', icon: XCircle };
  return { className: 'bg-amber-50 text-amber-700 ring-amber-200', icon: Clock };
};

const maskValue = (value: string) => (value.length <= 4 ? value : `${'•'.repeat(value.length - 4)}${value.slice(-4)}`);
const fileHref = (url: string, origin: string) => (/^https?:\/\//i.test(url) ? url : `${origin}${url}`);

/* ------------------------------------------------------------------ */
/* Small components                                                    */
/* ------------------------------------------------------------------ */
function Pill({ className, icon: Icon, children }: { className: string; icon?: LucideIcon; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${className}`}>
      {Icon && <Icon size={12} aria-hidden="true" />}
      {children}
    </span>
  );
}

function DocStatus({ status }: { status: string }) {
  const style = statusStyle(status);
  return <Pill className={style.className} icon={style.icon}>{humanize(status)}</Pill>;
}

function Panel({ title, description, action, children }: { title: string; description: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">{description}</p>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function InfoGrid({ rows }: { rows: [string, unknown][] }) {
  return (
    <dl className="grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt className="text-xs font-medium text-[var(--muted)]">{label}</dt>
          <dd className={`mt-1 text-sm ${isFilled(value) ? 'font-medium' : 'text-[var(--muted)]'}`}>{valueOrDash(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

function ProgressBar({ percent }: { percent: number }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-muted)]" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-[var(--primary)] transition-all" style={{ width: `${percent}%` }} />
    </div>
  );
}

function DocumentRow({ document, origin, showCategory = false }: { document: CandidateDocument; origin: string; showCategory?: boolean }) {
  const rejected = /(REJECT|FAIL|INVALID)/i.test(document.verificationStatus);
  return (
    <li className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--surface-muted)] text-[var(--muted)]"><FileText size={17} aria-hidden="true" /></span>
        <div className="min-w-0">
          <p className="text-sm font-semibold">
            {humanize(document.documentType)}
            {showCategory && <span className="ml-2 text-xs font-medium text-[var(--muted)]">{CATEGORY_LABEL[categoryOf(document.documentType)]}</span>}
          </p>
          <p className="truncate text-sm text-[var(--muted)]">{document.fileName}</p>
          <p className="mt-0.5 text-xs text-[var(--muted)]">{document.documentNumber ? `Number ${document.documentNumber}, ` : ''}uploaded {formatDateTime(document.uploadedAt) ?? '-'}</p>
          {rejected && <p className="mt-1 text-xs text-red-600">Rejected. Ask the candidate for a clearer copy.</p>}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3 sm:flex-col sm:items-end sm:gap-1.5">
        <DocStatus status={document.verificationStatus} />
        <a href={fileHref(document.fileUrl, origin)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--primary)] hover:underline">
          Open file <ExternalLink size={12} aria-hidden="true" />
        </a>
      </div>
    </li>
  );
}

function DocumentList({ documents, origin, emptyText, showCategory }: { documents: CandidateDocument[]; origin: string; emptyText: string; showCategory?: boolean }) {
  if (!documents.length) {
    return <p className="rounded-xl border border-dashed border-[var(--border)] px-4 py-8 text-center text-sm text-[var(--muted)]">{emptyText}</p>;
  }
  return (
    <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-xl border border-[var(--border)]">
      {documents.map((document) => <DocumentRow key={document.id} document={document} origin={origin} showCategory={showCategory} />)}
    </ul>
  );
}

function IdentityCard({ title, value, documents, origin }: { title: string; value: unknown; documents: CandidateDocument[]; origin: string }) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const text = isFilled(value) ? String(value) : '';
  const latest = [...documents].sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())[0];

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access can be blocked; the value stays selectable on screen.
    }
  };

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--surface-muted)] text-[var(--primary)]"><Hash size={18} aria-hidden="true" /></span>
          <h3 className="font-semibold">{title}</h3>
        </div>
        {latest ? <DocStatus status={latest.verificationStatus} /> : <Pill className="bg-slate-100 text-slate-600 ring-slate-200">No file</Pill>}
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-[var(--surface-muted)] px-4 py-3">
        <div>
          <p className="text-xs text-[var(--muted)]">Number</p>
          <p className={`mt-0.5 font-mono text-sm ${text ? 'font-semibold tracking-wide' : 'font-sans text-[var(--muted)]'}`}>{text ? (revealed ? text : maskValue(text)) : 'Not provided'}</p>
        </div>
        {text && (
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setRevealed((previous) => !previous)} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[var(--muted)] hover:bg-[var(--surface)]" aria-pressed={revealed}>
              {revealed ? <EyeOff size={14} aria-hidden="true" /> : <Eye size={14} aria-hidden="true" />}
              {revealed ? 'Hide' : 'Show'}
            </button>
            <button type="button" onClick={copy} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[var(--muted)] hover:bg-[var(--surface)]">
              {copied ? <CheckCircle2 size={14} className="text-emerald-600" aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        )}
      </div>
      {documents.length > 0 && <div className="mt-3"><DocumentList documents={documents} origin={origin} emptyText="" /></div>}
    </section>
  );
}

function DurationPicker({ value, onChange, valid }: { value: string; onChange: (value: string) => void; valid: boolean }) {
  return (
    <div>
      <p className="text-sm font-medium">Link stays active for</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {DAY_PRESETS.map((preset) => (
          <button key={preset} type="button" onClick={() => onChange(String(preset))} aria-pressed={value === String(preset)} className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${value === String(preset) ? 'border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]' : 'border-[var(--border)] hover:bg-[var(--surface-muted)]'}`}>
            {preset} {preset === 1 ? 'day' : 'days'}
          </button>
        ))}
        <label className="flex items-center gap-2 text-sm">
          <span className="sr-only">Custom number of days</span>
          <input type="number" inputMode="numeric" min={1} max={MAX_PORTAL_DAYS} value={value} onChange={(event) => onChange(event.target.value)} aria-invalid={!valid} className={`w-20 rounded-lg border bg-[var(--surface)] px-3 py-2 text-sm ${valid ? 'border-[var(--border)]' : 'border-red-300'}`} />
          <span className="text-[var(--muted)]">days</span>
        </label>
      </div>
      {!valid && <p className="mt-1.5 text-xs text-red-600">Enter a whole number from 1 to {MAX_PORTAL_DAYS}.</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */
export default function CandidateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { accessToken } = useAuth();
  const [candidate, setCandidate] = useState<CandidateDetail | null>(null);
  const [portal, setPortal] = useState<CandidatePortalStatus | null>(null);
  const [daysInput, setDaysInput] = useState('7');
  const [tab, setTab] = useState<Tab>('summary');
  const [docFilter, setDocFilter] = useState<Category | 'all'>('all');
  const [confirmLock, setConfirmLock] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [detail, status] = await Promise.all([getCandidate(id, accessToken), getCandidatePortalStatus(id, accessToken)]);
      setCandidate(detail as CandidateDetail);
      setPortal(status ?? (detail.portalInvitation ? { ...detail.portalInvitation, url: null } : null));
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : 'Could not load candidate details.');
    } finally {
      setLoading(false);
    }
  }, [id, accessToken]);

  useEffect(() => { if (id) void load(); }, [id, load]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    const refreshPortalStatus = () => {
      if (document.visibilityState !== 'visible') return;
      void getCandidatePortalStatus(id, accessToken)
        .then((status) => { if (!cancelled && status) setPortal(status); })
        .catch(() => undefined);
    };
    const intervalId = window.setInterval(refreshPortalStatus, 15000);
    window.addEventListener('focus', refreshPortalStatus);
    document.addEventListener('visibilitychange', refreshPortalStatus);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', refreshPortalStatus);
      document.removeEventListener('visibilitychange', refreshPortalStatus);
    };
  }, [id, accessToken]);

  // Keeps the "expires in" countdown and the expired state current without a refresh.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  const parsedDays = Number(daysInput);
  const daysValid = daysInput.trim() !== '' && Number.isInteger(parsedDays) && parsedDays >= 1 && parsedDays <= MAX_PORTAL_DAYS;
  const newExpiry = daysValid ? new Date(now + parsedDays * 86400000) : null;

  const state = getPortalState(portal, now);
  const expired = portal ? new Date(portal.expiresAt).getTime() <= now : false;
  const needsResend = state === 'expired' || (state === 'locked' && expired);

  const documents = useMemo(() => candidate?.documents ?? [], [candidate]);
  const origin = (process.env.NEXT_PUBLIC_API ?? '').replace(/\/api\/v1\/?$/, '');
  const docsOf = useCallback((category: Category) => documents.filter((document) => categoryOf(document.documentType) === category), [documents]);

  const field = useCallback((key: string): unknown => (candidate ? (candidate as unknown as Record<string, unknown>)[key] : undefined), [candidate]);

  const completeness = useMemo(
    () => PROFILE_SECTIONS.map((section) => {
      const filled = section.fields.filter((key) => isFilled(field(key))).length;
      return { label: section.label, filled, total: section.fields.length, percent: Math.round((filled / section.fields.length) * 100) };
    }),
    [field],
  );
  const overallPercent = completeness.length ? Math.round(completeness.reduce((sum, section) => sum + section.percent, 0) / completeness.length) : 0;

  const verifiedCount = documents.filter((document) => /(VERIFIED|APPROVED|ACCEPTED|COMPLETED)/i.test(document.verificationStatus)).length;
  const rejectedCount = documents.filter((document) => /(REJECT|FAIL|INVALID)/i.test(document.verificationStatus)).length;
  const reviewCount = documents.length - verifiedCount - rejectedCount;

  const run = async (action: () => Promise<void>, fallback: string) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await action();
    } catch (requestError) {
      setError(requestError instanceof ApiError
        ? requestError.message
        : requestError instanceof TypeError
          ? `Could not reach the API server: ${requestError.message}`
          : requestError instanceof Error ? requestError.message : fallback);
    } finally {
      setBusy(false);
    }
  };

  // Activate, extend and resend all issue a fresh expiry from today.
  // If your API has a separate "send invitation email" endpoint, call it inside the resend case.
  const issueLink = (mode: 'activate' | 'extend' | 'resend') => {
    if (!daysValid) return;
    void run(async () => {
      const result = await activateCandidatePortal(id, parsedDays, accessToken);
      setPortal({ ...result, revokedAt: null, reminderCount: portal?.reminderCount || 0, lastRemindedAt: portal?.lastRemindedAt || null });
      const until = formatDateTime(result.expiresAt) ?? '';
      setNotice(result.emailSent
        ? mode === 'resend' ? `Invitation sent. The new link is active until ${until}.` : mode === 'extend' ? `Link extended until ${until}.` : `Portal link activated until ${until}.`
        : `Portal access is active until ${until}, but the email could not be delivered. Use the active link below to share it with the candidate.`);
    }, 'Could not update portal access.');
  };

  const sendPortalReminder = () => {
    void run(async () => {
      const result = await sendCandidatePortalReminder(id, accessToken);
      setPortal(result);
      setNotice(result.emailSent
        ? `Reminder sent using the same portal link. Expiry remains ${formatDateTime(result.expiresAt)}.`
        : 'The portal link is still active, but the reminder email could not be delivered.');
    }, 'Could not send portal reminder.');
  };

  const setLocked = (locked: boolean) => {
    setConfirmLock(false);
    void run(async () => {
      const result = await setCandidatePortalLocked(id, locked, accessToken);
      setPortal(result);
      setNotice(locked ? 'Portal link locked. The candidate can no longer open it.' : 'Portal link unlocked.');
    }, 'Could not update portal access.');
  };

  const copyActivePortalLink = async () => {
    if (!portal?.url) return;
    try {
      await navigator.clipboard.writeText(portal.url);
      setNotice('Portal link copied.');
    } catch {
      setError('Could not copy the link. Check clipboard permissions and try again.');
    }
  };

  if (loading && !candidate) return <div className="grid min-h-[50vh] place-items-center text-[var(--muted)]"><Loader2 className="animate-spin" aria-label="Loading" /></div>;
  if (!candidate) return <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">{error || 'Candidate not found.'}</div>;

  const stateInfo = PORTAL_STATES[state];
  const StateIcon = stateInfo.icon;
  const expiresAt = portal ? new Date(portal.expiresAt) : null;
  const remainingMs = expiresAt ? expiresAt.getTime() - now : 0;
  const initials = `${candidate.firstName?.[0] ?? ''}${candidate.lastName?.[0] ?? ''}`.toUpperCase() || '?';

  const tabs: { key: Tab; label: string; icon: LucideIcon; count?: number }[] = [
    { key: 'summary', label: 'Summary', icon: LayoutDashboard },
    { key: 'personal', label: 'Personal', icon: UserRound },
    { key: 'identity', label: 'Identity', icon: Hash, count: docsOf('identity').length },
    { key: 'education', label: 'Education', icon: GraduationCap, count: docsOf('education').length },
    { key: 'employment', label: 'Employment', icon: BriefcaseBusiness, count: docsOf('employment').length },
    { key: 'addresses', label: 'Addresses', icon: Home },
    { key: 'documents', label: 'Documents', icon: FileText, count: documents.length },
    { key: 'portal', label: 'Portal access', icon: ShieldCheck },
  ];

  const attention: { text: string; tab: Tab; tone: 'red' | 'amber' }[] = [];
  if (needsResend) attention.push({ text: 'The portal link has expired. Resend the invitation so the candidate can continue.', tab: 'portal', tone: 'red' });
  else if (state === 'expiring') attention.push({ text: `The portal link is active and expires in ${formatDuration(remainingMs)}, on ${formatDateTime(expiresAt)}.`, tab: 'portal', tone: 'amber' });
  if (state === 'locked' && !expired) attention.push({ text: 'The portal link is locked, so the candidate cannot submit anything.', tab: 'portal', tone: 'amber' });
  if (rejectedCount > 0) attention.push({ text: `${rejectedCount} document${rejectedCount === 1 ? ' was' : 's were'} rejected and may need a new upload.`, tab: 'documents', tone: 'red' });
  if (reviewCount > 0) attention.push({ text: `${reviewCount} document${reviewCount === 1 ? ' is' : 's are'} waiting for review.`, tab: 'documents', tone: 'amber' });
  if (!isFilled(field('aadhaarNumber')) || !isFilled(field('panNumber'))) attention.push({ text: 'Aadhaar or PAN number is missing.', tab: 'identity', tone: 'amber' });
  if (documents.length === 0) attention.push({ text: 'The candidate has not uploaded any documents yet.', tab: 'documents', tone: 'amber' });

  const filteredDocuments = docFilter === 'all' ? documents : docsOf(docFilter);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <button type="button" onClick={() => router.push('/company/candidates')} className="inline-flex items-center gap-2 text-sm text-[var(--muted)] hover:text-[var(--foreground)]">
        <ArrowLeft size={15} aria-hidden="true" />Back to candidates
      </button>

      <header className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-[var(--surface-muted)] text-lg font-semibold text-[var(--primary)]" aria-hidden="true">{initials}</span>
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-semibold">{candidate.firstName} {candidate.lastName}</h1>
              <p className="mt-0.5 text-sm text-[var(--muted)]">{candidate.candidateCode}{candidate.email ? `, ${candidate.email}` : ''}{candidate.phone ? `, ${candidate.phone}` : ''}</p>
              {candidate.client && <p className="mt-0.5 text-xs text-[var(--muted)]">Requested by {candidate.client.name}</p>}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Pill className="bg-[var(--surface-muted)] text-[var(--muted)] ring-[var(--border)]">{humanize(candidate.status)}</Pill>
            <button type="button" onClick={() => setTab('portal')} className="rounded-full" aria-label={`Portal link ${stateInfo.label}. Open portal access`}>
              <Pill className={stateInfo.badge} icon={StateIcon}>Portal {stateInfo.label.toLowerCase()}</Pill>
            </button>
          </div>
        </div>
      </header>

      <div aria-live="polite">
        {(error || notice) && (
          <div role={error ? 'alert' : 'status'} className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm ${error ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
            {error ? <AlertTriangle size={16} aria-hidden="true" /> : <CheckCircle2 size={16} aria-hidden="true" />}
            {error || notice}
          </div>
        )}
      </div>
      <nav aria-label="Candidate sections">
        <div role="tablist" className="flex gap-1 overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1">
          {tabs.map(({ key, label, icon: Icon, count }) => (
            <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)} className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-lg px-3.5 py-2.5 text-sm font-semibold transition sm:flex-1 ${tab === key ? 'bg-[var(--primary)] text-[var(--primary-foreground)]' : 'text-[var(--muted)] hover:bg-[var(--surface-muted)]'}`}>
              <Icon size={15} aria-hidden="true" />
              <span className="whitespace-nowrap">{label}</span>
              {count !== undefined && count > 0 && <span className={`rounded-full px-1.5 text-[10px] ${tab === key ? 'bg-white/25' : 'bg-[var(--surface-muted)]'}`}>{count}</span>}
            </button>
          ))}
        </div>
      </nav>

      {tab === 'summary' && (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['Documents', documents.length, 'Files uploaded'],
              ['Verified', verifiedCount, 'Documents approved'],
              ['Needs review', reviewCount + rejectedCount, 'Pending or rejected'],
              ['Cases', candidate.bgvCaseCount || 0, 'Verification cases'],
            ].map(([label, value, hint]) => (
              <div key={String(label)} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
                <p className="text-xs font-medium text-[var(--muted)]">{label}</p>
                <p className="mt-1 text-3xl font-semibold">{value}</p>
                <p className="mt-0.5 text-xs text-[var(--muted)]">{hint}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-5 lg:grid-cols-5">
            <div className="lg:col-span-3">
              <Panel title="Profile completeness" description="How much the candidate has filled in, by section." action={<span className="text-2xl font-semibold">{overallPercent}%</span>}>
                <div className="space-y-4">
                  {completeness.map((section) => (
                    <div key={section.label}>
                      <div className="mb-1.5 flex items-center justify-between text-sm">
                        <span className="font-medium">{section.label}</span>
                        <span className="text-xs text-[var(--muted)]">{section.filled} of {section.total} provided</span>
                      </div>
                      <ProgressBar percent={section.percent} />
                    </div>
                  ))}
                </div>
              </Panel>
            </div>
            <div className="space-y-5 lg:col-span-2">
              <Panel title="Portal link" description="Candidate access to the submission portal.">
                <div className="flex items-center justify-between gap-3">
                  <Pill className={stateInfo.badge} icon={StateIcon}>{stateInfo.label}</Pill>
                  <button type="button" onClick={() => setTab('portal')} className="text-sm font-semibold text-[var(--primary)] hover:underline">Manage</button>
                </div>
                <p className="mt-3 text-sm text-[var(--muted)]">
                  {state === 'none' && 'No link has been sent yet.'}
                  {(state === 'active' || state === 'expiring') && `Active until ${formatDateTime(expiresAt)} (${formatDuration(remainingMs)} remaining).`}
                  {state === 'expired' && `Expired ${formatDuration(remainingMs)} ago.`}
                  {state === 'locked' && 'Locked by an admin.'}
                </p>
              </Panel>
              <Panel title="Needs attention" description="Things to follow up on.">
                {attention.length === 0 ? (
                  <p className="flex items-center gap-2 text-sm text-emerald-700"><CheckCircle2 size={16} aria-hidden="true" />Nothing needs attention.</p>
                ) : (
                  <ul className="space-y-2">
                    {attention.map((item) => (
                      <li key={item.text}>
                        <button type="button" onClick={() => setTab(item.tab)} className={`flex w-full items-start gap-2 rounded-lg px-3 py-2.5 text-left text-sm ${item.tone === 'red' ? 'bg-red-50 text-red-800' : 'bg-amber-50 text-amber-900'}`}>
                          <AlertTriangle size={15} className="mt-0.5 shrink-0" aria-hidden="true" />{item.text}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            </div>
          </div>
        </div>
      )}

      {tab === 'personal' && (
        <Panel title="Personal information" description="Contact and identity details submitted by the candidate.">
          <InfoGrid rows={[['First name', candidate.firstName], ['Last name', candidate.lastName], ['Email', candidate.email], ['Phone', candidate.phone], ['Date of birth', formatDate(candidate.dateOfBirth)], ['Gender', candidate.gender]]} />
        </Panel>
      )}

      {tab === 'identity' && (
        <div className="space-y-4">
          <p className="px-1 text-sm text-[var(--muted)]">Numbers are hidden by default. Show a number to compare it with the uploaded copy.</p>
          {IDENTITY_ITEMS.map((item) => (
            <IdentityCard key={item.docType} title={item.title} value={field(item.fieldKey)} documents={documents.filter((document) => document.documentType === item.docType)} origin={origin} />
          ))}
        </div>
      )}

      {tab === 'education' && (
        <div className="space-y-5">
          <Panel title="Education information" description="Education details submitted for verification.">
            <InfoGrid rows={[['Highest qualification', field('highestQualification')], ['Course or degree', field('courseName')], ['College or school', field('institutionName')], ['University or board', field('universityName')], ['Year of passing', field('yearOfPassing')], ['Percentage or CGPA', field('gradeOrPercentage')]]} />
          </Panel>
          <Panel title="Education documents" description="Certificates and marksheets uploaded by the candidate.">
            <DocumentList documents={docsOf('education')} origin={origin} emptyText="No education documents uploaded yet." />
          </Panel>
        </div>
      )}

      {tab === 'employment' && (
        <div className="space-y-5">
          <Panel title="Employment information" description="Employment details submitted for verification.">
            <InfoGrid rows={[['Current employer', field('currentEmployer')], ['Employee ID', field('employeeId')], ['Designation', field('employeeDesignation')], ['Department', field('employeeDepartment')], ['Employment type', field('employmentType')], ['Joining date', formatDate(field('joiningDate'))], ['Work location', field('workLocation')]]} />
          </Panel>
          <Panel title="Employment documents" description="Experience letters and salary slips uploaded by the candidate.">
            <DocumentList documents={docsOf('employment')} origin={origin} emptyText="No employment documents uploaded yet." />
          </Panel>
        </div>
      )}

      {tab === 'addresses' && (
        <div className="space-y-5">
          <Panel title="Address information" description="Addresses submitted by the candidate, kept separate for review.">
            <div className="grid gap-4 md:grid-cols-2">
              {([['Current address', field('currentAddress')], ['Permanent address', field('permanentAddress')]] as [string, unknown][]).map(([label, value]) => (
                <div key={label} className="min-h-32 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
                  <h3 className="text-sm font-semibold">{label}</h3>
                  <p className={`mt-2 whitespace-pre-wrap text-sm leading-6 ${isFilled(value) ? '' : 'text-[var(--muted)]'}`}>{valueOrDash(value)}</p>
                </div>
              ))}
            </div>
          </Panel>
          <Panel title="Address proof" description="Documents that confirm the candidate's address.">
            <DocumentList documents={docsOf('address')} origin={origin} emptyText="No address proof uploaded yet." />
          </Panel>
        </div>
      )}

      {tab === 'documents' && (
        <Panel title="All documents" description="Every file the candidate has uploaded, with its verification status.">
          <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Filter documents">
            {(['all', 'identity', 'education', 'employment', 'address', 'other'] as const).map((key) => {
              const count = key === 'all' ? documents.length : docsOf(key).length;
              return (
                <button key={key} type="button" onClick={() => setDocFilter(key)} aria-pressed={docFilter === key} className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${docFilter === key ? 'border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]' : 'border-[var(--border)] text-[var(--muted)] hover:bg-[var(--surface-muted)]'}`}>
                  {key === 'all' ? 'All' : CATEGORY_LABEL[key]} ({count})
                </button>
              );
            })}
          </div>
          <DocumentList documents={filteredDocuments} origin={origin} emptyText={documents.length ? 'No documents in this category.' : 'No documents uploaded yet.'} showCategory />
        </Panel>
      )}

      {tab === 'portal' && (
        <div className="space-y-5">
          <section className={`rounded-2xl border p-5 sm:p-6 ${stateInfo.panel}`}>
            <div className="flex items-start gap-4">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/70"><StateIcon size={22} aria-hidden="true" /></span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold">Portal link is {stateInfo.label.toLowerCase()}</h2>
                </div>
                <p className="mt-1 text-sm">
                  {state === 'none' && 'The candidate has no portal link yet. Activate one so they can submit their details and documents.'}
                  {state === 'active' && `The candidate can open the portal. It expires on ${formatDateTime(expiresAt)} (${formatDuration(remainingMs)} remaining).`}
                  {state === 'expiring' && `The link is active and the candidate can still open it. It expires on ${formatDateTime(expiresAt)} (${formatDuration(remainingMs)} remaining). Extend it to give the candidate more time.`}
                  {state === 'expired' && `This link expired ${formatDuration(remainingMs)} ago, on ${formatDateTime(expiresAt)}. The candidate cannot open it. Resend the invitation to give them a new link.`}
                  {state === 'locked' && `An admin locked this link${portal?.revokedAt ? ` on ${formatDateTime(portal.revokedAt)}` : ''}. The candidate cannot open it.${expired ? ' It has also expired, so resend the invitation to replace it.' : ' Unlock it to restore access.'}`}
                </p>
              </div>
            </div>
          </section>

          <Panel title="Link details" description="Current status of the candidate's portal link.">
            <InfoGrid rows={[
              ['Status', stateInfo.label],
              ['Activated on', portal ? formatDateTime(portal.activatedAt) : null],
              ['Last email sent', portal ? (portal.lastSentAt ? formatDateTime(portal.lastSentAt) : 'Not recorded') : null],
              [expired ? 'Expired on' : 'Expires on', portal ? formatDateTime(portal.expiresAt) : null],
              ['Time remaining', portal && !expired ? formatDuration(remainingMs) : null],
              ['Locked on', portal?.revokedAt ? formatDateTime(portal.revokedAt) : null],
              ['Reminders sent', portal ? portal.reminderCount || 0 : null],
              ['Last reminder', portal ? (portal.lastRemindedAt ? formatDateTime(portal.lastRemindedAt) : 'No reminders sent') : null],
            ]} />
            {portal && (
              <div className="mt-5 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-4">
                <p className="text-xs font-medium text-[var(--muted)]">Most recently issued portal URL</p>
                {portal?.url ? (
                  <>
                    {(state === 'active' || state === 'expiring')
                      ? <a href={portal.url} target="_blank" rel="noopener noreferrer" className="mt-1 block break-all text-sm font-medium text-[var(--primary)] underline-offset-2 hover:underline">{portal.url}</a>
                      : <p className="mt-1 break-all text-sm text-[var(--muted)]">{portal.url}</p>}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button type="button" onClick={() => void copyActivePortalLink()} className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-semibold"><Copy size={14} aria-hidden="true" />Copy link</button>
                      {(state === 'active' || state === 'expiring') && <a href={portal.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-semibold"><ExternalLink size={14} aria-hidden="true" />Open portal</a>}
                    </div>
                  </>
                ) : (
                  <p className="mt-1 text-sm text-[var(--muted)]">The URL is not available for this existing link. Extend or resend it to generate a shareable URL.</p>
                )}
              </div>
            )}
          </Panel>

          <Panel title="Manage access" description="Only company admins can activate, resend, extend or lock this link.">
            <div className="space-y-5">
              {(state !== 'locked' || needsResend) && (
                <div className="space-y-4">
                  <DurationPicker value={daysInput} onChange={setDaysInput} valid={daysValid} />
                  {newExpiry && <p className="text-sm text-[var(--muted)]">{needsResend ? 'The new link will' : 'The link will'} stay active until <span className="font-medium text-[var(--foreground)]">{formatDateTime(newExpiry)}</span>.</p>}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3">
                {state === 'none' && (
                  <button type="button" onClick={() => issueLink('activate')} disabled={busy || !daysValid} className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-[var(--primary-foreground)] disabled:opacity-50">
                    {busy ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Link2 size={15} aria-hidden="true" />}Activate link
                  </button>
                )}
                {needsResend && (
                  <button type="button" onClick={() => issueLink('resend')} disabled={busy || !daysValid} className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-[var(--primary-foreground)] disabled:opacity-50">
                    {busy ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Send size={15} aria-hidden="true" />}Resend invitation
                  </button>
                )}
                {(state === 'active' || state === 'expiring') && (
                  <button type="button" onClick={() => issueLink('extend')} disabled={busy || !daysValid} className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-[var(--primary-foreground)] disabled:opacity-50">
                    {busy ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Clock size={15} aria-hidden="true" />}Extend link
                  </button>
                )}
                {(state === 'active' || state === 'expiring') && (
                  <button type="button" onClick={sendPortalReminder} disabled={busy} className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm font-semibold hover:bg-[var(--surface-muted)] disabled:opacity-50">
                    {busy ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Mail size={15} aria-hidden="true" />}Send reminder email
                  </button>
                )}
                {state === 'locked' && !expired && (
                  <button type="button" onClick={() => setLocked(false)} disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-[var(--primary-foreground)] disabled:opacity-50">
                    {busy ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Unlock size={15} aria-hidden="true" />}Unlock link
                  </button>
                )}
                {(state === 'active' || state === 'expiring') && !confirmLock && (
                  <button type="button" onClick={() => setConfirmLock(true)} disabled={busy} className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm font-semibold hover:bg-[var(--surface-muted)] disabled:opacity-50">
                    <Lock size={15} aria-hidden="true" />Lock link
                  </button>
                )}
              </div>

              {confirmLock && (
                <div role="alertdialog" aria-label="Confirm lock" className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-red-800">Lock this link? The candidate will not be able to open the portal until you unlock it.</p>
                  <div className="flex shrink-0 gap-2">
                    <button type="button" onClick={() => setLocked(true)} disabled={busy} className="rounded-lg bg-red-600 px-3.5 py-2 text-sm font-semibold text-white disabled:opacity-50">Lock link</button>
                    <button type="button" onClick={() => setConfirmLock(false)} className="rounded-lg border border-red-200 bg-white px-3.5 py-2 text-sm font-semibold text-red-800">Cancel</button>
                  </div>
                </div>
              )}
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}