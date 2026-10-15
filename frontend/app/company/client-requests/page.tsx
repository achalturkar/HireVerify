'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { AlertCircle, CheckCircle2, Clock3, LoaderCircle, MessageSquareText, RefreshCw, Search, Send } from 'lucide-react';
import { useAuth } from '@/src/auth/AuthProvider';
import {
  ClientPortalApiError,
  listClientRequests,
  updateClientRequest,
  type ClientRequest,
  type ClientRequestStatus,
} from '@/src/lib/api/client-portal';

const statuses: ClientRequestStatus[] = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
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
const humanize = (value: string) => value.replaceAll('_', ' ').toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase());

export default function CompanyClientRequestsPage() {
  const { accessToken } = useAuth();
  const [items, setItems] = useState<ClientRequest[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusDraft, setStatusDraft] = useState<ClientRequestStatus>('OPEN');
  const [responseDraft, setResponseDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const selected = items.find((item) => item.id === selectedId) ?? null;
  const selectedIdRef = useRef<string | null>(null);

  const loadRequests = useCallback(async () => {
    try {
      const result = await listClientRequests(accessToken, {
        page,
        status: statusFilter,
        search,
      });
      setError(null);
      setItems(result.items);
      setTotalPages(result.meta.totalPages || 1);
      const selectedStillExists = result.items.some((item) => item.id === selectedIdRef.current);
      if (!selectedStillExists) {
        const first = result.items[0] ?? null;
        selectedIdRef.current = first?.id ?? null;
        setSelectedId(first?.id ?? null);
        setStatusDraft(first?.status ?? 'OPEN');
        setResponseDraft(first?.adminResponse ?? '');
      }
    } catch (fetchError) {
      setError(fetchError instanceof ClientPortalApiError ? fetchError.message : 'Could not load client requests.');
    } finally {
      setLoading(false);
    }
  }, [accessToken, page, search, statusFilter]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadRequests(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadRequests]);

  const selectRequest = (item: ClientRequest) => {
    selectedIdRef.current = item.id;
    setSelectedId(item.id);
    setStatusDraft(item.status);
    setResponseDraft(item.adminResponse ?? '');
    setNotice(null);
  };

  const applySearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setPage(1);
    setSearch(searchInput.trim());
  };

  const saveChanges = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const payload: { status?: ClientRequestStatus; adminResponse?: string } = { status: statusDraft };
      const normalizedResponse = responseDraft.trim();
      if (normalizedResponse && normalizedResponse !== (selected.adminResponse ?? '')) {
        payload.adminResponse = normalizedResponse;
      }
      const updated = await updateClientRequest(selected.id, payload, accessToken);
      setItems((current) => current.map((item) => item.id === updated.id ? updated : item));
      setResponseDraft(updated.adminResponse ?? '');
      setNotice('Request updated. The client can now see the latest status and reply.');
      void loadRequests();
    } catch (saveError) {
      setError(saveError instanceof ClientPortalApiError ? saveError.message : 'Could not update this request.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><div className="flex items-center gap-2 text-[var(--primary)]"><MessageSquareText size={19} /><span className="text-xs font-semibold uppercase tracking-wider">Client support</span></div><h1 className="mt-2 text-2xl font-semibold tracking-tight">Client requests</h1><p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">Review requests from your clients, update progress, and send replies directly to their portal.</p></div>
        <button type="button" onClick={() => { setLoading(true); void loadRequests(); }} className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-medium hover:bg-[var(--surface-muted)]"><RefreshCw size={15} />Refresh</button>
      </header>

      {error && <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-500/20 bg-rose-500/5 p-3 text-sm text-rose-700"><AlertCircle size={17} className="mt-0.5 shrink-0" />{error}</div>}
      {notice && <div role="status" className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-sm text-emerald-700"><CheckCircle2 size={17} />{notice}</div>}

      <form onSubmit={applySearch} className="flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 sm:flex-row">
        <label className="relative flex-1"><span className="sr-only">Search client requests</span><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" /><input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search subject, details, client, or submitter" className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] py-2.5 pl-9 pr-3 text-sm" /></label>
        <select aria-label="Filter by status" value={statusFilter} onChange={(event) => { setLoading(true); setStatusFilter(event.target.value); setPage(1); }} className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-sm"><option value="">All statuses</option>{statuses.map((status) => <option key={status} value={status}>{humanize(status)}</option>)}</select>
        <button type="submit" className="rounded-lg bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-[var(--primary-foreground)]">Search</button>
      </form>

      <div className="grid min-h-[520px] gap-4 lg:grid-cols-[minmax(300px,0.85fr)_minmax(0,1.5fr)]">
        <section className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3"><div><h2 className="text-sm font-semibold">Inbox</h2><p className="text-xs text-[var(--muted)]">Page {page} of {totalPages}</p></div><span className="rounded-full bg-[var(--surface-muted)] px-2.5 py-1 text-xs font-semibold">{items.length} shown</span></div>
          {loading ? <div className="flex items-center justify-center gap-2 p-10 text-sm text-[var(--muted)]"><LoaderCircle size={17} className="animate-spin" />Loading…</div>
            : items.length === 0 ? <div className="p-8 text-center"><MessageSquareText size={23} className="mx-auto text-[var(--muted)]" /><p className="mt-3 text-sm font-medium">No requests found</p><p className="mt-1 text-xs text-[var(--muted)]">New client submissions will appear here.</p></div>
              : <ul className="divide-y divide-[var(--border)]">{items.map((item) => (
                <li key={item.id}><button type="button" onClick={() => selectRequest(item)} aria-current={item.id === selectedId ? 'true' : undefined} className={`w-full border-l-2 p-4 text-left transition-colors ${item.id === selectedId ? 'border-[var(--primary)] bg-[var(--primary)]/5' : 'border-transparent hover:bg-[var(--surface-muted)]'}`}>
                  <div className="flex items-start justify-between gap-2"><span className="truncate text-sm font-semibold">{item.subject}</span><span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusStyles[item.status]}`}>{humanize(item.status)}</span></div>
                  <p className="mt-1 truncate text-xs text-[var(--muted)]">{item.client.name} · {item.submittedBy ? `${item.submittedBy.firstName} ${item.submittedBy.lastName}` : 'Client user'}</p>
                  <p className="mt-2 line-clamp-2 text-xs leading-5 text-[var(--muted)]">{item.description}</p>
                  <time className="mt-2 block text-[10px] text-[var(--muted)]">{dateText(item.createdAt)}</time>
                </button></li>
              ))}</ul>}
          <div className="flex justify-between border-t border-[var(--border)] p-3"><button type="button" disabled={page <= 1 || loading} onClick={() => { setLoading(true); setPage((current) => current - 1); }} className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs disabled:opacity-40">Previous</button><button type="button" disabled={page >= totalPages || loading} onClick={() => { setLoading(true); setPage((current) => current + 1); }} className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs disabled:opacity-40">Next</button></div>
        </section>

        <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)]">
          {!selected ? <div className="flex h-full min-h-80 flex-col items-center justify-center p-8 text-center"><MessageSquareText size={26} className="text-[var(--muted)]" /><p className="mt-3 font-medium">Select a request</p><p className="mt-1 text-sm text-[var(--muted)]">Choose a client request from the inbox to review and respond.</p></div>
            : <div className="p-5 sm:p-7">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border)] pb-5"><div><div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]"><span>{humanize(selected.category)}</span><span>·</span><span>{selected.client.name}</span></div><h2 className="mt-2 text-xl font-semibold">{selected.subject}</h2><p className="mt-1 text-xs text-[var(--muted)]">Submitted by {selected.submittedBy ? `${selected.submittedBy.firstName} ${selected.submittedBy.lastName} (${selected.submittedBy.email})` : 'Client user'} · {dateText(selected.createdAt)}</p></div><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyles[selected.status]}`}><Clock3 size={13} />{humanize(selected.status)}</span></div>
              <div className="my-5 whitespace-pre-wrap text-sm leading-7">{selected.description}</div>
              {selected.adminResponse && <div className="mb-5 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-4"><p className="text-xs font-semibold">Previous reply{selected.respondedBy ? ` · ${selected.respondedBy.firstName} ${selected.respondedBy.lastName}` : ''}</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6">{selected.adminResponse}</p>{selected.respondedAt && <time className="mt-2 block text-xs text-[var(--muted)]">{dateText(selected.respondedAt)}</time>}</div>}
              <form onSubmit={saveChanges} className="space-y-4 border-t border-[var(--border)] pt-5">
                <label className="block space-y-1.5 text-sm font-medium">Update status<select value={statusDraft} onChange={(event) => setStatusDraft(event.target.value as ClientRequestStatus)} className="block w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-sm">{statuses.map((status) => <option key={status} value={status}>{humanize(status)}</option>)}</select></label>
                <label className="block space-y-1.5 text-sm font-medium">Reply to client<textarea rows={5} maxLength={5000} value={responseDraft} onChange={(event) => setResponseDraft(event.target.value)} placeholder="Write an update or answer that the client can see in their portal…" className="block w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-sm font-normal" /><span className="block text-right text-xs font-normal text-[var(--muted)]">{responseDraft.length}/5000</span></label>
                <div className="flex justify-end"><button type="submit" disabled={saving || (statusDraft === selected.status && responseDraft.trim() === (selected.adminResponse ?? ''))} className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-[var(--primary-foreground)] disabled:opacity-50"><Send size={15} />{saving ? 'Saving…' : 'Save response'}</button></div>
              </form>
            </div>}
        </section>
      </div>
    </div>
  );
}
