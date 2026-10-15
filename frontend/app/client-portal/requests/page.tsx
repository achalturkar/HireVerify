'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { AlertCircle, ArrowRight, CheckCircle2, Clock3, LoaderCircle, MessageSquareText, Plus, Send } from 'lucide-react';
import { useAuth } from '@/src/auth/AuthProvider';
import {
  ClientPortalApiError,
  createClientRequest,
  listClientRequests,
  type ClientRequest,
  type ClientRequestCategory,
  type ClientRequestStatus,
} from '@/src/lib/api/client-portal';

const categories: { value: ClientRequestCategory; label: string }[] = [
  { value: 'ACCOUNT', label: 'Account and access' },
  { value: 'CANDIDATE', label: 'Candidate information' },
  { value: 'CASE', label: 'BGV case' },
  { value: 'REPORT', label: 'Report' },
  { value: 'INVOICE', label: 'Invoice or payment' },
  { value: 'TECHNICAL_SUPPORT', label: 'Technical support' },
  { value: 'OTHER', label: 'Other' },
];

const statusStyles: Record<ClientRequestStatus, string> = {
  OPEN: 'bg-amber-500/10 text-amber-700',
  IN_PROGRESS: 'bg-blue-500/10 text-blue-700',
  RESOLVED: 'bg-emerald-500/10 text-emerald-700',
  CLOSED: 'bg-[var(--surface-muted)] text-[var(--muted)]',
};

const dateText = (value: string) => new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
}).format(new Date(value));

export default function ClientRequestsPage() {
  const { accessToken } = useAuth();
  const [items, setItems] = useState<ClientRequest[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [category, setCategory] = useState<ClientRequestCategory>('OTHER');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadRequests = useCallback(async () => {
    try {
      const result = await listClientRequests(accessToken, { page });
      setLoadError(null);
      setItems(result.items);
      setTotalPages(result.meta.totalPages || 1);
    } catch (error) {
      setLoadError(error instanceof ClientPortalApiError ? error.message : 'Could not load your requests.');
    } finally {
      setLoading(false);
    }
  }, [accessToken, page]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadRequests(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadRequests]);

  const submitRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setFormError(null);
    setNotice(null);
    try {
      await createClientRequest({ category, subject: subject.trim(), description: description.trim() }, accessToken);
      setSubject('');
      setDescription('');
      setCategory('OTHER');
      setFormOpen(false);
      setPage(1);
      setNotice('Your request was sent to the support team.');
      if (page === 1) await loadRequests();
    } catch (error) {
      setFormError(error instanceof ClientPortalApiError ? error.message : 'Could not submit your request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
        <div className="flex flex-col gap-5 bg-gradient-to-br from-[var(--primary)]/10 via-[var(--surface)] to-[var(--surface)] p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div className="max-w-2xl">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--primary)]/15 text-[var(--primary)]"><MessageSquareText size={21} /></div>
            <h2 className="mt-4 text-2xl font-semibold tracking-tight">How can we help?</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Send a request to your account team and follow its progress here. Replies from the team will appear with your request.</p>
          </div>
          <button type="button" onClick={() => { setFormOpen((value) => !value); setFormError(null); }} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-[var(--primary-foreground)] shadow-sm hover:opacity-90">
            {formOpen ? <ArrowRight size={16} className="rotate-180" /> : <Plus size={17} />}{formOpen ? 'Back to requests' : 'New request'}
          </button>
        </div>
      </section>

      {notice && <div role="status" className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-700"><CheckCircle2 size={17} />{notice}</div>}

      {formOpen && (
        <form onSubmit={submitRequest} className="space-y-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-7">
          <div>
            <h3 className="text-lg font-semibold">Create a request</h3>
            <p className="mt-1 text-sm text-[var(--muted)]">Share enough detail so the team can help without needing to chase you for information.</p>
          </div>
          {formError && <div role="alert" className="flex items-start gap-2 rounded-lg bg-rose-500/10 p-3 text-sm text-rose-700"><AlertCircle size={17} className="mt-0.5 shrink-0" />{formError}</div>}
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5 text-sm font-medium">Request type
              <select value={category} onChange={(event) => setCategory(event.target.value as ClientRequestCategory)} className="block w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-sm font-normal">
                {categories.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </label>
            <label className="space-y-1.5 text-sm font-medium">Subject
              <input required minLength={3} maxLength={180} value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="A short summary of what you need" className="block w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-sm font-normal" />
            </label>
          </div>
          <label className="block space-y-1.5 text-sm font-medium">Details
            <textarea required minLength={10} maxLength={5000} rows={5} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Describe the issue or information you need. Please do not include passwords or sensitive identity numbers." className="block w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-sm font-normal" />
            <span className="block text-right text-xs font-normal text-[var(--muted)]">{description.length}/5000</span>
          </label>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setFormOpen(false)} disabled={submitting} className="rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm font-medium hover:bg-[var(--surface-muted)]">Cancel</button>
            <button type="submit" disabled={submitting} className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-[var(--primary-foreground)] disabled:opacity-60"><Send size={15} />{submitting ? 'Sending…' : 'Send request'}</button>
          </div>
        </form>
      )}

      <section className="space-y-3">
        <div className="flex items-end justify-between">
          <div><h3 className="text-lg font-semibold">Your requests</h3><p className="mt-1 text-sm text-[var(--muted)]">Updates and replies from your account team.</p></div>
          {totalPages > 1 && <span className="text-xs text-[var(--muted)]">Page {page} of {totalPages}</span>}
        </div>
        {loadError && <div role="alert" className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4 text-sm text-rose-700">{loadError}<button type="button" onClick={() => void loadRequests()} className="ml-2 font-semibold underline">Try again</button></div>}
        {loading ? <div className="flex items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-10 text-sm text-[var(--muted)]"><LoaderCircle size={17} className="animate-spin" />Loading requests…</div>
          : !loadError && items.length === 0 ? <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] p-10 text-center"><MessageSquareText size={24} className="mx-auto text-[var(--muted)]" /><p className="mt-3 font-medium">No requests yet</p><p className="mt-1 text-sm text-[var(--muted)]">When you need help, create a request and track it here.</p></div>
            : <div className="space-y-3">{items.map((item) => (
              <article key={item.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="text-xs font-medium text-[var(--muted)]">{categories.find((categoryItem) => categoryItem.value === item.category)?.label || item.category}</span><span className="text-[var(--muted)]">·</span><time className="text-xs text-[var(--muted)]">{dateText(item.createdAt)}</time></div><h4 className="mt-2 font-semibold">{item.subject}</h4></div>
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyles[item.status]}`}><Clock3 size={13} />{item.status.replaceAll('_', ' ')}</span>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[var(--muted)]">{item.description}</p>
                {item.adminResponse && <div className="mt-4 rounded-lg border-l-2 border-[var(--primary)] bg-[var(--surface-muted)] px-4 py-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-semibold text-[var(--foreground)]">Reply from {item.respondedBy ? `${item.respondedBy.firstName} ${item.respondedBy.lastName}` : 'your account team'}</p>{item.respondedAt && <time className="text-xs text-[var(--muted)]">{dateText(item.respondedAt)}</time>}</div><p className="mt-2 whitespace-pre-wrap text-sm leading-6">{item.adminResponse}</p></div>}
              </article>
            ))}</div>}
        {!loading && totalPages > 1 && <div className="flex justify-end gap-2"><button type="button" disabled={page <= 1} onClick={() => { setLoading(true); setPage((current) => current - 1); }} className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm disabled:opacity-40">Previous</button><button type="button" disabled={page >= totalPages} onClick={() => { setLoading(true); setPage((current) => current + 1); }} className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm disabled:opacity-40">Next</button></div>}
      </section>
    </div>
  );
}
