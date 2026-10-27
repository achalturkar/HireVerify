'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { Activity, ArrowRight, ArrowUpRight, CheckCircle2, Clock3, Copy, Download, FileCheck2, FileText, KeyRound, Mail, MessageSquareText, Phone, Plus, RefreshCw, Receipt, Sparkles, Users, X, Eye, Search } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useAuth } from '@/src/auth/AuthProvider';
import { useClientPortalBrand } from '@/src/auth/ClientPortalBrandContext';
import { changePassword } from '@/src/lib/api/users';
import { getReportVerificationStatus, getVerificationStatus } from '@/src/lib/verification-status';
import { formatCandidateName, splitCandidateName } from '@/src/lib/candidate-name';
import { resolveLogoUrl } from '@/src/lib/logo';
import {
  ClientPortalApiError,
  downloadPortalReport,
  getPortalDashboard,
  hasPortalPermission,
  listPortalCandidates,
  listPortalSubclients,
  listPortalCases,
  listPortalReports,
  invitePortalCandidate,
  savePortalCandidate,
  type PortalCandidate,
  type PortalCase,
  type PortalDashboardSummary,
  type PortalListFilters,
  type PortalReport,
  type PortalSubclient,
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
  fullName: '', email: '', phone: '', dateOfBirth: '', gender: '', subclientId: '',
};

function errorMessage(error: unknown, fallback: string) {
  return error instanceof ClientPortalApiError ? error.message : fallback;
}

function dateText(value: string | null | undefined) {
  return value ? new Date(value).toLocaleDateString() : '—';
}

function dateTimeText(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Date unavailable'
    : new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
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
  const portalBrand = useClientPortalBrand();
  const isPortalAdmin = user?.role.isCompanyAdmin ?? false;
  const isPortalUser = Boolean(user?.role.isClientUser || isPortalAdmin);
  const availableTabs = useMemo(
    () => (['candidates', 'cases', 'reports'] as const).filter((key) => hasPortalPermission(permissions, PERMISSION_TAB[key], isPortalAdmin)),
    [isPortalAdmin, permissions],
  );
  const section = pathname.split('/')[2] || 'dashboard';
  const tab = (['candidates', 'cases', 'reports'].includes(section) ? section : 'candidates') as PortalTab;
  const activeTab = availableTabs.includes(tab) ? tab : availableTabs[0] ?? 'candidates';
  const [page, setPage] = useState(1);
  const [candidates, setCandidates] = useState<PortalCandidate[]>([]);
  const [cases, setCases] = useState<PortalCase[]>([]);
  const [reports, setReports] = useState<PortalReport[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState<PortalListFilters>({ search: '', status: '', dateFrom: '', dateTo: '' });
  const [subclients, setSubclients] = useState<PortalSubclient[]>([]);
  const [subclientsError, setSubclientsError] = useState<string | null>(null);
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
  const [dashboard, setDashboard] = useState<PortalDashboardSummary | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [analyticsPeriod, setAnalyticsPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [analyticsYear, setAnalyticsYear] = useState(new Date().getFullYear());
  const [analyticsCurrency, setAnalyticsCurrency] = useState('');
  const updateFilter = (key: keyof PortalListFilters, value: string) => {
    setPage(1);
    setFilters((current) => ({ ...current, [key]: value }));
  };
  const canViewSubclients =
    hasPortalPermission(permissions, 'clientportal.subclients.view', isPortalAdmin) ||
    hasPortalPermission(permissions, 'clientportal.subclients.manage', isPortalAdmin);

  useEffect(() => {
    if (!canViewSubclients) return;
    let active = true;
    listPortalSubclients(accessToken)
      .then((result) => {
        if (active) setSubclients(result);
      })
      .catch((loadError: unknown) => {
        if (active) setSubclientsError(errorMessage(loadError, 'Could not load subclients.'));
      });
    return () => { active = false; };
  }, [accessToken, canViewSubclients]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace('/login');
    } else if (!user.role.isClientUser && !user.role.isCompanyAdmin) {
      router.replace(user.role.isSuperAdmin ? '/super-admin/dashboard' : '/company/dashboard');
    }
  }, [authLoading, router, user]);

  const loadTab = useCallback(async () => {
    setLoading(true);
    setError(null);
    const candidateFilters = filters;
    const caseFilters = { search: filters.search, status: filters.status, dateFrom: filters.dateFrom, dateTo: filters.dateTo, subclientId: filters.subclientId };
    try {
      if (activeTab === 'candidates' && hasPortalPermission(permissions, 'clientportal.candidates.view', isPortalAdmin)) {
        const result = await listPortalCandidates(page, accessToken, candidateFilters);
        setCandidates(result.items);
        setTotal(result.total);
        setTotalPages(result.totalPages);
      } else if (activeTab === 'cases' && hasPortalPermission(permissions, 'clientportal.cases.view', isPortalAdmin)) {
        const result = await listPortalCases(page, accessToken, caseFilters);
        setCases(result.items);
        setTotal(result.total);
        setTotalPages(result.totalPages);
      } else if (activeTab === 'reports' && hasPortalPermission(permissions, 'clientportal.reports.view', isPortalAdmin)) {
        const result = await listPortalReports(page, accessToken, caseFilters);
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
  }, [accessToken, activeTab, filters, isPortalAdmin, page, permissions]);

  useEffect(() => {
    if (authLoading || !isPortalUser || !['candidates', 'cases', 'reports'].includes(section) || !availableTabs.includes(activeTab)) return;
    const timer = window.setTimeout(() => { void loadTab(); }, 250);
    return () => window.clearTimeout(timer);
  }, [activeTab, authLoading, availableTabs, isPortalUser, loadTab, section]);

  const loadDashboard = useCallback(async () => {
    setDashboardLoading(true);
    setDashboardError(null);
    try {
      setDashboard(await getPortalDashboard(accessToken, analyticsPeriod, analyticsYear));
    } catch (loadError) {
      setDashboardError(errorMessage(loadError, 'Could not load dashboard data.'));
    } finally {
      setDashboardLoading(false);
    }
  }, [accessToken, analyticsPeriod, analyticsYear]);

  useEffect(() => {
    if (authLoading || !isPortalUser || section !== 'dashboard') return;
    const timer = window.setTimeout(() => { void loadDashboard(); }, 0);
    return () => window.clearTimeout(timer);
  }, [authLoading, isPortalUser, loadDashboard, section]);

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
      const candidateName = splitCandidateName(candidateValues.fullName);
      if (!candidateName) {
        setCandidateError('Enter the candidate’s full name, including first and last name.');
        return;
      }
      const payload = {
        ...Object.fromEntries(Object.entries(candidateValues)
          .filter(([key]) => key !== 'fullName')
          .map(([key, value]) => [key, value.trim() || null])),
        ...candidateName,
      };
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

  if (authLoading || !user || (!user.role.isClientUser && !user.role.isCompanyAdmin)) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-[var(--muted)]">Loading client portal…</div>;
  }

  const canCreateCandidates = hasPortalPermission(permissions, 'clientportal.candidates.create', isPortalAdmin);
  const canInviteCandidates = hasPortalPermission(permissions, 'clientportal.candidates.invite', isPortalAdmin) || canCreateCandidates;
  const canDownloadReports = hasPortalPermission(permissions, 'clientportal.reports.download', isPortalAdmin);
  const client = portalBrand ?? user.client;
  const clientLogo = resolveLogoUrl(client?.logoUrl);
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
          <dl className="mt-4 grid gap-4 text-[12px] sm:grid-cols-2">{[['Client code', client?.clientCode], ['Industry', client?.industry], ['Support email', client?.supportEmail], ['Support phone', client?.supportPhone], ['Website', client?.website], ['Address', [client?.addressLine1, client?.addressLine2, client?.city, client?.state, client?.postalCode, client?.country].filter(Boolean).join(', ') || null]].map(([label, value]) => <div key={label}><dt className="text-[10px] uppercase tracking-wide text-[var(--muted)]">{label}</dt><dd className="mt-1 break-words">{value || '—'}</dd></div>)}</dl>
        </section>
      </section>
    );
  }

  if (section === 'dashboard') {
    const metrics = [
      ...(dashboard?.permissions.candidates ? [{
        label: 'Candidates',
        value: dashboard.counts.candidates,
        icon: Users,
        href: '/client-portal/candidates',
        detail: 'Candidate records in your workspace',
        accent: 'text-sky-600 bg-sky-500/10',
        iconBg: 'bg-sky-500/10 text-sky-700',
      }] : []),
      ...(dashboard?.permissions.cases ? [{
        label: 'BGV cases',
        value: dashboard.counts.cases,
        icon: FileCheck2,
        href: '/client-portal/cases',
        detail: `${(dashboard.counts.openCases ?? 0).toLocaleString()} currently in progress`,
        accent: 'text-amber-600 bg-amber-500/10',
        iconBg: 'bg-amber-500/10 text-amber-700',
      }] : []),
      ...(dashboard?.permissions.cases ? [{
        label: 'Completed cases',
        value: dashboard.counts.completedCases,
        icon: Activity,
        href: '/client-portal/cases',
        detail: 'Verification checks completed',
        accent: 'text-emerald-600 bg-emerald-500/10',
        iconBg: 'bg-emerald-500/10 text-emerald-700',
      }] : []),
      ...(dashboard?.permissions.reports ? [{
        label: 'Available reports',
        value: dashboard.counts.reports,
        icon: FileText,
        href: '/client-portal/reports',
        detail: 'Completed reports ready to view',
        accent: 'text-violet-600 bg-violet-500/10',
        iconBg: 'bg-violet-500/10 text-violet-700',
      }] : []),
      ...(dashboard?.permissions.invoices ? [{
        label: 'Invoices',
        value: dashboard.counts.invoices,
        icon: Receipt,
        detail: 'Issued invoices to review',
        accent: 'text-violet-600 bg-violet-500/10',
        iconBg: 'bg-violet-500/10 text-violet-700',
        href: '/client-portal/invoices',
      }] : []),
    ];
    const chartHasData = dashboard?.monthlyActivity.some((month) => (month.candidates ?? 0) > 0 || (month.cases ?? 0) > 0 || (month.reports ?? 0) > 0 || (month.invoices ?? 0) > 0) ?? false;
    const invoiceCurrencies = dashboard?.invoiceAnalytics.map((item) => item.currency) ?? [];
    const activeCurrency = invoiceCurrencies.includes(analyticsCurrency) ? analyticsCurrency : invoiceCurrencies[0] || 'INR';
    const selectedInvoiceAnalytics = dashboard?.invoiceAnalytics.find((item) => item.currency === activeCurrency);
    const financialTrend = dashboard?.financialActivity.map((item) => ({
      label: item.label,
      invoiced: item.currencies.find((currency) => currency.currency === activeCurrency)?.invoiced ?? 0,
      paid: item.currencies.find((currency) => currency.currency === activeCurrency)?.paid ?? 0,
    })) ?? [];
    const formatMoney = (value: number) => new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: activeCurrency,
      maximumFractionDigits: 0,
    }).format(value);
    const quickLinks = [
      ...(dashboard?.permissions.cases ? [{
        label: 'Track case progress',
        description: 'See what is in progress',
        href: '/client-portal/cases',
        icon: FileCheck2,
        accent: 'bg-emerald-500/10 text-emerald-700',
      }] : []),
      ...(hasPortalPermission(permissions, 'clientportal.reports.view', isPortalAdmin) ? [{
        label: 'View reports',
        description: 'Open completed verifications',
        href: '/client-portal/reports',
        icon: FileText,
        accent: 'bg-violet-500/10 text-violet-700',
      }] : []),
      ...(dashboard?.permissions.invoices ? [{
        label: 'Review invoices',
        description: 'Check billing and payment status',
        href: '/client-portal/invoices',
        icon: Receipt,
        accent: 'bg-amber-500/10 text-amber-700',
      }] : []),
      {
        label: 'Request support',
        description: 'Ask your account team for help',
        href: '/client-portal/requests',
        icon: MessageSquareText,
        accent: 'bg-sky-500/10 text-sky-700',
      },
    ];
    const recentUpdateGroups = [
      ...(dashboard?.permissions.candidates ? [{
        id: 'candidates',
        title: 'Candidates',
        count: dashboard.counts.candidates ?? 0,
        countLabel: 'candidate records',
        href: '/client-portal/candidates',
        icon: Users,
        accent: 'bg-sky-500/10 text-sky-700',
        latest: dashboard.recentCandidates[0] ? {
          title: dashboard.recentCandidates[0].fullName,
          detail: `${dashboard.recentCandidates[0].candidateCode} · New candidate`,
          date: dateTimeText(dashboard.recentCandidates[0].createdAt),
          href: `/client-portal/candidates/${dashboard.recentCandidates[0].id}`,
          action: 'View candidate',
        } : null,
      }] : []),
      ...(dashboard?.permissions.cases ? [{
        id: 'cases',
        title: 'BGV cases',
        count: dashboard.counts.cases ?? 0,
        countLabel: 'total cases',
        href: '/client-portal/cases',
        icon: FileCheck2,
        accent: 'bg-amber-500/10 text-amber-700',
        latest: dashboard.recentCases[0] ? {
          title: `Case ${dashboard.recentCases[0].caseNumber}`,
          detail: `${formatCandidateName(dashboard.recentCases[0].candidate)} · ${dashboard.recentCases[0].status.replaceAll('_', ' ')}`,
          date: dateTimeText(dashboard.recentCases[0].createdAt),
          href: `/client-portal/cases/${dashboard.recentCases[0].id}`,
          action: 'View case',
        } : null,
      }] : []),
      ...(dashboard?.permissions.reports ? [{
        id: 'reports',
        title: 'Completed reports',
        count: dashboard.counts.reports ?? 0,
        countLabel: 'reports completed',
        href: '/client-portal/reports',
        icon: FileText,
        accent: 'bg-emerald-500/10 text-emerald-700',
        latest: dashboard.recentReports[0] ? {
          title: `Report for ${formatCandidateName(dashboard.recentReports[0].candidate)}`,
          detail: `${dashboard.recentReports[0].caseNumber} · Completed`,
          date: dateTimeText(dashboard.recentReports[0].completedAt),
          href: '/client-portal/reports',
          action: 'View reports',
        } : null,
      }] : []),
      ...(dashboard?.permissions.invoices ? [{
        id: 'invoices',
        title: 'Invoices',
        count: dashboard.counts.invoices ?? 0,
        countLabel: 'issued invoices',
        href: '/client-portal/invoices',
        icon: Receipt,
        accent: 'bg-violet-500/10 text-violet-700',
        latest: dashboard.recentInvoices[0] ? {
          title: dashboard.recentInvoices[0].invoiceNumber,
          detail: `${dashboard.recentInvoices[0].status.replaceAll('_', ' ')} · ${new Intl.NumberFormat('en-IN', { style: 'currency', currency: dashboard.recentInvoices[0].currency, maximumFractionDigits: 2 }).format(dashboard.recentInvoices[0].total)}`,
          date: dateTimeText(dashboard.recentInvoices[0].invoiceDate),
          href: '/client-portal/invoices',
          action: 'View invoices',
        } : null,
      }] : []),
    ];

    return (
      <div className="space-y-6">
        <section className="relative isolate overflow-hidden rounded-3xl bg-[var(--primary)] px-5 py-6 text-[var(--primary-foreground)] shadow-lg shadow-[var(--primary)]/10 sm:px-8 sm:py-8">
          <div aria-hidden="true" className="absolute -right-10 -top-28 -z-10 h-72 w-72 rounded-full border-[36px] border-current opacity-[0.07]" />
          <div aria-hidden="true" className="absolute -bottom-28 right-36 -z-10 h-56 w-56 rounded-full border-[28px] border-current opacity-[0.06]" />
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-current/20 bg-black/5 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em]">
                <Sparkles size={12} /> Client workspace
              </div>
              <div className="mt-4 flex items-center gap-3">
                {clientLogo && <Image src={clientLogo} alt={`${client?.name ?? 'Client'} logo`} width={64} height={64} unoptimized className="h-14 w-14 shrink-0 rounded-xl bg-white object-contain p-1.5" />}
                <h2 className="min-w-0 break-words text-2xl font-semibold tracking-tight sm:text-3xl">{client?.name ?? 'Your organization'}</h2>
              </div>
              <p className="mt-2 max-w-xl text-[13px] leading-6 opacity-80">
                Here&apos;s your organization&apos;s background verification overview. Follow candidate and case activity, find reports, and keep billing on track.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] font-medium opacity-80">
                {client?.clientCode && <span className="inline-flex items-center gap-1.5"><span className="opacity-60">Client ID</span>{client.clientCode}</span>}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {hasPortalPermission(permissions, 'clientportal.candidates.create', isPortalAdmin) && (
                <Link href="/client-portal/candidates" className="inline-flex w-fit shrink-0 items-center justify-center gap-2 rounded-xl bg-[var(--primary-foreground)] px-4 py-2.5 text-[12px] font-semibold text-[var(--primary)] shadow-sm transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current">
                  <Plus size={15} />Add candidate
                </Link>
              )}
              <button type="button" onClick={() => void loadDashboard()} disabled={dashboardLoading} className="inline-flex w-fit shrink-0 items-center justify-center gap-2 rounded-xl border border-current/25 bg-black/5 px-4 py-2.5 text-[12px] font-semibold transition hover:bg-black/10 disabled:opacity-50">
                <RefreshCw size={14} className={dashboardLoading ? 'animate-spin' : ''} />{dashboardLoading ? 'Refreshing…' : 'Refresh overview'}
              </button>
            </div>
          </div>
        </section>

        {(dashboard?.supportContact?.email || dashboard?.supportContact?.phone) && (
          <section aria-label="Candidate support contacts" className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-[13px] font-semibold">Candidate support</h3>
              <p className="mt-1 text-[11px] text-[var(--muted)]">Contact details for candidate portal support.</p>
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {dashboard.supportContact.email && (
                <a href={`mailto:${dashboard.supportContact.email}`} className="inline-flex items-center gap-2 text-[12px] font-medium text-[var(--primary)] hover:underline">
                  <Mail size={14} aria-hidden="true" />{dashboard.supportContact.email}
                </a>
              )}
              {dashboard.supportContact.phone && (
                <a href={`tel:${dashboard.supportContact.phone.replace(/[^\d+]/g, '')}`} className="inline-flex items-center gap-2 text-[12px] font-medium text-[var(--primary)] hover:underline">
                  <Phone size={14} aria-hidden="true" />{dashboard.supportContact.phone}
                </a>
              )}
            </div>
          </section>
        )}

        {dashboard?.notifications.length ? <section aria-label="Client portal notifications" className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4 sm:px-6">
            <div><h3 className="text-[14px] font-semibold">Latest notifications</h3><p className="mt-1 text-[11px] text-[var(--muted)]">New candidates, completed cases, reports, invoices, and payments.</p></div>
            <span className="rounded-full bg-[var(--primary)]/10 px-2.5 py-1 text-[10px] font-semibold text-[var(--primary)]">{dashboard.notifications.length} updates</span>
          </div>
          <div className="grid divide-y divide-[var(--border)] md:grid-cols-2 md:divide-y-0">
            {dashboard.notifications.slice(0, 6).map((item) => <Link key={item.id} href={item.href} className="flex min-w-0 items-start gap-3 px-5 py-3.5 transition hover:bg-[var(--surface-muted)] sm:px-6">
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[var(--primary)]" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[11px] font-semibold">{item.title}</span>
                <span className="mt-0.5 block truncate text-[10px] text-[var(--muted)]">{item.description}</span>
              </span>
              <span className="shrink-0 text-[9px] text-[var(--muted)]">{dateText(item.createdAt)}</span>
            </Link>)}
          </div>
        </section> : null}

        <section aria-label="Recent portal updates" className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-4 sm:px-6">
            <div>
              <h3 className="text-[14px] font-semibold">Recent updates</h3>
              <p className="mt-1 text-[11px] text-[var(--muted)]">A quick count and the latest update for each area.</p>
            </div>
            <span className="rounded-full bg-[var(--surface-muted)] px-2.5 py-1 text-[10px] font-medium text-[var(--muted)]">By category</span>
          </div>
          {dashboardLoading && !dashboard
            ? <div className="grid gap-3 p-5 sm:grid-cols-2 sm:px-6 xl:grid-cols-3" aria-label="Loading recent updates">
              {[1, 2, 3].map((item) => <div key={item} className="h-36 animate-pulse rounded-xl border border-[var(--border)] p-4"><div className="h-3 w-24 rounded bg-[var(--surface-muted)]" /><div className="mt-4 h-8 w-16 rounded bg-[var(--surface-muted)]" /><div className="mt-4 h-3 w-40 rounded bg-[var(--surface-muted)]" /></div>)}
            </div>
            : recentUpdateGroups.length === 0
              ? <div className="px-5 py-8 text-center sm:px-6">
                <Activity size={21} className="mx-auto text-[var(--muted)]" />
                <p className="mt-2 text-[12px] font-medium">No update categories available</p>
                <p className="mt-1 text-[11px] text-[var(--muted)]">Ask your administrator for access to cases, reports, or invoices.</p>
              </div>
              : <div className="grid gap-3 p-5 sm:grid-cols-2 sm:px-6 xl:grid-cols-3">
                {recentUpdateGroups.map(({ id, title, count, countLabel, href, icon: Icon, accent, latest }) => <article key={id} className="flex min-h-[174px] flex-col rounded-xl border border-[var(--border)] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold text-[var(--muted)]">{title}</p>
                      <p className="mt-1 text-2xl font-semibold tabular-nums">{count.toLocaleString()}</p>
                      <p className="text-[10px] text-[var(--muted)]">{countLabel}</p>
                    </div>
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${accent}`}><Icon size={16} /></span>
                  </div>
                  <div className="mt-4 border-t border-[var(--border)] pt-3">
                    {latest ? (
                      <>
                        <p className="truncate text-[11px] font-semibold" title={latest.title}>{latest.title}</p>
                        <p className="mt-1 truncate text-[10px] text-[var(--muted)]" title={latest.detail}>{latest.detail}</p>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <span className="truncate text-[9px] text-[var(--muted)]">{latest.date}</span>
                          <Link href={latest.href} className="inline-flex shrink-0 items-center gap-1 text-[10px] font-semibold text-[var(--primary)] hover:underline">
                            {latest.action}<ArrowUpRight size={12} />
                          </Link>
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[10px] text-[var(--muted)]">No recent updates in this area.</p>
                        <Link href={href} className="inline-flex shrink-0 items-center gap-1 text-[10px] font-semibold text-[var(--primary)] hover:underline">
                          View all<ArrowUpRight size={12} />
                        </Link>
                      </div>
                    )}
                  </div>
                </article>)}
              </div>}
        </section>

        {dashboardError && <p role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-500/20 bg-rose-500/5 px-4 py-3 text-[12px] text-rose-700"><span>{dashboardError}</span><button type="button" onClick={() => void loadDashboard()} className="font-semibold underline underline-offset-2">Try again</button></p>}
        {dashboardLoading && !dashboard
          ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Loading dashboard">
            {[1, 2, 3, 4].map((item) => <div key={item} className="h-36 animate-pulse rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"><div className="h-3 w-24 rounded bg-[var(--surface-muted)]" /><div className="mt-5 h-8 w-16 rounded bg-[var(--surface-muted)]" /><div className="mt-3 h-3 w-40 rounded bg-[var(--surface-muted)]" /></div>)}
          </div>
          : dashboard && metrics.length === 0
            ? <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-5 py-12 text-center"><ShieldCheckIcon /><h2 className="mt-3 text-[15px] font-semibold">Dashboard access is not set up yet</h2><p className="mx-auto mt-1 max-w-md text-[12px] leading-5 text-[var(--muted)]">Ask your client administrator to enable access to candidate records, case progress, reports, or invoices.</p></section>
            : dashboard && (
              <>
                <section aria-label="Client activity summary" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {metrics.map(({ label, value, icon: Icon, href, detail, iconBg }) => {
                    const content = <div className="group flex min-h-[150px] items-start justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-[var(--primary)]/40 hover:shadow-md">
                      <div className="min-w-0"><p className="text-[12px] font-semibold text-[var(--muted)]">{label}</p><p className="mt-3 text-3xl font-semibold tracking-tight tabular-nums">{(value ?? 0).toLocaleString()}</p><p className="mt-1.5 max-w-[210px] text-[11px] leading-4 text-[var(--muted)]">{detail}</p></div>
                      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconBg}`}><Icon size={19} /></span>
                      {href && <span className="mt-auto self-end text-[var(--muted)] transition group-hover:text-[var(--primary)]"><ArrowUpRight size={15} /></span>}
                    </div>;
                    return href ? <Link key={label} href={href} className="block rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]">{content}</Link> : <div key={label}>{content}</div>;
                  })}
                </section>

                {quickLinks.length > 0 && <section aria-label="Quick actions" className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--primary)]/10 text-[var(--primary)]"><Sparkles size={16} /></span>
                    <div><h3 className="text-[14px] font-semibold">Quick actions</h3><p className="mt-0.5 text-[11px] text-[var(--muted)]">Jump straight to the work you need to do.</p></div>
                  </div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                    {quickLinks.map(({ label, description, href, icon: Icon, accent }) => <Link key={label} href={href} className="group flex items-center gap-3 rounded-xl border border-[var(--border)] p-3 transition hover:border-[var(--primary)]/40 hover:bg-[var(--surface-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]">
                      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${accent}`}><Icon size={17} /></span>
                      <span className="min-w-0 flex-1"><span className="block text-[12px] font-semibold">{label}</span><span className="mt-0.5 block text-[10px] leading-4 text-[var(--muted)]">{description}</span></span>
                      <ArrowRight size={14} className="shrink-0 text-[var(--muted)] transition group-hover:translate-x-0.5 group-hover:text-[var(--primary)]" />
                    </Link>)}
                  </div>
                </section>}

                <div className="grid gap-4 xl:grid-cols-[1.4fr_0.6fr]">
                  {dashboard.monthlyActivity.length > 0 && <section className="min-w-0 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm sm:p-6">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div><h3 className="text-[14px] font-semibold">Workspace performance</h3><p className="mt-1 text-[11px] leading-5 text-[var(--muted)]">Candidate growth, BGV cases, completed reports, and invoice volume.</p></div>
                      <div className="flex flex-wrap items-center gap-2">
                        <select aria-label="Analytics time grouping" value={analyticsPeriod} onChange={(event) => setAnalyticsPeriod(event.target.value as 'monthly' | 'yearly')} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-2 text-[10px] font-semibold">
                          <option value="monthly">Monthly</option><option value="yearly">Yearly</option>
                        </select>
                        <select aria-label="Analytics year" value={analyticsYear} onChange={(event) => setAnalyticsYear(Number(event.target.value))} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-2 text-[10px] font-semibold">
                          {Array.from({ length: 6 }, (_, index) => new Date().getFullYear() - index).map((year) => <option key={year} value={year}>{analyticsPeriod === 'yearly' ? `Through ${year}` : year}</option>)}
                        </select>
                      </div>
                    </div>
                    {chartHasData
                      ? <div className="mt-5 h-[300px] w-full" role="img" aria-label="Line chart showing monthly candidate, BGV case, completed report, and invoice activity">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={dashboard.monthlyActivity} margin={{ top: 10, right: 18, left: -18, bottom: 0 }}>
                            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: 'var(--muted)', fontSize: 11 }} />
                            <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: 'var(--muted)', fontSize: 11 }} />
                            <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--foreground)', fontSize: 12 }} />
                            <Legend verticalAlign="bottom" height={28} wrapperStyle={{ fontSize: 11, color: 'var(--muted)' }} />
                            {dashboard.permissions.candidates && <Line type="monotone" dataKey="candidates" name="New candidates" stroke="#4D8FE8" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />}
                            {dashboard.permissions.cases && <Line type="monotone" dataKey="cases" name="BGV cases" stroke="#14A38B" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />}
                            {dashboard.permissions.reports && <Line type="monotone" dataKey="reports" name="Completed reports" stroke="#8B6BE8" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />}
                            {dashboard.permissions.invoices && <Line type="monotone" dataKey="invoices" name="Invoices" stroke="#E89B48" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />}
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                      : <div className="mt-5 flex h-[220px] flex-col items-center justify-center rounded-xl bg-[var(--surface-muted)] px-4 text-center">
                        <Activity size={22} className="text-[var(--muted)]" />
                        <p className="mt-3 text-[12px] font-medium">No activity to chart yet</p>
                        <p className="mt-1 max-w-sm text-[11px] leading-5 text-[var(--muted)]">When candidates, cases, reports, or invoices are added, this performance chart will update.</p>
                      </div>}
                  </section>}

                  {dashboard.permissions.cases && <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
                    <div className="border-b border-[var(--border)] px-5 py-4">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-700"><Clock3 size={15} /></span>
                        <div><h3 className="text-[13px] font-semibold">Cases in progress</h3><p className="mt-0.5 text-[10px] text-[var(--muted)]">Cases that may need follow-up</p></div>
                      </div>
                    </div>
                    <div className="px-5 py-5">
                      <p className="text-3xl font-semibold tabular-nums">{(dashboard.counts.openCases ?? 0).toLocaleString()}</p>
                      <p className="mt-1 text-[11px] leading-5 text-[var(--muted)]">{(dashboard.counts.openCases ?? 0) === 0 ? 'You’re all caught up. There are no open cases right now.' : 'These checks are not yet marked complete. Open case progress to see the latest updates.'}</p>
                      <Link href="/client-portal/cases" className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3 py-2 text-[11px] font-semibold text-[var(--primary-foreground)] hover:opacity-90">
                        View case progress <ArrowRight size={13} />
                      </Link>
                    </div>
                  </section>}
                </div>

                {dashboard.permissions.invoices && <section aria-label="Invoice analytics" className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--primary)]">Billing intelligence</p><h3 className="mt-1 text-[15px] font-semibold">Invoice performance</h3><p className="mt-1 text-[11px] text-[var(--muted)]">Lifetime billed, collected, outstanding, and overdue balances.</p></div>
                    <div className="flex items-center gap-2">
                      {invoiceCurrencies.length > 1 && <select aria-label="Invoice analytics currency" value={activeCurrency} onChange={(event) => setAnalyticsCurrency(event.target.value)} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-2 text-[10px] font-semibold">
                        {invoiceCurrencies.map((currency) => <option key={currency} value={currency}>{currency}</option>)}
                      </select>}
                      <Link href="/client-portal/invoices" className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-3 py-2 text-[10px] font-semibold hover:bg-[var(--surface-muted)]">All invoice activity<ArrowUpRight size={13} /></Link>
                    </div>
                  </div>
                  {!selectedInvoiceAnalytics
                    ? <div className="rounded-xl bg-[var(--surface-muted)] px-4 py-8 text-center text-[11px] text-[var(--muted)]">Invoice analytics will appear when invoices are issued.</div>
                    : <>
                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        {[
                          { label: 'Total invoiced', value: formatMoney(selectedInvoiceAnalytics.totalInvoiced), detail: `${selectedInvoiceAnalytics.invoices} issued invoices`, color: 'text-slate-700' },
                          { label: 'Payments received', value: formatMoney(selectedInvoiceAnalytics.totalPaid), detail: 'Recorded payments', color: 'text-emerald-700' },
                          { label: 'Outstanding', value: formatMoney(selectedInvoiceAnalytics.outstanding), detail: 'Balance to be paid', color: 'text-amber-700' },
                          { label: 'Overdue', value: formatMoney(selectedInvoiceAnalytics.overdue), detail: `${selectedInvoiceAnalytics.overdueInvoices} overdue invoices`, color: 'text-rose-700' },
                        ].map((metric) => <div key={metric.label} className="rounded-xl border border-[var(--border)] px-4 py-3">
                          <p className="text-[10px] font-medium text-[var(--muted)]">{metric.label}</p><p className={`mt-1 truncate text-lg font-semibold tabular-nums ${metric.color}`}>{metric.value}</p><p className="mt-1 text-[9px] text-[var(--muted)]">{metric.detail}</p>
                        </div>)}
                      </div>
                      <div className="h-[240px] w-full" role="img" aria-label={`Invoice amount billed and payments received by ${analyticsPeriod === 'monthly' ? 'month' : 'year'} in ${activeCurrency}`}>
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={financialTrend} margin={{ top: 8, right: 12, left: -14, bottom: 0 }}>
                            <defs>
                              <linearGradient id="invoiceBilledGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6C8FF5" stopOpacity={0.34} /><stop offset="100%" stopColor="#6C8FF5" stopOpacity={0.02} /></linearGradient>
                              <linearGradient id="invoicePaidGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#16A98C" stopOpacity={0.3} /><stop offset="100%" stopColor="#16A98C" stopOpacity={0.02} /></linearGradient>
                            </defs>
                            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: 'var(--muted)', fontSize: 10 }} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--muted)', fontSize: 10 }} />
                            <Tooltip formatter={(value) => formatMoney(Number(value ?? 0))} contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--foreground)', fontSize: 11 }} />
                            <Legend verticalAlign="bottom" height={24} wrapperStyle={{ fontSize: 10, color: 'var(--muted)' }} />
                            <Area type="monotone" dataKey="invoiced" name="Invoiced" stroke="#6C8FF5" strokeWidth={2} fill="url(#invoiceBilledGradient)" />
                            <Area type="monotone" dataKey="paid" name="Payments received" stroke="#16A98C" strokeWidth={2} fill="url(#invoicePaidGradient)" />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </>}
                </section>}

                {dashboard.permissions.cases && <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
                  <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
                    <div><h3 className="text-[14px] font-semibold">Recent BGV cases</h3><p className="mt-0.5 text-[11px] text-[var(--muted)]">The latest verification activity for your organization.</p></div>
                    <Link href="/client-portal/cases" className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--primary)] hover:underline">View all cases <ArrowRight size={13} /></Link>
                  </div>
                  {dashboard.recentCases.length === 0
                    ? <div className="px-5 py-10 text-center"><CheckCircle2 size={22} className="mx-auto text-emerald-600" /><p className="mt-3 text-[12px] font-medium">No BGV cases yet</p><p className="mt-1 text-[11px] text-[var(--muted)]">When a verification case is created, its latest progress will show here.</p></div>
                    : <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-[12px]">
                      <thead className="bg-[var(--surface-muted)]/60 text-[10px] uppercase tracking-wide text-[var(--muted)]"><tr><th className="px-5 py-3">Case</th><th className="px-5 py-3">Candidate</th><th className="px-5 py-3">Status</th><th className="px-5 py-3 text-right">Created</th></tr></thead>
                      <tbody className="divide-y divide-[var(--border)]">{dashboard.recentCases.map((item) => <tr key={item.id}>
                        <td className="px-5 py-3.5"><Link href={`/client-portal/cases/${item.id}`} className="font-mono font-medium text-[var(--primary)] hover:underline">{item.caseNumber}</Link></td>
                        <td className="px-5 py-3.5">{formatCandidateName(item.candidate)}<span className="block text-[10px] text-[var(--muted)]">{item.candidate.candidateCode}</span></td>
                        <td className="px-5 py-3.5"><Status value={item.status} /></td>
                        <td className="px-5 py-3.5 text-right text-[var(--muted)]">{dateText(item.createdAt)}</td>
                      </tr>)}</tbody>
                    </table></div>}
                </section>}

                {dashboard.permissions.invoices && <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
                  <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
                    <div><h3 className="text-[14px] font-semibold">Recent invoices</h3><p className="mt-0.5 text-[11px] text-[var(--muted)]">The latest billing documents issued to your organization.</p></div>
                    <Link href="/client-portal/invoices" className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--primary)] hover:underline">View all invoices <ArrowRight size={13} /></Link>
                  </div>
                  {dashboard.recentInvoices.length === 0
                    ? <div className="px-5 py-10 text-center"><Receipt size={21} className="mx-auto text-[var(--muted)]" /><p className="mt-3 text-[12px] font-medium">No invoices have been issued</p><p className="mt-1 text-[11px] text-[var(--muted)]">New billing documents will be available here when issued.</p></div>
                    : <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-[12px]">
                      <thead className="bg-[var(--surface-muted)]/60 text-[10px] uppercase tracking-wide text-[var(--muted)]"><tr><th className="px-5 py-3">Invoice</th><th className="px-5 py-3">Date</th><th className="px-5 py-3">Status</th><th className="px-5 py-3 text-right">Total</th></tr></thead>
                      <tbody className="divide-y divide-[var(--border)]">{dashboard.recentInvoices.map((invoice) => <tr key={invoice.id}>
                        <td className="px-5 py-3.5"><Link href="/client-portal/invoices" className="font-semibold text-[var(--primary)] hover:underline">{invoice.invoiceNumber}</Link></td>
                        <td className="px-5 py-3.5">{dateText(invoice.invoiceDate)}</td>
                        <td className="px-5 py-3.5"><Status value={invoice.status} /></td>
                        <td className="px-5 py-3.5 text-right tabular-nums">{new Intl.NumberFormat('en-IN', { style: 'currency', currency: invoice.currency, maximumFractionDigits: 2 }).format(invoice.total)}</td>
                      </tr>)}</tbody>
                    </table></div>}
                </section>}
              </>
            )}
      </div>
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
            <section aria-label={`${activeTab} filters`} className="grid gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
              <label className="relative block text-[10px] font-medium text-[var(--muted)]">Search
                <Search size={14} className="absolute left-3 top-[31px] text-[var(--muted)]" />
                <input value={filters.search || ''} onChange={(event) => updateFilter('search', event.target.value)} placeholder={activeTab === 'candidates' ? 'Name, email, or reference' : 'Case or candidate'} className={`${inputClass} pl-9`} />
              </label>
              <label className="block text-[10px] font-medium text-[var(--muted)]">Status
                <select value={filters.status || ''} onChange={(event) => updateFilter('status', event.target.value)} className={inputClass}>
                  <option value="">All statuses</option>
                  {(activeTab === 'candidates'
                    ? ['PENDING', 'INVITED', 'IN_PROGRESS', 'VERIFICATION_IN_PROGRESS', 'COMPLETED', 'WITHDRAWN', 'ON_HOLD']
                    : activeTab === 'cases'
                      ? ['DRAFT', 'INITIATED', 'CONSENT_PENDING', 'IN_PROGRESS', 'UNDER_REVIEW', 'COMPLETED', 'ON_HOLD', 'CANCELLED']
                      : ['CLEAR', 'MINOR_DISCREPANCY', 'MAJOR_DISCREPANCY', 'UNABLE_TO_VERIFY', 'REQUIRES_REVIEW']
                  ).map((status) => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}
                </select>
              </label>
              {canViewSubclients && <label className="block text-[10px] font-medium text-[var(--muted)]">Subclient
                <select value={filters.subclientId || ''} onChange={(event) => updateFilter('subclientId', event.target.value)} className={inputClass}>
                  <option value="">All {activeTab}</option>
                  <option value="none">Direct client {activeTab}</option>
                  {subclients.map((subclient) => <option key={subclient.id} value={subclient.id}>{subclient.name} ({subclient.clientCode})</option>)}
                </select>
                {subclientsError && <span className="mt-1 block text-rose-700">{subclientsError}</span>}
              </label>}
              <label className="block text-[10px] font-medium text-[var(--muted)]">{activeTab === 'reports' ? 'Completed from' : 'Created from'}
                <input type="date" value={filters.dateFrom || ''} max={filters.dateTo || undefined} onChange={(event) => updateFilter('dateFrom', event.target.value)} className={inputClass} />
              </label>
              <label className="block text-[10px] font-medium text-[var(--muted)]">{activeTab === 'reports' ? 'Completed to' : 'Created to'}
                <input type="date" value={filters.dateTo || ''} min={filters.dateFrom || undefined} onChange={(event) => updateFilter('dateTo', event.target.value)} className={inputClass} />
              </label>
            </section>

            <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
              <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4"><div><h2 className="text-[14px] font-semibold">{activeTab === 'candidates' ? 'Candidates' : activeTab === 'cases' ? 'BGV case progress' : 'Completed reports'}</h2><p className="mt-0.5 text-[11px] text-[var(--muted)]">{total} record{total === 1 ? '' : 's'}</p></div></div>
              {loading ? <p className="px-5 py-12 text-center text-[12px] text-[var(--muted)]">Loading…</p>
                : activeTab === 'candidates' ? (
                  candidates.length === 0 ? <EmptyState icon={<Users size={19} />} message="No candidates are available." />
                    : <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-[12px]"><thead className="bg-[var(--surface-muted)]/60 text-[10px] uppercase tracking-wide text-[var(--muted)]"><tr><th className="px-5 py-3">Reference</th><th className="px-5 py-3">Candidate</th><th className="px-5 py-3">Subclient</th><th className="px-5 py-3">Email / phone</th><th className="px-5 py-3">Status</th><th className="px-5 py-3 text-right">Details</th></tr></thead><tbody className="divide-y divide-[var(--border)]">{candidates.map((candidate) => <tr key={candidate.id}><td className="px-5 py-3.5 font-mono text-[11px] text-[var(--muted)]">{candidate.candidateCode}</td><td className="px-5 py-3.5 font-medium">{formatCandidateName(candidate)}</td><td className="px-5 py-3.5">{candidate.subclient ? <><span>{candidate.subclient.name}</span><span className="block font-mono text-[10px] text-[var(--muted)]">{candidate.subclient.clientCode}</span></> : <span className="text-[var(--muted)]">Direct client</span>}</td><td className="px-5 py-3.5 text-[var(--muted)]">{candidate.email || '—'}<span className="block text-[10px]">{candidate.phone || ''}</span></td><td className="px-5 py-3.5"><Status value={candidate.status} /></td><td className="px-5 py-3.5 text-right"><button type="button" onClick={() => router.push(`/client-portal/candidates/${candidate.id}`)} className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] px-2.5 py-1.5 text-[11px] hover:bg-[var(--surface-muted)]"><Eye size={13} />View</button></td></tr>)}</tbody></table></div>
                ) : activeTab === 'cases' ? (
                  cases.length === 0 ? <EmptyState icon={<FileCheck2 size={19} />} message="No BGV cases are available." />
                    : <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-[12px]"><thead className="bg-[var(--surface-muted)]/60 text-[10px] uppercase tracking-wide text-[var(--muted)]"><tr><th className="px-5 py-3">Case</th><th className="px-5 py-3">Candidate</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Verification status</th><th className="px-5 py-3">Initiated</th><th className="px-5 py-3">Completed</th><th className="px-5 py-3 text-right">Progress</th></tr></thead><tbody className="divide-y divide-[var(--border)]">{cases.map((item) => { const verification = getVerificationStatus(item.verificationStatuses); return <tr key={item.id}><td className="px-5 py-3.5 font-mono">{item.caseNumber}</td><td className="px-5 py-3.5">{formatCandidateName(item.candidate)}<span className="block text-[10px] text-[var(--muted)]">{item.candidate.candidateCode}</span></td><td className="px-5 py-3.5"><Status value={item.status} /></td><td className="px-5 py-3.5"><span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold ${verification.className}`}>{verification.label}</span></td><td className="px-5 py-3.5">{dateText(item.initiatedAt)}</td><td className="px-5 py-3.5">{dateText(item.completedAt)}</td><td className="px-5 py-3.5 text-right"><button type="button" onClick={() => router.push(`/client-portal/cases/${item.id}`)} className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] px-2.5 py-1.5 text-[11px] hover:bg-[var(--surface-muted)]"><Eye size={13} />View</button></td></tr>; })}</tbody></table></div>
                ) : reports.length === 0 ? <EmptyState icon={<FileText size={19} />} message="No completed reports are available." />
                  : <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-[12px]"><thead className="bg-[var(--surface-muted)]/60 text-[10px] uppercase tracking-wide text-[var(--muted)]"><tr><th className="px-5 py-3">Case</th><th className="px-5 py-3">Candidate</th><th className="px-5 py-3">Completed</th><th className="px-5 py-3">Verification status</th><th className="px-5 py-3 text-right">Report</th></tr></thead><tbody className="divide-y divide-[var(--border)]">{reports.map((report) => { const verification = getReportVerificationStatus(report.reportVerificationStatus); return <tr key={report.id}><td className="px-5 py-3.5 font-mono">{report.caseNumber}</td><td className="px-5 py-3.5">{formatCandidateName(report.candidate)}<span className="block text-[10px] text-[var(--muted)]">{report.candidate.candidateCode}</span></td><td className="px-5 py-3.5">{dateText(report.completedAt)}</td><td className="px-5 py-3.5"><span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold ${verification.className}`}>{verification.label}</span></td><td className="px-5 py-3.5 text-right">{canDownloadReports && <button type="button" disabled={downloadingReport === report.id} onClick={() => void downloadReport(report)} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-[11px] font-medium hover:bg-[var(--surface-muted)] disabled:opacity-50"><Download size={13} />{downloadingReport === report.id ? 'Downloading…' : 'PDF'}</button>}</td></tr>; })}</tbody></table></div>}
              <div className="flex flex-col items-center justify-between gap-3 border-t border-[var(--border)] px-5 py-3 text-[11px] text-[var(--muted)] sm:flex-row">
                <span>{total === 0 ? '0 records' : `${(page - 1) * 20 + 1}–${Math.min(page * 20, total)} of ${total} records`} · 20 per page</span>
                <div className="flex items-center gap-2"><span>Page {page} of {Math.max(1, totalPages)}</span><button type="button" disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)} className="rounded-md border border-[var(--border)] px-3 py-1.5 disabled:opacity-40">Previous</button><button type="button" disabled={page >= totalPages || loading} onClick={() => setPage((value) => value + 1)} className="rounded-md border border-[var(--border)] px-3 py-1.5 disabled:opacity-40">Next</button></div>
              </div>
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
                <label className="text-[12px] text-[var(--muted)] sm:col-span-2">Full name<input required autoComplete="name" type="text" value={candidateValues.fullName} onChange={(event) => setCandidateValues((value) => ({ ...value, fullName: event.target.value }))} className={inputClass} /></label>
                {canViewSubclients && <label className="text-[12px] text-[var(--muted)]">Assign to subclient<select value={candidateValues.subclientId} onChange={(event) => setCandidateValues((value) => ({ ...value, subclientId: event.target.value }))} className={inputClass}><option value="">Direct client candidate</option>{subclients.filter((subclient) => subclient.status === 'ACTIVE').map((subclient) => <option key={subclient.id} value={subclient.id}>{subclient.name} ({subclient.clientCode})</option>)}</select></label>}
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
