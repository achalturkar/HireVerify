'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  ArrowLeft, ChevronLeft, ChevronRight, Download, FileCheck2, FileText, Globe, Mail, Pencil, Phone, Receipt, Users, MapPin, Power, PowerOff, ShieldCheck, UserPlus, Trash2, Building2, SlidersHorizontal,
} from 'lucide-react';
import { useAuth } from '@/src/auth/AuthProvider';
import { getReportVerificationStatus, getVerificationStatus } from '@/src/lib/verification-status';
import { getClient, updateClient, activateClient, inactivateClient, listClientPortalUsers, inviteClientPortalUser, updateClientPortalUser, revokeClientPortalUser, ApiError as ClientApiError } from '@/src/lib/api/clients';
import { listCandidates, createCandidate, ApiError as CandidateApiError } from '@/src/lib/api/candidates';
import { ApiError as BGVApiError, downloadBGVReport, listBGVCases } from '@/src/lib/api/bgv';
import type { BGVCase } from '@/src/types/bgv';
import { downloadInvoicePdf, InvoiceApiError, listInvoices } from '@/src/lib/api/invoices';
import type { Invoice } from '@/src/lib/api/invoices';
import ClientFormModal from '@/src/components/layout/company/client/ClientFormModal';
import ClientConfirmDialog from '@/src/components/layout/company/client/ClientConfirmDialog';
import CandidateFormModal from '@/src/components/layout/company/candidate/CandidateFormModal';
import { CANDIDATE_IDENTITY_FIELDS, DEFAULT_CANDIDATE_FORM_CONFIG } from '@/src/types/client';
import type { CandidateFormConfig, Client, ClientFormValues, ClientPortalAccountMethod, ClientPortalPermission, ClientPortalUser } from '@/src/types/client';
import type { Candidate, CandidateFormValues, PaginationMeta } from '@/src/types/candidate';

const PAGE_SIZE = 10;
type TabKey = 'overview' | 'billing' | 'candidates' | 'cases' | 'reports' | 'invoices' | 'report-branding' | 'candidate-form' | 'portal-access';
const TABS: { key: TabKey; label: string; icon: typeof Users }[] = [
  { key: 'overview', label: 'Overview', icon: Users },
  { key: 'billing', label: 'Billing details', icon: Receipt },
  { key: 'candidates', label: 'Candidates', icon: Users },
  { key: 'cases', label: 'BGV cases', icon: FileCheck2 },
  { key: 'reports', label: 'Reports', icon: FileText },
  { key: 'invoices', label: 'Invoices', icon: Receipt },
  { key: 'report-branding', label: 'Report branding', icon: Building2 },
  { key: 'candidate-form', label: 'Candidate form', icon: SlidersHorizontal },
  { key: 'portal-access', label: 'Portal access', icon: ShieldCheck },
];
const PORTAL_PERMISSION_OPTIONS: { key: ClientPortalPermission; label: string; description: string }[] = [
  { key: 'clientportal.candidates.view', label: 'View candidates', description: 'View candidate names, references and contact details.' },
  { key: 'clientportal.candidates.create', label: 'Create candidates', description: 'Add candidate records. Also enables candidate viewing.' },
  { key: 'clientportal.candidates.update', label: 'Update candidates', description: 'Edit candidate contact details. Also enables candidate viewing.' },
  { key: 'clientportal.candidates.invite', label: 'Invite candidates', description: 'Send candidates a secure link to complete their profile. Also enables candidate viewing.' },
  { key: 'clientportal.candidates.portal.manage', label: 'Manage candidate portal access', description: 'Lock and unlock candidate portal links. Also enables candidate viewing.' },
  { key: 'clientportal.cases.view', label: 'View case progress', description: 'View BGV case numbers, statuses and outcomes.' },
  { key: 'clientportal.reports.view', label: 'View completed reports', description: 'View completed report listings.' },
  { key: 'clientportal.reports.download', label: 'Download reports', description: 'Download completed PDFs. Also enables report listing.' },
];

function togglePermissionSelection(current: ClientPortalPermission[], permission: ClientPortalPermission) {
  if (current.includes(permission)) {
    const removed = new Set([permission]);
    if (permission === 'clientportal.candidates.view') {
      removed.add('clientportal.candidates.create');
      removed.add('clientportal.candidates.update');
      removed.add('clientportal.candidates.invite');
      removed.add('clientportal.candidates.portal.manage');
    }
    if (permission === 'clientportal.reports.view') removed.add('clientportal.reports.download');
    return current.filter((item) => !removed.has(item));
  }
  const next = [...current, permission];
  if (permission === 'clientportal.candidates.create' || permission === 'clientportal.candidates.update' || permission === 'clientportal.candidates.invite' || permission === 'clientportal.candidates.portal.manage') {
    next.push('clientportal.candidates.view');
  }
  if (permission === 'clientportal.reports.download') next.push('clientportal.reports.view');
  return [...new Set(next)];
}
const RECORD_PAGE_SIZE = 10;
const currencyLabel = (value: number | string, currency: string) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(value || 0));
const dateLabel = (value?: string | null) => value ? new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

function initials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { accessToken, permissions, user } = useAuth();
  const canManageAccess = permissions.includes('client.update') || user?.role.isSuperAdmin === true;

  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>('overview');

  const [editOpen, setEditOpen] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [statusTarget, setStatusTarget] = useState<'ACTIVE' | 'INACTIVE' | null>(null);
  const [togglingStatus, setTogglingStatus] = useState(false);

  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [candidatesMeta, setCandidatesMeta] = useState<PaginationMeta>({ page: 1, limit: PAGE_SIZE, total: 0, totalPages: 1 });
  const [candidatesPage, setCandidatesPage] = useState(1);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [candidatesError, setCandidatesError] = useState<string | null>(null);
  const [candidateModalOpen, setCandidateModalOpen] = useState(false);
  const [candidateSubmitting, setCandidateSubmitting] = useState(false);
  const [cases, setCases] = useState<BGVCase[]>([]);
  const [casesTotal, setCasesTotal] = useState(0);
  const [casesPage, setCasesPage] = useState(1);
  const [casesLoading, setCasesLoading] = useState(false);
  const [casesError, setCasesError] = useState<string | null>(null);
  const [reports, setReports] = useState<BGVCase[]>([]);
  const [reportsTotal, setReportsTotal] = useState(0);
  const [reportsPage, setReportsPage] = useState(1);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportsError, setReportsError] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [invoicesTotal, setInvoicesTotal] = useState(0);
  const [invoicesPage, setInvoicesPage] = useState(1);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [invoicesError, setInvoicesError] = useState<string | null>(null);
  const [recordAction, setRecordAction] = useState<string | null>(null);
  const [portalUsers, setPortalUsers] = useState<ClientPortalUser[]>([]);
  const [portalUsersLoading, setPortalUsersLoading] = useState(false);
  const [portalUsersError, setPortalUsersError] = useState<string | null>(null);
  const [portalUserPermissionDrafts, setPortalUserPermissionDrafts] = useState<Record<string, ClientPortalPermission[]>>({});
  const [portalInviteSubmitting, setPortalInviteSubmitting] = useState(false);
  const [portalInviteError, setPortalInviteError] = useState<string | null>(null);
  const [portalInviteSuccess, setPortalInviteSuccess] = useState<string | null>(null);
  const [portalInvite, setPortalInvite] = useState({ firstName: '', lastName: '', email: '' });
  const [portalAccountMethod, setPortalAccountMethod] = useState<ClientPortalAccountMethod>('INVITATION');
  const [portalPassword, setPortalPassword] = useState('');
  const [portalPasswordConfirm, setPortalPasswordConfirm] = useState('');
  const [portalInvitePermissions, setPortalInvitePermissions] = useState<ClientPortalPermission[]>([
    'clientportal.reports.view',
    'clientportal.reports.download',
  ]);
  const [reportBrandingSaving, setReportBrandingSaving] = useState(false);
  const [reportBrandingError, setReportBrandingError] = useState<string | null>(null);
  const [reportBrandingSaved, setReportBrandingSaved] = useState(false);
  const [candidateFormConfig, setCandidateFormConfig] = useState<CandidateFormConfig>(DEFAULT_CANDIDATE_FORM_CONFIG);
  const [candidateFormSaving, setCandidateFormSaving] = useState(false);
  const [candidateFormError, setCandidateFormError] = useState<string | null>(null);
  const [candidateFormSaved, setCandidateFormSaved] = useState(false);

  const loadClient = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const loaded = await getClient(id, accessToken);
      setClient(loaded);
      setCandidateFormConfig(loaded.candidateFormConfig ?? DEFAULT_CANDIDATE_FORM_CONFIG);
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : 'Failed to load client.');
    } finally {
      setLoading(false);
    }
  }, [id, accessToken]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadClient(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadClient]);

  const loadPortalUsers = useCallback(async () => {
    if (!id || !canManageAccess) return;
    setPortalUsersLoading(true);
    setPortalUsersError(null);
    try {
      setPortalUsers(await listClientPortalUsers(id, accessToken));
    } catch (err) {
      setPortalUsersError(err instanceof ClientApiError ? err.message : 'Could not load client portal users.');
    } finally {
      setPortalUsersLoading(false);
    }
  }, [id, accessToken, canManageAccess]);

  useEffect(() => {
    if (tab !== 'portal-access') return;
    const timer = window.setTimeout(() => { void loadPortalUsers(); }, 0);
    return () => window.clearTimeout(timer);
  }, [tab, loadPortalUsers]);

  const saveReportBranding = async (showCompany: boolean, showClient: boolean) => {
    if (!client) return;
    setReportBrandingSaving(true);
    setReportBrandingError(null);
    setReportBrandingSaved(false);
    try {
      const updated = await updateClient(client.id, {
        reportShowCompanyBranding: showCompany,
        reportShowClientBranding: showClient,
      }, accessToken);
      setClient(updated);
      setReportBrandingSaved(true);
    } catch (err) {
      setReportBrandingError(err instanceof ClientApiError ? err.message : 'Could not save report branding.');
    } finally {
      setReportBrandingSaving(false);
    }
  };

  const saveCandidateForm = async () => {
    if (!client) return;
    setCandidateFormSaving(true);
    setCandidateFormError(null);
    setCandidateFormSaved(false);
    try {
      const updated = await updateClient(client.id, { candidateFormConfig }, accessToken);
      setClient(updated);
      setCandidateFormConfig(updated.candidateFormConfig);
      setCandidateFormSaved(true);
    } catch (saveError) {
      setCandidateFormError(saveError instanceof ClientApiError ? saveError.message : 'Could not save candidate form settings.');
    } finally {
      setCandidateFormSaving(false);
    }
  };

  const updateCandidateFormField = (key: keyof CandidateFormConfig, property: 'enabled' | 'required' | 'documentRequired', value: boolean) => {
    setCandidateFormSaved(false);
    setCandidateFormConfig((current) => {
      const existing = current[key];
      if (property === 'enabled' && !value) {
        return { ...current, [key]: { enabled: false, required: false, documentRequired: false } };
      }
      return { ...current, [key]: { ...existing, [property]: value } };
    });
  };

  const togglePortalInvitePermission = (permission: ClientPortalPermission) => {
    setPortalInvitePermissions((current) => togglePermissionSelection(current, permission));
  };

  const submitPortalInvite = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!client) return;
    setPortalInviteError(null);
    setPortalInviteSuccess(null);
    if (portalAccountMethod === 'PASSWORD' && portalPassword !== portalPasswordConfirm) {
      setPortalInviteError('Passwords do not match.');
      return;
    }
    setPortalInviteSubmitting(true);
    try {
      await inviteClientPortalUser(client.id, {
        ...portalInvite,
        permissions: portalInvitePermissions,
        accountMethod: portalAccountMethod,
        ...(portalAccountMethod === 'PASSWORD' ? { password: portalPassword } : {}),
      }, accessToken);
      setPortalInvite({ firstName: '', lastName: '', email: '' });
      setPortalInvitePermissions(['clientportal.reports.view', 'clientportal.reports.download']);
      setPortalPassword('');
      setPortalPasswordConfirm('');
      setPortalInviteSuccess(
        portalAccountMethod === 'PASSWORD'
          ? 'Portal account created. The user can now sign in with the password you set.'
          : 'Invitation email sent. The user can set a password using the secure link.'
      );
      await loadPortalUsers();
    } catch (err) {
      setPortalInviteError(err instanceof ClientApiError ? err.message : 'Could not create the portal account.');
    } finally {
      setPortalInviteSubmitting(false);
    }
  };

  const togglePortalUserStatus = async (user: ClientPortalUser) => {
    if (!client) return;
    try {
      const updated = await updateClientPortalUser(client.id, user.id, {
        status: user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
      }, accessToken);
      setPortalUsers((current) => current.map((item) => item.id === updated.id ? updated : item));
    } catch (err) {
      setPortalUsersError(err instanceof ClientApiError ? err.message : 'Could not update portal user.');
    }
  };

  const togglePortalUserPermission = (userId: string, permission: ClientPortalPermission) => {
    setPortalUserPermissionDrafts((current) => {
      const existing = current[userId] ?? portalUsers.find((user) => user.id === userId)?.permissions ?? [];
      return {
        ...current,
        [userId]: togglePermissionSelection(existing, permission),
      };
    });
  };

  const savePortalUserPermissions = async (user: ClientPortalUser) => {
    if (!client) return;
    const permissions = portalUserPermissionDrafts[user.id];
    if (!permissions) return;
    try {
      const updated = await updateClientPortalUser(client.id, user.id, { permissions }, accessToken);
      setPortalUsers((current) => current.map((item) => item.id === updated.id ? updated : item));
      setPortalUserPermissionDrafts((current) => {
        const next = { ...current };
        delete next[user.id];
        return next;
      });
    } catch (err) {
      setPortalUsersError(err instanceof ClientApiError ? err.message : 'Could not update portal permissions.');
    }
  };

  const revokePortalUser = async (user: ClientPortalUser) => {
    if (!client) return;
    if (!window.confirm(`Revoke portal access for ${user.email}?`)) return;
    try {
      await revokeClientPortalUser(client.id, user.id, accessToken);
      setPortalUsers((current) => current.filter((item) => item.id !== user.id));
    } catch (err) {
      setPortalUsersError(err instanceof ClientApiError ? err.message : 'Could not revoke portal access.');
    }
  };

  const loadCandidates = useCallback(async () => {
    if (!id) return;
    setCandidatesLoading(true);
    setCandidatesError(null);
    try {
      const res = await listCandidates(
        { page: candidatesPage, limit: PAGE_SIZE, clientId: id, sortBy: 'createdAt', sortOrder: 'desc' },
        accessToken
      );
      setCandidates(res.items);
      setCandidatesMeta(res.meta);
    } catch (err) {
      setCandidatesError(err instanceof CandidateApiError ? err.message : 'Failed to load candidates.');
    } finally {
      setCandidatesLoading(false);
    }
  }, [id, candidatesPage, accessToken]);

  useEffect(() => {
    if (tab !== 'candidates') return undefined;
    const timer = window.setTimeout(() => { void loadCandidates(); }, 0);
    return () => window.clearTimeout(timer);
  }, [tab, loadCandidates]);

  const loadCases = useCallback(async () => {
    setCasesLoading(true);
    setCasesError(null);
    try {
      const result = await listBGVCases({ page: casesPage, limit: RECORD_PAGE_SIZE, clientId: id }, accessToken);
      setCases(result.items);
      setCasesTotal(result.meta.total);
    } catch (err) {
      setCasesError(err instanceof BGVApiError ? err.message : 'Could not load BGV cases.');
    } finally {
      setCasesLoading(false);
    }
  }, [accessToken, casesPage, id]);

  const loadReports = useCallback(async () => {
    setReportsLoading(true);
    setReportsError(null);
    try {
      const result = await listBGVCases({ page: reportsPage, limit: RECORD_PAGE_SIZE, clientId: id, status: 'COMPLETED' }, accessToken);
      setReports(result.items);
      setReportsTotal(result.meta.total);
    } catch (err) {
      setReportsError(err instanceof BGVApiError ? err.message : 'Could not load reports.');
    } finally {
      setReportsLoading(false);
    }
  }, [accessToken, id, reportsPage]);

  const loadInvoices = useCallback(async () => {
    setInvoicesLoading(true);
    setInvoicesError(null);
    try {
      const result = await listInvoices({ page: invoicesPage, limit: RECORD_PAGE_SIZE, clientId: id }, accessToken);
      setInvoices(result.items);
      setInvoicesTotal(result.meta.total);
    } catch (err) {
      setInvoicesError(err instanceof InvoiceApiError ? err.message : 'Could not load invoices.');
    } finally {
      setInvoicesLoading(false);
    }
  }, [accessToken, id, invoicesPage]);

  useEffect(() => {
    if (tab !== 'cases') return undefined;
    const timer = window.setTimeout(() => { void loadCases(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadCases, tab]);
  useEffect(() => {
    if (tab !== 'reports') return undefined;
    const timer = window.setTimeout(() => { void loadReports(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadReports, tab]);
  useEffect(() => {
    if (tab !== 'invoices') return undefined;
    const timer = window.setTimeout(() => { void loadInvoices(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadInvoices, tab]);

  const downloadReport = async (item: BGVCase) => {
    setRecordAction(`report-${item.id}`);
    setReportsError(null);
    try {
      const blob = await downloadBGVReport(item.id, accessToken);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${item.caseNumber}_${item.candidate ? `${item.candidate.firstName}_${item.candidate.lastName}` : 'Candidate'}_BGV_FinalReport.pdf`.replace(/\s+/g, '_');
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setReportsError(err instanceof BGVApiError ? err.message : 'Could not download this report.');
    } finally {
      setRecordAction(null);
    }
  };

  const downloadInvoice = async (invoice: Invoice) => {
    setRecordAction(`invoice-${invoice.id}`);
    setInvoicesError(null);
    try {
      const blob = await downloadInvoicePdf(invoice.id, accessToken);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${invoice.invoiceNumber}.pdf`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setInvoicesError(err instanceof InvoiceApiError ? err.message : 'Could not download this invoice.');
    } finally {
      setRecordAction(null);
    }
  };

  const handleToggleStatus = async () => {
    if (!client || !statusTarget) return;
    setTogglingStatus(true);
    try {
      const updated = statusTarget === 'ACTIVE'
        ? await activateClient(client.id, accessToken)
        : await inactivateClient(client.id, accessToken);
      setClient(updated);
    } finally {
      setStatusTarget(null);
      setTogglingStatus(false);
    }
  };

  const handleUpdateClient = async (values: ClientFormValues, logoFile: File | null) => {
    if (!client) return;
    setEditSubmitting(true);
    setEditError(null);
    const payload = new FormData();
    Object.entries({
      clientCode: values.clientCode.trim(),
      name: values.name.trim(),
      website: values.website.trim(),
      industry: values.industry.trim(),
      contactName: values.contactName.trim(),
      contactEmail: values.contactEmail.trim(),
      contactPhone: values.contactPhone.trim(),
      gstNumber: values.gstNumber.trim(),
      panNumber: values.panNumber.trim(),
      addressLine1: values.addressLine1.trim(),
      addressLine2: values.addressLine2.trim(),
      city: values.city.trim(),
      state: values.state.trim(),
      country: values.country.trim(),
      postalCode: values.postalCode.trim(),
      status: client.status,
    }).forEach(([key, value]) => payload.append(key, value));
    if (logoFile) payload.append('logo', logoFile);

    try {
      const updated = await updateClient(client.id, payload, accessToken);
      setClient(updated);
      setEditOpen(false);
    } catch (err) {
      setEditError(err instanceof ClientApiError ? err.message : 'Could not update client details.');
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleCreateCandidate = async (values: CandidateFormValues) => {
    if (!client) return;
    setCandidateSubmitting(true);
    try {
      await createCandidate(
        {
          clientId: client.id,
          firstName: values.firstName.trim(),
          lastName: values.lastName.trim(),
          email: values.email.trim(),
          phone: values.phone.trim() || undefined,
          dateOfBirth: values.dateOfBirth || undefined,
          gender: values.gender || undefined,
          aadhaarNumber: values.aadhaarNumber || undefined,
          panNumber: values.panNumber || undefined,
          uanNumber: values.uanNumber || undefined,
          passportNumber: values.passportNumber || undefined,
          drivingLicenseNumber: values.drivingLicenseNumber || undefined,
          voterIdNumber: values.voterIdNumber || undefined,
          currentAddress: values.currentAddress || undefined,
          permanentAddress: values.permanentAddress || undefined,
        },
        accessToken
      );
      setCandidateModalOpen(false);
      await loadCandidates();
    } finally {
      setCandidateSubmitting(false);
    }
  };

  if (loading) return <div className="max-w-6xl mx-auto py-16 text-center text-[13px] text-[var(--muted)]">Loading client…</div>;

  if (error || !client) {
    return (
      <div className="max-w-6xl mx-auto py-16 text-center">
        <p className="text-[13px] text-[#FF6B6B] mb-3">{error || 'Client not found.'}</p>
        <button onClick={() => router.push('/company/clients')} className="text-[13px] text-[var(--primary)] underline">
          Back to clients
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <button onClick={() => router.push('/company/clients')} className="inline-flex items-center gap-1.5 text-[13px] text-[var(--muted)] hover:text-[var(--foreground)]">
        <ArrowLeft size={14} /> Back to clients
      </button>

      <div className="overflow-hidden rounded-2xl border border-l-4 border-[var(--border)] border-l-[var(--primary)] bg-[var(--surface)]">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
        <div className="flex items-center gap-4">
          {client.logoUrl ? (
            <img src={client.logoUrl} alt="" className="h-14 w-14 shrink-0 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] object-cover" />
          ) : (
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[var(--primary)]/15 text-[15px] font-semibold text-[var(--primary)]">
              {initials(client.name)}
            </div>
          )}
          <div className="min-w-0">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--primary)]">Client profile</p>
            <h1 className="truncate text-[22px] font-semibold text-[var(--foreground)]">{client.name}</h1>
            <p className="text-[12.5px] text-[var(--muted)] font-mono">
              {client.clientCode}{client.industry ? ` · ${client.industry}` : ''}
            </p>
            <span className={`inline-flex mt-1.5 items-center rounded-full px-2.5 py-1 text-[11px] font-medium ${client.status === 'ACTIVE' ? 'bg-[var(--primary)]/15 text-[var(--primary)]' : 'bg-[var(--muted)]/20 text-[var(--muted)]'}`}>
              {client.status}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
          {client.website && (
            <a href={client.website} target="_blank" rel="noreferrer" aria-label="Open client website" title="Open website" className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--muted)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]">
              <Globe size={15} />
            </a>
          )}
          <button onClick={() => setStatusTarget(client.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE')} aria-label={client.status === 'ACTIVE' ? 'Deactivate client' : 'Activate client'} title={client.status === 'ACTIVE' ? 'Deactivate client' : 'Activate client'} className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--muted)] transition-colors hover:bg-[var(--surface-muted)]">
            {client.status === 'ACTIVE' ? <PowerOff size={15} /> : <Power size={15} />}
          </button>
          <button onClick={() => setEditOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3.5 py-2.5 text-[13px] font-semibold text-[var(--primary-foreground)] transition-opacity hover:opacity-90">
            <Pencil size={13} /> Edit client
          </button>
        </div>
        </div>
        <div className="grid gap-3 border-t border-[var(--border)] bg-[var(--surface-muted)]/50 px-5 py-3 sm:grid-cols-2 sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5 text-[12px]"><Users size={14} className="shrink-0 text-[var(--primary)]" /><span className="shrink-0 text-[var(--muted)]">Contact</span><span className="truncate font-medium">{client.contactName || 'Not provided'}</span></div>
          <div className="flex min-w-0 items-center gap-2.5 text-[12px]"><Mail size={14} className="shrink-0 text-[var(--primary)]" /><span className="shrink-0 text-[var(--muted)]">Email</span><span className="truncate font-medium">{client.contactEmail || 'Not provided'}</span></div>
          <div className="flex min-w-0 items-center gap-2.5 text-[12px]"><Phone size={14} className="shrink-0 text-[var(--primary)]" /><span className="shrink-0 text-[var(--muted)]">Phone</span><span className="truncate font-medium">{client.contactPhone || 'Not provided'}</span></div>
          <div className="flex min-w-0 items-center gap-2.5 text-[12px]"><MapPin size={14} className="shrink-0 text-[var(--primary)]" /><span className="shrink-0 text-[var(--muted)]">Location</span><span className="truncate font-medium">{[client.city, client.state, client.country].filter(Boolean).join(', ') || 'Not provided'}</span></div>
      </div>
      </div>

      <div className="border-b border-[var(--border)] flex items-center gap-1">
        {TABS.filter((t) => canManageAccess || (t.key !== 'portal-access' && t.key !== 'report-branding' && t.key !== 'candidate-form')).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`inline-flex items-center gap-2 whitespace-nowrap px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors ${
              tab === t.key ? 'border-[var(--primary)] text-[var(--foreground)]' : 'border-transparent text-[var(--muted)] hover:text-[var(--foreground)]'
            }`}
          >
            <t.icon size={14} />
            {t.label}
            {t.key === 'candidates' && candidatesMeta.total > 0 && <span className="rounded-full bg-[var(--surface-muted)] px-1.5 py-0.5 text-[10px]">{candidatesMeta.total}</span>}
            {t.key === 'cases' && casesTotal > 0 && <span className="rounded-full bg-[var(--surface-muted)] px-1.5 py-0.5 text-[10px]">{casesTotal}</span>}
            {t.key === 'reports' && reportsTotal > 0 && <span className="rounded-full bg-[var(--surface-muted)] px-1.5 py-0.5 text-[10px]">{reportsTotal}</span>}
            {t.key === 'invoices' && invoicesTotal > 0 && <span className="rounded-full bg-[var(--surface-muted)] px-1.5 py-0.5 text-[10px]">{invoicesTotal}</span>}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <h3 className="text-[13px] font-semibold text-[var(--foreground)]">Client profile</h3>
          <dl className="mt-4 grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            <div><dt className="text-[11px] uppercase tracking-wide text-[var(--muted)]">Client code</dt><dd className="mt-1 text-[13px]">{client.clientCode}</dd></div>
            <div><dt className="text-[11px] uppercase tracking-wide text-[var(--muted)]">Industry</dt><dd className="mt-1 text-[13px]">{client.industry || '—'}</dd></div>
            <div><dt className="text-[11px] uppercase tracking-wide text-[var(--muted)]">Website</dt><dd className="mt-1 truncate text-[13px]">{client.website || '—'}</dd></div>
            <div><dt className="text-[11px] uppercase tracking-wide text-[var(--muted)]">Status</dt><dd className="mt-1 text-[13px]">{client.status}</dd></div>
            <div><dt className="text-[11px] uppercase tracking-wide text-[var(--muted)]">Client since</dt><dd className="mt-1 text-[13px]">{new Date(client.createdAt).toLocaleDateString()}</dd></div>
          </dl>
        </section>
      )}

      {tab === 'billing' && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <h3 className="text-[13px] font-semibold text-[var(--foreground)]">Billing contact</h3>
            <dl className="mt-4 space-y-3 text-[13px]">
              <div><dt className="text-[11px] text-[var(--muted)]">Contact person</dt><dd className="mt-0.5">{client.contactName || 'Not provided'}</dd></div>
              <div><dt className="text-[11px] text-[var(--muted)]">Billing email</dt><dd className="mt-0.5 break-all">{client.contactEmail || 'Not provided'}</dd></div>
              <div><dt className="text-[11px] text-[var(--muted)]">Phone</dt><dd className="mt-0.5">{client.contactPhone || 'Not provided'}</dd></div>
            </dl>
          </section>
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <h3 className="text-[13px] font-semibold text-[var(--foreground)]">Billing address</h3>
            <div className="mt-4 flex items-start gap-2 text-[13px] leading-5 text-[var(--muted)]">
              <MapPin size={14} className="mt-0.5 shrink-0" />
              <address className="not-italic">{[client.addressLine1, client.addressLine2, client.city, client.state, client.postalCode, client.country].filter(Boolean).join(', ') || 'Not provided'}</address>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-[var(--border)] pt-3 text-[13px]">
              <div><dt className="text-[11px] text-[var(--muted)]">State</dt><dd className="mt-0.5">{client.state || 'Not provided'}</dd></div>
              <div><dt className="text-[11px] text-[var(--muted)]">Postal code</dt><dd className="mt-0.5">{client.postalCode || 'Not provided'}</dd></div>
              <div><dt className="text-[11px] text-[var(--muted)]">Country</dt><dd className="mt-0.5">{client.country || 'Not provided'}</dd></div>
            </dl>
          </section>
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:col-span-2">
            <h3 className="text-[13px] font-semibold text-[var(--foreground)]">Tax identifiers</h3>
            <dl className="mt-4 grid gap-4 sm:grid-cols-2 text-[13px]">
              <div><dt className="text-[11px] text-[var(--muted)]">GSTIN</dt><dd className="mt-0.5 font-medium">{client.gstNumber || 'Not provided'}</dd></div>
              <div><dt className="text-[11px] text-[var(--muted)]">PAN</dt><dd className="mt-0.5 font-medium">{client.panNumber || 'Not provided'}</dd></div>
            </dl>
          </section>
        </div>
      )}

      {tab === 'report-branding' && (
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6">
          <div className="max-w-3xl">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--primary)]">PDF report settings</p>
            <h2 className="mt-1 text-[16px] font-semibold">Choose which identity appears on this client’s BGV reports</h2>
            <p className="mt-1 text-[12px] leading-5 text-[var(--muted)]">Company branding is enabled by default. The selected names and logos are applied to newly generated reports; existing PDFs are not changed.</p>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {[
              { company: true, title: 'Your company', name: user?.company?.name ?? 'Company name and logo', logo: user?.company?.logoUrl ?? null, enabled: client.reportShowCompanyBranding },
              { company: false, title: client.name, name: 'Client name and logo', logo: client.logoUrl, enabled: client.reportShowClientBranding },
            ].map((item) => (
              <label key={item.company ? 'company' : 'client'} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors ${item.enabled ? 'border-[var(--primary)]/50 bg-[var(--primary)]/5' : 'border-[var(--border)] hover:bg-[var(--surface-muted)]'}`}>
                <input
                  type="checkbox"
                  checked={item.enabled}
                  disabled={!canManageAccess || reportBrandingSaving || (item.enabled && !(item.company ? client.reportShowClientBranding : client.reportShowCompanyBranding))}
                  onChange={(event) => void saveReportBranding(
                    item.company ? event.target.checked : client.reportShowCompanyBranding,
                    item.company ? client.reportShowClientBranding : event.target.checked,
                  )}
                  className="mt-1 accent-[var(--primary)]"
                />
                <span className="flex min-w-0 flex-1 items-center gap-3">
                  {item.logo ? (
                    <Image src={item.logo} alt="" width={40} height={40} unoptimized className="h-10 w-10 shrink-0 rounded-lg border border-[var(--border)] object-cover" />
                  ) : item.company ? (
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-muted)] text-[var(--primary)]"><Building2 size={19} /></span>
                  ) : (
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--primary)]/10 text-xs font-semibold text-[var(--primary)]">{initials(client.name)}</span>
                  )}
                  <span className="min-w-0"><span className="block truncate text-[13px] font-semibold">{item.name}</span><span className="mt-0.5 block text-[11px] text-[var(--muted)]">{item.title}</span></span>
                </span>
              </label>
            ))}
          </div>
          {!client.logoUrl && <p className="mt-3 text-[11px] text-[var(--muted)]">No client logo is set. Add one when editing the client profile to include it in reports.</p>}
          {reportBrandingError && <p role="alert" className="mt-3 text-[12px] text-[#FF6B6B]">{reportBrandingError}</p>}
          {reportBrandingSaved && <p role="status" className="mt-3 text-[12px] text-emerald-700">Report branding saved.</p>}
          {reportBrandingSaving && <p role="status" className="mt-3 text-[12px] text-[var(--muted)]">Saving report branding…</p>}
          <p className="mt-5 border-t border-[var(--border)] pt-4 text-[11px] leading-5 text-[var(--muted)]">At least one identity must remain enabled. If both are selected, the report shows both identities.</p>
        </section>
      )}

      {tab === 'candidate-form' && (
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6">
          <div className="max-w-3xl">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--primary)]">Candidate intake</p>
            <h2 className="mt-1 text-[16px] font-semibold">Configure identity fields for {client.name}</h2>
            <p className="mt-1 text-[12px] leading-5 text-[var(--muted)]">Enabled fields appear when company admins and client users create candidates and in the candidate’s secure portal. Required documents are tracked in the portal checklist. Aadhaar, PAN, UAN and other ID formats are validated by the server.</p>
          </div>
          <div className="mt-5 space-y-3">
            {CANDIDATE_IDENTITY_FIELDS.map((field) => {
              const config = candidateFormConfig[field.key];
              return (
                <div key={field.key} className="grid gap-3 rounded-xl border border-[var(--border)] p-4 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
                  <label className="flex items-start gap-3">
                    <input type="checkbox" checked={config.enabled} onChange={(event) => updateCandidateFormField(field.key, 'enabled', event.target.checked)} disabled={!canManageAccess || candidateFormSaving} className="mt-1 accent-[var(--primary)]" />
                    <span><span className="block text-[13px] font-semibold">{field.label}</span><span className="mt-0.5 block text-[11px] text-[var(--muted)]">Candidate number field and {field.documentType.replaceAll('_', ' ').toLowerCase()} upload</span></span>
                  </label>
                  <label className={`flex items-center gap-2 text-[12px] ${!config.enabled ? 'opacity-50' : ''}`}><input type="checkbox" checked={config.required} onChange={(event) => updateCandidateFormField(field.key, 'required', event.target.checked)} disabled={!canManageAccess || candidateFormSaving || !config.enabled} className="accent-[var(--primary)]" />Number required</label>
                  <label className={`flex items-center gap-2 text-[12px] ${!config.enabled ? 'opacity-50' : ''}`}><input type="checkbox" checked={config.documentRequired} onChange={(event) => updateCandidateFormField(field.key, 'documentRequired', event.target.checked)} disabled={!canManageAccess || candidateFormSaving || !config.enabled} className="accent-[var(--primary)]" />Document required</label>
                </div>
              );
            })}
          </div>
          {candidateFormError && <p role="alert" className="mt-3 text-[12px] text-[#FF6B6B]">{candidateFormError}</p>}
          {candidateFormSaved && <p role="status" className="mt-3 text-[12px] text-emerald-700">Candidate form settings saved.</p>}
          <button type="button" onClick={() => void saveCandidateForm()} disabled={!canManageAccess || candidateFormSaving} className="mt-5 rounded-lg bg-[var(--primary)] px-4 py-2.5 text-[12px] font-semibold text-[var(--primary-foreground)] disabled:opacity-50">{candidateFormSaving ? 'Saving…' : 'Save candidate form'}</button>
        </section>
      )}

      {tab === 'portal-access' && (
        <div className="space-y-5">
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--primary)]/10 text-[var(--primary)]"><UserPlus size={18} /></span>
              <div><h2 className="text-[15px] font-semibold">Create client portal access</h2><p className="mt-1 text-[12px] leading-5 text-[var(--muted)]">Choose how the user will receive login access. Access is limited to this client and the permissions you select.</p></div>
            </div>
            <form onSubmit={submitPortalInvite} className="mt-5 space-y-4">
              <fieldset>
                <legend className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">Account setup</legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 ${portalAccountMethod === 'INVITATION' ? 'border-[var(--primary)] bg-[var(--primary)]/5' : 'border-[var(--border)]'}`}>
                    <input
                      type="radio"
                      name="portal-account-method"
                      value="INVITATION"
                      checked={portalAccountMethod === 'INVITATION'}
                      onChange={() => {
                        setPortalAccountMethod('INVITATION');
                        setPortalPassword('');
                        setPortalPasswordConfirm('');
                        setPortalInviteError(null);
                        setPortalInviteSuccess(null);
                      }}
                      className="mt-0.5 accent-[var(--primary)]"
                    />
                    <span><span className="block text-[12px] font-semibold">Send invitation link</span><span className="mt-0.5 block text-[10px] leading-4 text-[var(--muted)]">Email a secure link so the user can set their own password.</span></span>
                  </label>
                  <label className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 ${portalAccountMethod === 'PASSWORD' ? 'border-[var(--primary)] bg-[var(--primary)]/5' : 'border-[var(--border)]'}`}>
                    <input
                      type="radio"
                      name="portal-account-method"
                      value="PASSWORD"
                      checked={portalAccountMethod === 'PASSWORD'}
                      onChange={() => {
                        setPortalAccountMethod('PASSWORD');
                        setPortalInviteError(null);
                        setPortalInviteSuccess(null);
                      }}
                      className="mt-0.5 accent-[var(--primary)]"
                    />
                    <span><span className="block text-[12px] font-semibold">Set a temporary password</span><span className="mt-0.5 block text-[10px] leading-4 text-[var(--muted)]">Create the account now and securely share the password with the user.</span></span>
                  </label>
                </div>
              </fieldset>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="text-[11px] font-medium text-[var(--muted)]">First name<input required value={portalInvite.firstName} onChange={(event) => setPortalInvite((current) => ({ ...current, firstName: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-[13px] text-[var(--foreground)] outline-none focus:border-[var(--primary)]" /></label>
                <label className="text-[11px] font-medium text-[var(--muted)]">Last name<input required value={portalInvite.lastName} onChange={(event) => setPortalInvite((current) => ({ ...current, lastName: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-[13px] text-[var(--foreground)] outline-none focus:border-[var(--primary)]" /></label>
                <label className="text-[11px] font-medium text-[var(--muted)]">Email address<input required type="email" value={portalInvite.email} onChange={(event) => setPortalInvite((current) => ({ ...current, email: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-[13px] text-[var(--foreground)] outline-none focus:border-[var(--primary)]" /></label>
              </div>
              {portalAccountMethod === 'PASSWORD' && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-[11px] font-medium text-[var(--muted)]">
                    Temporary password
                    <input
                      required
                      type="password"
                      autoComplete="new-password"
                      minLength={8}
                      maxLength={128}
                      value={portalPassword}
                      onChange={(event) => setPortalPassword(event.target.value)}
                      disabled={portalInviteSubmitting}
                      className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-[13px] text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
                    />
                  </label>
                  <label className="text-[11px] font-medium text-[var(--muted)]">
                    Confirm password
                    <input
                      required
                      type="password"
                      autoComplete="new-password"
                      minLength={8}
                      maxLength={128}
                      value={portalPasswordConfirm}
                      onChange={(event) => setPortalPasswordConfirm(event.target.value)}
                      disabled={portalInviteSubmitting}
                      className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-[13px] text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
                    />
                  </label>
                  <p className="text-[11px] leading-4 text-[var(--muted)] sm:col-span-2">The password is stored securely and can be used to sign in immediately. Share it with the user through a secure channel, not email.</p>
                </div>
              )}
              <fieldset>
                <legend className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">Portal permissions</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {PORTAL_PERMISSION_OPTIONS.map((option) => (
                    <label key={option.key} className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-[var(--border)] p-3 hover:bg-[var(--surface-muted)]">
                      <input type="checkbox" checked={portalInvitePermissions.includes(option.key)} onChange={() => togglePortalInvitePermission(option.key)} className="mt-0.5 accent-[var(--primary)]" />
                      <span><span className="block text-[12px] font-medium text-[var(--foreground)]">{option.label}</span><span className="mt-0.5 block text-[10px] leading-4 text-[var(--muted)]">{option.description}</span></span>
                    </label>
                  ))}
                </div>
              </fieldset>
              {portalInviteError && <p role="alert" className="text-[12px] text-[#FF6B6B]">{portalInviteError}</p>}
              {portalInviteSuccess && <p role="status" className="text-[12px] text-emerald-700">{portalInviteSuccess}</p>}
              <button type="submit" disabled={portalInviteSubmitting || portalInvitePermissions.length === 0 || (portalAccountMethod === 'PASSWORD' && portalPassword !== portalPasswordConfirm)} className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2.5 text-[12px] font-semibold text-[var(--primary-foreground)] disabled:cursor-not-allowed disabled:opacity-50">
                {portalAccountMethod === 'INVITATION' ? <Mail size={14} /> : <ShieldCheck size={14} />}
                {portalInviteSubmitting
                  ? portalAccountMethod === 'INVITATION' ? 'Sending invitation…' : 'Creating account…'
                  : portalAccountMethod === 'INVITATION' ? 'Send invitation link' : 'Create login account'}
              </button>
            </form>
          </section>

          <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
            <div className="border-b border-[var(--border)] px-5 py-4"><h2 className="text-[14px] font-semibold">Client portal accounts</h2><p className="mt-1 text-[11px] text-[var(--muted)]">Manage each person’s access to {client.name}.</p></div>
            {portalUsersLoading ? <p className="px-5 py-10 text-center text-[12px] text-[var(--muted)]">Loading portal users…</p>
              : portalUsersError ? <p role="alert" className="px-5 py-8 text-center text-[12px] text-[#FF6B6B]">{portalUsersError}</p>
                : portalUsers.length === 0 ? <p className="px-5 py-10 text-center text-[12px] text-[var(--muted)]">No portal accounts have been invited yet.</p>
                  : <div className="divide-y divide-[var(--border)]">
                    {portalUsers.map((user) => {
                      const draft = portalUserPermissionDrafts[user.id] ?? user.permissions;
                      const dirty = portalUserPermissionDrafts[user.id] !== undefined;
                      return (
                        <article key={user.id} className="px-5 py-4">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0"><p className="truncate text-[13px] font-semibold">{user.firstName} {user.lastName}</p><p className="mt-0.5 truncate text-[11px] text-[var(--muted)]">{user.email}</p><span className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${user.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-700' : 'bg-[var(--surface-muted)] text-[var(--muted)]'}`}>{user.status}</span></div>
                            <div className="flex shrink-0 gap-2">
                              <button type="button" onClick={() => void togglePortalUserStatus(user)} className="rounded-lg border border-[var(--border)] px-3 py-2 text-[11px] font-medium hover:bg-[var(--surface-muted)]">{user.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}</button>
                              <button type="button" onClick={() => void revokePortalUser(user)} className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/30 px-3 py-2 text-[11px] font-medium text-rose-700 hover:bg-rose-500/5"><Trash2 size={12} />Revoke</button>
                            </div>
                          </div>
                          <details className="mt-3">
                            <summary className="cursor-pointer text-[11px] font-medium text-[var(--primary)]">Edit permissions ({user.permissions.length})</summary>
                            <div className="mt-3 grid gap-2 sm:grid-cols-2">
                              {PORTAL_PERMISSION_OPTIONS.map((option) => <label key={option.key} className="flex cursor-pointer items-center gap-2 text-[11px] text-[var(--foreground)]"><input type="checkbox" checked={draft.includes(option.key)} onChange={() => togglePortalUserPermission(user.id, option.key)} className="accent-[var(--primary)]" />{option.label}</label>)}
                            </div>
                            {dirty && <button type="button" onClick={() => void savePortalUserPermissions(user)} className="mt-3 rounded-lg bg-[var(--primary)] px-3 py-2 text-[11px] font-semibold text-[var(--primary-foreground)]">Save permissions</button>}
                          </details>
                        </article>
                      );
                    })}
                  </div>}
          </section>
        </div>
      )}

      {tab === 'candidates' && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-[var(--border)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--primary)]">People</p>
              <h2 className="mt-0.5 text-[15px] font-semibold">Candidate directory</h2>
              <p className="mt-0.5 text-[12px] text-[var(--muted)]">{candidatesMeta.total} candidates linked to {client.name}</p>
            </div>
            <button onClick={() => setCandidateModalOpen(true)} className="inline-flex items-center justify-center gap-1.5 self-start rounded-lg bg-[var(--primary)] px-3.5 py-2.5 text-[12.5px] font-semibold text-[var(--primary-foreground)] transition-opacity hover:opacity-90 sm:self-auto">
              <Users size={14} /> Add candidate
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead className="border-b border-[var(--border)] bg-[var(--surface-muted)]/60 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                <tr><th className="px-5 py-3">Reference</th><th className="px-5 py-3">Candidate</th><th className="px-5 py-3">Cases</th><th className="px-5 py-3">Status</th></tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {candidatesLoading ? (
                  <tr><td colSpan={4} className="px-5 py-12 text-center text-[var(--muted)]">Loading candidates…</td></tr>
                ) : candidatesError ? (
                  <tr><td colSpan={4} className="px-5 py-12 text-center text-[#FF6B6B]">{candidatesError}</td></tr>
                ) : candidates.length === 0 ? (
                  <tr><td colSpan={4} className="px-5 py-14 text-center"><div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--primary)]/10 text-[var(--primary)]"><Users size={19} /></div><p className="mt-3 text-[13px] font-medium">No candidates yet</p><p className="mt-1 text-[12px] text-[var(--muted)]">Add a candidate to start a verification case for this client.</p></td></tr>
                ) : candidates.map((c) => (
                  <tr key={c.id} role="link" tabIndex={0} aria-label={`Open ${c.firstName} ${c.lastName}`} onClick={() => router.push(`/company/candidate/${c.id}`)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); router.push(`/company/candidate/${c.id}`); } }} className="group cursor-pointer outline-none transition-colors hover:bg-[var(--surface-muted)]/70 focus-visible:bg-[var(--surface-muted)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--primary)]">
                    <td className="whitespace-nowrap px-5 py-3.5 font-mono text-[11px] text-[var(--muted)]">{c.candidateCode}</td>
                    <td className="min-w-[220px] px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--primary)]/10 text-[11px] font-semibold text-[var(--primary)]">{initials(`${c.firstName} ${c.lastName}`)}</span>
                        <span className="min-w-0"><span className="block truncate font-medium text-[var(--foreground)] group-hover:text-[var(--primary)]">{c.firstName} {c.lastName}</span><span className="block truncate text-[11px] text-[var(--muted)]">{c.email || 'No email provided'}</span></span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5"><span className="inline-flex min-w-8 justify-center rounded-md bg-[var(--surface-muted)] px-2 py-1 font-mono text-[11px] tabular-nums">{c.bgvCaseCount ?? 0}</span></td>
                    <td className="whitespace-nowrap px-5 py-3.5">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold ${c.status === 'COMPLETED' ? 'bg-[#159A7A]/10 text-[#147A68]' : c.status === 'WITHDRAWN' ? 'bg-[#C94C4C]/10 text-[#B53D3D]' : c.status === 'ON_HOLD' || c.status.includes('PENDING') || c.status.includes('PROGRESS') || c.status === 'INVITED' ? 'bg-[#D88A22]/10 text-[#9B6414]' : 'bg-[var(--surface-muted)] text-[var(--muted)]'}`}>{c.status.replaceAll('_', ' ')}</span>
                    </td>
                    <td className="px-4 py-3.5 text-right"><ChevronRight size={16} className="ml-auto text-[var(--muted)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--primary)]" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col items-center gap-2.5 border-t border-[var(--border)] bg-[var(--surface)] px-5 py-3 text-[12px] text-[var(--muted)]">
            <span>Showing {candidatesMeta.total === 0 ? 0 : (candidatesPage - 1) * PAGE_SIZE + 1}–{Math.min(candidatesPage * PAGE_SIZE, candidatesMeta.total)} of {candidatesMeta.total}</span>
            <div className="flex gap-2">
              <button disabled={candidatesPage <= 1} onClick={() => setCandidatesPage((p) => p - 1)} className="rounded-md border border-[var(--border)] px-3 py-1.5 transition-colors hover:bg-[var(--surface-muted)] disabled:cursor-not-allowed disabled:opacity-40">Previous</button>
              <button disabled={candidatesPage >= candidatesMeta.totalPages} onClick={() => setCandidatesPage((p) => p + 1)} className="rounded-md border border-[var(--border)] px-3 py-1.5 transition-colors hover:bg-[var(--surface-muted)] disabled:cursor-not-allowed disabled:opacity-40">Next</button>
            </div>
          </div>
        </div>
      )}

      {(tab === 'cases' || tab === 'reports') && (() => {
        const isReports = tab === 'reports';
        const rows = isReports ? reports : cases;
        const loadingRows = isReports ? reportsLoading : casesLoading;
        const loadError = isReports ? reportsError : casesError;
        const total = isReports ? reportsTotal : casesTotal;
        const currentPage = isReports ? reportsPage : casesPage;
        const setCurrentPage = isReports ? setReportsPage : setCasesPage;
        const title = isReports ? 'Completed verification reports' : 'Background verification cases';
        return (
          <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
            <div className="flex flex-col gap-3 border-b border-[var(--border)] bg-gradient-to-r from-[var(--primary)]/10 via-[var(--surface)] to-[var(--surface)] px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--primary)]/15 text-[var(--primary)]">{isReports ? <FileText size={19} /> : <FileCheck2 size={19} />}</span>
                <div><h2 className="text-[15px] font-semibold">{title}</h2><p className="mt-0.5 text-[12px] text-[var(--muted)]">{total} record{total === 1 ? '' : 's'} for {client.name}</p></div>
              </div>
              <button type="button" onClick={() => router.push(isReports ? '/company/reports' : `/company/bgv-cases?clientId=${encodeURIComponent(client.id)}`)} className="inline-flex items-center justify-center gap-1.5 self-start rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[12px] font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--surface-muted)] sm:self-auto">
                Open {isReports ? 'reports' : 'all cases'} <ChevronRight size={14} />
              </button>
            </div>
            {loadError && <p role="alert" className="border-b border-[#FF6B6B]/20 bg-[#FF6B6B]/10 px-5 py-3 text-[12px] text-[#FF6B6B]">{loadError}</p>}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-left text-[13px]">
                <thead className="border-b border-[var(--border)] bg-[var(--surface-muted)]/60 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                  <tr><th className="px-5 py-3">Case</th><th className="px-5 py-3">Candidate</th><th className="px-5 py-3">{isReports ? 'Completed' : 'Created'}</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Verification status</th><th className="px-5 py-3 text-right">Action</th></tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {loadingRows ? <tr><td colSpan={6} className="px-5 py-14 text-center text-[var(--muted)]">Loading {isReports ? 'reports' : 'cases'}…</td></tr>
                    : rows.length === 0 ? <tr><td colSpan={6} className="px-5 py-16 text-center"><span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--primary)]/10 text-[var(--primary)]">{isReports ? <FileText size={21} /> : <FileCheck2 size={21} />}</span><p className="mt-3 text-[13px] font-semibold">{isReports ? 'No completed reports yet' : 'No BGV cases yet'}</p><p className="mt-1 text-[12px] text-[var(--muted)]">{isReports ? 'Reports appear here when a case is completed.' : 'Cases created for this client will appear here.'}</p></td></tr>
                      : rows.map((item) => (
                        <tr key={item.id} className="transition-colors hover:bg-[var(--surface-muted)]/60">
                          <td className="px-5 py-3.5"><button type="button" onClick={() => router.push(`/company/bgv-cases/${item.id}`)} className="font-mono text-[12px] font-semibold text-[var(--primary)] hover:underline">{item.caseNumber}</button>{item.packageName && <p className="mt-0.5 text-[11px] text-[var(--muted)]">{item.packageName}</p>}</td>
                          <td className="px-5 py-3.5"><p className="font-medium">{item.candidate ? `${item.candidate.firstName} ${item.candidate.lastName}` : 'Candidate'}</p><p className="text-[11px] text-[var(--muted)]">{item.candidate?.candidateCode || '—'}</p></td>
                          <td className="px-5 py-3.5 text-[12px] text-[var(--muted)]">{dateLabel(isReports ? item.completedAt : item.createdAt)}</td>
                          <td className="px-5 py-3.5"><span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold ${item.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-700' : item.status === 'CANCELLED' || item.status === 'ON_HOLD' ? 'bg-amber-500/10 text-amber-700' : 'bg-sky-500/10 text-sky-700'}`}>{item.status.replaceAll('_', ' ')}</span></td>
                          <td className="px-5 py-3.5">{(() => { const verification = isReports ? getReportVerificationStatus(item.reportVerificationStatus) : getVerificationStatus(item.verificationStatuses); return <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold ${verification.className}`}>{verification.label}</span>; })()}</td>
                          <td className="px-5 py-3.5 text-right">{isReports && <button type="button" onClick={() => void downloadReport(item)} disabled={recordAction === `report-${item.id}`} title="Download report" aria-label={`Download report for ${item.caseNumber}`} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-[11px] font-semibold hover:bg-[var(--surface-muted)] disabled:opacity-50"><Download size={13} />{recordAction === `report-${item.id}` ? 'Preparing…' : 'PDF'}</button>}</td>
                        </tr>
                      ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col items-center gap-2.5 border-t border-[var(--border)] bg-[var(--surface)] px-5 py-3 text-[11px] text-[var(--muted)]"><span>{total ? `${(currentPage - 1) * RECORD_PAGE_SIZE + 1}–${Math.min(currentPage * RECORD_PAGE_SIZE, total)} of ${total}` : '0 records'}</span><div className="flex justify-center gap-2"><button type="button" disabled={currentPage <= 1 || loadingRows} onClick={() => setCurrentPage((value) => Math.max(1, value - 1))} className="rounded-md border border-[var(--border)] px-3 py-1.5 hover:bg-[var(--surface-muted)] disabled:opacity-40" aria-label="Previous page"><ChevronLeft size={14} /><span className="ml-1">Previous</span></button><button type="button" disabled={currentPage >= Math.ceil(total / RECORD_PAGE_SIZE) || loadingRows} onClick={() => setCurrentPage((value) => value + 1)} className="inline-flex items-center rounded-md border border-[var(--border)] px-3 py-1.5 hover:bg-[var(--surface-muted)] disabled:opacity-40" aria-label="Next page">Next<span className="ml-1"><ChevronRight size={14} /></span></button></div></div>
          </section>
        );
      })()}

      {tab === 'invoices' && (
        <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
          <div className="flex flex-col gap-3 border-b border-[var(--border)] bg-gradient-to-r from-[#E7A83E]/15 via-[var(--surface)] to-[var(--surface)] px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E7A83E]/15 text-[#B87512]"><Receipt size={19} /></span><div><h2 className="text-[15px] font-semibold">Client invoices</h2><p className="mt-0.5 text-[12px] text-[var(--muted)]">{invoicesTotal} invoice{invoicesTotal === 1 ? '' : 's'} for {client.name}</p></div></div>
            <button type="button" onClick={() => router.push('/company/invoices')} className="inline-flex items-center justify-center gap-1.5 self-start rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[12px] font-semibold hover:bg-[var(--surface-muted)] sm:self-auto">Open invoices <ChevronRight size={14} /></button>
          </div>
          {invoicesError && <p role="alert" className="border-b border-[#FF6B6B]/20 bg-[#FF6B6B]/10 px-5 py-3 text-[12px] text-[#FF6B6B]">{invoicesError}</p>}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-[13px]">
              <thead className="border-b border-[var(--border)] bg-[var(--surface-muted)]/60 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]"><tr><th className="px-5 py-3">Invoice</th><th className="px-5 py-3">Issued / due</th><th className="px-5 py-3 text-right">Total</th><th className="px-5 py-3 text-right">Balance</th><th className="px-5 py-3">Status</th><th className="px-5 py-3 text-right">Action</th></tr></thead>
              <tbody className="divide-y divide-[var(--border)]">
                {invoicesLoading ? <tr><td colSpan={6} className="px-5 py-14 text-center text-[var(--muted)]">Loading invoices…</td></tr>
                  : invoices.length === 0 ? <tr><td colSpan={6} className="px-5 py-16 text-center"><span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#E7A83E]/15 text-[#B87512]"><Receipt size={21} /></span><p className="mt-3 text-[13px] font-semibold">No invoices yet</p><p className="mt-1 text-[12px] text-[var(--muted)]">Invoices issued to this client will appear here.</p></td></tr>
                    : invoices.map((invoice) => <tr key={invoice.id} className="transition-colors hover:bg-[var(--surface-muted)]/60">
                      <td className="px-5 py-3.5"><p className="font-mono text-[12px] font-semibold text-[var(--foreground)]">{invoice.invoiceNumber}</p>{invoice.purchaseOrderNumber && <p className="mt-0.5 text-[11px] text-[var(--muted)]">PO {invoice.purchaseOrderNumber}</p>}</td>
                      <td className="px-5 py-3.5 text-[12px]"><p>{dateLabel(invoice.invoiceDate)}</p><p className="mt-0.5 text-[11px] text-[var(--muted)]">Due {dateLabel(invoice.dueDate)}</p></td>
                      <td className="px-5 py-3.5 text-right font-medium">{currencyLabel(invoice.total, invoice.currency)}</td><td className="px-5 py-3.5 text-right text-[var(--muted)]">{currencyLabel(invoice.balanceDue, invoice.currency)}</td>
                      <td className="px-5 py-3.5"><span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold ${invoice.status === 'PAID' ? 'bg-emerald-500/10 text-emerald-700' : invoice.status === 'OVERDUE' || invoice.status === 'VOID' ? 'bg-rose-500/10 text-rose-700' : invoice.status === 'DRAFT' ? 'bg-slate-500/10 text-slate-600' : 'bg-sky-500/10 text-sky-700'}`}>{invoice.status.replaceAll('_', ' ')}</span></td>
                      <td className="px-5 py-3.5 text-right"><button type="button" onClick={() => void downloadInvoice(invoice)} disabled={recordAction === `invoice-${invoice.id}`} title="Download invoice PDF" aria-label={`Download ${invoice.invoiceNumber}`} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-[11px] font-semibold hover:bg-[var(--surface-muted)] disabled:opacity-50"><Download size={13} />PDF</button></td>
                    </tr>)}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col items-center gap-2.5 border-t border-[var(--border)] bg-[var(--surface)] px-5 py-3 text-[11px] text-[var(--muted)]"><span>{invoicesTotal ? `${(invoicesPage - 1) * RECORD_PAGE_SIZE + 1}–${Math.min(invoicesPage * RECORD_PAGE_SIZE, invoicesTotal)} of ${invoicesTotal}` : '0 invoices'}</span><div className="flex justify-center gap-2"><button type="button" disabled={invoicesPage <= 1 || invoicesLoading} onClick={() => setInvoicesPage((value) => Math.max(1, value - 1))} className="inline-flex items-center rounded-md border border-[var(--border)] px-3 py-1.5 hover:bg-[var(--surface-muted)] disabled:opacity-40" aria-label="Previous page"><ChevronLeft size={14} /><span className="ml-1">Previous</span></button><button type="button" disabled={invoicesPage >= Math.ceil(invoicesTotal / RECORD_PAGE_SIZE) || invoicesLoading} onClick={() => setInvoicesPage((value) => value + 1)} className="inline-flex items-center rounded-md border border-[var(--border)] px-3 py-1.5 hover:bg-[var(--surface-muted)] disabled:opacity-40" aria-label="Next page">Next<span className="ml-1"><ChevronRight size={14} /></span></button></div></div>
        </section>
      )}

      {statusTarget && (
        <ClientConfirmDialog
          title={statusTarget === 'ACTIVE' ? 'Activate client?' : 'Deactivate client?'}
          description={statusTarget === 'ACTIVE' ? `"${client.name}" will be marked active again.` : `"${client.name}" will be marked inactive.`}
          confirmLabel={statusTarget === 'ACTIVE' ? 'Activate' : 'Deactivate'}
          tone={statusTarget === 'ACTIVE' ? 'default' : 'danger'}
          submitting={togglingStatus}
          onConfirm={handleToggleStatus}
          onCancel={() => setStatusTarget(null)}
        />
      )}

      {candidateModalOpen && (
        <CandidateFormModal
          mode="create"
          candidate={null}
          defaultClientId={client.id}
          submitting={candidateSubmitting}
          error={null}
          onClose={() => setCandidateModalOpen(false)}
          onSubmit={handleCreateCandidate}
        />
      )}

      {editOpen && (
        <ClientFormModal
          mode="edit"
          client={client}
          companies={[]}
          isSuperAdmin={false}
          submitting={editSubmitting}
          error={editError}
          onClose={() => { if (!editSubmitting) setEditOpen(false); }}
          onSubmit={handleUpdateClient}
        />
      )}
    </div>
  );
}