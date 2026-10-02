'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  ChartNoAxesCombined,
  Download,
  Eye,
  FileText,
  LoaderCircle,
  Mail,
  Pencil,
  Plus,
  Receipt,
  Search,
  Settings2,
  Trash2,
  TrendingUp,
  X,
} from 'lucide-react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useAuth } from '@/src/auth/AuthProvider';
import GeoSelect from '@/src/components/common/GeoSelect';
import { getClient, listClients } from '@/src/lib/api/clients';
import type { Client } from '@/src/types/client';
import {
  createInvoice,
  deleteInvoice,
  downloadInvoicePdf,
  emailInvoice,
  getInvoiceProfile,
  InvoiceApiError,
  listInvoiceCases,
  listInvoices,
  previewInvoicePdf,
  recordInvoicePayment,
  saveInvoiceProfile,
  updateInvoice,
  changeInvoiceStatus,
  voidInvoice,
} from '@/src/lib/api/invoices';
import type {
  Invoice,
  InvoiceAnalytics,
  InvoiceCase,
  InvoiceInput,
  InvoiceProfile,
  InvoiceStatus,
  InvoiceSummary,
} from '@/src/lib/api/invoices';

const PAGE_SIZE = 25;
const fieldClass = 'w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--primary)]';
const labelClass = 'mb-1.5 block text-xs font-medium text-[var(--muted)]';
const defaultSummary: InvoiceSummary = { total: 0, drafts: 0, paid: 0, overdue: 0, outstanding: 0 };
const emptyAnalytics: InvoiceAnalytics = { currencies: [], statusMix: [], topClients: [] };
const statuses: InvoiceStatus[] = ['DRAFT', 'SENT', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'VOID'];
const statusColors: Record<InvoiceStatus, string> = { DRAFT: '#94A3B8', SENT: '#4F9CD6', PARTIALLY_PAID: '#E7A83E', PAID: '#269A78', OVERDUE: '#E26363', VOID: '#A1A1AA' };

interface DraftLine {
  caseId: string;
  description: string;
  candidateName: string;
  serviceCode: string;
  quantity: string | number;
  unitPrice: string | number;
  discountPercent: string | number;
  taxPercent: string | number;
}

interface ClientBillingDraft {
  address: string;
  contactName: string;
  phone: string;
  state: string;
  gstNumber: string;
  panNumber: string;
  email: string;
}

const emptyClientBilling: ClientBillingDraft = { address: '', contactName: '', phone: '', state: '', gstNumber: '', panNumber: '', email: '' };
const clientBillingFrom = (client?: Client, invoice?: Invoice): ClientBillingDraft => ({
  address: invoice?.clientAddress || [client?.addressLine1, client?.addressLine2, client?.city, client?.state, client?.postalCode, client?.country].filter(Boolean).join(', '),
  contactName: invoice?.clientContactName || client?.contactName || '',
  phone: invoice?.clientPhone || client?.contactPhone || '',
  state: invoice?.clientState || client?.state || '',
  gstNumber: invoice?.clientGst || client?.gstNumber || '',
  panNumber: invoice?.clientPan || client?.panNumber || '',
  email: invoice?.clientEmail || client?.contactEmail || '',
});

const today = () => new Date().toISOString().slice(0, 10);
const datePlusDays = (dayCount: number) => {
  const value = new Date();
  value.setDate(value.getDate() + dayCount);
  return value.toISOString().slice(0, 10);
};
const amount = (value: string | number | null | undefined) => Number(value || 0);
const money = (value: string | number, currency = 'INR') => new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount(value));
const dateLabel = (value: string) => new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
const dateInput = (value: string) => value.slice(0, 10);
const newLine = (): DraftLine => ({ caseId: '', description: '', candidateName: '', serviceCode: '', quantity: '1', unitPrice: '0', discountPercent: '0', taxPercent: '0' });

function statusTone(status: InvoiceStatus) {
  if (status === 'PAID') return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
  if (status === 'OVERDUE' || status === 'VOID') return 'bg-rose-500/10 text-rose-700 dark:text-rose-300';
  if (status === 'DRAFT') return 'bg-slate-500/10 text-slate-600 dark:text-slate-300';
  if (status === 'PARTIALLY_PAID') return 'bg-amber-500/10 text-amber-700 dark:text-amber-300';
  return 'bg-sky-500/10 text-sky-700 dark:text-sky-300';
}

function StatusTag({ status }: { status: InvoiceStatus }) {
  return <span className={`inline-flex rounded px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${statusTone(status)}`}>{status.replaceAll('_', ' ')}</span>;
}

function FormField({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return <div className={className}><label className={labelClass}>{label}</label>{children}</div>;
}

function BillingProfileDialog({ profile, token, onClose, onSaved }: {
  profile: InvoiceProfile;
  token: string | null;
  onClose: () => void;
  onSaved: (profile: InvoiceProfile) => void;
}) {
  const [values, setValues] = useState(profile);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const update = (key: keyof InvoiceProfile, value: string) => setValues((current) => ({ ...current, [key]: value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const saved = await saveInvoiceProfile({
        address: values.address,
        gstNumber: values.gstNumber,
        panNumber: values.panNumber,
        city: values.city,
        country: values.country,
        state: values.state,
        postalCode: values.postalCode,
        bankAccountName: values.bankAccountName,
        bankName: values.bankName,
        bankAccountNumber: values.bankAccountNumber,
        bankIfscCode: values.bankIfscCode,
        bankSwiftCode: values.bankSwiftCode,
        bankBranch: values.bankBranch,
        upiId: values.upiId,
      }, token);
      onSaved(saved);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save billing profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <form onSubmit={submit} className="my-8 w-full max-w-3xl rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-2xl">
        <div className="flex items-start justify-between border-b border-[var(--border)] px-6 py-5">
          <div><p className="text-xs font-semibold uppercase text-[var(--primary)]">Invoice settings</p><h2 className="mt-1 text-lg font-semibold">Business billing profile</h2><p className="mt-1 text-xs text-[var(--muted)]">Saved for future invoices. Existing invoices keep their original details.</p></div>
          <button type="button" onClick={onClose} className="rounded p-1 text-[var(--muted)] hover:bg-[var(--surface-muted)]" aria-label="Close"><X size={18} /></button>
        </div>
        <div className="grid max-h-[70vh] gap-4 overflow-y-auto p-6 sm:grid-cols-2">
          <FormField label="Legal business name"><div className="rounded-md border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm">{profile.name}</div></FormField>
          <FormField label="GSTIN (optional)"><input className={fieldClass} value={values.gstNumber} onChange={(event) => update('gstNumber', event.target.value)} maxLength={30} /></FormField>
          <FormField label="PAN (optional)"><input className={fieldClass} value={values.panNumber} onChange={(event) => update('panNumber', event.target.value)} maxLength={20} /></FormField>
          <FormField label="Country"><GeoSelect kind="country" className={fieldClass} value={values.country} onChange={(value) => setValues((current) => ({ ...current, country: value, state: current.country === value ? current.state : '' }))} /></FormField>
          <FormField label="State"><GeoSelect kind="state" className={fieldClass} value={values.state} countryName={values.country} placeholder={values.country ? 'Select state' : 'Select a country first'} disabled={!values.country} onChange={(value) => update('state', value)} /></FormField>
          <FormField label="City"><input className={fieldClass} value={values.city} onChange={(event) => update('city', event.target.value)} maxLength={120} /></FormField>
          <FormField label="Postal code"><input className={fieldClass} value={values.postalCode} onChange={(event) => update('postalCode', event.target.value)} maxLength={20} /></FormField>
          <FormField label="Registered address" className="sm:col-span-2"><textarea className={`${fieldClass} min-h-20 resize-y`} value={values.address} onChange={(event) => update('address', event.target.value)} maxLength={1000} /></FormField>
          <div className="border-t border-[var(--border)] pt-4 sm:col-span-2"><h3 className="text-sm font-semibold">Payment bank account</h3><p className="mt-1 text-xs text-[var(--muted)]">These details are saved to the company and included on newly created invoices.</p></div>
          <FormField label="Account holder name"><input className={fieldClass} value={values.bankAccountName} onChange={(event) => update('bankAccountName', event.target.value)} maxLength={255} /></FormField>
          <FormField label="Bank name"><input className={fieldClass} value={values.bankName} onChange={(event) => update('bankName', event.target.value)} maxLength={255} /></FormField>
          <FormField label="Account number"><input className={fieldClass} value={values.bankAccountNumber} onChange={(event) => update('bankAccountNumber', event.target.value)} maxLength={80} autoComplete="off" /></FormField>
          <FormField label="IFSC code"><input className={fieldClass} value={values.bankIfscCode} onChange={(event) => update('bankIfscCode', event.target.value.toUpperCase())} maxLength={20} /></FormField>
          <FormField label="SWIFT / BIC code"><input className={fieldClass} value={values.bankSwiftCode} onChange={(event) => update('bankSwiftCode', event.target.value.toUpperCase())} maxLength={20} /></FormField>
          <FormField label="Branch"><input className={fieldClass} value={values.bankBranch} onChange={(event) => update('bankBranch', event.target.value)} maxLength={255} /></FormField>
          <FormField label="UPI ID (optional)" className="sm:col-span-2"><input className={fieldClass} value={values.upiId} onChange={(event) => update('upiId', event.target.value)} maxLength={100} placeholder="accounts@bank" /></FormField>
          {error && <p className="text-sm text-rose-600 sm:col-span-2">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 border-t border-[var(--border)] px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-md border border-[var(--border)] px-4 py-2 text-sm">Cancel</button>
          <button disabled={saving} className="inline-flex items-center gap-2 rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--primary-foreground)] disabled:opacity-60">{saving && <LoaderCircle size={15} className="animate-spin" />}Save profile</button>
        </div>
      </form>
    </div>
  );
}

export default function InvoicesPage() {
  const searchParams = useSearchParams();
  const initialStatus = statuses.find((value) => value === searchParams.get('status')) ?? '';
  const initialTab = initialStatus || searchParams.get('tab') === 'invoices' ? 'invoices' : 'analytics';
  const { accessToken } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [profile, setProfile] = useState<InvoiceProfile | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [summary, setSummary] = useState(defaultSummary);
  const [analytics, setAnalytics] = useState(emptyAnalytics);
  const [selectedCurrency, setSelectedCurrency] = useState('INR');
  const [meta, setMeta] = useState({ page: 1, limit: PAGE_SIZE, total: 0, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [activeTab, setActiveTab] = useState<'analytics' | 'invoices'>(initialTab);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<InvoiceStatus | ''>(initialStatus);
  const [clientFilter, setClientFilter] = useState('');
  const [currencyFilter, setCurrencyFilter] = useState('');
  const [invoiceDateFrom, setInvoiceDateFrom] = useState('');
  const [invoiceDateTo, setInvoiceDateTo] = useState('');
  const [dueDateFrom, setDueDateFrom] = useState('');
  const [dueDateTo, setDueDateTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [actionId, setActionId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Invoice | null>(null);
  const [preview, setPreview] = useState<{ url: string; invoiceNumber: string } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [cases, setCases] = useState<InvoiceCase[]>([]);
  const [casesLoading, setCasesLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState({ clientId: '', invoiceDate: today(), dueDate: datePlusDays(30), currency: 'INR', placeOfSupply: '', purchaseOrderNumber: '', notes: '', terms: 'Payment due within 30 days.' });
  const [lines, setLines] = useState<DraftLine[]>([newLine()]);
  const [recipient, setRecipient] = useState('');
  const [statusChoice, setStatusChoice] = useState<'SENT' | 'VOID'>('SENT');
  const [payment, setPayment] = useState({ amount: '', paymentDate: today(), method: 'BANK_TRANSFER', reference: '' });
  const [clientBilling, setClientBilling] = useState<ClientBillingDraft>(emptyClientBilling);
  const selectedClientIdRef = useRef('');

  const loadInvoices = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await listInvoices({ page, limit: PAGE_SIZE, search: search.trim(), status, clientId: clientFilter, currency: currencyFilter, invoiceDateFrom, invoiceDateTo, dueDateFrom, dueDateTo }, accessToken);
      setInvoices(result.items);
      setMeta(result.meta);
      setSummary(result.summary || defaultSummary);
      setAnalytics(result.analytics || emptyAnalytics);
      setSelectedCurrency((current) => result.analytics?.currencies.some((entry) => entry.currency === current) ? current : result.analytics?.currencies[0]?.currency || 'INR');
    } catch (cause) {
      setError(cause instanceof InvoiceApiError ? cause.message : 'Could not load invoices.');
    } finally {
      setLoading(false);
    }
  }, [accessToken, page, search, status, clientFilter, currencyFilter, invoiceDateFrom, invoiceDateTo, dueDateFrom, dueDateTo]);

  useEffect(() => {
    listClients({ page: 1, limit: 100, status: 'ACTIVE' }, accessToken)
      .then((result) => setClients(result.items))
      .catch(() => setClients([]));
    getInvoiceProfile(accessToken).then(setProfile).catch(() => setProfile(null));
  }, [accessToken]);

  useEffect(() => {
    void Promise.resolve().then(loadInvoices);
  }, [loadInvoices]);

  useEffect(() => {
    if (!notice) return;
    const timeout = setTimeout(() => setNotice(''), 4500);
    return () => clearTimeout(timeout);
  }, [notice]);

  const draftTotals = useMemo(() => lines.reduce((result, item) => {
    const subtotal = amount(item.quantity) * amount(item.unitPrice);
    const discount = subtotal * amount(item.discountPercent) / 100;
    const tax = (subtotal - discount) * amount(item.taxPercent) / 100;
    result.subtotal += subtotal;
    result.discount += discount;
    result.tax += tax;
    result.total += subtotal - discount + tax;
    return result;
  }, { subtotal: 0, discount: 0, tax: 0, total: 0 }), [lines]);
  const selectedBilling = analytics.currencies.find((entry) => entry.currency === selectedCurrency);
  const missingClientBillingFields = [!clientBilling.address.trim() && 'address', !clientBilling.state.trim() && 'state', !clientBilling.gstNumber.trim() && 'GSTIN'].filter(Boolean);
  const monthlyBilled = selectedBilling?.monthly.reduce((sum, month) => sum + amount(month.billed), 0) || 0;
  const monthlyCollected = selectedBilling?.monthly.reduce((sum, month) => sum + amount(month.collected), 0) || 0;
  const rankedClients = analytics.topClients.filter((client) => client.currency === selectedCurrency).slice(0, 6);
  const compactMoney = (value: number) => new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 }).format(value);

  const setFormValue = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const setLineValue = (index: number, key: keyof DraftLine, value: string) => setLines((current) => current.map((line, lineIndex) => lineIndex === index ? { ...line, [key]: value } : line));

  const chooseClient = async (clientId: string) => {
    selectedClientIdRef.current = clientId;
    const cachedClient = clients.find((item) => item.id === clientId);
    setClientBilling(clientBillingFrom(cachedClient));
    setForm((current) => ({ ...current, clientId, placeOfSupply: cachedClient?.state || '' }));
    setLines((current) => current.map((line) => ({ ...line, caseId: '' })));
    setCases([]);
    if (!clientId) return;
    setCasesLoading(true);
    try {
      const [latestClient, clientCases] = await Promise.all([
        getClient(clientId, accessToken).catch(() => cachedClient),
        listInvoiceCases(clientId, accessToken),
      ]);
      if (selectedClientIdRef.current !== clientId) return;
      if (latestClient) {
        setClientBilling(clientBillingFrom(latestClient));
        setClients((current) => current.map((item) => item.id === latestClient.id ? latestClient : item));
        setForm((current) => ({ ...current, placeOfSupply: current.placeOfSupply === (cachedClient?.state || '') ? latestClient.state || '' : current.placeOfSupply }));
      }
      setCases(clientCases);
    } catch (cause) {
      if (selectedClientIdRef.current === clientId) setFormError(cause instanceof Error ? cause.message : 'Could not load client cases.');
    } finally {
      if (selectedClientIdRef.current === clientId) setCasesLoading(false);
    }
  };

  const resetComposer = () => {
    selectedClientIdRef.current = '';
    setEditingId(null);
    setForm({ clientId: '', invoiceDate: today(), dueDate: datePlusDays(30), currency: 'INR', placeOfSupply: '', purchaseOrderNumber: '', notes: '', terms: 'Payment due within 30 days.' });
    setClientBilling(emptyClientBilling);
    setLines([newLine()]);
    setCases([]);
    setFormError('');
  };

  const openComposer = async (invoice?: Invoice) => {
    resetComposer();
    setCreateOpen(true);
    if (!invoice) return;
    selectedClientIdRef.current = invoice.clientId;
    setEditingId(invoice.id);
    setForm({
      clientId: invoice.clientId,
      invoiceDate: dateInput(invoice.invoiceDate),
      dueDate: dateInput(invoice.dueDate),
      currency: invoice.currency,
      placeOfSupply: invoice.placeOfSupply || '',
      purchaseOrderNumber: invoice.purchaseOrderNumber || '',
      notes: invoice.notes || '',
      terms: invoice.terms || '',
    });
    setClientBilling(clientBillingFrom(clients.find((client) => client.id === invoice.clientId), invoice));
    setLines(invoice.items.map((item) => ({
      caseId: item.caseId || '',
      description: item.description,
      candidateName: item.candidateName || '',
      serviceCode: item.serviceCode || '',
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      discountPercent: Number(item.discountPercent),
      taxPercent: Number(item.taxPercent),
    })));
    setCasesLoading(true);
    try { setCases(await listInvoiceCases(invoice.clientId, accessToken)); }
    catch { setCases([]); }
    finally { setCasesLoading(false); }
  };

  const submitInvoice = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.clientId) { setFormError('Choose a client before saving.'); return; }
    if (lines.some((line) => !line.description.trim() || amount(line.quantity) <= 0 || amount(line.unitPrice) < 0)) { setFormError('Each line needs a description, positive quantity, and valid rate.'); return; }
    const payload: InvoiceInput = {
      ...form,
      clientAddress: clientBilling.address,
      clientContactName: clientBilling.contactName,
      clientPhone: clientBilling.phone,
      clientState: clientBilling.state,
      clientGst: clientBilling.gstNumber,
      clientPan: clientBilling.panNumber,
      clientEmail: clientBilling.email,
      items: lines.map((item) => ({
        ...(item.caseId ? { caseId: item.caseId } : {}),
        description: item.description,
        candidateName: item.candidateName || undefined,
        serviceCode: item.serviceCode || undefined,
        quantity: amount(item.quantity),
        unitPrice: amount(item.unitPrice),
        discountPercent: amount(item.discountPercent),
        taxPercent: amount(item.taxPercent),
      })),
    };
    setWorking(true);
    setFormError('');
    try {
      if (editingId) await updateInvoice(editingId, payload, accessToken);
      else await createInvoice(payload, accessToken);
      setNotice(editingId ? 'Draft invoice updated.' : 'Draft invoice created.');
      setCreateOpen(false);
      resetComposer();
      await loadInvoices();
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'Could not save invoice.');
    } finally {
      setWorking(false);
    }
  };

  const withAction = async (id: string, action: () => Promise<void>) => {
    setActionId(id);
    setError('');
    try { await action(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'The invoice action failed.'); }
    finally { setActionId(''); }
  };

  const download = (invoice: Invoice) => withAction(`download-${invoice.id}`, async () => {
    const blob = await downloadInvoicePdf(invoice.id, accessToken);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${invoice.invoiceNumber}.pdf`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  const openPdfPreview = async (invoice: Invoice) => {
    setPreviewLoading(true);
    setError('');
    try {
      const blob = await previewInvoicePdf(invoice.id, accessToken);
      const url = URL.createObjectURL(blob);
      setPreview((current) => {
        if (current) URL.revokeObjectURL(current.url);
        return { url, invoiceNumber: invoice.invoiceNumber };
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not open the invoice PDF.');
    } finally {
      setPreviewLoading(false);
    }
  };

  const closePdfPreview = () => {
    if (preview) URL.revokeObjectURL(preview.url);
    setPreview(null);
  };

  const removeDraft = async () => {
    if (!selected || selected.status !== 'DRAFT') return;
    if (!window.confirm(`Delete draft ${selected.invoiceNumber}? This cannot be undone.`)) return;
    await withAction(`delete-${selected.id}`, async () => {
      const invoiceNumber = selected.invoiceNumber;
      await deleteInvoice(selected.id, accessToken);
      setSelected(null);
      setNotice(`Draft ${invoiceNumber} deleted.`);
      await loadInvoices();
    });
  };

  const send = async () => {
    if (!selected || !recipient.trim()) { setError('Enter a recipient email address.'); return; }
    await withAction(`send-${selected.id}`, async () => {
      const updated = await emailInvoice(selected.id, recipient.trim(), accessToken);
      setSelected(updated);
      setNotice(`Invoice sent to ${recipient.trim()}.`);
      await loadInvoices();
    });
  };

  const savePayment = async () => {
    if (!selected || amount(payment.amount) <= 0) { setError('Enter a payment amount greater than zero.'); return; }
    await withAction(`payment-${selected.id}`, async () => {
      const updated = await recordInvoicePayment(selected.id, { ...payment, amount: amount(payment.amount) }, accessToken);
      setSelected(updated);
      setPayment((current) => ({ ...current, amount: '' }));
      setNotice('Payment recorded.');
      await loadInvoices();
    });
  };

  const saveStatus = async () => {
    if (!selected) return;
    if (statusChoice === 'VOID' && !window.confirm(`Void ${selected.invoiceNumber}? This cannot be undone.`)) return;
    await withAction(`status-${selected.id}`, async () => {
      const updated = statusChoice === 'VOID'
        ? await voidInvoice(selected.id, accessToken)
        : await changeInvoiceStatus(selected.id, 'SENT', accessToken);
      setSelected(updated);
      setNotice(`${selected.invoiceNumber} status changed to ${updated.status.replaceAll('_', ' ')}.`);
      await loadInvoices();
    });
  };

  const selectInvoice = (invoice: Invoice) => {
    setSelected(invoice);
    setRecipient(invoice.clientEmail || '');
    setStatusChoice(invoice.status === 'DRAFT' ? 'SENT' : 'VOID');
    setPayment({ amount: String(invoice.balanceDue || ''), paymentDate: today(), method: 'BANK_TRANSFER', reference: '' });
  };

  return (
    <main className="mx-auto max-w-[1440px] px-4 py-6 sm:px-7 lg:px-9">
      <div className="mb-6 flex flex-col gap-4 border-b border-[var(--border)] pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--primary)]"><Receipt size={15} /> Finance</div>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>Invoices</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">Create client bills, send branded PDFs, and keep payment status current.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setProfileOpen(true)} disabled={!profile} className="inline-flex items-center gap-2 rounded-md border border-[var(--border)] px-3.5 py-2.5 text-sm font-medium hover:bg-[var(--surface-muted)] disabled:opacity-50"><Settings2 size={16} /> Billing profile</button>
          <button onClick={() => void openComposer()} className="inline-flex items-center gap-2 rounded-md bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-[var(--primary-foreground)]"><Plus size={17} /> New invoice</button>
        </div>
      </div>

      {notice && <div className="mb-4 flex items-center gap-2 rounded-md border border-emerald-500/25 bg-emerald-500/10 px-3 py-2.5 text-sm text-emerald-800 dark:text-emerald-200"><Check size={16} />{notice}</div>}
      {error && <div className="mb-4 flex items-center justify-between rounded-md border border-rose-500/25 bg-rose-500/10 px-3 py-2.5 text-sm text-rose-700 dark:text-rose-300"><span>{error}</span><button onClick={() => setError('')} aria-label="Dismiss"><X size={16} /></button></div>}

      <section aria-label="Invoice summary" className="mb-6 grid grid-cols-2 border-y border-[var(--border)] sm:grid-cols-4">
        <div className="border-r border-[var(--border)] px-4 py-4 first:pl-0"><p className="text-xs text-[var(--muted)]">All invoices</p><p className="mt-1 text-xl font-semibold">{summary.total}</p></div>
        <div className="border-r border-[var(--border)] px-4 py-4"><p className="text-xs text-[var(--muted)]">Drafts</p><p className="mt-1 text-xl font-semibold">{summary.drafts}</p></div>
        <div className="border-r border-[var(--border)] px-4 py-4"><p className="text-xs text-[var(--muted)]">Overdue</p><p className="mt-1 text-xl font-semibold text-rose-600">{summary.overdue}</p></div>
        <div className="px-4 py-4 sm:pr-0"><p className="text-xs text-[var(--muted)]">Outstanding · {selectedCurrency}</p><p className="mt-1 text-xl font-semibold">{money(selectedBilling?.outstanding || 0, selectedCurrency)}</p></div>
      </section>

      <div role="tablist" aria-label="Invoice views" className="mb-5 flex gap-1 border-b border-[var(--border)]">
        <button type="button" id="billing-analytics-tab" role="tab" aria-selected={activeTab === 'analytics'} aria-controls="billing-analytics-panel" onClick={() => setActiveTab('analytics')} className={`border-b-2 px-4 py-3 text-sm font-semibold ${activeTab === 'analytics' ? 'border-[var(--primary)] text-[var(--primary)]' : 'border-transparent text-[var(--muted)] hover:text-[var(--foreground)]'}`}><ChartNoAxesCombined size={15} className="mr-2 inline" />Billing analytics</button>
        <button type="button" id="all-invoices-tab" role="tab" aria-selected={activeTab === 'invoices'} aria-controls="all-invoices-panel" onClick={() => setActiveTab('invoices')} className={`border-b-2 px-4 py-3 text-sm font-semibold ${activeTab === 'invoices' ? 'border-[var(--primary)] text-[var(--primary)]' : 'border-transparent text-[var(--muted)] hover:text-[var(--foreground)]'}`}><Receipt size={15} className="mr-2 inline" />All invoices <span className="ml-1 text-xs font-normal">({summary.total})</span></button>
      </div>

      <section id="billing-analytics-panel" role="tabpanel" aria-labelledby="billing-analytics-tab" hidden={activeTab !== 'analytics'} className="mb-7 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--border)] pb-3">
          <div><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--primary)]"><ChartNoAxesCombined size={15} /> Billing analytics</div><h2 className="mt-1 text-lg font-semibold">Revenue and collections</h2><p className="mt-0.5 text-xs text-[var(--muted)]">Invoice activity across the last 12 months. Values stay separated by currency.</p></div>
          <label className="flex items-center gap-2 text-xs font-medium text-[var(--muted)]">Currency<select value={selectedCurrency} onChange={(event) => setSelectedCurrency(event.target.value)} className={`${fieldClass} w-28 py-2`}>{(analytics.currencies.length ? analytics.currencies.map((entry) => entry.currency) : ['INR']).map((currency) => <option key={currency} value={currency}>{currency}</option>)}</select></label>
        </div>

        {loading && !analytics.currencies.length ? <div className="py-10 text-center text-sm text-[var(--muted)]">Loading billing analytics…</div> : !selectedBilling ? <div className="border-b border-[var(--border)] py-10 text-center"><Receipt size={23} className="mx-auto mb-2 text-[var(--muted)]" /><p className="text-sm font-medium">No billing activity yet</p><p className="mt-1 text-xs text-[var(--muted)]">Create and send an invoice to start building your revenue overview.</p></div> : <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="border-l-2 border-[#4F9CD6] py-2 pl-4"><p className="text-xs text-[var(--muted)]">Billed · 12 months</p><p className="mt-1 text-xl font-semibold">{money(monthlyBilled, selectedCurrency)}</p><p className="mt-1 text-[11px] text-[var(--muted)]">Issued invoice totals</p></div>
            <div className="border-l-2 border-[#269A78] py-2 pl-4"><p className="text-xs text-[var(--muted)]">Collected · 12 months</p><p className="mt-1 text-xl font-semibold">{money(monthlyCollected, selectedCurrency)}</p><p className="mt-1 text-[11px] text-[var(--muted)]">Payments recorded in period</p></div>
            <div className="border-l-2 border-[#E7A83E] py-2 pl-4"><p className="text-xs text-[var(--muted)]">Outstanding balance</p><p className="mt-1 text-xl font-semibold">{money(selectedBilling.outstanding, selectedCurrency)}</p><p className="mt-1 text-[11px] text-[var(--muted)]">Across open, non-void invoices</p></div>
          </div>

          <div className="grid gap-5 border-y border-[var(--border)] py-5 xl:grid-cols-[1.45fr_0.75fr]">
            <div className="min-w-0"><div className="mb-3 flex items-center justify-between"><div><h3 className="text-sm font-semibold">Billing trend</h3><p className="mt-0.5 text-[11px] text-[var(--muted)]">Billed by invoice date, collected by payment date</p></div><TrendingUp size={16} className="text-[var(--primary)]" /></div><div className="h-[250px] min-w-0"><ResponsiveContainer width="100%" height="100%"><AreaChart data={selectedBilling.monthly} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}><defs><linearGradient id="invoiceBilledFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#4F9CD6" stopOpacity={0.28} /><stop offset="100%" stopColor="#4F9CD6" stopOpacity={0} /></linearGradient><linearGradient id="invoiceCollectedFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#269A78" stopOpacity={0.22} /><stop offset="100%" stopColor="#269A78" stopOpacity={0} /></linearGradient></defs><CartesianGrid stroke="var(--border)" vertical={false} /><XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--muted)' }} axisLine={false} tickLine={false} minTickGap={16} /><YAxis tickFormatter={compactMoney} tick={{ fontSize: 10, fill: 'var(--muted)' }} axisLine={false} tickLine={false} width={48} /><Tooltip formatter={(value) => money(Number(value), selectedCurrency)} contentStyle={{ borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', fontSize: 11 }} /><Legend wrapperStyle={{ fontSize: 11 }} /><Area type="monotone" dataKey="billed" name="Billed" stroke="#4F9CD6" fill="url(#invoiceBilledFill)" strokeWidth={2} /><Area type="monotone" dataKey="collected" name="Collected" stroke="#269A78" fill="url(#invoiceCollectedFill)" strokeWidth={2} /></AreaChart></ResponsiveContainer></div></div>

            <div className="min-w-0 border-t border-[var(--border)] pt-5 xl:border-l xl:border-t-0 xl:pl-5 xl:pt-0"><h3 className="text-sm font-semibold">Invoice status mix</h3><p className="mt-0.5 text-[11px] text-[var(--muted)]">Current non-void invoice portfolio</p>{analytics.statusMix.length ? <><div className="h-[165px]"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={analytics.statusMix.filter((entry) => entry.status !== 'VOID')} dataKey="count" nameKey="status" innerRadius={48} outerRadius={68} paddingAngle={3} stroke="none">{analytics.statusMix.filter((entry) => entry.status !== 'VOID').map((entry) => <Cell key={entry.status} fill={statusColors[entry.status]} />)}</Pie><Tooltip formatter={(value, name) => [value, String(name).replaceAll('_', ' ')]} contentStyle={{ borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', fontSize: 11 }} /></PieChart></ResponsiveContainer></div><div className="grid grid-cols-2 gap-x-3 gap-y-2">{analytics.statusMix.filter((entry) => entry.status !== 'VOID').map((entry) => <div key={entry.status} className="flex items-center justify-between gap-2 text-[11px]"><span className="flex min-w-0 items-center gap-1.5 text-[var(--muted)]"><span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: statusColors[entry.status] }} /><span className="truncate">{entry.status.replaceAll('_', ' ')}</span></span><strong>{entry.count}</strong></div>)}</div></> : <p className="py-10 text-center text-xs text-[var(--muted)]">No invoice status data.</p>}</div>
          </div>

          <div className="grid gap-5 border-b border-[var(--border)] pb-5 lg:grid-cols-[1fr_1fr]">
            <div className="min-w-0"><h3 className="text-sm font-semibold">Top clients by billing</h3><p className="mt-0.5 text-[11px] text-[var(--muted)]">Highest issued invoice totals in {selectedCurrency}</p>{rankedClients.length ? <div className="mt-3 h-[220px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={rankedClients} layout="vertical" margin={{ top: 2, right: 12, left: 8, bottom: 2 }}><CartesianGrid stroke="var(--border)" horizontal={false} /><XAxis type="number" tickFormatter={compactMoney} tick={{ fontSize: 10, fill: 'var(--muted)' }} axisLine={false} tickLine={false} /><YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 10, fill: 'var(--muted)' }} axisLine={false} tickLine={false} tickFormatter={(name) => String(name).length > 16 ? `${String(name).slice(0, 15)}…` : name} /><Tooltip formatter={(value) => money(Number(value), selectedCurrency)} contentStyle={{ borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', fontSize: 11 }} /><Bar dataKey="billed" name="Billed" fill="#E7A83E" radius={[0, 3, 3, 0]} barSize={15} /></BarChart></ResponsiveContainer></div> : <p className="py-10 text-center text-xs text-[var(--muted)]">No issued invoices for this currency yet.</p>}</div>
            <div className="border-t border-[var(--border)] pt-5 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0"><h3 className="text-sm font-semibold">Billing snapshot</h3><p className="mt-0.5 text-[11px] text-[var(--muted)]">Quick read on the current collection position</p><div className="mt-4 space-y-4">{[{ label: 'Collected against billed (all time)', value: selectedBilling.billed ? Math.min(100, Math.round(selectedBilling.collected / selectedBilling.billed * 100)) : 0, color: '#269A78' }, { label: 'Open balance against billed (all time)', value: selectedBilling.billed ? Math.min(100, Math.round(selectedBilling.outstanding / selectedBilling.billed * 100)) : 0, color: '#E7A83E' }].map((item) => <div key={item.label}><div className="mb-1.5 flex justify-between gap-3 text-[11px]"><span className="text-[var(--muted)]">{item.label}</span><strong>{item.value}%</strong></div><div className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-muted)]"><div className="h-full rounded-full" style={{ width: `${item.value}%`, backgroundColor: item.color }} /></div></div>)}<p className="border-l-2 border-[var(--primary)] pl-3 text-xs leading-5 text-[var(--muted)]">{selectedBilling.outstanding > 0 ? `${money(selectedBilling.outstanding, selectedCurrency)} remains open. Review due dates and follow up with clients to keep collections moving.` : 'No outstanding balance for this currency. Recorded payments have cleared all open invoices.'}</p></div></div>
          </div>
        </>}
      </section>

      <section id="all-invoices-panel" role="tabpanel" aria-labelledby="all-invoices-tab" hidden={activeTab !== 'invoices'}>
      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        <label className="relative sm:col-span-2"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search invoice, client, or PO" className={`${fieldClass} pl-9`} /></label>
        <select value={clientFilter} onChange={(event) => { setClientFilter(event.target.value); setPage(1); }} className={fieldClass} aria-label="Filter by client"><option value="">All clients</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select>
        <select value={status} onChange={(event) => { setStatus(event.target.value as InvoiceStatus | ''); setPage(1); }} className={fieldClass} aria-label="Filter by invoice status"><option value="">All statuses</option>{statuses.map((value) => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}</select>
        <select value={currencyFilter} onChange={(event) => { setCurrencyFilter(event.target.value); setPage(1); }} className={fieldClass} aria-label="Filter by currency"><option value="">All currencies</option>{['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD'].map((currency) => <option key={currency} value={currency}>{currency}</option>)}</select>
        <label className="text-[10px] font-medium text-[var(--muted)]">Invoice date from<input type="date" value={invoiceDateFrom} max={invoiceDateTo || undefined} onChange={(event) => { setInvoiceDateFrom(event.target.value); setPage(1); }} className={`${fieldClass} mt-1`} /></label>
        <label className="text-[10px] font-medium text-[var(--muted)]">Invoice date to<input type="date" value={invoiceDateTo} min={invoiceDateFrom || undefined} onChange={(event) => { setInvoiceDateTo(event.target.value); setPage(1); }} className={`${fieldClass} mt-1`} /></label>
        <label className="text-[10px] font-medium text-[var(--muted)]">Due date from<input type="date" value={dueDateFrom} max={dueDateTo || undefined} onChange={(event) => { setDueDateFrom(event.target.value); setPage(1); }} className={`${fieldClass} mt-1`} /></label>
        <label className="text-[10px] font-medium text-[var(--muted)]">Due date to<input type="date" value={dueDateTo} min={dueDateFrom || undefined} onChange={(event) => { setDueDateTo(event.target.value); setPage(1); }} className={`${fieldClass} mt-1`} /></label>
        {(search || status || clientFilter || currencyFilter || invoiceDateFrom || invoiceDateTo || dueDateFrom || dueDateTo) && <button type="button" onClick={() => { setSearch(''); setStatus(''); setClientFilter(''); setCurrencyFilter(''); setInvoiceDateFrom(''); setInvoiceDateTo(''); setDueDateFrom(''); setDueDateTo(''); setPage(1); }} className="justify-self-start px-2 text-xs font-semibold text-[var(--primary)] hover:underline">Clear filters</button>}
      </div>

      <div className="overflow-hidden rounded-md border border-[var(--border)] bg-[var(--surface)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] border-collapse text-left text-sm">
            <thead className="bg-[var(--surface-muted)] text-[11px] uppercase tracking-wide text-[var(--muted)]">
              <tr><th className="px-4 py-3 font-semibold">Invoice</th><th className="px-4 py-3 font-semibold">Client</th><th className="px-4 py-3 font-semibold">Issued / Due</th><th className="px-4 py-3 text-right font-semibold">Total</th><th className="px-4 py-3 text-right font-semibold">Balance</th><th className="px-4 py-3 font-semibold">Status</th><th className="px-4 py-3 text-right font-semibold">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {loading ? <tr><td colSpan={7} className="py-16 text-center text-[var(--muted)]"><LoaderCircle size={20} className="mx-auto mb-2 animate-spin" />Loading invoices</td></tr>
                : invoices.length === 0 ? <tr><td colSpan={7} className="py-16 text-center"><FileText size={24} className="mx-auto mb-2 text-[var(--muted)]" /><p className="font-medium">No invoices found</p><p className="mt-1 text-xs text-[var(--muted)]">Create a client invoice to begin tracking billing here.</p></td></tr>
                  : invoices.map((invoice) => <tr key={invoice.id} className="transition-colors hover:bg-[var(--surface-muted)]/60">
                    <td className="px-4 py-3"><button onClick={() => selectInvoice(invoice)} className="font-semibold text-[var(--primary)] hover:underline">{invoice.invoiceNumber}</button>{invoice.purchaseOrderNumber && <p className="mt-0.5 text-xs text-[var(--muted)]">PO {invoice.purchaseOrderNumber}</p>}</td>
                    <td className="px-4 py-3"><p className="font-medium">{invoice.clientName}</p><p className="mt-0.5 text-xs text-[var(--muted)]">{invoice.clientEmail || 'No billing email'}</p></td>
                    <td className="px-4 py-3 text-xs"><p>{dateLabel(invoice.invoiceDate)}</p><p className="mt-1 text-[var(--muted)]">Due {dateLabel(invoice.dueDate)}</p></td>
                    <td className="px-4 py-3 text-right font-medium">{money(invoice.total, invoice.currency)}</td>
                    <td className="px-4 py-3 text-right">{money(invoice.balanceDue, invoice.currency)}</td>
                    <td className="px-4 py-3"><StatusTag status={invoice.status} /></td>
                    <td className="px-4 py-3"><div className="flex justify-end gap-1">
                      {invoice.status === 'DRAFT' && <button onClick={() => void openComposer(invoice)} title="Edit draft" aria-label="Edit draft" className="rounded p-2 text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"><Pencil size={15} /></button>}
                      <button onClick={() => void download(invoice)} title="Download PDF" aria-label="Download PDF" disabled={actionId === `download-${invoice.id}`} className="rounded p-2 text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"><Download size={15} /></button>
                      <button onClick={() => selectInvoice(invoice)} title="View invoice" className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] px-2.5 py-1.5 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--surface-muted)]"><Eye size={14} />View</button>
                    </div></td>
                  </tr>)}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-[var(--border)] px-4 py-3 text-xs text-[var(--muted)]"><span>{meta.total ? `${(page - 1) * PAGE_SIZE + 1}-${Math.min(page * PAGE_SIZE, meta.total)} of ${meta.total}` : '0 invoices'}</span><div className="flex gap-1"><button disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded border border-[var(--border)] p-1.5 disabled:opacity-40" aria-label="Previous page"><ChevronLeft size={15} /></button><button disabled={page >= meta.totalPages} onClick={() => setPage((value) => Math.min(meta.totalPages, value + 1))} className="rounded border border-[var(--border)] p-1.5 disabled:opacity-40" aria-label="Next page"><ChevronRight size={15} /></button></div></div>
      </div>
      </section>

      {createOpen && profile && <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/50 p-3 sm:p-6" onMouseDown={(event) => event.target === event.currentTarget && !working && (setCreateOpen(false), resetComposer())}>
        <form onSubmit={submitInvoice} className="my-3 w-full max-w-5xl rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-2xl sm:my-6">
          <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-lg border-b border-[var(--border)] bg-[var(--surface)] px-5 py-4 sm:px-7">
            <div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-md bg-[var(--primary)]/10 text-[var(--primary)]"><Receipt size={18} /></span><div><h2 className="font-semibold">{editingId ? 'Edit draft invoice' : 'Create invoice'}</h2><p className="text-xs text-[var(--muted)]">{profile.name} · saved as a draft</p></div></div>
            <button type="button" onClick={() => { setCreateOpen(false); resetComposer(); }} disabled={working} aria-label="Close invoice form" className="rounded p-2 text-[var(--muted)] hover:bg-[var(--surface-muted)]"><X size={18} /></button>
          </div>

          <div className="space-y-6 p-5 sm:p-7">
            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <FormField label="Bill to client"><select value={form.clientId} onChange={(event) => void chooseClient(event.target.value)} required className={fieldClass}><option value="">Select client</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></FormField>
              <FormField label="Invoice date"><input type="date" value={form.invoiceDate} onChange={(event) => setFormValue('invoiceDate', event.target.value)} required className={fieldClass} /></FormField>
              <FormField label="Due date"><input type="date" value={form.dueDate} min={form.invoiceDate} onChange={(event) => setFormValue('dueDate', event.target.value)} required className={fieldClass} /></FormField>
              <FormField label="Currency"><select value={form.currency} onChange={(event) => setFormValue('currency', event.target.value)} className={fieldClass}>{['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD'].map((currency) => <option key={currency}>{currency}</option>)}</select></FormField>
              <FormField label="Place of supply"><GeoSelect kind="state" countryName={clients.find((client) => client.id === form.clientId)?.country || undefined} value={form.placeOfSupply} onChange={(value) => setFormValue('placeOfSupply', value)} className={fieldClass} /></FormField>
              <FormField label="Purchase order number"><input value={form.purchaseOrderNumber} onChange={(event) => setFormValue('purchaseOrderNumber', event.target.value)} placeholder="Optional" maxLength={100} className={fieldClass} /></FormField>
              <div className="flex items-end pb-1 lg:col-span-2"><div className="rounded-md border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-xs text-[var(--muted)]">{profile.gstNumber ? `Supplier GSTIN ${profile.gstNumber} · ${profile.state || 'State not set'}` : 'GST registration not configured'}<button type="button" onClick={() => setProfileOpen(true)} className="ml-2 font-semibold text-[var(--primary)] hover:underline">Edit billing details</button></div></div>
            </section>

            {form.clientId && <section aria-label="Client billing details" className="border-l-2 border-[var(--primary)] py-2 pl-4"><div className="mb-3 flex flex-wrap items-baseline justify-between gap-2"><div><h3 className="text-sm font-semibold">Client billing details</h3><p className="mt-0.5 text-[11px] text-[var(--muted)]">Saved on this invoice; the client profile will not be changed.</p></div>{missingClientBillingFields.length > 0 && <p className="text-[11px] text-amber-700 dark:text-amber-300">Complete {missingClientBillingFields.join(', ')} for a more complete invoice</p>}</div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><FormField label="Billing address" className="sm:col-span-2"><textarea value={clientBilling.address} onChange={(event) => setClientBilling((current) => ({ ...current, address: event.target.value }))} maxLength={1000} placeholder="Street, city, postal code, country" className={`${fieldClass} min-h-16 resize-y`} /></FormField><FormField label="Contact person"><input value={clientBilling.contactName} onChange={(event) => setClientBilling((current) => ({ ...current, contactName: event.target.value }))} maxLength={150} className={fieldClass} /></FormField><FormField label="Contact phone"><input value={clientBilling.phone} onChange={(event) => setClientBilling((current) => ({ ...current, phone: event.target.value }))} maxLength={50} className={fieldClass} /></FormField><FormField label="State"><GeoSelect kind="state" countryName={clients.find((client) => client.id === form.clientId)?.country || undefined} value={clientBilling.state} onChange={(value) => { setClientBilling((current) => ({ ...current, state: value })); setForm((current) => ({ ...current, placeOfSupply: value })); }} className={fieldClass} /></FormField><FormField label="GSTIN"><input value={clientBilling.gstNumber} onChange={(event) => setClientBilling((current) => ({ ...current, gstNumber: event.target.value }))} maxLength={30} className={fieldClass} /></FormField><FormField label="PAN"><input value={clientBilling.panNumber} onChange={(event) => setClientBilling((current) => ({ ...current, panNumber: event.target.value }))} maxLength={20} className={fieldClass} /></FormField><FormField label="Billing email"><input type="email" value={clientBilling.email} onChange={(event) => setClientBilling((current) => ({ ...current, email: event.target.value }))} maxLength={255} className={fieldClass} /></FormField></div></section>}

            <section>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><h3 className="text-sm font-semibold">Services and individuals</h3><p className="mt-0.5 text-xs text-[var(--muted)]">Link a BGV case or enter a service line manually. Rates and tax are editable per line.</p></div><button type="button" onClick={() => setLines((current) => [...current, newLine()])} className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] px-3 py-2 text-xs font-semibold hover:bg-[var(--surface-muted)]"><Plus size={14} />Add line</button></div>
              {form.clientId && cases.length > 0 && <div className="mb-3 flex items-center gap-2 rounded-md bg-[var(--surface-muted)] px-3 py-2 text-xs text-[var(--muted)]"><FileText size={14} />{casesLoading ? 'Loading client cases…' : `${cases.length} client cases available to link`}</div>}
              {lines.map((line, index) => {
                const linkedCase = cases.find((item) => item.id === line.caseId);
                return <div key={`line-${index}`} className="mb-3 rounded-md border border-[var(--border)] p-3 sm:p-4">
                  <div className="mb-3 flex items-center justify-between"><span className="text-xs font-semibold text-[var(--muted)]">LINE {String(index + 1).padStart(2, '0')}</span><button type="button" disabled={lines.length === 1} onClick={() => setLines((current) => current.filter((_, lineIndex) => lineIndex !== index))} title="Remove line" aria-label="Remove line" className="rounded p-1.5 text-[var(--muted)] hover:bg-rose-500/10 hover:text-rose-600 disabled:opacity-40"><Trash2 size={15} /></button></div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <FormField label="Service description" className="sm:col-span-2"><input value={line.description} onChange={(event) => setLineValue(index, 'description', event.target.value)} placeholder="Background verification package" maxLength={500} required className={fieldClass} /></FormField>
                    <FormField label="Link BGV case (optional)"><select value={line.caseId} disabled={!form.clientId || casesLoading} onChange={(event) => {
                      const selectedCase = cases.find((item) => item.id === event.target.value);
                      setLines((current) => current.map((entry, lineIndex) => lineIndex === index ? { ...entry, caseId: event.target.value, candidateName: selectedCase?.candidateName || '', description: selectedCase ? `${selectedCase.packageName || 'Background verification'} · ${selectedCase.caseNumber}` : entry.description } : entry));
                    }} className={fieldClass}><option value="">No case link</option>{cases.map((item) => <option key={item.id} value={item.id}>{item.caseNumber} · {item.candidateName}</option>)}</select></FormField>
                    <FormField label="Individual / candidate"><input value={line.candidateName} onChange={(event) => setLineValue(index, 'candidateName', event.target.value)} placeholder={linkedCase?.candidateName || 'Optional'} maxLength={255} className={fieldClass} /></FormField>
                    <FormField label="Service / HSN code"><input value={line.serviceCode} onChange={(event) => setLineValue(index, 'serviceCode', event.target.value)} placeholder="Optional" maxLength={30} className={fieldClass} /></FormField>
                    <FormField label="Quantity"><input type="number" min="0.001" step="0.001" value={line.quantity} onChange={(event) => setLineValue(index, 'quantity', event.target.value)} required className={fieldClass} /></FormField>
                    <FormField label={`Rate (${form.currency})`}><input type="number" min="0" step="0.01" value={line.unitPrice} onChange={(event) => setLineValue(index, 'unitPrice', event.target.value)} required className={fieldClass} /></FormField>
                    <FormField label="Discount %"><input type="number" min="0" max="100" step="0.01" value={line.discountPercent} onChange={(event) => setLineValue(index, 'discountPercent', event.target.value)} className={fieldClass} /></FormField>
                    <FormField label="GST / tax %"><input type="number" min="0" max="100" step="0.01" value={line.taxPercent} onChange={(event) => setLineValue(index, 'taxPercent', event.target.value)} className={fieldClass} /></FormField>
                  </div>
                </div>;
              })}
            </section>

            <section className="grid gap-5 border-t border-[var(--border)] pt-5 lg:grid-cols-[1fr_300px]">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Notes"><textarea value={form.notes} onChange={(event) => setFormValue('notes', event.target.value)} placeholder="Optional note shown on the invoice" maxLength={3000} className={`${fieldClass} min-h-20 resize-y`} /></FormField>
                <FormField label="Payment terms"><textarea value={form.terms} onChange={(event) => setFormValue('terms', event.target.value)} placeholder="Payment terms" maxLength={3000} className={`${fieldClass} min-h-20 resize-y`} /></FormField>
              </div>
              <div className="rounded-md bg-[var(--surface-muted)] p-4">
                <div className="flex justify-between py-1.5 text-sm"><span className="text-[var(--muted)]">Subtotal</span><span>{money(draftTotals.subtotal, form.currency)}</span></div>
                <div className="flex justify-between py-1.5 text-sm"><span className="text-[var(--muted)]">Discount</span><span>-{money(draftTotals.discount, form.currency)}</span></div>
                <div className="flex justify-between py-1.5 text-sm"><span className="text-[var(--muted)]">Tax</span><span>{money(draftTotals.tax, form.currency)}</span></div>
                <div className="mt-2 flex justify-between border-t border-[var(--border)] pt-3 text-base font-semibold"><span>Total</span><span>{money(draftTotals.total, form.currency)}</span></div>
                {profile.gstNumber && <p className="mt-2 text-[10px] text-[var(--muted)]">GST split (CGST/SGST or IGST) is determined from supplier state and place of supply.</p>}
              </div>
            </section>
            {formError && <p role="alert" className="rounded-md bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">{formError}</p>}
          </div>

          <div className="sticky bottom-0 flex flex-col-reverse gap-2 rounded-b-lg border-t border-[var(--border)] bg-[var(--surface)] px-5 py-4 sm:flex-row sm:justify-end sm:px-7">
            <button type="button" disabled={working} onClick={() => { setCreateOpen(false); resetComposer(); }} className="rounded-md border border-[var(--border)] px-4 py-2.5 text-sm font-medium">Cancel</button>
            <button disabled={working || !profile} className="inline-flex items-center justify-center gap-2 rounded-md bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-[var(--primary-foreground)] disabled:opacity-60">{working && <LoaderCircle size={15} className="animate-spin" />}{editingId ? 'Save draft' : 'Create draft invoice'}</button>
          </div>
        </form>
      </div>}

      {selected && <div className="fixed inset-0 z-40 flex justify-end bg-black/45" onMouseDown={(event) => event.target === event.currentTarget && setSelected(null)}>
        <aside className="flex h-full w-full max-w-xl flex-col border-l border-[var(--border)] bg-[var(--surface)] shadow-2xl">
          <div className="flex items-start justify-between border-b border-[var(--border)] px-5 py-4 sm:px-6"><div><div className="mb-2 flex items-center gap-2"><StatusTag status={selected.status} />{selected.purchaseOrderNumber && <span className="text-xs text-[var(--muted)]">PO {selected.purchaseOrderNumber}</span>}</div><h2 className="text-lg font-semibold">{selected.invoiceNumber}</h2><p className="mt-1 text-sm text-[var(--muted)]">{selected.clientName}</p></div><button onClick={() => setSelected(null)} className="rounded p-2 text-[var(--muted)] hover:bg-[var(--surface-muted)]" aria-label="Close invoice details"><X size={18} /></button></div>
          <div className="flex-1 space-y-5 overflow-y-auto p-5 sm:p-6">
            <div className="grid grid-cols-2 gap-3"><div className="rounded-md border border-[var(--border)] p-3"><p className="text-xs text-[var(--muted)]">Invoice date</p><p className="mt-1 text-sm font-medium">{dateLabel(selected.invoiceDate)}</p></div><div className="rounded-md border border-[var(--border)] p-3"><p className="text-xs text-[var(--muted)]">Due date</p><p className="mt-1 text-sm font-medium">{dateLabel(selected.dueDate)}</p></div></div>
            <section><h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Billed to</h3><div className="text-sm font-semibold">{selected.clientName}</div><p className="mt-1 whitespace-pre-line text-xs leading-5 text-[var(--muted)]">{selected.clientAddress || 'No billing address on file'}</p><div className="mt-2 grid gap-1 text-xs text-[var(--muted)] sm:grid-cols-2"><p>Contact: {selected.clientContactName || 'Not provided'}</p><p>Phone: {selected.clientPhone || 'Not provided'}</p><p>State: {selected.clientState || selected.placeOfSupply || 'Not provided'}</p><p>GSTIN: {selected.clientGst || 'Not provided'}</p><p>PAN: {selected.clientPan || 'Not provided'}</p><p>Email: {selected.clientEmail || 'Not provided'}</p></div></section>
            <section><h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Line items</h3><div className="divide-y divide-[var(--border)] rounded-md border border-[var(--border)]">{selected.items.map((item) => <div key={item.id} className="flex items-start justify-between gap-4 p-3"><div className="min-w-0"><p className="text-sm font-medium">{item.description}</p>{item.candidateName && <p className="mt-0.5 text-xs text-[var(--muted)]">{item.candidateName}</p>}<p className="mt-1 text-xs text-[var(--muted)]">{amount(item.quantity)} × {money(item.unitPrice, selected.currency)}{Number(item.discountPercent) > 0 ? ` · ${item.discountPercent}% discount` : ''} · {item.taxPercent}% tax</p></div><span className="shrink-0 text-sm font-semibold">{money(item.total, selected.currency)}</span></div>)}</div>
              <div className="ml-auto mt-3 max-w-xs space-y-1.5 text-sm"><div className="flex justify-between text-[var(--muted)]"><span>Subtotal</span><span>{money(selected.subtotal, selected.currency)}</span></div><div className="flex justify-between text-[var(--muted)]"><span>Discount</span><span>-{money(selected.discountTotal, selected.currency)}</span></div><div className="flex justify-between text-[var(--muted)]"><span>{selected.taxType === 'CGST_SGST' ? 'CGST + SGST' : selected.taxType === 'IGST' ? 'IGST' : 'Tax'}</span><span>{money(selected.taxTotal, selected.currency)}</span></div><div className="flex justify-between border-t border-[var(--border)] pt-2 font-semibold"><span>Total</span><span>{money(selected.total, selected.currency)}</span></div><div className="flex justify-between text-emerald-700 dark:text-emerald-300"><span>Paid</span><span>{money(selected.amountPaid, selected.currency)}</span></div><div className="flex justify-between font-semibold"><span>Balance due</span><span>{money(selected.balanceDue, selected.currency)}</span></div></div>
            </section>
            {selected.payments.length > 0 && <section><h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Payments</h3><div className="space-y-2">{selected.payments.map((entry) => <div key={entry.id} className="flex justify-between rounded-md bg-[var(--surface-muted)] px-3 py-2 text-xs"><span>{dateLabel(entry.paymentDate)} · {(entry.method || 'Payment').replaceAll('_', ' ')}{entry.reference ? ` · ${entry.reference}` : ''}</span><strong>{money(entry.amount, selected.currency)}</strong></div>)}</div></section>}
            {selected.notes && <section><h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Notes</h3><p className="whitespace-pre-line text-sm">{selected.notes}</p></section>}
            {selected.activity.length > 0 && <section><h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Activity</h3><div className="space-y-2">{selected.activity.map((entry) => <div key={entry.id} className="flex justify-between gap-3 text-xs"><span>{entry.action.replaceAll('_', ' ').toLowerCase()}</span><time className="shrink-0 text-[var(--muted)]">{new Date(entry.createdAt).toLocaleString()}</time></div>)}</div></section>}
            {error && <p role="alert" className="rounded-md bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">{error}</p>}
          </div>

          <div className="space-y-4 border-t border-[var(--border)] p-5 sm:p-6">
            <div className="flex flex-wrap gap-2"><button onClick={() => void openPdfPreview(selected)} disabled={previewLoading} className="inline-flex items-center gap-2 rounded-md bg-[var(--primary)] px-3 py-2 text-xs font-semibold text-[var(--primary-foreground)] disabled:opacity-50"><Eye size={14} />{previewLoading ? 'Opening PDF…' : 'Preview PDF'}</button><button onClick={() => void download(selected)} disabled={actionId === `download-${selected.id}`} className="inline-flex items-center gap-2 rounded-md border border-[var(--border)] px-3 py-2 text-xs font-semibold hover:bg-[var(--surface-muted)]"><Download size={14} />Download PDF</button>{selected.status === 'DRAFT' && <><button onClick={() => { setSelected(null); void openComposer(selected); }} className="inline-flex items-center gap-2 rounded-md border border-[var(--border)] px-3 py-2 text-xs font-semibold hover:bg-[var(--surface-muted)]"><Pencil size={14} />Edit draft</button><button onClick={() => void removeDraft()} disabled={Boolean(actionId)} className="inline-flex items-center gap-2 rounded-md border border-rose-500/30 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-500/10 dark:text-rose-300 disabled:opacity-50"><Trash2 size={14} />Delete draft</button></>}</div>
            {(selected.status === 'DRAFT' || (selected.status !== 'VOID' && selected.status !== 'PAID' && amount(selected.amountPaid) === 0)) && <div className="grid gap-2 border-t border-[var(--border)] pt-3 sm:grid-cols-[1fr_auto]"><div><label className={labelClass}>Change status</label><select value={statusChoice} onChange={(event) => setStatusChoice(event.target.value as 'SENT' | 'VOID')} className={fieldClass}>{selected.status === 'DRAFT' && <option value="SENT">Sent</option>}<option value="VOID">Void</option></select><p className="mt-1 text-[10px] text-[var(--muted)]">Paid status follows recorded payments; overdue is calculated from the due date.</p></div><button onClick={() => void saveStatus()} disabled={Boolean(actionId)} className="mt-auto rounded-md border border-[var(--border)] px-4 py-2 text-sm font-semibold hover:bg-[var(--surface-muted)] disabled:opacity-50">Update status</button></div>}
            {selected.status !== 'PAID' && selected.status !== 'VOID' && <div className="grid gap-2 sm:grid-cols-[1fr_auto]"><div><label className={labelClass}>Send invoice to</label><input type="email" value={recipient} onChange={(event) => setRecipient(event.target.value)} placeholder="billing@client.com" className={fieldClass} /></div><button onClick={() => void send()} disabled={Boolean(actionId) || !recipient} className="mt-auto inline-flex items-center justify-center gap-2 rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--primary-foreground)] disabled:opacity-50"><Mail size={15} />Email PDF</button></div>}
            {selected.status !== 'DRAFT' && selected.status !== 'VOID' && selected.status !== 'PAID' && <div className="border-t border-[var(--border)] pt-3"><p className="mb-2 text-xs font-semibold">Record payment</p><div className="grid grid-cols-2 gap-2"><input aria-label="Payment amount" type="number" min="0.01" step="0.01" max={amount(selected.balanceDue)} value={payment.amount} onChange={(event) => setPayment((current) => ({ ...current, amount: event.target.value }))} placeholder="Amount" className={fieldClass} /><input aria-label="Payment date" type="date" value={payment.paymentDate} onChange={(event) => setPayment((current) => ({ ...current, paymentDate: event.target.value }))} className={fieldClass} /><select aria-label="Payment method" value={payment.method} onChange={(event) => setPayment((current) => ({ ...current, method: event.target.value }))} className={fieldClass}><option value="BANK_TRANSFER">Bank transfer</option><option value="UPI">UPI</option><option value="CARD">Card</option><option value="CASH">Cash</option><option value="CHEQUE">Cheque</option><option value="OTHER">Other</option></select><input aria-label="Payment reference" value={payment.reference} onChange={(event) => setPayment((current) => ({ ...current, reference: event.target.value }))} placeholder="Reference (optional)" className={fieldClass} /></div><button onClick={() => void savePayment()} disabled={Boolean(actionId) || !payment.amount} className="mt-2 inline-flex items-center gap-2 rounded-md border border-[var(--border)] px-3 py-2 text-xs font-semibold hover:bg-[var(--surface-muted)] disabled:opacity-50"><CircleDollarSign size={14} />Record payment</button></div>}
          </div>
        </aside>
      </div>}

      {profileOpen && profile && <BillingProfileDialog profile={profile} token={accessToken} onClose={() => setProfileOpen(false)} onSaved={setProfile} />}

      {preview && <div className="fixed inset-0 z-[60] flex flex-col bg-black/80 p-2 sm:p-5">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 rounded-t-md border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
          <div className="min-w-0"><h2 className="truncate text-sm font-semibold">{preview.invoiceNumber}</h2><p className="text-xs text-[var(--muted)]">PDF preview</p></div>
          <div className="flex shrink-0 gap-2"><button onClick={() => selected && void download(selected)} className="inline-flex items-center gap-2 rounded-md border border-[var(--border)] px-3 py-2 text-xs font-semibold hover:bg-[var(--surface-muted)]"><Download size={14} />Download</button><button onClick={closePdfPreview} aria-label="Close PDF preview" className="rounded-md border border-[var(--border)] p-2 hover:bg-[var(--surface-muted)]"><X size={16} /></button></div>
        </div>
        <iframe title={`Invoice ${preview.invoiceNumber} PDF preview`} src={preview.url} className="mx-auto h-full min-h-0 w-full max-w-6xl flex-1 rounded-b-md bg-white" />
      </div>}
    </main>
  );
}