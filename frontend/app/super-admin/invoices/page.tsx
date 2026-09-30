'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight, Download, ExternalLink, LoaderCircle, Receipt, Search, X } from 'lucide-react';
import { useAuth } from '@/src/auth/AuthProvider';
import { listCompanies } from '@/src/lib/api/company.api';
import { InvoiceApiError, downloadInvoicePdf, listPlatformInvoices } from '@/src/lib/api/invoices';
import type { Invoice, InvoiceStatus } from '@/src/lib/api/invoices';
import type { CompanyOption } from '@/src/types/company';

const PAGE_SIZE = 25;
const STATUSES: InvoiceStatus[] = ['DRAFT', 'SENT', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'VOID'];
const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD'];
const inputClass = 'w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--primary)]';

function formatMoney(value: Invoice['total'], currency: string) {
  const validCurrency = CURRENCIES.includes(currency) ? currency : 'INR';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: validCurrency, maximumFractionDigits: 2 }).format(Number(value) || 0);
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function statusClass(status: InvoiceStatus) {
  if (status === 'PAID') return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
  if (status === 'OVERDUE' || status === 'VOID') return 'bg-rose-500/10 text-rose-700 dark:text-rose-300';
  if (status === 'PARTIALLY_PAID') return 'bg-amber-500/10 text-amber-700 dark:text-amber-300';
  if (status === 'DRAFT') return 'bg-slate-500/10 text-slate-600 dark:text-slate-300';
  return 'bg-sky-500/10 text-sky-700 dark:text-sky-300';
}

function SuperAdminInvoiceExplorer() {
  const { accessToken } = useAuth();
  const searchParams = useSearchParams();
  const requestedCompanyId = searchParams.get('companyId') || '';
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: PAGE_SIZE, total: 0, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [companyId, setCompanyId] = useState(requestedCompanyId);
  const [status, setStatus] = useState<InvoiceStatus | ''>('');
  const [currency, setCurrency] = useState('');
  const [invoiceDateFrom, setInvoiceDateFrom] = useState('');
  const [invoiceDateTo, setInvoiceDateTo] = useState('');
  const [dueDateFrom, setDueDateFrom] = useState('');
  const [dueDateTo, setDueDateTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloadingId, setDownloadingId] = useState('');

  useEffect(() => {
    const timeout = window.setTimeout(() => setCompanyId(requestedCompanyId), 0);
    return () => window.clearTimeout(timeout);
  }, [requestedCompanyId]);

  useEffect(() => {
    if (!accessToken) return;
    const timeout = window.setTimeout(() => {
      void listCompanies(accessToken).then(setCompanies).catch(() => setCompanies([]));
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [accessToken]);

  const loadInvoices = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError('');
    try {
      const result = await listPlatformInvoices({
        page,
        limit: PAGE_SIZE,
        search: search.trim(),
        companyId,
        status,
        currency,
        invoiceDateFrom,
        invoiceDateTo,
        dueDateFrom,
        dueDateTo,
      }, accessToken);
      setInvoices(result.items);
      setMeta(result.meta);
    } catch (cause) {
      setError(cause instanceof InvoiceApiError ? cause.message : 'Could not load platform invoices.');
    } finally {
      setLoading(false);
    }
  }, [accessToken, page, search, companyId, status, currency, invoiceDateFrom, invoiceDateTo, dueDateFrom, dueDateTo]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadInvoices(), 0);
    return () => window.clearTimeout(timeout);
  }, [loadInvoices]);

  const download = async (invoice: Invoice) => {
    setDownloadingId(invoice.id);
    setError('');
    try {
      const blob = await downloadInvoicePdf(invoice.id, accessToken);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${invoice.invoiceNumber}.pdf`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not download invoice PDF.');
    } finally {
      setDownloadingId('');
    }
  };

  const clearFilters = () => {
    setSearch('');
    setCompanyId('');
    setStatus('');
    setCurrency('');
    setInvoiceDateFrom('');
    setInvoiceDateTo('');
    setDueDateFrom('');
    setDueDateTo('');
    setPage(1);
  };

  const hasFilters = Boolean(search || companyId || status || currency || invoiceDateFrom || invoiceDateTo || dueDateFrom || dueDateTo);

  return (
    <div className="mx-auto max-w-[1440px] space-y-6 px-4 py-6 sm:px-7 lg:px-9">
      <header className="flex flex-col gap-4 border-b border-[var(--border)] pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--primary)]"><Receipt size={15} /> Platform finance</div>
          <h1 className="text-2xl font-semibold" style={{ fontFamily: 'var(--font-display)' }}>Invoices across companies</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">Browse company billing records and open invoice PDFs.</p>
        </div>
        <p className="text-sm text-[var(--muted)]">{meta.total.toLocaleString('en-IN')} invoices</p>
      </header>

      {error && <div role="alert" className="flex items-start justify-between gap-3 rounded-md border border-rose-500/25 bg-rose-500/10 px-3 py-2.5 text-sm text-rose-700 dark:text-rose-300"><span>{error}</span><button type="button" onClick={() => setError('')} aria-label="Dismiss error"><X size={16} /></button></div>}

      <section aria-label="Invoice filters" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="relative sm:col-span-2"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search invoice, client, or PO" className={`${inputClass} pl-9`} /></label>
        <label className="sr-only" htmlFor="invoice-company-filter">Company</label><select id="invoice-company-filter" value={companyId} onChange={(event) => { setCompanyId(event.target.value); setPage(1); }} className={inputClass}><option value="">All companies</option>{companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select>
        <label className="sr-only" htmlFor="invoice-status-filter">Status</label><select id="invoice-status-filter" value={status} onChange={(event) => { setStatus(event.target.value as InvoiceStatus | ''); setPage(1); }} className={inputClass}><option value="">All statuses</option>{STATUSES.map((value) => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}</select>
        <label className="sr-only" htmlFor="invoice-currency-filter">Currency</label><select id="invoice-currency-filter" value={currency} onChange={(event) => { setCurrency(event.target.value); setPage(1); }} className={inputClass}><option value="">All currencies</option>{CURRENCIES.map((value) => <option key={value} value={value}>{value}</option>)}</select>
        <label className="text-[10px] font-medium text-[var(--muted)]">Invoice date from<input type="date" value={invoiceDateFrom} max={invoiceDateTo || undefined} onChange={(event) => { setInvoiceDateFrom(event.target.value); setPage(1); }} className={`${inputClass} mt-1`} /></label>
        <label className="text-[10px] font-medium text-[var(--muted)]">Invoice date to<input type="date" value={invoiceDateTo} min={invoiceDateFrom || undefined} onChange={(event) => { setInvoiceDateTo(event.target.value); setPage(1); }} className={`${inputClass} mt-1`} /></label>
        <label className="text-[10px] font-medium text-[var(--muted)]">Due date from<input type="date" value={dueDateFrom} max={dueDateTo || undefined} onChange={(event) => { setDueDateFrom(event.target.value); setPage(1); }} className={`${inputClass} mt-1`} /></label>
        <label className="text-[10px] font-medium text-[var(--muted)]">Due date to<input type="date" value={dueDateTo} min={dueDateFrom || undefined} onChange={(event) => { setDueDateTo(event.target.value); setPage(1); }} className={`${inputClass} mt-1`} /></label>
        {hasFilters && <button type="button" onClick={clearFilters} className="justify-self-start px-2 text-xs font-semibold text-[var(--primary)] hover:underline">Clear filters</button>}
      </section>

      <section className="overflow-hidden rounded-md border border-[var(--border)] bg-[var(--surface)]" aria-label="Platform invoices">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] border-collapse text-left text-sm">
            <thead className="bg-[var(--surface-muted)] text-[11px] uppercase tracking-wide text-[var(--muted)]"><tr><th className="px-4 py-3">Invoice</th><th className="px-4 py-3">Company</th><th className="px-4 py-3">Client</th><th className="px-4 py-3">Issued / Due</th><th className="px-4 py-3 text-right">Total</th><th className="px-4 py-3 text-right">Balance</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Actions</th></tr></thead>
            <tbody className="divide-y divide-[var(--border)]">
              {loading ? <tr><td colSpan={8} className="py-16 text-center text-[var(--muted)]"><LoaderCircle size={20} className="mx-auto mb-2 animate-spin" />Loading invoices</td></tr>
                : invoices.length === 0 ? <tr><td colSpan={8} className="py-16 text-center"><Receipt size={24} className="mx-auto mb-2 text-[var(--muted)]" /><p className="font-medium">No invoices found</p><p className="mt-1 text-xs text-[var(--muted)]">Try changing the filters.</p></td></tr>
                  : invoices.map((invoice) => <tr key={invoice.id} className="hover:bg-[var(--surface-muted)]/60">
                    <td className="px-4 py-3"><span className="font-semibold text-[var(--foreground)]">{invoice.invoiceNumber}</span>{invoice.purchaseOrderNumber && <p className="mt-0.5 text-xs text-[var(--muted)]">PO {invoice.purchaseOrderNumber}</p>}</td>
                    {/* <td className="px-4 py-3"><Link href={`/super-admin/companies/${invoice.companyId}`} className="inline-flex items-center gap-1 font-medium text-[var(--primary)] hover:underline">{invoice.supplierName}<ExternalLink size={12} /></Link></td> */}
                    <td className="px-4 py-3"><p className="font-medium">{invoice.clientName}</p><p className="mt-0.5 text-xs text-[var(--muted)]">{invoice.clientEmail || 'No billing email'}</p></td>
                    <td className="px-4 py-3 text-xs"><p>{formatDate(invoice.invoiceDate)}</p><p className="mt-1 text-[var(--muted)]">Due {formatDate(invoice.dueDate)}</p></td>
                    <td className="px-4 py-3 text-right font-medium">{formatMoney(invoice.total, invoice.currency)}</td>
                    <td className="px-4 py-3 text-right">{formatMoney(invoice.balanceDue, invoice.currency)}</td>
                    <td className="px-4 py-3"><span className={`inline-flex rounded px-2 py-1 text-[10px] font-semibold uppercase ${statusClass(invoice.status)}`}>{invoice.status.replaceAll('_', ' ')}</span></td>
                    <td className="px-4 py-3"><div className="flex justify-end"><button type="button" onClick={() => void download(invoice)} disabled={downloadingId === invoice.id} title="Download invoice PDF" aria-label={`Download ${invoice.invoiceNumber} PDF`} className="rounded p-2 text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)] disabled:opacity-50"><Download size={15} /></button></div></td>
                  </tr>)}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-[var(--border)] px-4 py-3 text-xs text-[var(--muted)]"><span>{meta.total ? `${(page - 1) * PAGE_SIZE + 1}-${Math.min(page * PAGE_SIZE, meta.total)} of ${meta.total}` : '0 invoices'}</span><div className="flex gap-1"><button type="button" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded border border-[var(--border)] p-1.5 disabled:opacity-40" aria-label="Previous page"><ChevronLeft size={15} /></button><button type="button" disabled={page >= meta.totalPages} onClick={() => setPage((value) => Math.min(meta.totalPages, value + 1))} className="rounded border border-[var(--border)] p-1.5 disabled:opacity-40" aria-label="Next page"><ChevronRight size={15} /></button></div></div>
      </section>
    </div>
  );
}

export default function SuperAdminInvoicesPage() {
  return <Suspense fallback={<div className="py-16 text-center text-sm text-[var(--muted)]">Loading invoice explorer…</div>}><SuperAdminInvoiceExplorer /></Suspense>;
}