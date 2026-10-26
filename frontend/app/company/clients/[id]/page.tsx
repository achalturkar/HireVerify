'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  ArrowLeft, BarChart3, ChevronLeft, ChevronRight, Download, FileCheck2, FileText, Globe, Mail, Pencil, Phone, Receipt, Users, MapPin, Power, PowerOff, ShieldCheck, UserPlus, Trash2, Building2, SlidersHorizontal, Plus, Check, X, Search,
} from 'lucide-react';
import { useAuth } from '@/src/auth/AuthProvider';
import { getReportVerificationStatus, getVerificationStatus } from '@/src/lib/verification-status';
import { formatCandidateName } from '@/src/lib/candidate-name';
import { getClient, updateClient, uploadCandidateFormTemplate, removeCandidateFormTemplate, downloadCandidateFormTemplate, activateClient, inactivateClient, listClientPortalUsers, inviteClientPortalUser, updateClientPortalUser, revokeClientPortalUser, listSubclients, createSubclient, updateSubclient, deleteSubclient, ApiError as ClientApiError } from '@/src/lib/api/clients';
import { listCandidates, exportCandidates, createCandidate, sendCandidatePortalLink, ApiError as CandidateApiError } from '@/src/lib/api/candidates';
import { ApiError as BGVApiError, downloadBGVReport, listBGVCases, listVerificationCheckTypes } from '@/src/lib/api/bgv';
import type { BGVCase, VerificationCheckType, VerificationType } from '@/src/types/bgv';
import { downloadInvoicePdf, InvoiceApiError, listInvoices } from '@/src/lib/api/invoices';
import type { Invoice } from '@/src/lib/api/invoices';
import ClientFormModal from '@/src/components/layout/company/client/ClientFormModal';
import ClientConfirmDialog from '@/src/components/layout/company/client/ClientConfirmDialog';
import ClientAnalyticsPanel from '@/src/components/layout/company/client/ClientAnalyticsPanel';
import CandidateFormModal from '@/src/components/layout/company/candidate/CandidateFormModal';
import { CANDIDATE_ADDRESS_DOCUMENT_TYPES, CANDIDATE_EMPLOYMENT_DOCUMENT_TYPES, CANDIDATE_FORM_REQUIRED_FIELD_GROUPS, CANDIDATE_IDENTITY_FIELDS, DEFAULT_CANDIDATE_FORM_CONFIG } from '@/src/types/client';
import { setClientPortalScope } from '@/src/lib/api/client-portal';
import type { CandidateFormConfig, CandidateFormRequiredFieldKey, CandidateIdentityFieldKey, Client, ClientFormValues, ClientPortalAccountMethod, ClientPortalPermission, ClientPortalUser } from '@/src/types/client';
import type { Candidate, CandidateFormValues, CandidateStatus, PaginationMeta } from '@/src/types/candidate';

const PAGE_SIZE = 10;
const CANDIDATE_STATUSES: CandidateStatus[] = ['PENDING', 'INVITED', 'IN_PROGRESS', 'VERIFICATION_IN_PROGRESS', 'COMPLETED', 'WITHDRAWN', 'ON_HOLD'];
const candidateRequiredFieldsFor = (key: typeof CANDIDATE_FORM_REQUIRED_FIELD_GROUPS[number]['key']) =>
  CANDIDATE_FORM_REQUIRED_FIELD_GROUPS.find((group) => group.key === key)?.fields ?? [];
type TabKey = 'overview' | 'analytics' | 'billing' | 'subclients' | 'candidates' | 'cases' | 'reports' | 'invoices' | 'report-branding' | 'candidate-form' | 'portal-access' | 'client-portal';
const TABS: { key: TabKey; label: string; icon: typeof Users }[] = [
  { key: 'overview', label: 'Overview', icon: Users },
  { key: 'analytics', label: 'Analytics', icon: BarChart3 },
  { key: 'billing', label: 'Billing details', icon: Receipt },
  { key: 'subclients', label: 'Subclients', icon: Building2 },
  { key: 'candidates', label: 'Candidates', icon: Users },
  { key: 'cases', label: 'BGV cases', icon: FileCheck2 },
  { key: 'reports', label: 'Reports', icon: FileText },
  { key: 'invoices', label: 'Invoices', icon: Receipt },
  { key: 'report-branding', label: 'Report branding', icon: Building2 },
  { key: 'candidate-form', label: 'Candidate form', icon: SlidersHorizontal },
  { key: 'portal-access', label: 'Portal access', icon: ShieldCheck },
  { key: 'client-portal', label: 'Client portal', icon: Building2 },
];
type SubclientCheckDraft = { checkType: VerificationType };
type SubclientDraft = {
  name: string; clientCode: string; industry: string; contactName: string; contactEmail: string; contactPhone: string;
  supportEmail: string; supportPhone: string;
  gstNumber: string; panNumber: string; addressLine1: string; addressLine2: string; city: string; state: string;
  country: string; postalCode: string; status: 'ACTIVE' | 'INACTIVE'; serviceRates: SubclientCheckDraft[]; packageRate: string;
};
const emptySubclientDraft = (): SubclientDraft => ({
  name: '', clientCode: '', industry: '', contactName: '', contactEmail: '', contactPhone: '',
  supportEmail: '', supportPhone: '',
  gstNumber: '', panNumber: '', addressLine1: '', addressLine2: '', city: '', state: '',
  country: '', postalCode: '', status: 'ACTIVE', serviceRates: [], packageRate: '',
});

function CandidateFormPreviewFields({ title, fields }: { title: string; fields: string[] }) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold">{title}</p>
      {fields.length ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {fields.map((field) => {
            const required = field.endsWith(' *') || field.endsWith(' · required');
            const label = required ? field.replace(/(?: \*| · required)$/, '') : field;
            return (
              <div key={field} className="rounded-md border border-[var(--border)] bg-white px-3 py-2 text-[10px] text-[var(--muted)]">
                {label}{required && <><span className="ml-1 font-bold text-red-600">*</span><span className="sr-only"> required</span></>}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-[var(--border)] bg-white p-3 text-xs text-[var(--muted)]">No fields or forms are enabled in this section.</p>
      )}
    </div>
  );
}

const PORTAL_PERMISSION_OPTIONS: { key: ClientPortalPermission; label: string; description: string }[] = [
  { key: 'clientportal.candidates.view', label: 'View candidates', description: 'View candidate names, references and contact details.' },
  { key: 'clientportal.candidates.pdf.download', label: 'Download candidate PDFs', description: 'Download candidate profiles and their uploaded document register. Also enables candidate viewing.' },
  { key: 'clientportal.candidates.create', label: 'Create candidates', description: 'Add candidate records. Also enables candidate viewing.' },
  { key: 'clientportal.candidates.update', label: 'Update candidates', description: 'Edit candidate contact details. Also enables candidate viewing.' },
  { key: 'clientportal.candidates.invite', label: 'Invite candidates', description: 'Send candidates a secure link to complete their profile. Also enables candidate viewing.' },
  { key: 'clientportal.candidates.portal.manage', label: 'Manage candidate portal access', description: 'Lock and unlock candidate portal links. Also enables candidate viewing.' },
  { key: 'clientportal.subclients.view', label: 'View subclients', description: 'View the client’s subclients, configured package checks, and package rates.' },
  { key: 'clientportal.subclients.manage', label: 'Manage subclients', description: 'Add subclients and configure their package checks and rates. Also enables subclient viewing.' },
  { key: 'clientportal.cases.view', label: 'View case progress', description: 'View BGV case numbers, statuses and outcomes.' },
  { key: 'clientportal.invoices.view', label: 'View invoices', description: 'View issued invoices, payment status, amounts, and download invoice PDFs.' },
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
      removed.add('clientportal.candidates.pdf.download');
    }
    if (permission === 'clientportal.reports.view') removed.add('clientportal.reports.download');
    if (permission === 'clientportal.subclients.view') removed.add('clientportal.subclients.manage');
    return current.filter((item) => !removed.has(item));
  }
  const next = [...current, permission];
  if (permission === 'clientportal.candidates.create' || permission === 'clientportal.candidates.update' || permission === 'clientportal.candidates.invite' || permission === 'clientportal.candidates.portal.manage' || permission === 'clientportal.candidates.pdf.download') {
    next.push('clientportal.candidates.view');
  }
  if (permission === 'clientportal.reports.download') next.push('clientportal.reports.view');
  if (permission === 'clientportal.subclients.manage') next.push('clientportal.subclients.view');
  return [...new Set(next)];
}
const RECORD_PAGE_SIZE = 10;
const currencyLabel = (value: number | string, currency: string) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(value || 0));
const dateLabel = (value?: string | null) => value ? new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const invoiceDateLabel = (value: string) => {
  const dateOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (dateOnly) return `${dateOnly[3]}/${dateOnly[2]}/${dateOnly[1]}`;
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
};

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
  const tabScrollerRef = useRef<HTMLDivElement>(null);
  const [canScrollTabsLeft, setCanScrollTabsLeft] = useState(false);
  const [canScrollTabsRight, setCanScrollTabsRight] = useState(false);

  const updateTabScrollControls = useCallback(() => {
    const element = tabScrollerRef.current;
    if (!element) return;
    setCanScrollTabsLeft(element.scrollLeft > 0);
    setCanScrollTabsRight(element.scrollLeft + element.clientWidth < element.scrollWidth - 1);
  }, []);

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
  const [candidateSearch, setCandidateSearch] = useState('');
  const [candidateStatusFilter, setCandidateStatusFilter] = useState<CandidateStatus | ''>('');
  const [candidateDateFrom, setCandidateDateFrom] = useState('');
  const [candidateDateTo, setCandidateDateTo] = useState('');
  const [candidateExporting, setCandidateExporting] = useState(false);
  const [candidateExportError, setCandidateExportError] = useState<string | null>(null);
  const [candidateModalOpen, setCandidateModalOpen] = useState(false);
  const [candidateSubmitting, setCandidateSubmitting] = useState(false);
  const [candidateCreateMessage, setCandidateCreateMessage] = useState<string | null>(null);
  const [subclients, setSubclients] = useState<Client[]>([]);
  const [checkTypes, setCheckTypes] = useState<VerificationCheckType[]>([]);
  const [subclientsLoading, setSubclientsLoading] = useState(false);
  const [subclientsError, setSubclientsError] = useState<string | null>(null);
  const [subclientsMessage, setSubclientsMessage] = useState<string | null>(null);
  const [subclientFilter, setSubclientFilter] = useState('');
  const [subclientEditorOpen, setSubclientEditorOpen] = useState(false);
  const [subclientEditingId, setSubclientEditingId] = useState<string | null>(null);
  const [subclientDraft, setSubclientDraft] = useState<SubclientDraft>(emptySubclientDraft);
  const [subclientSaving, setSubclientSaving] = useState(false);
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
  const [candidateFormTargetId, setCandidateFormTargetId] = useState('');
  const [candidateFormSaving, setCandidateFormSaving] = useState(false);
  const [candidateFormError, setCandidateFormError] = useState<string | null>(null);
  const [candidateFormSaved, setCandidateFormSaved] = useState(false);
  const [candidateFormPreview, setCandidateFormPreview] = useState(false);
  const [candidatePreviewTab, setCandidatePreviewTab] = useState('overview');
  const [candidateTemplateName, setCandidateTemplateName] = useState('');
  const [candidateTemplateCategory, setCandidateTemplateCategory] = useState('BGV');
  const [candidateTemplateRequired, setCandidateTemplateRequired] = useState(true);
  const [candidateTemplateFile, setCandidateTemplateFile] = useState<File | null>(null);
  const candidateTemplateFileRef = useRef<HTMLInputElement>(null);
  const [candidateTemplateDownloading, setCandidateTemplateDownloading] = useState<string | null>(null);

  const loadClient = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [loaded, availableTypes] = await Promise.all([getClient(id, accessToken), listVerificationCheckTypes(accessToken)]);
      setClient(loaded);
      setCheckTypes(availableTypes);
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

  useEffect(() => {
    const element = tabScrollerRef.current;
    if (!element) return undefined;
    const frame = window.requestAnimationFrame(updateTabScrollControls);
    const observer = new ResizeObserver(updateTabScrollControls);
    observer.observe(element);
    if (element.firstElementChild) observer.observe(element.firstElementChild);
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [updateTabScrollControls, canManageAccess, candidatesMeta.total, casesTotal, reportsTotal, invoicesTotal]);

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
      if (candidateFormTargetId) {
        const updated = await updateSubclient(client.id, candidateFormTargetId, { candidateFormConfig }, accessToken);
        setSubclients((current) => current.map((subclient) => subclient.id === updated.id ? updated : subclient));
        setCandidateFormConfig(updated.candidateFormConfig);
      } else {
        const updated = await updateClient(client.id, { candidateFormConfig }, accessToken);
        setClient(updated);
        setCandidateFormConfig(updated.candidateFormConfig);
      }
      setCandidateFormSaved(true);
    } catch (saveError) {
      setCandidateFormError(saveError instanceof ClientApiError ? saveError.message : 'Could not save candidate form settings.');
    } finally {
      setCandidateFormSaving(false);
    }
  };

  const updateCandidateFormField = (key: CandidateIdentityFieldKey, property: 'enabled' | 'required' | 'documentRequired', value: boolean) => {
    setCandidateFormSaved(false);
    setCandidateFormConfig((current) => {
      const existing = current[key];
      if (property === 'enabled' && !value) {
        return { ...current, [key]: { enabled: false, required: false, documentRequired: false } };
      }
      return { ...current, [key]: { ...existing, [property]: value } };
    });
  };

  const updateCandidateFormSection = (key: keyof CandidateFormConfig['sections'], enabled: boolean) => {
    setCandidateFormSaved(false);
    setCandidateFormConfig((current) => ({ ...current, sections: { ...current.sections, [key]: { enabled } } }));
  };

  const updateCandidateFieldRequirement = (key: CandidateFormRequiredFieldKey, required: boolean) => {
    setCandidateFormSaved(false);
    setCandidateFormConfig((current) => ({
      ...current,
      fields: { ...current.fields, [key]: { required } },
    }));
  };

  const updateCandidateAddressField = (key: 'currentAddressEnabled' | 'currentAddressRequired' | 'permanentAddressEnabled' | 'permanentAddressRequired', value: boolean) => {
    setCandidateFormSaved(false);
    setCandidateFormConfig((current) => ({
      ...current,
      address: {
        ...current.address,
        [key]: value,
        ...((key === 'currentAddressEnabled' || key === 'permanentAddressEnabled') && !value
          ? { [key === 'currentAddressEnabled' ? 'currentAddressRequired' : 'permanentAddressRequired']: false }
          : {}),
      },
    }));
  };

  const updateAddressDocument = (type: string, property: 'enabled' | 'required', value: boolean) => {
    setCandidateFormSaved(false);
    setCandidateFormConfig((current) => ({
      ...current,
      address: {
        ...current.address,
        documents: current.address.documents.map((document) => document.type === type
          ? { ...document, [property]: value, ...(property === 'enabled' && !value ? { required: false } : {}) }
          : document),
      },
    }));
  };

  const updateEmploymentDocument = (type: string, property: 'enabled' | 'required', value: boolean) => {
    setCandidateFormSaved(false);
    setCandidateFormConfig((current) => ({
      ...current,
      employmentDocuments: current.employmentDocuments.map((document) => document.type === type
        ? {
          ...document,
          [property]: value,
          ...(property === 'enabled' && !value ? { required: false } : {}),
        }
        : document),
    }));
  };

  const updateCustomForm = (formId: string, property: 'enabled' | 'required', value: boolean) => {
    setCandidateFormSaved(false);
    setCandidateFormConfig((current) => ({
      ...current,
      customForms: current.customForms.map((form) => form.id === formId
        ? { ...form, [property]: value, ...(property === 'enabled' && !value ? { required: false } : {}) }
        : form),
    }));
  };

  const uploadCandidateTemplate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!client || !candidateTemplateFile) return;
    const target = candidateFormTargetId
      ? subclients.find((subclient) => subclient.id === candidateFormTargetId)
      : client;
    if (!target) return;
    setCandidateFormSaving(true);
    setCandidateFormError(null);
    setCandidateFormSaved(false);
    try {
      const updated = await uploadCandidateFormTemplate(target.id, {
        file: candidateTemplateFile,
        name: candidateTemplateName,
        category: candidateTemplateCategory,
        required: candidateTemplateRequired,
      }, accessToken);
      if (candidateFormTargetId) {
        setSubclients((current) => current.map((subclient) => subclient.id === updated.id ? updated : subclient));
      } else {
        setClient(updated);
      }
      setCandidateFormConfig(updated.candidateFormConfig);
      setCandidateTemplateName('');
      setCandidateTemplateFile(null);
      if (candidateTemplateFileRef.current) candidateTemplateFileRef.current.value = '';
      setCandidateFormSaved(true);
    } catch (uploadError) {
      setCandidateFormError(uploadError instanceof ClientApiError ? uploadError.message : 'Could not upload the candidate form template.');
    } finally {
      setCandidateFormSaving(false);
    }
  };

  const deleteCandidateTemplate = async (formId: string) => {
    if (!client || !window.confirm('Remove this form from the candidate portal?')) return;
    const target = candidateFormTargetId
      ? subclients.find((subclient) => subclient.id === candidateFormTargetId)
      : client;
    if (!target) return;
    setCandidateFormSaving(true);
    setCandidateFormError(null);
    setCandidateFormSaved(false);
    try {
      const updated = await removeCandidateFormTemplate(target.id, formId, accessToken);
      if (candidateFormTargetId) {
        setSubclients((current) => current.map((subclient) => subclient.id === updated.id ? updated : subclient));
      } else {
        setClient(updated);
      }
      setCandidateFormConfig(updated.candidateFormConfig);
      setCandidateFormSaved(true);
    } catch (deleteError) {
      setCandidateFormError(deleteError instanceof ClientApiError ? deleteError.message : 'Could not remove the candidate form template.');
    } finally {
      setCandidateFormSaving(false);
    }
  };

  const downloadCandidateTemplate = async (formId: string, fileName: string) => {
    if (!client) return;
    const target = candidateFormTargetId
      ? subclients.find((subclient) => subclient.id === candidateFormTargetId)
      : client;
    if (!target) return;
    setCandidateTemplateDownloading(formId);
    setCandidateFormError(null);
    try {
      const blob = await downloadCandidateFormTemplate(target.id, formId, accessToken);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (downloadError) {
      setCandidateFormError(downloadError instanceof ClientApiError ? downloadError.message : 'Could not download the form template.');
    } finally {
      setCandidateTemplateDownloading(null);
    }
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

  const loadSubclients = useCallback(async () => {
    if (!id) return;
    setSubclientsLoading(true);
    setSubclientsError(null);
    try {
      setSubclients(await listSubclients(id, accessToken));
    } catch (err) {
      setSubclientsError(err instanceof ClientApiError ? err.message : 'Could not load subclients.');
    } finally {
      setSubclientsLoading(false);
    }
  }, [accessToken, id]);

  const loadCandidates = useCallback(async () => {
    if (!id) return;
    setCandidatesLoading(true);
    setCandidatesError(null);
    try {
      const res = await listCandidates(
        {
          page: candidatesPage,
          limit: PAGE_SIZE,
          clientId: id,
          subclientId: subclientFilter || undefined,
          search: candidateSearch || undefined,
          status: candidateStatusFilter,
          dateFrom: candidateDateFrom || undefined,
          dateTo: candidateDateTo || undefined,
          sortBy: 'createdAt',
          sortOrder: 'desc',
        },
        accessToken
      );
      setCandidates(res.items);
      setCandidatesMeta(res.meta);
    } catch (err) {
      setCandidatesError(err instanceof CandidateApiError ? err.message : 'Failed to load candidates.');
    } finally {
      setCandidatesLoading(false);
    }
  }, [id, candidatesPage, accessToken, subclientFilter, candidateSearch, candidateStatusFilter, candidateDateFrom, candidateDateTo]);

  useEffect(() => {
    if (tab !== 'candidates') return undefined;
    const timer = window.setTimeout(() => { void loadCandidates(); }, 0);
    return () => window.clearTimeout(timer);
  }, [tab, loadCandidates]);

  const downloadCandidateExport = async () => {
    if (!id || (candidateDateFrom && candidateDateTo && candidateDateFrom > candidateDateTo)) return;
    setCandidateExporting(true);
    setCandidateExportError(null);
    try {
      const blob = await exportCandidates({
        clientId: id,
        subclientId: subclientFilter || undefined,
        search: candidateSearch || undefined,
        status: candidateStatusFilter,
        dateFrom: candidateDateFrom || undefined,
        dateTo: candidateDateTo || undefined,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      }, accessToken);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const safeClientName = (client?.name || 'client').trim().replace(/\s+/g, '-').replace(/[^a-zA-Z0-9_-]/g, '');
      link.href = url;
      link.download = `${safeClientName || 'client'}-candidates-${candidateDateFrom || 'all'}-to-${candidateDateTo || 'all'}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setCandidateExportError(err instanceof CandidateApiError ? err.message : 'Could not export candidates.');
    } finally {
      setCandidateExporting(false);
    }
  };

  useEffect(() => {
    if (tab !== 'subclients' && tab !== 'candidates' && tab !== 'candidate-form') return undefined;
    const timer = window.setTimeout(() => { void loadSubclients(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadSubclients, tab]);

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
      supportEmail: values.supportEmail.trim(),
      supportPhone: values.supportPhone.trim(),
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

  const handleCreateCandidate = async (values: CandidateFormValues, inviteByEmail = false) => {
    if (!client) return;
    setCandidateSubmitting(true);
    try {
      const created = await createCandidate(
        {
          clientId: client.id,
          subclientId: values.subclientId || undefined,
          fullName: values.fullName.trim(),
          firstName: values.firstName.trim(),
          middleName: values.middleName.trim() || null,
          lastName: values.lastName.trim(),
          email: values.email.trim() || undefined,
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
      if (inviteByEmail) {
        try {
          const invitation = await sendCandidatePortalLink(created.id, accessToken);
          setCandidateCreateMessage(invitation.emailSent
            ? `Candidate added and portal invitation sent to ${created.email}.`
            : 'Candidate added, but the invitation email could not be delivered.');
        } catch (inviteError) {
          setCandidateCreateMessage(`Candidate added, but the invitation failed: ${inviteError instanceof Error ? inviteError.message : 'Please try again from the candidate profile.'}`);
        }
      } else {
        setCandidateCreateMessage('Candidate added.');
      }
    } catch (err) {
      setCandidateCreateMessage(err instanceof CandidateApiError ? err.message : 'Could not add candidate.');
    } finally {
      setCandidateSubmitting(false);
    }
  };

  const openSubclientEditor = (subclient?: Client) => {
    setSubclientEditingId(subclient?.id || null);
    setSubclientDraft({
      ...emptySubclientDraft(),
      name: subclient?.name || '',
      clientCode: subclient?.clientCode || `${client?.clientCode || 'CLIENT'}-SUB-${String(subclients.length + 1).padStart(3, '0')}`,
      industry: subclient?.industry || '',
      contactName: subclient?.contactName || '',
      contactEmail: subclient?.contactEmail || '',
      contactPhone: subclient?.contactPhone || '',
      supportEmail: subclient?.supportEmail || '',
      supportPhone: subclient?.supportPhone || '',
      gstNumber: subclient?.gstNumber || '',
      panNumber: subclient?.panNumber || '',
      addressLine1: subclient?.addressLine1 || '',
      addressLine2: subclient?.addressLine2 || '',
      city: subclient?.city || '',
      state: subclient?.state || '',
      country: subclient?.country || '',
      postalCode: subclient?.postalCode || '',
      status: subclient?.status || 'ACTIVE',
      serviceRates: (subclient?.serviceRates || []).map((entry) => ({ checkType: entry.checkType as VerificationType })),
      packageRate: subclient?.packageRate === null || subclient?.packageRate === undefined ? '' : String(subclient.packageRate),
    });
    setSubclientsError(null);
    setSubclientEditorOpen(true);
  };

  const saveSubclient = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!client) return;
    if (!subclientDraft.serviceRates.length) {
      setSubclientsError('Select at least one background check for the package.');
      return;
    }
    const packageRate = Number(subclientDraft.packageRate);
    if (subclientDraft.packageRate === '' || !Number.isFinite(packageRate) || packageRate < 0 || packageRate > 100000000) {
      setSubclientsError('Enter a valid package rate between ₹0 and ₹100,000,000.');
      return;
    }
    const payload = {
      name: subclientDraft.name.trim(),
      clientCode: subclientDraft.clientCode.trim(),
      industry: subclientDraft.industry.trim(),
      contactName: subclientDraft.contactName.trim(),
      contactEmail: subclientDraft.contactEmail.trim(),
      contactPhone: subclientDraft.contactPhone.trim(),
      supportEmail: subclientDraft.supportEmail.trim(),
      supportPhone: subclientDraft.supportPhone.trim(),
      gstNumber: subclientDraft.gstNumber.trim(),
      panNumber: subclientDraft.panNumber.trim(),
      addressLine1: subclientDraft.addressLine1.trim(),
      addressLine2: subclientDraft.addressLine2.trim(),
      city: subclientDraft.city.trim(),
      state: subclientDraft.state.trim(),
      country: subclientDraft.country.trim(),
      postalCode: subclientDraft.postalCode.trim(),
      status: subclientDraft.status,
      serviceRates: subclientDraft.serviceRates.map((entry) => ({ checkType: entry.checkType, rate: 0 })),
      packageRate,
    };
    setSubclientSaving(true);
    setSubclientsError(null);
    setSubclientsMessage(null);
    try {
      if (subclientEditingId) await updateSubclient(client.id, subclientEditingId, payload, accessToken);
      else await createSubclient(client.id, payload, accessToken);
      await loadSubclients();
      setSubclientEditorOpen(false);
      setSubclientsMessage(subclientEditingId ? 'Subclient updated.' : 'Subclient created.');
    } catch (err) {
      setSubclientsError(err instanceof ClientApiError ? err.message : 'Could not save the subclient.');
    } finally {
      setSubclientSaving(false);
    }
  };

  const deactivateSubclient = async (subclient: Client) => {
    if (!client || !window.confirm(`Deactivate ${subclient.name}? Existing candidate and case records will be preserved.`)) return;
    setSubclientsError(null);
    setSubclientsMessage(null);
    try {
      await deleteSubclient(client.id, subclient.id, accessToken);
      if (subclientFilter === subclient.id) setSubclientFilter('');
      await loadSubclients();
      setSubclientsMessage(`${subclient.name} deactivated.`);
    } catch (err) {
      setSubclientsError(err instanceof ClientApiError ? err.message : 'Could not deactivate the subclient.');
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

      <div className="flex min-w-0 items-center border-b border-[var(--border)]">
        <button
          type="button"
          onClick={() => tabScrollerRef.current?.scrollBy({ left: -240, behavior: 'smooth' })}
          disabled={!canScrollTabsLeft}
          aria-label="Scroll tabs left"
          className="flex h-10 w-9 shrink-0 items-center justify-center border-r border-[var(--border)] text-[var(--muted)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)] disabled:invisible"
        >
          <ChevronLeft size={16} />
        </button>
        <div
          ref={tabScrollerRef}
          onScroll={updateTabScrollControls}
          role="tablist"
          aria-label="Client sections"
          className="min-w-0 flex-1 overflow-x-auto scroll-smooth [scrollbar-width:thin]"
        >
          <div className="flex w-max min-w-full items-center gap-1">
            {TABS.filter((t) => t.key === 'client-portal'
              ? user?.role.isCompanyAdmin === true
              : canManageAccess || (t.key !== 'portal-access' && t.key !== 'report-branding' && t.key !== 'candidate-form')).map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={tab === t.key}
                onClick={(event) => {
                  setTab(t.key);
                  event.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
                }}
                className={`inline-flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-[13px] font-medium transition-colors ${
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
        </div>
        <button
          type="button"
          onClick={() => tabScrollerRef.current?.scrollBy({ left: 240, behavior: 'smooth' })}
          disabled={!canScrollTabsRight}
          aria-label="Scroll tabs right"
          className="flex h-10 w-9 shrink-0 items-center justify-center border-l border-[var(--border)] text-[var(--muted)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)] disabled:invisible"
        >
          <ChevronRight size={16} />
        </button>
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

      {tab === 'analytics' && <ClientAnalyticsPanel client={client} />}

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

      {tab === 'subclients' && (
        <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
          <div className="flex flex-col gap-4 border-b border-[var(--border)] bg-gradient-to-r from-[var(--primary)]/10 via-[var(--surface)] to-[var(--surface)] px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--primary)]/10 text-[var(--primary)]"><Building2 size={19} /></span>
              <div><h2 className="text-[15px] font-semibold">Subclients</h2><p className="mt-0.5 text-[12px] text-[var(--muted)]">Manage business units, contacts, enabled checks and per-check rates under {client.name}.</p></div>
            </div>
            {canManageAccess && <button type="button" onClick={() => openSubclientEditor()} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2.5 text-[12px] font-semibold text-[var(--primary-foreground)]"><Plus size={15} />Add subclient</button>}
          </div>
          {subclientsError && !subclientEditorOpen && <p role="alert" className="border-b border-rose-500/20 bg-rose-500/5 px-5 py-3 text-[12px] text-rose-700">{subclientsError}</p>}
          {subclientsMessage && <p role="status" className="border-b border-emerald-500/20 bg-emerald-500/5 px-5 py-3 text-[12px] text-emerald-700">{subclientsMessage}</p>}
          {subclientsLoading ? <div className="px-5 py-14 text-center text-[12px] text-[var(--muted)]">Loading subclients…</div>
            : subclients.length === 0 ? <div className="px-5 py-16 text-center"><span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--primary)]/10 text-[var(--primary)]"><Building2 size={21} /></span><p className="mt-3 text-[13px] font-semibold">No subclients yet</p><p className="mt-1 text-[12px] text-[var(--muted)]">Add a subclient to organize candidates and configure package checks and rates.</p></div>
              : <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-2">
                {subclients.map((subclient) => (
                  <article key={subclient.id} className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
                    <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] bg-[var(--surface-muted)]/50 p-4">
                      <div className="flex min-w-0 items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--primary)]/10 text-[var(--primary)]"><Building2 size={17} /></span><div className="min-w-0"><h3 className="truncate text-[13px] font-semibold">{subclient.name}</h3><p className="mt-0.5 truncate font-mono text-[10px] text-[var(--muted)]">{subclient.clientCode}{subclient.industry ? ` · ${subclient.industry}` : ''}</p></div></div>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold ${subclient.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-700' : 'bg-slate-500/10 text-slate-600'}`}>{subclient.status}</span>
                    </div>
                    <div className="grid gap-x-4 gap-y-2 p-4 text-[11px] sm:grid-cols-2">
                      <p className="truncate"><span className="text-[var(--muted)]">Contact: </span>{subclient.contactName || 'Not provided'}</p>
                      <p className="truncate"><span className="text-[var(--muted)]">Email: </span>{subclient.contactEmail || 'Not provided'}</p>
                      <p className="truncate"><span className="text-[var(--muted)]">Phone: </span>{subclient.contactPhone || 'Not provided'}</p>
                      <p className="truncate"><span className="text-[var(--muted)]">GSTIN: </span>{subclient.gstNumber || 'Not provided'}</p>
                      <p className="truncate sm:col-span-2"><span className="text-[var(--muted)]">Address: </span>{[subclient.addressLine1, subclient.addressLine2, subclient.city, subclient.state, subclient.postalCode, subclient.country].filter(Boolean).join(', ') || 'Not provided'}</p>
                    </div>
                    <div className="border-t border-[var(--border)] px-4 py-3">
                      <div className="mb-2 flex items-center justify-between gap-2"><h4 className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">Package checks</h4><span className="text-[10px] text-[var(--muted)]">{subclient.candidateCount || 0} candidates</span></div>
                      {(subclient.serviceRates || []).length ? <div className="flex flex-wrap gap-1.5">{(subclient.serviceRates || []).map((rate) => <span key={rate.checkType} className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] px-2 py-1 text-[10px]"><Check size={11} className="text-emerald-600" />{checkTypes.find((option) => option.type === rate.checkType)?.label || rate.checkType.replaceAll('_', ' ')}</span>)}</div> : <p className="text-[11px] text-amber-700">No checks configured</p>}
                      <p className="mt-2 text-[11px] font-semibold">Package rate per candidate: {subclient.packageRate == null ? 'Not set' : currencyLabel(subclient.packageRate, 'INR')}</p>
                    </div>
                    {canManageAccess && <div className="flex justify-end gap-2 border-t border-[var(--border)] p-3"><button type="button" onClick={() => openSubclientEditor(subclient)} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-2 text-[11px] font-semibold hover:bg-[var(--surface-muted)]"><Pencil size={12} />Edit</button>{subclient.status === 'ACTIVE' && <button type="button" onClick={() => void deactivateSubclient(subclient)} className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/20 px-3 py-2 text-[11px] font-semibold text-rose-700 hover:bg-rose-500/5"><PowerOff size={12} />Deactivate</button>}</div>}
                  </article>
                ))}
              </div>}
        </section>
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
            <h2 className="mt-1 text-[16px] font-semibold">Configure candidate portal for {candidateFormTargetId ? subclients.find((item) => item.id === candidateFormTargetId)?.name || client.name : client.name}</h2>
            <p className="mt-1 text-[12px] leading-5 text-[var(--muted)]">Choose which sections and identity fields candidates see. Settings can be managed separately for each subclient. Upload PDF forms and decide whether candidates must return them.</p>
          </div>
          <div className="mt-4 rounded-xl border border-[var(--border)] p-4">
            <label htmlFor="candidate-form-target" className="block text-[13px] font-semibold">Settings apply to</label>
            <select
              id="candidate-form-target"
              value={candidateFormTargetId}
              onChange={(event) => {
                const targetId = event.target.value;
                setCandidateFormTargetId(targetId);
                const target = targetId ? subclients.find((item) => item.id === targetId) : client;
                setCandidateFormConfig(target?.candidateFormConfig ?? DEFAULT_CANDIDATE_FORM_CONFIG);
                setCandidateFormSaved(false);
                setCandidateFormError(null);
              }}
              disabled={!canManageAccess || candidateFormSaving || subclientsLoading}
              className="mt-2 w-full max-w-md rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-[12px]"
            >
              <option value="">Parent client: {client.name}</option>
              {subclients.map((subclient) => <option key={subclient.id} value={subclient.id}>Subclient: {subclient.name}</option>)}
            </select>
            {subclientsLoading && <p className="mt-2 text-[11px] text-[var(--muted)]">Loading subclient settings…</p>}
          </div>
          <div className="mt-4 rounded-xl border border-[var(--border)] p-4">
            <label htmlFor="candidate-link-validity" className="block text-[13px] font-semibold">Candidate portal link validity</label>
            <p className="mt-1 text-[11px] leading-5 text-[var(--muted)]">New links for this client expire after the selected number of days. Default: 2 days. Choose between 1 and 30 days.</p>
            <select
              id="candidate-link-validity"
              value={candidateFormConfig.invitationExpiryDays}
              onChange={(event) => {
                setCandidateFormSaved(false);
                setCandidateFormConfig((current) => ({ ...current, invitationExpiryDays: Number(event.target.value) }));
              }}
              disabled={!canManageAccess || candidateFormSaving}
              className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-[12px]"
            >
              {Array.from({ length: 30 }, (_, index) => index + 1).map((days) => (
                <option key={days} value={days}>{days} {days === 1 ? 'day' : 'days'}</option>
              ))}
            </select>
          </div>
          <nav aria-label="Candidate form settings" className="sticky top-2 z-20 mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface)]/95 p-2 shadow-sm backdrop-blur">
            <div className="flex items-center gap-2 overflow-x-auto">
              {[
                ['candidate-section-settings', 'Sections'],
                ['candidate-required-fields', 'Required fields'],
                ['candidate-address-settings', 'Address'],
                ['candidate-identity-settings', 'Identity'],
                ['candidate-employment-document-settings', 'Employment docs'],
                ['candidate-custom-form-settings', 'Templates'],
                ['candidate-live-preview', 'Preview'],
              ].map(([target, label]) => (
                <button key={target} type="button" onClick={() => document.getElementById(target)?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className="shrink-0 rounded-lg border border-[var(--border)] px-3 py-2 text-[11px] font-semibold text-[var(--foreground)] hover:border-[var(--primary)] hover:text-[var(--primary)]">
                  {label}
                </button>
              ))}
              <button type="button" onClick={() => void saveCandidateForm()} disabled={!canManageAccess || candidateFormSaving} className="ml-auto shrink-0 rounded-lg bg-[var(--primary)] px-3 py-2 text-[11px] font-semibold text-[var(--primary-foreground)] disabled:opacity-50">
                {candidateFormSaving ? 'Saving…' : 'Save form'}
              </button>
            </div>
          </nav>
          <div id="candidate-live-preview" className="mt-4 scroll-mt-24 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-3">
            <div>
              <p className="text-[12px] font-semibold">Candidate portal preview</p>
              <p className="mt-0.5 text-[11px] text-[var(--muted)]">Preview updates immediately as you change the client-specific form settings.</p>
            </div>
            <button type="button" onClick={() => setCandidateFormPreview((open) => !open)} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[11px] font-semibold text-[var(--primary)]">
              {candidateFormPreview ? 'Hide preview' : 'Preview candidate form'}
            </button>
          </div>
          {candidateFormPreview && (() => {
            const previewTabs = [
              { key: 'overview', label: 'Overview', enabled: true },
              { key: 'details', label: 'Details', enabled: true },
              { key: 'family', label: 'Family', enabled: candidateFormConfig.sections.family.enabled },
              { key: 'identity', label: 'Identity', enabled: CANDIDATE_IDENTITY_FIELDS.some((field) => candidateFormConfig[field.key].enabled) },
              { key: 'address', label: 'Address', enabled: candidateFormConfig.sections.address.enabled && (candidateFormConfig.address.currentAddressEnabled || candidateFormConfig.address.permanentAddressEnabled || candidateFormConfig.address.documents.some((document) => document.enabled)) },
              { key: 'bgv', label: 'BGV forms', enabled: candidateFormConfig.customForms.some((form) => form.enabled && form.category === 'BGV') },
              { key: 'cibil', label: 'CIBIL', enabled: candidateFormConfig.customForms.some((form) => form.enabled && form.category === 'CIBIL') },
              { key: 'education', label: 'Education', enabled: candidateFormConfig.sections.education.enabled || candidateFormConfig.customForms.some((form) => form.enabled && form.category === 'EDUCATION') },
              { key: 'employment', label: 'Employment', enabled: candidateFormConfig.sections.employment.enabled && (candidateFormConfig.employmentDocuments.some((document) => document.enabled) || candidateFormConfig.customForms.some((form) => form.enabled && form.category === 'EMPLOYMENT')) },
              { key: 'police', label: 'Police verification', enabled: candidateFormConfig.sections.policeVerification.enabled && candidateFormConfig.customForms.some((form) => form.enabled && form.category === 'POLICE_VERIFICATION') },
              { key: 'otherChecks', label: 'Other checks', enabled: candidateFormConfig.customForms.some((form) => form.enabled && form.category === 'OTHER_CHECKS') },
              { key: 'documents', label: 'Documents', enabled: true },
              { key: 'consent', label: 'Consent', enabled: true },
            ].filter((item) => item.enabled);
            const selectedPreviewTab = previewTabs.some((item) => item.key === candidatePreviewTab) ? candidatePreviewTab : 'overview';
            const previewForms = candidateFormConfig.customForms.filter((form) => form.enabled && (
              (selectedPreviewTab === 'bgv' && form.category === 'BGV')
              || (selectedPreviewTab === 'cibil' && form.category === 'CIBIL')
              || (selectedPreviewTab === 'otherChecks' && form.category === 'OTHER_CHECKS')
              || (selectedPreviewTab === 'police' && form.category === 'POLICE_VERIFICATION')
              || (selectedPreviewTab === 'education' && form.category === 'EDUCATION')
              || (selectedPreviewTab === 'employment' && form.category === 'EMPLOYMENT')
              || (selectedPreviewTab === 'identity' && form.category === 'IDENTITY')
            ));
            const employmentDocs = candidateFormConfig.employmentDocuments.filter((document) => document.enabled);
            const addressDocs = candidateFormConfig.address.documents.filter((document) => document.enabled);
            return (
              <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--border)] bg-[#f5f7f6]">
                <div className="border-b border-[var(--border)] bg-white px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--primary)]">Candidate verification portal</p>
                  <p className="mt-1 text-sm font-semibold">{client.name}</p>
                  <p className="mt-1 text-[10px] text-[var(--muted)]"><span className="font-bold text-red-600">*</span> Required fields, uploads and forms</p>
                </div>
                <div className="flex gap-1 overflow-x-auto border-b border-[var(--border)] bg-white p-2">
                  {previewTabs.map((item) => (
                    <button key={item.key} type="button" onClick={() => setCandidatePreviewTab(item.key)} className={`whitespace-nowrap rounded-md px-2.5 py-1.5 text-[10px] font-medium ${selectedPreviewTab === item.key ? 'bg-[var(--primary)] text-white' : 'text-[var(--muted)] hover:bg-[var(--surface-muted)]'}`}>
                      {item.label}
                    </button>
                  ))}
                </div>
                <div className="min-h-36 space-y-3 p-4">
                  {selectedPreviewTab === 'overview' && (
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm font-semibold">Hello, let&apos;s complete your verification</p>
                        <p className="mt-1 text-xs text-[var(--muted)]">The candidate sees only enabled sections and forms configured for this client.</p>
                        <p className="mt-3 rounded-lg border border-[var(--border)] bg-white p-3 text-xs">Profile details · Documents · Consent as the final step</p>
                      </div>
                      <div className="rounded-lg border border-[var(--border)] bg-white p-3">
                        <p className="text-xs font-semibold">Questions or corrections?</p>
                        <p className="mt-1 text-[10px] leading-4 text-[var(--muted)]">Please check that the information and documents in your preview are correct. Contact your client representative if you have a query or need to correct anything.</p>
                        {client.contactName && <p className="mt-2 text-[10px] font-medium">{client.contactName}</p>}
                        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[10px]">
                          {client.contactEmail
                            ? <a href={`mailto:${client.contactEmail}`} className="text-[var(--primary)] hover:underline">{client.contactEmail}</a>
                            : <span className="text-amber-700">Contact email not provided</span>}
                          {client.contactPhone
                            ? <a href={`tel:${client.contactPhone.replace(/[^\d+]/g, '')}`} className="text-[var(--primary)] hover:underline">{client.contactPhone}</a>
                            : <span className="text-amber-700">Contact phone not provided</span>}
                        </div>
                      </div>
                    </div>
                  )}
                  {selectedPreviewTab === 'details' && <CandidateFormPreviewFields title="Your details" fields={[
                    'Full name *',
                    'Email address *',
                    ...candidateRequiredFieldsFor('details').map((field) => `${field.label}${candidateFormConfig.fields[field.key]?.required ? ' *' : ''}`),
                  ]} />}
                  {selectedPreviewTab === 'family' && <CandidateFormPreviewFields title="Family details" fields={[
                    ...candidateRequiredFieldsFor('family').map((field) => `${field.label}${candidateFormConfig.fields[field.key]?.required ? ' *' : ''}`),
                  ]} />}
                  {selectedPreviewTab === 'identity' && <CandidateFormPreviewFields title="Identity fields" fields={CANDIDATE_IDENTITY_FIELDS.filter((field) => candidateFormConfig[field.key].enabled).flatMap((field) => [
                    `${field.label}${candidateFormConfig[field.key].required ? ' *' : ''}`,
                    ...(candidateFormConfig[field.key].documentRequired ? [`${field.label} document copy *`] : []),
                  ])} />}
                  {selectedPreviewTab === 'address' && <CandidateFormPreviewFields title="Address details and requested documents" fields={[
                    ...(candidateFormConfig.address.currentAddressEnabled ? [`Current address${candidateFormConfig.address.currentAddressRequired ? ' *' : ''}`] : []),
                    ...(candidateFormConfig.address.permanentAddressEnabled ? [`Permanent address${candidateFormConfig.address.permanentAddressRequired ? ' *' : ''}`] : []),
                    ...addressDocs.map((document) => `${CANDIDATE_ADDRESS_DOCUMENT_TYPES.find((item) => item.type === document.type)?.label ?? document.type}${document.required ? ' *' : ''}`),
                  ]} />}
                  {selectedPreviewTab === 'education' && <CandidateFormPreviewFields title="Education details and requested forms" fields={[
                    ...candidateRequiredFieldsFor('education').map((field) => `${field.label}${candidateFormConfig.fields[field.key]?.required ? ' *' : ''}`),
                    ...previewForms.map((form) => `${form.name}${form.required ? ' *' : ''}`),
                  ]} />}
                  {selectedPreviewTab === 'employment' && <CandidateFormPreviewFields title="Employment details and upload types" fields={[
                    ...candidateRequiredFieldsFor('employment').map((field) => `${field.label}${candidateFormConfig.fields[field.key]?.required ? ' *' : ''}`),
                    ...employmentDocs.map((document) => `${CANDIDATE_EMPLOYMENT_DOCUMENT_TYPES.find((item) => item.type === document.type)?.label ?? document.type}${document.required ? ' *' : ''}`),
                    ...previewForms.map((form) => `${form.name}${form.required ? ' *' : ''}`),
                  ]} />}
                  {selectedPreviewTab === 'police' && <CandidateFormPreviewFields title="Police verification forms" fields={previewForms.map((form) => `${form.name}${form.required ? ' · required' : ''}`)} />}
                  {selectedPreviewTab === 'bgv' && <CandidateFormPreviewFields title="BGV forms" fields={previewForms.map((form) => `${form.name}${form.required ? ' · required' : ''}`)} />}
                  {selectedPreviewTab === 'cibil' && <CandidateFormPreviewFields title="CIBIL forms" fields={previewForms.map((form) => `${form.name}${form.required ? ' *' : ''}`)} />}
                  {selectedPreviewTab === 'otherChecks' && <CandidateFormPreviewFields title="Other checks" fields={previewForms.map((form) => `${form.name}${form.required ? ' · required' : ''}`)} />}
                  {selectedPreviewTab === 'documents' && <CandidateFormPreviewFields title="Documents" fields={['Other documents', ...candidateFormConfig.customForms.filter((form) => form.enabled && form.category === 'OTHER').map((form) => form.name)]} />}
                  {selectedPreviewTab === 'consent' && <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">Consent appears after required profile details, documents, and forms are complete.</p>}
                </div>
              </div>
            );
          })()}
          <div id="candidate-section-settings" className="mt-5 scroll-mt-24 rounded-xl border border-[var(--border)] p-4">
            <h3 className="text-[13px] font-semibold">Portal sections</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {([
                ['family', 'Family details'],
                ['address', 'Address'],
                ['education', 'Education'],
                ['employment', 'Employment'],
                ['policeVerification', 'Police verification'],
              ] as const).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 text-[12px]">
                  <input type="checkbox" checked={candidateFormConfig.sections[key].enabled} onChange={(event) => updateCandidateFormSection(key, event.target.checked)} disabled={!canManageAccess || candidateFormSaving} className="accent-[var(--primary)]" />
                  {label}
                </label>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-[var(--muted)]">Disabled sections are hidden from candidates for this client. Details, consent and requested documents remain available when needed.</p>
          </div>
          <section id="candidate-required-fields" className="mt-5 scroll-mt-24 rounded-xl border border-[var(--border)] p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="text-[13px] font-semibold">Required candidate fields</h3>
                <p className="mt-1 text-[11px] leading-5 text-[var(--muted)]">Choose which profile fields candidates must complete. Required fields are marked with a red asterisk and must be complete before consent. Name and email are always required and cannot be changed by candidates.</p>
              </div>
              <span className="shrink-0 text-[11px] font-medium text-[var(--muted)]"><span className="font-bold text-red-600">*</span> Required</span>
            </div>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {CANDIDATE_FORM_REQUIRED_FIELD_GROUPS.map((group) => {
                const enabled = group.key === 'details' || candidateFormConfig.sections[group.key as keyof CandidateFormConfig['sections']].enabled;
                return (
                  <section key={group.key} className={`rounded-xl border border-[var(--border)] p-3 ${enabled ? 'bg-[var(--surface)]' : 'bg-[var(--surface-muted)] opacity-60'}`}>
                    <h4 className="text-[12px] font-semibold">{group.label}</h4>
                    <div className="mt-2 space-y-1.5">
                      {group.fields.map((field) => {
                        const required = candidateFormConfig.fields?.[field.key]?.required ?? field.defaultRequired;
                        return (
                          <label key={field.key} className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 text-[11px] hover:bg-[var(--surface-muted)]">
                            <span className="font-medium">{field.label}{required && <span className="ml-1 font-bold text-red-600" aria-hidden="true">*</span>}</span>
                            <span className="flex shrink-0 items-center gap-2">
                              <span className="text-[var(--muted)]">{required ? 'Required' : 'Optional'}</span>
                              <input type="checkbox" aria-label={`${field.label} required`} checked={required} onChange={(event) => updateCandidateFieldRequirement(field.key, event.target.checked)} disabled={!canManageAccess || candidateFormSaving || !enabled} className="h-4 w-4 accent-[var(--primary)]" />
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          </section>
          <div id="candidate-address-settings" className="mt-5 scroll-mt-24 rounded-xl border border-[var(--border)] p-4">
            <h3 className="text-[13px] font-semibold">Address details and verification</h3>
            <p className="mt-1 text-[11px] leading-5 text-[var(--muted)]">Choose which address fields and address documents this client requests. Required items block consent until completed.</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {([
                ['currentAddressEnabled', 'Current address'],
                ['permanentAddressEnabled', 'Permanent address'],
              ] as const).map(([key, label]) => {
                const requiredKey = key === 'currentAddressEnabled' ? 'currentAddressRequired' : 'permanentAddressRequired';
                return (
                  <div key={key} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--border)] p-3">
                    <label className="flex items-center gap-2 text-[12px] font-medium">
                      <input type="checkbox" checked={candidateFormConfig.address[key]} onChange={(event) => updateCandidateAddressField(key, event.target.checked)} disabled={!canManageAccess || candidateFormSaving || !candidateFormConfig.sections.address.enabled} className="accent-[var(--primary)]" />
                      {label}{candidateFormConfig.address[requiredKey] && <span className="font-bold text-red-600" aria-hidden="true">*</span>}
                    </label>
                    <label className={`flex items-center gap-2 text-[11px] ${!candidateFormConfig.address[key] ? 'opacity-50' : ''}`}>
                      <input type="checkbox" checked={candidateFormConfig.address[requiredKey]} onChange={(event) => updateCandidateAddressField(requiredKey, event.target.checked)} disabled={!canManageAccess || candidateFormSaving || !candidateFormConfig.sections.address.enabled || !candidateFormConfig.address[key]} className="accent-[var(--primary)]" />
                      Required
                    </label>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 space-y-2">
              {CANDIDATE_ADDRESS_DOCUMENT_TYPES.map(({ type, label }) => {
                const document = candidateFormConfig.address.documents.find((item) => item.type === type);
                const enabled = document?.enabled ?? false;
                const required = document?.required ?? false;
                return (
                  <div key={type} className="grid gap-3 rounded-lg border border-[var(--border)] p-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
                    <label className="flex items-center gap-2 text-[12px] font-medium">
                      <input type="checkbox" checked={enabled} onChange={(event) => updateAddressDocument(type, 'enabled', event.target.checked)} disabled={!canManageAccess || candidateFormSaving || !candidateFormConfig.sections.address.enabled} className="accent-[var(--primary)]" />
                      {label}{required && <span className="font-bold text-red-600" aria-hidden="true">*</span>}
                    </label>
                    <label className={`flex items-center gap-2 text-[11px] ${!enabled ? 'opacity-50' : ''}`}>
                      <input type="checkbox" checked={required} onChange={(event) => updateAddressDocument(type, 'required', event.target.checked)} disabled={!canManageAccess || candidateFormSaving || !candidateFormConfig.sections.address.enabled || !enabled} className="accent-[var(--primary)]" />
                      Candidate must upload
                    </label>
                  </div>
                );
              })}
            </div>
          </div>
          <div id="candidate-identity-settings" className="mt-5 scroll-mt-24 space-y-3">
            {CANDIDATE_IDENTITY_FIELDS.map((field) => {
              const config = candidateFormConfig[field.key];
              return (
                <div key={field.key} className="grid gap-3 rounded-xl border border-[var(--border)] p-4 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
                  <label className="flex items-start gap-3">
                    <input type="checkbox" checked={config.enabled} onChange={(event) => updateCandidateFormField(field.key, 'enabled', event.target.checked)} disabled={!canManageAccess || candidateFormSaving} className="mt-1 accent-[var(--primary)]" />
                    <span><span className="block text-[13px] font-semibold">{field.label}{(config.required || config.documentRequired) && <span className="ml-1 text-red-600" aria-hidden="true">*</span>}</span><span className="mt-0.5 block text-[11px] text-[var(--muted)]">Candidate number field and {field.documentType.replaceAll('_', ' ').toLowerCase()} upload</span></span>
                  </label>
                  <label className={`flex items-center gap-2 text-[12px] ${!config.enabled ? 'opacity-50' : ''}`}><input type="checkbox" checked={config.required} onChange={(event) => updateCandidateFormField(field.key, 'required', event.target.checked)} disabled={!canManageAccess || candidateFormSaving || !config.enabled} className="accent-[var(--primary)]" />Number required</label>
                  <label className={`flex items-center gap-2 text-[12px] ${!config.enabled ? 'opacity-50' : ''}`}><input type="checkbox" checked={config.documentRequired} onChange={(event) => updateCandidateFormField(field.key, 'documentRequired', event.target.checked)} disabled={!canManageAccess || candidateFormSaving || !config.enabled} className="accent-[var(--primary)]" />Document required</label>
                </div>
              );
            })}
          </div>
          <div id="candidate-employment-document-settings" className="mt-6 scroll-mt-24 rounded-xl border border-[var(--border)] p-4">
            <h3 className="text-[13px] font-semibold">Employment document uploads</h3>
            <p className="mt-1 text-[11px] leading-5 text-[var(--muted)]">Choose which document types this client accepts. Candidates select a type first, then upload its file in the Employment tab.</p>
            <div className="mt-3 space-y-2">
              {CANDIDATE_EMPLOYMENT_DOCUMENT_TYPES.map(({ type, label }) => {
                const document = candidateFormConfig.employmentDocuments.find((item) => item.type === type);
                const enabled = document?.enabled ?? false;
                const required = document?.required ?? false;
                return (
                  <div key={type} className="grid gap-3 rounded-lg border border-[var(--border)] p-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
                    <label className="flex items-center gap-2 text-[12px] font-medium">
                      <input type="checkbox" checked={enabled} onChange={(event) => updateEmploymentDocument(type, 'enabled', event.target.checked)} disabled={!canManageAccess || candidateFormSaving || !candidateFormConfig.sections.employment.enabled} className="accent-[var(--primary)]" />
                      {label}{required && <span className="font-bold text-red-600" aria-hidden="true">*</span>}
                    </label>
                    <label className={`flex items-center gap-2 text-[11px] ${!enabled ? 'opacity-50' : ''}`}>
                      <input type="checkbox" checked={required} onChange={(event) => updateEmploymentDocument(type, 'required', event.target.checked)} disabled={!canManageAccess || candidateFormSaving || !enabled} className="accent-[var(--primary)]" />
                      Candidate must upload
                    </label>
                  </div>
                );
              })}
            </div>
          </div>
          <div id="candidate-custom-form-settings" className="mt-6 scroll-mt-24 rounded-xl border border-[var(--border)] p-4">
            <h3 className="text-[13px] font-semibold">Client-specific candidate forms</h3>
            <p className="mt-1 text-[11px] leading-5 text-[var(--muted)]">Upload a PDF or Microsoft Word (DOC/DOCX) template for candidates to download, complete and upload back. Templates are scoped to this client and limited to 10 MB each.</p>
            {candidateFormConfig.customForms.length > 0 && (
              <div className="mt-3 space-y-2">
                {candidateFormConfig.customForms.map((form) => (
                  <div key={form.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-[var(--border)] p-3">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12px] font-semibold">{form.name}{form.required && <span className="ml-1 text-red-600" aria-hidden="true">*</span>}</span>
                      <span className="block text-[10px] text-[var(--muted)]">{form.category.replaceAll('_', ' ').toLowerCase()} · {form.fileName}</span>
                    </span>
                    <button type="button" onClick={() => void downloadCandidateTemplate(form.id, form.fileName)} disabled={!canManageAccess || candidateTemplateDownloading === form.id} className="text-[11px] font-medium text-[var(--primary)] disabled:opacity-50">{candidateTemplateDownloading === form.id ? 'Downloading…' : 'Download template'}</button>
                    <label className="flex items-center gap-1.5 text-[11px]">
                      <input type="checkbox" checked={form.enabled} onChange={(event) => updateCustomForm(form.id, 'enabled', event.target.checked)} disabled={!canManageAccess || candidateFormSaving} className="accent-[var(--primary)]" />
                      Send
                    </label>
                    <label className={`flex items-center gap-1.5 text-[11px] ${!form.enabled ? 'opacity-50' : ''}`}>
                      <input type="checkbox" checked={form.required} onChange={(event) => updateCustomForm(form.id, 'required', event.target.checked)} disabled={!canManageAccess || candidateFormSaving || !form.enabled} className="accent-[var(--primary)]" />
                      Required
                    </label>
                    <button type="button" onClick={() => void deleteCandidateTemplate(form.id)} disabled={!canManageAccess || candidateFormSaving} aria-label={`Remove ${form.name}`} className="rounded-md p-1.5 text-red-600 hover:bg-red-50 disabled:opacity-50"><Trash2 size={15} /></button>
                  </div>
                ))}
              </div>
            )}
            <form onSubmit={uploadCandidateTemplate} className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-[11px] font-medium">Form name
                <input required maxLength={100} value={candidateTemplateName} onChange={(event) => setCandidateTemplateName(event.target.value)} placeholder="Background verification form" disabled={!canManageAccess || candidateFormSaving} className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-[12px]" />
              </label>
              <label className="text-[11px] font-medium">Portal section
                <select value={candidateTemplateCategory} onChange={(event) => setCandidateTemplateCategory(event.target.value)} disabled={!canManageAccess || candidateFormSaving} className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-[12px]">
                  <option value="BGV">BGV form</option>
                  <option value="CIBIL">CIBIL</option>
                  <option value="POLICE_VERIFICATION">Police verification</option>
                  <option value="OTHER_CHECKS">Other checks</option>
                  <option value="IDENTITY">Identity</option>
                  <option value="EDUCATION">Education</option>
                  <option value="EMPLOYMENT">Employment</option>
                  <option value="OTHER">Other documents</option>
                </select>
              </label>
              <label className="text-[11px] font-medium">Form template (PDF, DOC, DOCX)
                <input ref={candidateTemplateFileRef} required type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.ms-word,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(event) => setCandidateTemplateFile(event.target.files?.[0] ?? null)} disabled={!canManageAccess || candidateFormSaving} className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-[12px]" />
              </label>
              <label className="flex items-center gap-2 self-end pb-2 text-[11px]">
                <input type="checkbox" checked={candidateTemplateRequired} onChange={(event) => setCandidateTemplateRequired(event.target.checked)} disabled={!canManageAccess || candidateFormSaving} className="accent-[var(--primary)]" />
                Candidate must upload completed form
              </label>
              <button type="submit" disabled={!canManageAccess || candidateFormSaving || !candidateTemplateFile} className="rounded-lg bg-[var(--primary)] px-4 py-2.5 text-[12px] font-semibold text-[var(--primary-foreground)] disabled:opacity-50 sm:col-span-2">{candidateFormSaving ? 'Saving…' : 'Upload form template'}</button>
            </form>
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

      {tab === 'client-portal' && user?.role.isCompanyAdmin && client && (
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--primary)]/10 text-[var(--primary)]"><Building2 size={18} /></span>
              <div>
                <h2 className="text-[15px] font-semibold">Open {client.name}&apos;s client portal</h2>
                <p className="mt-1 max-w-xl text-[12px] leading-5 text-[var(--muted)]">View and manage the client workspace using this client&apos;s portal context. Company-admin access is available for active clients in your company.</p>
              </div>
            </div>
            <button
              type="button"
              disabled={client.status !== 'ACTIVE'}
              onClick={() => {
                setClientPortalScope(client.id);
                router.push('/client-portal');
              }}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-[var(--primary-foreground)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Building2 size={15} />{client.status === 'ACTIVE' ? 'Open client portal' : 'Client is inactive'}
            </button>
          </div>
        </section>
      )}

      {tab === 'candidates' && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
          <div className="space-y-4 border-b border-[var(--border)] px-4 py-4 sm:px-5 sm:py-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--primary)]">People</p>
                <h2 className="mt-0.5 text-[15px] font-semibold">Candidate directory</h2>
                <p className="mt-0.5 text-[12px] text-[var(--muted)]">{candidatesMeta.total} candidates linked to {client.name}</p>
                {candidateCreateMessage && <p role="status" className="mt-1 text-[11px] text-[var(--primary)]">{candidateCreateMessage}</p>}
                {candidateExportError && <p role="alert" className="mt-1 text-[11px] text-[#FF6B6B]">{candidateExportError}</p>}
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                {Boolean(user?.role.isSuperAdmin || permissions.includes('candidate.export')) && <button type="button" onClick={() => void downloadCandidateExport()} disabled={candidateExporting || Boolean(candidateDateFrom && candidateDateTo && candidateDateFrom > candidateDateTo)} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[var(--border)] px-3.5 py-2.5 text-[12px] font-semibold text-[var(--foreground)] transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-50">
                  <Download size={14} />{candidateExporting ? 'Preparing…' : 'Download Excel'}
                </button>}
                <button type="button" onClick={() => setCandidateModalOpen(true)} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[var(--primary)] px-3.5 py-2.5 text-[12px] font-semibold text-[var(--primary-foreground)] transition-opacity hover:opacity-90">
                  <Users size={14} /> Add candidate
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <label className="relative min-w-0 text-[10px] font-medium text-[var(--muted)] xl:col-span-2">Search candidates
                <Search size={13} className="absolute left-2.5 top-[31px] text-[var(--muted)]" />
                <input value={candidateSearch} onChange={(event) => { setCandidateSearch(event.target.value); setCandidatesPage(1); }} placeholder="Name, reference, email or mobile" className="mt-1 block w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] py-2.5 pl-8 pr-3 text-[12px] text-[var(--foreground)]" />
              </label>
              <label className="min-w-0 text-[10px] font-medium text-[var(--muted)]">Subclient
                <select value={subclientFilter} onChange={(event) => { setSubclientFilter(event.target.value); setCandidatesPage(1); }} className="mt-1 block w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-[12px] text-[var(--foreground)]">
                  <option value="">All candidates</option>
                  <option value="none">Client only (no subclient)</option>
                  {subclients.map((subclient) => <option key={subclient.id} value={subclient.id}>{subclient.name}</option>)}
                </select>
              </label>
              <label className="min-w-0 text-[10px] font-medium text-[var(--muted)]">Status
                <select value={candidateStatusFilter} onChange={(event) => { setCandidateStatusFilter(event.target.value as CandidateStatus | ''); setCandidatesPage(1); }} className="mt-1 block w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-[12px] text-[var(--foreground)]">
                  <option value="">All statuses</option>
                  {CANDIDATE_STATUSES.map((status) => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}
                </select>
              </label>
              <label className="min-w-0 text-[10px] font-medium text-[var(--muted)]">Added from
                <input type="date" value={candidateDateFrom} onChange={(event) => { const value = event.target.value; setCandidateDateFrom(value); if (candidateDateTo && value > candidateDateTo) setCandidateDateTo(''); setCandidatesPage(1); }} className="mt-1 block w-full min-w-0 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-[12px] text-[var(--foreground)]" />
              </label>
              <label className="min-w-0 text-[10px] font-medium text-[var(--muted)]">Added to
                <input type="date" value={candidateDateTo} min={candidateDateFrom || undefined} onChange={(event) => { setCandidateDateTo(event.target.value); setCandidatesPage(1); }} className="mt-1 block w-full min-w-0 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-[12px] text-[var(--foreground)]" />
              </label>
            </div>
            <p className="text-[11px] text-[var(--muted)]">Showing {candidatesMeta.total} matching candidate{candidatesMeta.total === 1 ? '' : 's'}{candidateDateFrom || candidateDateTo ? ` · Added ${candidateDateFrom || 'any time'} to ${candidateDateTo || 'present'}` : ''}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[740px] text-left text-[13px]">
              <thead className="border-b border-[var(--border)] bg-[var(--surface-muted)]/60 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                <tr><th className="px-5 py-3">Reference</th><th className="px-5 py-3">Candidate</th><th className="px-5 py-3">Subclient</th><th className="px-5 py-3">Cases</th><th className="px-5 py-3">Status</th><th className="px-5 py-3"></th></tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {candidatesLoading ? (
                  <tr><td colSpan={6} className="px-5 py-12 text-center text-[var(--muted)]">Loading candidates…</td></tr>
                ) : candidatesError ? (
                  <tr><td colSpan={6} className="px-5 py-12 text-center text-[#FF6B6B]">{candidatesError}</td></tr>
                ) : candidates.length === 0 ? (
                  <tr><td colSpan={6} className="px-5 py-14 text-center"><div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--primary)]/10 text-[var(--primary)]"><Users size={19} /></div><p className="mt-3 text-[13px] font-medium">No candidates yet</p><p className="mt-1 text-[12px] text-[var(--muted)]">Add a candidate to start a verification case for this client.</p></td></tr>
                ) : candidates.map((c) => (
                  <tr key={c.id} role="link" tabIndex={0} aria-label={`Open ${formatCandidateName(c)}`} onClick={() => router.push(`/company/candidate/${c.id}`)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); router.push(`/company/candidate/${c.id}`); } }} className="group cursor-pointer outline-none transition-colors hover:bg-[var(--surface-muted)]/70 focus-visible:bg-[var(--surface-muted)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--primary)]">
                    <td className="whitespace-nowrap px-5 py-3.5 font-mono text-[11px] text-[var(--muted)]">{c.candidateCode}</td>
                    <td className="min-w-[220px] px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--primary)]/10 text-[11px] font-semibold text-[var(--primary)]">{initials(formatCandidateName(c))}</span>
                        <span className="min-w-0"><span className="block truncate font-medium text-[var(--foreground)] group-hover:text-[var(--primary)]">{formatCandidateName(c)}</span><span className="block truncate text-[11px] text-[var(--muted)]">{c.email || 'No email provided'}</span></span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-[11px] text-[var(--muted)]">{c.subclient?.name || 'Client'}</td>
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
              <table className="w-full min-w-[800px] text-left text-[13px]">
                <thead className="border-b border-[var(--border)] bg-[var(--surface-muted)]/60 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                  <tr><th className="px-5 py-3">Case</th><th className="px-5 py-3">Candidate</th><th className="px-5 py-3">Subclient</th><th className="px-5 py-3">{isReports ? 'Completed' : 'Created'}</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Verification status</th><th className="px-5 py-3 text-right">Action</th></tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {loadingRows ? <tr><td colSpan={7} className="px-5 py-14 text-center text-[var(--muted)]">Loading {isReports ? 'reports' : 'cases'}…</td></tr>
                    : rows.length === 0 ? <tr><td colSpan={7} className="px-5 py-16 text-center"><span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--primary)]/10 text-[var(--primary)]">{isReports ? <FileText size={21} /> : <FileCheck2 size={21} />}</span><p className="mt-3 text-[13px] font-semibold">{isReports ? 'No completed reports yet' : 'No BGV cases yet'}</p><p className="mt-1 text-[12px] text-[var(--muted)]">{isReports ? 'Reports appear here when a case is completed.' : 'Cases created for this client will appear here.'}</p></td></tr>
                      : rows.map((item) => (
                        <tr key={item.id} className="transition-colors hover:bg-[var(--surface-muted)]/60">
                          <td className="px-5 py-3.5"><button type="button" onClick={() => router.push(`/company/bgv-cases/${item.id}`)} className="font-mono text-[12px] font-semibold text-[var(--primary)] hover:underline">{item.caseNumber}</button>{item.packageName && <p className="mt-0.5 text-[11px] text-[var(--muted)]">{item.packageName}</p>}</td>
                          <td className="px-5 py-3.5"><p className="font-medium">{item.candidate ? formatCandidateName(item.candidate) : 'Candidate'}</p><p className="text-[11px] text-[var(--muted)]">{item.candidate?.candidateCode || '—'}</p></td>
                          <td className="px-5 py-3.5 text-[11px] text-[var(--muted)]">{item.subclient?.name || 'Client'}</td>
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
                      <td className="px-5 py-3.5 text-[12px]"><p className="font-medium tabular-nums">{invoiceDateLabel(invoice.invoiceDate)}</p><p className="mt-1 text-[11px] text-[var(--muted)]">Due <span className="tabular-nums">{invoiceDateLabel(invoice.dueDate)}</span></p></td>
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
          canInvite={user?.role.isCompanyAdmin || user?.role.isSuperAdmin}
          submitting={candidateSubmitting}
          error={null}
          onClose={() => setCandidateModalOpen(false)}
          onSubmit={handleCreateCandidate}
        />
      )}

      {subclientEditorOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-3 sm:p-6" onMouseDown={(event) => event.target === event.currentTarget && !subclientSaving && setSubclientEditorOpen(false)}>
          <form onSubmit={(event) => void saveSubclient(event)} className="my-3 w-full max-w-4xl overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl sm:my-8">
            <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-5 py-4 sm:px-6">
              <div><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--primary)]">{client.name}</p><h2 className="mt-1 text-[17px] font-semibold">{subclientEditingId ? 'Edit subclient' : 'Add subclient'}</h2><p className="mt-1 text-[11px] text-[var(--muted)]">Subclients are kept under this client and use its billing account.</p></div>
              <button type="button" onClick={() => setSubclientEditorOpen(false)} disabled={subclientSaving} className="rounded-lg p-2 text-[var(--muted)] hover:bg-[var(--surface-muted)]" aria-label="Close subclient editor"><X size={17} /></button>
            </div>
            <div className="max-h-[72vh] space-y-5 overflow-y-auto p-5 sm:p-6">
              <section>
                <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">Subclient information</h3>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <label className="text-[11px] font-medium text-[var(--muted)]">Subclient name<input required minLength={2} maxLength={255} value={subclientDraft.name} onChange={(event) => setSubclientDraft((current) => ({ ...current, name: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-[13px] text-[var(--foreground)] outline-none focus:border-[var(--primary)]" /></label>
                  <label className="text-[11px] font-medium text-[var(--muted)]">Subclient code<input required minLength={2} maxLength={50} value={subclientDraft.clientCode} onChange={(event) => setSubclientDraft((current) => ({ ...current, clientCode: event.target.value.toUpperCase() }))} className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 font-mono text-[13px] text-[var(--foreground)] outline-none focus:border-[var(--primary)]" /></label>
                  <label className="text-[11px] font-medium text-[var(--muted)]">Industry<input maxLength={150} value={subclientDraft.industry} onChange={(event) => setSubclientDraft((current) => ({ ...current, industry: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-[13px] text-[var(--foreground)] outline-none focus:border-[var(--primary)]" /></label>
                  <label className="text-[11px] font-medium text-[var(--muted)]">Contact person<input maxLength={150} value={subclientDraft.contactName} onChange={(event) => setSubclientDraft((current) => ({ ...current, contactName: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-[13px] text-[var(--foreground)] outline-none focus:border-[var(--primary)]" /></label>
                  <label className="text-[11px] font-medium text-[var(--muted)]">Contact email<input type="email" maxLength={255} value={subclientDraft.contactEmail} onChange={(event) => setSubclientDraft((current) => ({ ...current, contactEmail: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-[13px] text-[var(--foreground)] outline-none focus:border-[var(--primary)]" /></label>
                  <label className="text-[11px] font-medium text-[var(--muted)]">Phone<input maxLength={50} value={subclientDraft.contactPhone} onChange={(event) => setSubclientDraft((current) => ({ ...current, contactPhone: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-[13px] text-[var(--foreground)] outline-none focus:border-[var(--primary)]" /></label>
                  <label className="text-[11px] font-medium text-[var(--muted)]">Candidate support email<input type="email" maxLength={255} value={subclientDraft.supportEmail} onChange={(event) => setSubclientDraft((current) => ({ ...current, supportEmail: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-[13px] text-[var(--foreground)] outline-none focus:border-[var(--primary)]" /></label>
                  <label className="text-[11px] font-medium text-[var(--muted)]">Candidate support mobile number<input type="tel" maxLength={50} value={subclientDraft.supportPhone} onChange={(event) => setSubclientDraft((current) => ({ ...current, supportPhone: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-[13px] text-[var(--foreground)] outline-none focus:border-[var(--primary)]" /></label>
                  <label className="text-[11px] font-medium text-[var(--muted)]">GSTIN<input maxLength={30} value={subclientDraft.gstNumber} onChange={(event) => setSubclientDraft((current) => ({ ...current, gstNumber: event.target.value.toUpperCase() }))} className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-[13px] text-[var(--foreground)] outline-none focus:border-[var(--primary)]" /></label>
                  <label className="text-[11px] font-medium text-[var(--muted)]">PAN<input maxLength={20} value={subclientDraft.panNumber} onChange={(event) => setSubclientDraft((current) => ({ ...current, panNumber: event.target.value.toUpperCase() }))} className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-[13px] text-[var(--foreground)] outline-none focus:border-[var(--primary)]" /></label>
                  <label className="text-[11px] font-medium text-[var(--muted)]">Status<select value={subclientDraft.status} onChange={(event) => setSubclientDraft((current) => ({ ...current, status: event.target.value as 'ACTIVE' | 'INACTIVE' }))} className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-[13px] text-[var(--foreground)]"><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select></label>
                  <label className="text-[11px] font-medium text-[var(--muted)] sm:col-span-2">Address line 1<input maxLength={500} value={subclientDraft.addressLine1} onChange={(event) => setSubclientDraft((current) => ({ ...current, addressLine1: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-[13px] text-[var(--foreground)] outline-none focus:border-[var(--primary)]" /></label>
                  <label className="text-[11px] font-medium text-[var(--muted)]">Address line 2<input maxLength={500} value={subclientDraft.addressLine2} onChange={(event) => setSubclientDraft((current) => ({ ...current, addressLine2: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-[13px] text-[var(--foreground)] outline-none focus:border-[var(--primary)]" /></label>
                  <label className="text-[11px] font-medium text-[var(--muted)]">City<input maxLength={100} value={subclientDraft.city} onChange={(event) => setSubclientDraft((current) => ({ ...current, city: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-[13px] text-[var(--foreground)] outline-none focus:border-[var(--primary)]" /></label>
                  <label className="text-[11px] font-medium text-[var(--muted)]">State<input maxLength={100} value={subclientDraft.state} onChange={(event) => setSubclientDraft((current) => ({ ...current, state: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-[13px] text-[var(--foreground)] outline-none focus:border-[var(--primary)]" /></label>
                  <label className="text-[11px] font-medium text-[var(--muted)]">Postal code<input maxLength={20} value={subclientDraft.postalCode} onChange={(event) => setSubclientDraft((current) => ({ ...current, postalCode: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-[13px] text-[var(--foreground)] outline-none focus:border-[var(--primary)]" /></label>
                  <label className="text-[11px] font-medium text-[var(--muted)]">Country<input maxLength={100} value={subclientDraft.country} onChange={(event) => setSubclientDraft((current) => ({ ...current, country: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-[13px] text-[var(--foreground)] outline-none focus:border-[var(--primary)]" /></label>
                </div>
              </section>
              <section className="border-t border-[var(--border)] pt-5">
                <div className="mb-3"><h3 className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">Package checks and rate</h3><p className="mt-1 text-[11px] text-[var(--muted)]">Candidates assigned here can only be screened using enabled checks. One package rate applies per candidate, in INR.</p></div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {checkTypes.map((option) => {
                    const configured = subclientDraft.serviceRates.find((entry) => entry.checkType === option.type);
                    return <div key={option.type} className={`flex items-center gap-3 rounded-lg border p-3 ${configured ? 'border-[var(--primary)]/40 bg-[var(--primary)]/[0.04]' : 'border-[var(--border)]'}`}>
                      <input type="checkbox" checked={Boolean(configured)} aria-label={`Enable ${option.label}`} onChange={(event) => setSubclientDraft((current) => ({
                        ...current,
                        serviceRates: event.target.checked
                          ? [...current.serviceRates, { checkType: option.type }]
                          : current.serviceRates.filter((entry) => entry.checkType !== option.type),
                      }))} className="accent-[var(--primary)]" />
                      <span className="min-w-0 flex-1 text-[11px] font-medium">{option.label}</span>
                    </div>;
                  })}
                </div>
                <label className="mt-4 block max-w-sm text-[11px] font-medium text-[var(--muted)]">Package rate per candidate (INR)
                  <input type="number" required min="0" max="100000000" step="0.01" value={subclientDraft.packageRate} onChange={(event) => setSubclientDraft((current) => ({ ...current, packageRate: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-[13px] text-[var(--foreground)]" />
                </label>
              </section>
              {subclientsError && <p role="alert" className="rounded-lg border border-rose-500/20 bg-rose-500/5 px-3 py-2.5 text-[12px] text-rose-700">{subclientsError}</p>}
            </div>
            <div className="flex flex-col-reverse gap-2 border-t border-[var(--border)] px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
              <button type="button" disabled={subclientSaving} onClick={() => setSubclientEditorOpen(false)} className="rounded-lg border border-[var(--border)] px-4 py-2.5 text-[12px] font-semibold">Cancel</button>
              <button type="submit" disabled={subclientSaving} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-5 py-2.5 text-[12px] font-semibold text-[var(--primary-foreground)] disabled:opacity-60">{subclientSaving ? 'Saving…' : subclientEditingId ? 'Save changes' : 'Create subclient'}</button>
            </div>
          </form>
        </div>
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