'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, ChevronLeft, ChevronRight, Download, FileCheck2, FileText, Globe, Mail, Pencil, Phone, Receipt, Users, MapPin, Power, PowerOff,
} from 'lucide-react';
import { useAuth } from '@/src/auth/AuthProvider';
import { getClient, updateClient, activateClient, inactivateClient, ApiError as ClientApiError } from '@/src/lib/api/clients';
import { listCandidates, createCandidate, ApiError as CandidateApiError } from '@/src/lib/api/candidates';
import { ApiError as BGVApiError, downloadBGVReport, listBGVCases } from '@/src/lib/api/bgv';
import type { BGVCase } from '@/src/types/bgv';
import { downloadInvoicePdf, InvoiceApiError, listInvoices } from '@/src/lib/api/invoices';
import type { Invoice } from '@/src/lib/api/invoices';
import ClientFormModal from '@/src/components/layout/company/client/ClientFormModal';
import ClientConfirmDialog from '@/src/components/layout/company/client/ClientConfirmDialog';
import CandidateFormModal from '@/src/components/layout/company/candidate/CandidateFormModal';
import type { Client, ClientFormValues } from '@/src/types/client';
import type { Candidate, CandidateFormValues, PaginationMeta } from '@/src/types/candidate';

const PAGE_SIZE = 10;
type TabKey = 'overview' | 'billing' | 'candidates' | 'cases' | 'reports' | 'invoices';
const TABS: { key: TabKey; label: string; icon: typeof Users }[] = [
  { key: 'overview', label: 'Overview', icon: Users },
  { key: 'billing', label: 'Billing details', icon: Receipt },
  { key: 'candidates', label: 'Candidates', icon: Users },
  { key: 'cases', label: 'BGV cases', icon: FileCheck2 },
  { key: 'reports', label: 'Reports', icon: FileText },
  { key: 'invoices', label: 'Invoices', icon: Receipt },
];
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
  const { accessToken } = useAuth();

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

  const loadClient = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      setClient(await getClient(id, accessToken));
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : 'Failed to load client.');
    } finally {
      setLoading(false);
    }
  }, [id, accessToken]);

  useEffect(() => { loadClient(); }, [loadClient]);

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

  useEffect(() => { if (tab === 'candidates') loadCandidates(); }, [tab, loadCandidates]);

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
        {TABS.map((t) => (
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
          <div className="flex flex-col gap-3 border-t border-[var(--border)] px-5 py-3 text-[12px] text-[var(--muted)] sm:flex-row sm:items-center sm:justify-between">
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
                  <tr><th className="px-5 py-3">Case</th><th className="px-5 py-3">Candidate</th><th className="px-5 py-3">{isReports ? 'Completed' : 'Created'}</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Result</th><th className="px-5 py-3 text-right">Action</th></tr>
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
                          <td className="px-5 py-3.5 text-[12px] text-[var(--muted)]">{item.overallResult.replaceAll('_', ' ')}</td>
                          <td className="px-5 py-3.5 text-right">{isReports && <button type="button" onClick={() => void downloadReport(item)} disabled={recordAction === `report-${item.id}`} title="Download report" aria-label={`Download report for ${item.caseNumber}`} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-[11px] font-semibold hover:bg-[var(--surface-muted)] disabled:opacity-50"><Download size={13} />{recordAction === `report-${item.id}` ? 'Preparing…' : 'PDF'}</button>}</td>
                        </tr>
                      ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t border-[var(--border)] px-5 py-3 text-[11px] text-[var(--muted)]"><span>{total ? `${(currentPage - 1) * RECORD_PAGE_SIZE + 1}–${Math.min(currentPage * RECORD_PAGE_SIZE, total)} of ${total}` : '0 records'}</span><div className="flex gap-2"><button type="button" disabled={currentPage <= 1 || loadingRows} onClick={() => setCurrentPage((value) => Math.max(1, value - 1))} className="rounded-md border border-[var(--border)] p-1.5 hover:bg-[var(--surface-muted)] disabled:opacity-40" aria-label="Previous page"><ChevronLeft size={14} /></button><button type="button" disabled={currentPage >= Math.ceil(total / RECORD_PAGE_SIZE) || loadingRows} onClick={() => setCurrentPage((value) => value + 1)} className="rounded-md border border-[var(--border)] p-1.5 hover:bg-[var(--surface-muted)] disabled:opacity-40" aria-label="Next page"><ChevronRight size={14} /></button></div></div>
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
          <div className="flex items-center justify-between border-t border-[var(--border)] px-5 py-3 text-[11px] text-[var(--muted)]"><span>{invoicesTotal ? `${(invoicesPage - 1) * RECORD_PAGE_SIZE + 1}–${Math.min(invoicesPage * RECORD_PAGE_SIZE, invoicesTotal)} of ${invoicesTotal}` : '0 invoices'}</span><div className="flex gap-2"><button type="button" disabled={invoicesPage <= 1 || invoicesLoading} onClick={() => setInvoicesPage((value) => Math.max(1, value - 1))} className="rounded-md border border-[var(--border)] p-1.5 hover:bg-[var(--surface-muted)] disabled:opacity-40" aria-label="Previous page"><ChevronLeft size={14} /></button><button type="button" disabled={invoicesPage >= Math.ceil(invoicesTotal / RECORD_PAGE_SIZE) || invoicesLoading} onClick={() => setInvoicesPage((value) => value + 1)} className="rounded-md border border-[var(--border)] p-1.5 hover:bg-[var(--surface-muted)] disabled:opacity-40" aria-label="Next page"><ChevronRight size={14} /></button></div></div>
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