'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Activity, ArrowDownRight, ArrowUpRight, Download, Receipt, Search, Wallet } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useAuth } from '@/src/auth/AuthProvider';
import { ClientPortalApiError, downloadPortalInvoice, getPortalDashboard, listPortalInvoices, type PortalDashboardSummary, type PortalInvoice, type PortalListFilters } from '@/src/lib/api/client-portal';

const inputClass = 'mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2.5 text-[13px] text-[var(--foreground)] outline-none focus:border-[var(--primary)]';
const chartTooltipStyle = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--foreground)', fontSize: 11 };

function statusStyle(status: string) {
  if (status === 'PAID') return 'bg-emerald-500/10 text-emerald-700';
  if (status === 'OVERDUE') return 'bg-rose-500/10 text-rose-700';
  if (status === 'PARTIALLY_PAID') return 'bg-amber-500/10 text-amber-700';
  return 'bg-sky-500/10 text-sky-700';
}

function dateLabel(value: string) {
  return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function money(value: number, currency: string) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);
}

export default function ClientInvoicesPage() {
  const router = useRouter();
  const { user, loading: authLoading, accessToken, permissions } = useAuth();
  const isPortalAdmin = user?.role.isCompanyAdmin ?? false;
  const [invoices, setInvoices] = useState<PortalInvoice[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<PortalListFilters>({ search: '', status: '', dateFrom: '', dateTo: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<PortalDashboardSummary | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [period, setPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [year, setYear] = useState(new Date().getFullYear());
  const [currency, setCurrency] = useState('');

  useEffect(() => {
    if (authLoading) return;
    if (!user) router.replace('/login');
    else if (!user.role.isClientUser && !user.role.isCompanyAdmin) router.replace(user.role.isSuperAdmin ? '/super-admin/dashboard' : '/company/dashboard');
    else if (!isPortalAdmin && !permissions.includes('clientportal.invoices.view')) router.replace('/client-portal');
  }, [authLoading, isPortalAdmin, permissions, router, user]);

  const loadInvoices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listPortalInvoices(page, accessToken, filters);
      setInvoices(result.items);
      setTotal(result.total);
      setTotalPages(result.totalPages);
    } catch (loadError) {
      setError(loadError instanceof ClientPortalApiError ? loadError.message : 'Could not load invoices.');
    } finally {
      setLoading(false);
    }
  }, [accessToken, filters, page]);

  const loadAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    setAnalyticsError(null);
    try {
      setAnalytics(await getPortalDashboard(accessToken, period, year));
    } catch (loadError) {
      setAnalyticsError(loadError instanceof Error ? loadError.message : 'Could not load invoice analytics.');
    } finally {
      setAnalyticsLoading(false);
    }
  }, [accessToken, period, year]);

  useEffect(() => {
    if (authLoading || (!user?.role.isClientUser && !isPortalAdmin) || (!isPortalAdmin && !permissions.includes('clientportal.invoices.view'))) return;
    const timer = window.setTimeout(() => { void loadInvoices(); }, 250);
    return () => window.clearTimeout(timer);
  }, [authLoading, isPortalAdmin, loadInvoices, permissions, user]);

  useEffect(() => {
    if (authLoading || (!user?.role.isClientUser && !isPortalAdmin) || (!isPortalAdmin && !permissions.includes('clientportal.invoices.view'))) return;
    const timer = window.setTimeout(() => { void loadAnalytics(); }, 0);
    return () => window.clearTimeout(timer);
  }, [authLoading, isPortalAdmin, loadAnalytics, permissions, user]);

  const updateFilter = (key: keyof PortalListFilters, value: string) => {
    setPage(1);
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const download = async (invoice: PortalInvoice) => {
    setDownloadingId(invoice.id);
    setError(null);
    try {
      const blob = await downloadPortalInvoice(invoice.id, accessToken);
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = `${invoice.invoiceNumber}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (downloadError) {
      setError(downloadError instanceof ClientPortalApiError ? downloadError.message : 'Could not download this invoice.');
    } finally {
      setDownloadingId(null);
    }
  };

  const currencyOptions = analytics?.invoiceAnalytics.map((item) => item.currency) ?? [];
  const activeCurrency = currencyOptions.includes(currency) ? currency : currencyOptions[0] || 'INR';
  const selectedAnalytics = analytics?.invoiceAnalytics.find((item) => item.currency === activeCurrency);
  const chartData = analytics?.financialActivity.map((item) => ({
    label: item.label,
    invoiced: item.currencies.find((itemCurrency) => itemCurrency.currency === activeCurrency)?.invoiced ?? 0,
    paid: item.currencies.find((itemCurrency) => itemCurrency.currency === activeCurrency)?.paid ?? 0,
  })) ?? [];
  const formatMoney = (value: number) => new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: activeCurrency,
    maximumFractionDigits: 0,
  }).format(value);
  const activityEvents = invoices.flatMap((invoice) => [
    { id: `issued:${invoice.id}`, invoiceNumber: invoice.invoiceNumber, title: 'Invoice issued', detail: `${money(invoice.total, invoice.currency)} · ${invoice.status.replaceAll('_', ' ')}`, date: invoice.invoiceDate },
    ...invoice.payments.map((payment) => ({
      id: `payment:${payment.id}`,
      invoiceNumber: invoice.invoiceNumber,
      title: 'Payment received',
      detail: `${money(payment.amount, invoice.currency)}${payment.method ? ` · ${payment.method.replaceAll('_', ' ')}` : ''}`,
      date: payment.paymentDate,
    })),
    ...invoice.activity.map((item) => ({
      id: item.id,
      invoiceNumber: invoice.invoiceNumber,
      title: item.action.replaceAll('_', ' '),
      detail: 'Invoice status or document update',
      date: item.createdAt,
    })),
  ]).sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime());

  if (authLoading || (!user?.role.isClientUser && !isPortalAdmin) || (!isPortalAdmin && !permissions.includes('clientportal.invoices.view'))) {
    return <div className="flex min-h-[50vh] items-center justify-center text-sm text-[var(--muted)]">Loading invoices…</div>;
  }

  return (
    <div className="space-y-5">
      <section>
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--primary)]">Billing workspace</p>
        <h2 className="mt-1 text-2xl font-semibold">Invoices</h2>
        <p className="mt-1 text-[12px] text-[var(--muted)]">View issued invoices, payment progress, and download invoice PDFs for {user?.client?.name || 'your organization'}.</p>
      </section>

      <section aria-label="Invoice analytics" className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-700"><Wallet size={18} /></span>
            <div><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--primary)]">Financial overview</p><h3 className="mt-0.5 text-[14px] font-semibold">Invoice analytics</h3></div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {currencyOptions.length > 1 && <select aria-label="Analytics currency" value={activeCurrency} onChange={(event) => setCurrency(event.target.value)} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-2 text-[10px] font-semibold">{currencyOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select>}
            <select aria-label="Analytics time grouping" value={period} onChange={(event) => setPeriod(event.target.value as 'monthly' | 'yearly')} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-2 text-[10px] font-semibold"><option value="monthly">Monthly</option><option value="yearly">Yearly</option></select>
            <select aria-label="Analytics year" value={year} onChange={(event) => setYear(Number(event.target.value))} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-2 text-[10px] font-semibold">
              {Array.from({ length: 6 }, (_, index) => new Date().getFullYear() - index).map((option) => <option key={option} value={option}>{period === 'yearly' ? `Through ${option}` : option}</option>)}
            </select>
          </div>
        </div>
        {analyticsError && <p role="alert" className="border-b border-rose-500/15 bg-rose-500/5 px-5 py-3 text-[11px] text-rose-700">{analyticsError}<button type="button" onClick={() => void loadAnalytics()} className="ml-2 font-semibold underline">Retry</button></p>}
        {analyticsLoading && !analytics
          ? <p className="px-5 py-12 text-center text-[11px] text-[var(--muted)]">Loading invoice analytics…</p>
          : !selectedAnalytics
            ? <div className="px-5 py-12 text-center"><Receipt size={22} className="mx-auto text-[var(--muted)]" /><p className="mt-3 text-[12px] font-medium">No invoice analytics yet</p><p className="mt-1 text-[10px] text-[var(--muted)]">Issued invoices and payment activity will be summarized here.</p></div>
            : <div className="space-y-4 p-5 sm:p-6">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  { label: 'Total invoiced', value: formatMoney(selectedAnalytics.totalInvoiced), detail: `${selectedAnalytics.invoices} invoices issued`, icon: ArrowUpRight, color: 'text-slate-700', bg: 'bg-slate-500/10' },
                  { label: 'Payments received', value: formatMoney(selectedAnalytics.totalPaid), detail: 'All recorded payments', icon: ArrowDownRight, color: 'text-emerald-700', bg: 'bg-emerald-500/10' },
                  { label: 'Outstanding balance', value: formatMoney(selectedAnalytics.outstanding), detail: 'Balance remaining', icon: Wallet, color: 'text-amber-700', bg: 'bg-amber-500/10' },
                  { label: 'Overdue balance', value: formatMoney(selectedAnalytics.overdue), detail: `${selectedAnalytics.overdueInvoices} overdue invoices`, icon: Activity, color: 'text-rose-700', bg: 'bg-rose-500/10' },
                ].map(({ label, value, detail, icon: Icon, color, bg }) => <article key={label} className="rounded-xl border border-[var(--border)] p-4">
                  <div className="flex items-center justify-between"><p className="text-[10px] font-medium text-[var(--muted)]">{label}</p><span className={`flex h-8 w-8 items-center justify-center rounded-lg ${bg} ${color}`}><Icon size={15} /></span></div>
                  <p className={`mt-3 truncate text-xl font-semibold tabular-nums ${color}`}>{value}</p><p className="mt-1 text-[10px] text-[var(--muted)]">{detail}</p>
                </article>)}
              </div>
              <div>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><h4 className="text-[11px] font-semibold">Billed vs. payments received</h4><span className="text-[9px] text-[var(--muted)]">{period === 'monthly' ? `Monthly · ${year}` : `Yearly · ${year - 4}–${year}`} · {activeCurrency}</span></div>
                <div className="h-[250px] w-full" role="img" aria-label={`Invoice totals and payments by ${period === 'monthly' ? 'month' : 'year'}`}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 8, right: 12, left: -14, bottom: 0 }}>
                      <defs>
                        <linearGradient id="invoicePageBilled" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6686F2" stopOpacity={0.3} /><stop offset="100%" stopColor="#6686F2" stopOpacity={0.02} /></linearGradient>
                        <linearGradient id="invoicePagePaid" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10A98A" stopOpacity={0.3} /><stop offset="100%" stopColor="#10A98A" stopOpacity={0.02} /></linearGradient>
                      </defs>
                      <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: 'var(--muted)', fontSize: 10 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--muted)', fontSize: 10 }} />
                      <Tooltip formatter={(value) => formatMoney(Number(value ?? 0))} contentStyle={chartTooltipStyle} />
                      <Legend verticalAlign="bottom" height={24} wrapperStyle={{ fontSize: 10, color: 'var(--muted)' }} />
                      <Area type="monotone" dataKey="invoiced" name="Invoiced" stroke="#6686F2" strokeWidth={2} fill="url(#invoicePageBilled)" />
                      <Area type="monotone" dataKey="paid" name="Payments received" stroke="#10A98A" strokeWidth={2} fill="url(#invoicePagePaid)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>}
      </section>

      {error && <p role="alert" className="rounded-lg border border-rose-500/20 bg-rose-500/5 px-4 py-3 text-[12px] text-rose-700">{error}</p>}

      <section aria-label="Invoice filters" className="grid gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="relative block text-[10px] font-medium text-[var(--muted)]">Search invoice
          <Search size={14} className="absolute left-3 top-[31px] text-[var(--muted)]" />
          <input value={filters.search || ''} onChange={(event) => updateFilter('search', event.target.value)} placeholder="Invoice or PO number" className={`${inputClass} pl-9`} />
        </label>
        <label className="block text-[10px] font-medium text-[var(--muted)]">Payment status
          <select value={filters.status || ''} onChange={(event) => updateFilter('status', event.target.value)} className={inputClass}>
            <option value="">All statuses</option>
            {['SENT', 'PARTIALLY_PAID', 'PAID', 'OVERDUE'].map((status) => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}
          </select>
        </label>
        <label className="block text-[10px] font-medium text-[var(--muted)]">Invoice date from
          <input type="date" value={filters.dateFrom || ''} max={filters.dateTo || undefined} onChange={(event) => updateFilter('dateFrom', event.target.value)} className={inputClass} />
        </label>
        <label className="block text-[10px] font-medium text-[var(--muted)]">Invoice date to
          <input type="date" value={filters.dateTo || ''} min={filters.dateFrom || undefined} onChange={(event) => updateFilter('dateTo', event.target.value)} className={inputClass} />
        </label>
      </section>

      <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--primary)]/10 text-[var(--primary)]"><Receipt size={17} /></span><div><h3 className="text-[14px] font-semibold">Invoice register</h3><p className="mt-0.5 text-[11px] text-[var(--muted)]">{total.toLocaleString()} issued invoice{total === 1 ? '' : 's'}</p></div></div>
          <span className="hidden rounded-full bg-[var(--surface-muted)] px-2.5 py-1 text-[10px] text-[var(--muted)] sm:inline-flex">20 per page</span>
        </div>
        {loading ? <p className="px-5 py-12 text-center text-[12px] text-[var(--muted)]">Loading invoices…</p>
          : invoices.length === 0 ? <div className="px-5 py-12 text-center"><Receipt size={22} className="mx-auto text-[var(--muted)]" /><p className="mt-3 text-[13px] font-medium">No invoices found</p><p className="mt-1 text-[11px] text-[var(--muted)]">Try changing or clearing the selected filters.</p></div>
            : <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left text-[12px]">
              <thead className="bg-[var(--surface-muted)]/60 text-[10px] uppercase tracking-wide text-[var(--muted)]"><tr><th className="px-5 py-3">Invoice</th><th className="px-5 py-3">Invoice date</th><th className="px-5 py-3">Due date</th><th className="px-5 py-3">Status</th><th className="px-5 py-3 text-right">Total</th><th className="px-5 py-3 text-right">Paid</th><th className="px-5 py-3 text-right">Balance</th><th className="px-5 py-3 text-right">Document</th></tr></thead>
              <tbody className="divide-y divide-[var(--border)]">{invoices.map((invoice) => <tr key={invoice.id}>
                <td className="px-5 py-3.5 font-semibold">{invoice.invoiceNumber}</td>
                <td className="px-5 py-3.5">{dateLabel(invoice.invoiceDate)}</td>
                <td className="px-5 py-3.5">{dateLabel(invoice.dueDate)}</td>
                <td className="px-5 py-3.5"><span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold ${statusStyle(invoice.status)}`}>{invoice.status.replaceAll('_', ' ')}</span></td>
                <td className="px-5 py-3.5 text-right tabular-nums">{money(invoice.total, invoice.currency)}</td>
                <td className="px-5 py-3.5 text-right tabular-nums">{money(invoice.amountPaid, invoice.currency)}</td>
                <td className="px-5 py-3.5 text-right font-medium tabular-nums">{money(invoice.balanceDue, invoice.currency)}</td>
                <td className="px-5 py-3.5 text-right"><button type="button" disabled={downloadingId === invoice.id} onClick={() => void download(invoice)} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-[11px] font-medium hover:bg-[var(--surface-muted)] disabled:opacity-50"><Download size={13} />{downloadingId === invoice.id ? 'Preparing…' : 'PDF'}</button></td>
              </tr>)}</tbody>
            </table></div>}
        <div className="flex flex-col items-center justify-between gap-3 border-t border-[var(--border)] px-5 py-3 text-[11px] text-[var(--muted)] sm:flex-row">
          <span>{total === 0 ? '0 invoices' : `${(page - 1) * 20 + 1}–${Math.min(page * 20, total)} of ${total} invoices`} · 20 per page</span>
          <div className="flex items-center gap-2"><span>Page {page} of {Math.max(1, totalPages)}</span><button type="button" disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)} className="rounded-md border border-[var(--border)] px-3 py-1.5 disabled:opacity-40">Previous</button><button type="button" disabled={page >= totalPages || loading} onClick={() => setPage((value) => value + 1)} className="rounded-md border border-[var(--border)] px-3 py-1.5 disabled:opacity-40">Next</button></div>
        </div>
      </section>

      <section aria-label="Invoice activity history" className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-5 py-4">
          <div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-500/10 text-sky-700"><Activity size={17} /></span><div><h3 className="text-[14px] font-semibold">Invoice activity</h3><p className="mt-0.5 text-[11px] text-[var(--muted)]">Issue, payment, and invoice updates for the invoices on this page.</p></div></div>
          <span className="rounded-full bg-[var(--surface-muted)] px-2.5 py-1 text-[10px] text-[var(--muted)]">{activityEvents.length} events</span>
        </div>
        {loading ? <p className="px-5 py-8 text-center text-[11px] text-[var(--muted)]">Loading invoice activity…</p>
          : activityEvents.length === 0
            ? <p className="px-5 py-8 text-center text-[11px] text-[var(--muted)]">No invoice activity matches the selected filters.</p>
            : <div className="max-h-[520px] divide-y divide-[var(--border)] overflow-y-auto">
              {activityEvents.map((event) => <article key={event.id} className="flex items-start gap-3 px-5 py-3.5">
                <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-muted)] text-[var(--primary)]"><Receipt size={13} /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1"><p className="text-[11px] font-semibold capitalize">{event.title}</p><span className="font-mono text-[10px] text-[var(--primary)]">{event.invoiceNumber}</span></div>
                  <p className="mt-0.5 text-[10px] text-[var(--muted)]">{event.detail}</p>
                </div>
                <time className="shrink-0 text-[9px] text-[var(--muted)]">{dateLabel(event.date)}</time>
              </article>)}
            </div>}
      </section>
    </div>
  );
}
