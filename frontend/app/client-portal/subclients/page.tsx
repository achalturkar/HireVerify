'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Building2, ChevronDown, ChevronUp, KeyRound, Loader2, Pencil, Plus, Save, Search, SlidersHorizontal, UserPlus, Users, X } from 'lucide-react';
import { useAuth } from '@/src/auth/AuthProvider';
import { formatCandidateName } from '@/src/lib/candidate-name';
import { hasPortalPermission, inviteSubclientPortalUser, listPortalCandidates, listPortalSubclients, listSubclientPortalUsers, createPortalSubclient, updatePortalSubclient, updateSubclientPortalUser, type PortalCandidate, type PortalSubclient, type SubclientPortalUser } from '@/src/lib/api/client-portal';
import { listVerificationCheckTypes } from '@/src/lib/api/bgv';
import type { VerificationCheckType, VerificationType } from '@/src/types/bgv';

type Draft = {
  name: string;
  clientCode: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  supportEmail: string;
  supportPhone: string;
  status: PortalSubclient['status'];
  packageRate: string;
  selectedChecks: Record<string, boolean>;
};

const emptyDraft = (clientCode = ''): Draft => ({
  name: '',
  clientCode,
  contactName: '',
  contactEmail: '',
  contactPhone: '',
  supportEmail: '',
  supportPhone: '',
  status: 'ACTIVE',
  packageRate: '',
  selectedChecks: {},
});
const fieldClass = 'mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-[13px] text-[var(--foreground)] outline-none focus:border-[var(--primary)]';

export default function PortalSubclientsPage() {
  const { accessToken, permissions, user } = useAuth();
  const isPortalAdmin = user?.role.isCompanyAdmin ?? false;
  const canManage = hasPortalPermission(permissions, 'clientportal.subclients.manage', isPortalAdmin);
  const canViewCandidates = hasPortalPermission(permissions, 'clientportal.candidates.view', isPortalAdmin);
  const [items, setItems] = useState<PortalSubclient[]>([]);
  const [checkTypes, setCheckTypes] = useState<VerificationCheckType[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | PortalSubclient['status']>('ALL');
  const [activityFilter, setActivityFilter] = useState<'ALL' | 'CANDIDATES' | 'CASES' | 'NO_CASES'>('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [selectedSubclientId, setSelectedSubclientId] = useState<string | null>(null);
  const [subclientCandidates, setSubclientCandidates] = useState<PortalCandidate[]>([]);
  const [candidatePage, setCandidatePage] = useState(1);
  const [candidateTotal, setCandidateTotal] = useState(0);
  const [candidateTotalPages, setCandidateTotalPages] = useState(1);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [candidateError, setCandidateError] = useState<string | null>(null);
  const [portalAccountFor, setPortalAccountFor] = useState<PortalSubclient | null>(null);
  const [portalUsers, setPortalUsers] = useState<SubclientPortalUser[]>([]);
  const [portalUsersLoading, setPortalUsersLoading] = useState(false);
  const [portalUsersError, setPortalUsersError] = useState<string | null>(null);
  const [portalUserSaving, setPortalUserSaving] = useState(false);
  const [portalUserMessage, setPortalUserMessage] = useState<string | null>(null);
  const [portalAccountMethod, setPortalAccountMethod] = useState<'INVITATION' | 'PASSWORD'>('INVITATION');
  const [portalUserDraft, setPortalUserDraft] = useState({ firstName: '', lastName: '', email: '', password: '' });
  const filteredItems = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    return items.filter((item) => {
      const matchesSearch = !term || [
        item.name,
        item.clientCode,
        item.contactName,
        item.contactEmail,
        item.contactPhone,
      ].some((value) => value?.toLocaleLowerCase().includes(term));
      const matchesStatus = statusFilter === 'ALL' || item.status === statusFilter;
      const matchesActivity = activityFilter === 'ALL'
        || (activityFilter === 'CANDIDATES' && item.candidateCount > 0)
        || (activityFilter === 'CASES' && item.bgvCaseCount > 0)
        || (activityFilter === 'NO_CASES' && item.bgvCaseCount === 0);
      return matchesSearch && matchesStatus && matchesActivity;
    });
  }, [activityFilter, items, search, statusFilter]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [loadedSubclients, availableTypes] = await Promise.all([listPortalSubclients(accessToken), listVerificationCheckTypes(accessToken)]);
      setItems(loadedSubclients);
      setCheckTypes(availableTypes);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load subclients.');
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    if (!selectedSubclientId || !canViewCandidates) return;
    let active = true;
    const timer = window.setTimeout(() => {
      setCandidatesLoading(true);
      setCandidateError(null);
      void listPortalCandidates(candidatePage, accessToken, { subclientId: selectedSubclientId })
        .then((result) => {
          if (!active) return;
          setSubclientCandidates(result.items);
          setCandidateTotal(result.total);
          setCandidateTotalPages(result.totalPages);
        })
        .catch((cause: unknown) => {
          if (active) setCandidateError(cause instanceof Error ? cause.message : 'Could not load subclient candidates.');
        })
        .finally(() => {
          if (active) setCandidatesLoading(false);
        });
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [accessToken, candidatePage, canViewCandidates, selectedSubclientId]);

  const openCreate = () => {
    const prefix = user?.client?.clientCode || 'CLIENT';
    setEditingId(null);
    setEditorOpen(true);
    setDraft(emptyDraft(`${prefix}-SUB-${String(items.length + 1).padStart(3, '0')}`));
    setError(null);
    setMessage(null);
  };

  const openEdit = (item: PortalSubclient) => {
    setEditingId(item.id);
    setEditorOpen(true);
    setDraft({
      name: item.name,
      clientCode: item.clientCode,
      contactName: item.contactName || '',
      contactEmail: item.contactEmail || '',
      contactPhone: item.contactPhone || '',
      supportEmail: item.supportEmail || '',
      supportPhone: item.supportPhone || '',
      status: item.status,
      packageRate: item.packageRate === null ? '' : String(item.packageRate),
      selectedChecks: Object.fromEntries(item.serviceRates.map(({ checkType }) => [checkType, true])),
    });
    setError(null);
    setMessage(null);
  };

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    const serviceRates = Object.keys(draft.selectedChecks)
      .map((checkType) => ({ checkType: checkType as VerificationType, rate: 0 }));
    if (!serviceRates.length) {
      setError('Enable at least one check.');
      return;
    }
    const packageRate = Number(draft.packageRate);
    if (draft.packageRate === '' || !Number.isFinite(packageRate) || packageRate < 0 || packageRate > 100000000) {
      setError('Enter a valid package rate between ₹0 and ₹100,000,000.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: draft.name.trim(),
        clientCode: draft.clientCode.trim(),
        contactName: draft.contactName.trim() || null,
        contactEmail: draft.contactEmail.trim() || null,
        contactPhone: draft.contactPhone.trim() || null,
        supportEmail: draft.supportEmail.trim() || null,
        supportPhone: draft.supportPhone.trim() || null,
        packageRate,
        serviceRates,
      };
      if (editingId) await updatePortalSubclient(editingId, { ...payload, status: draft.status }, accessToken);
      else await createPortalSubclient(payload, accessToken);
      setEditingId(null);
      setEditorOpen(false);
      setDraft(emptyDraft());
      setMessage(editingId ? 'Subclient updated.' : 'Subclient added.');
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save subclient.');
    } finally {
      setSaving(false);
    }
  };

  const closeEditor = () => {
    if (saving) return;
    setEditingId(null);
    setEditorOpen(false);
    setDraft(emptyDraft());
    setError(null);
  };

  const openPortalAccounts = async (item: PortalSubclient) => {
    setPortalAccountFor(item);
    setPortalUsers([]);
    setPortalUsersError(null);
    setPortalUserMessage(null);
    setPortalUsersLoading(true);
    try {
      setPortalUsers(await listSubclientPortalUsers(item.id, accessToken));
    } catch (cause) {
      setPortalUsersError(cause instanceof Error ? cause.message : 'Could not load subclient portal accounts.');
    } finally {
      setPortalUsersLoading(false);
    }
  };

  const createPortalAccount = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!portalAccountFor) return;
    setPortalUserSaving(true);
    setPortalUsersError(null);
    setPortalUserMessage(null);
    try {
      await inviteSubclientPortalUser(portalAccountFor.id, {
        firstName: portalUserDraft.firstName.trim(),
        lastName: portalUserDraft.lastName.trim(),
        email: portalUserDraft.email.trim(),
        accountMethod: portalAccountMethod,
        ...(portalAccountMethod === 'PASSWORD' ? { password: portalUserDraft.password } : {}),
      }, accessToken);
      setPortalUserDraft({ firstName: '', lastName: '', email: '', password: '' });
      setPortalUserMessage(portalAccountMethod === 'INVITATION' ? 'Account created. A password setup invitation has been sent.' : 'Subclient portal account created.');
      setPortalUsers(await listSubclientPortalUsers(portalAccountFor.id, accessToken));
    } catch (cause) {
      setPortalUsersError(cause instanceof Error ? cause.message : 'Could not create portal account.');
    } finally {
      setPortalUserSaving(false);
    }
  };

  const togglePortalAccount = async (account: SubclientPortalUser) => {
    if (!portalAccountFor) return;
    setPortalUsersError(null);
    try {
      await updateSubclientPortalUser(portalAccountFor.id, account.id, account.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE', accessToken);
      setPortalUsers(await listSubclientPortalUsers(portalAccountFor.id, accessToken));
    } catch (cause) {
      setPortalUsersError(cause instanceof Error ? cause.message : 'Could not update the portal account.');
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--primary)]">Client workspace</p>
          <h1 className="mt-1 text-2xl font-semibold">Subclients</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">Manage subclient details, package checks, and one rate per candidate.</p>
        </div>
        {canManage && <button type="button" onClick={openCreate} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-[var(--primary-foreground)]"><Plus size={16} />Add subclient</button>}
      </header>

      {error && !editorOpen && <p role="alert" className="rounded-lg border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-700">{error}</p>}
      {message && <p role="status" className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700">{message}</p>}

      {!loading && items.length > 0 && <section aria-label="Filter subclients" className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold text-[var(--muted)]"><SlidersHorizontal size={14} />Find and filter subclients</div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(220px,1fr)_180px_200px_auto]">
          <label className="relative block">
            <span className="sr-only">Search subclients</span>
            <Search size={15} className="absolute left-3 top-3 text-[var(--muted)]" />
            <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, code, or contact" className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] py-2.5 pl-9 pr-3 text-[13px] text-[var(--foreground)] outline-none focus:border-[var(--primary)]" />
          </label>
          <label className="text-[10px] font-medium text-[var(--muted)]">Status
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)} className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-[13px] text-[var(--foreground)] outline-none focus:border-[var(--primary)]">
              <option value="ALL">All statuses</option><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option>
            </select>
          </label>
          <label className="text-[10px] font-medium text-[var(--muted)]">Activity
            <select value={activityFilter} onChange={(event) => setActivityFilter(event.target.value as typeof activityFilter)} className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-[13px] text-[var(--foreground)] outline-none focus:border-[var(--primary)]">
              <option value="ALL">All activity</option><option value="CANDIDATES">Has candidates</option><option value="CASES">Has BGV cases</option><option value="NO_CASES">No BGV cases</option>
            </select>
          </label>
          {(search || statusFilter !== 'ALL' || activityFilter !== 'ALL') && <button type="button" onClick={() => { setSearch(''); setStatusFilter('ALL'); setActivityFilter('ALL'); }} className="self-end rounded-lg border border-[var(--border)] px-3 py-2.5 text-xs font-semibold hover:bg-[var(--surface-muted)]">Clear filters</button>}
        </div>
        <p aria-live="polite" className="mt-3 text-[10px] text-[var(--muted)]">Showing {filteredItems.length} of {items.length} subclients</p>
      </section>}

      {editorOpen && canManage ? (
        <form onSubmit={(event) => void save(event)} className="space-y-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div><h2 className="text-base font-semibold">{editingId ? 'Edit subclient' : 'Add subclient'}</h2><p className="mt-1 text-xs text-[var(--muted)]">The package rate applies once per candidate for the selected checks.</p></div>
            <button type="button" onClick={closeEditor} disabled={saving} aria-label="Close subclient form" className="rounded-md p-2 text-[var(--muted)] hover:bg-[var(--surface-muted)] disabled:opacity-50"><X size={16} /></button>
          </div>
          {error && <p role="alert" className="rounded-lg border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-sm text-rose-700">{error}</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-medium text-[var(--muted)]">Subclient name<input required minLength={2} maxLength={255} value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} className={fieldClass} /></label>
            <label className="text-xs font-medium text-[var(--muted)]">Subclient code<input required minLength={2} maxLength={50} value={draft.clientCode} onChange={(event) => setDraft((current) => ({ ...current, clientCode: event.target.value.toUpperCase() }))} className={fieldClass} /></label>
            <label className="text-xs font-medium text-[var(--muted)]">Contact person<input maxLength={150} value={draft.contactName} onChange={(event) => setDraft((current) => ({ ...current, contactName: event.target.value }))} className={fieldClass} /></label>
            <label className="text-xs font-medium text-[var(--muted)]">Contact email<input type="email" maxLength={255} value={draft.contactEmail} onChange={(event) => setDraft((current) => ({ ...current, contactEmail: event.target.value }))} className={fieldClass} /></label>
            <label className="text-xs font-medium text-[var(--muted)]">Contact phone<input maxLength={50} value={draft.contactPhone} onChange={(event) => setDraft((current) => ({ ...current, contactPhone: event.target.value }))} className={fieldClass} /></label>
            <label className="text-xs font-medium text-[var(--muted)]">Candidate support email<input type="email" maxLength={255} value={draft.supportEmail} onChange={(event) => setDraft((current) => ({ ...current, supportEmail: event.target.value }))} className={fieldClass} /></label>
            <label className="text-xs font-medium text-[var(--muted)]">Candidate support mobile number<input type="tel" maxLength={50} value={draft.supportPhone} onChange={(event) => setDraft((current) => ({ ...current, supportPhone: event.target.value }))} className={fieldClass} /></label>
            {editingId && <label className="text-xs font-medium text-[var(--muted)]">Status<select value={draft.status} onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value as Draft['status'] }))} className={fieldClass}><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select></label>}
          </div>
          <fieldset>
            <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Package checks</legend>
            <p className="mb-3 text-xs text-[var(--muted)]">Select the checks included in this subclient package, then set one total rate per candidate.</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {checkTypes.map(({ type, label }) => {
                const enabled = Object.hasOwn(draft.selectedChecks, type);
                return <div key={type} className="flex items-center gap-3 rounded-lg border border-[var(--border)] p-3">
                  <label className="flex min-w-0 flex-1 items-center gap-2 text-sm"><input type="checkbox" checked={enabled} onChange={(event) => setDraft((current) => {
                    const selectedChecks = { ...current.selectedChecks };
                    if (event.target.checked) selectedChecks[type] = true;
                    else delete selectedChecks[type];
                    return { ...current, selectedChecks };
                  })} className="accent-[var(--primary)]" /><span className="truncate">{label}</span></label>
                </div>;
              })}
            </div>
          </fieldset>
          <label className="block max-w-sm text-xs font-medium text-[var(--muted)]">Package rate per candidate (INR)
            <input type="number" required min="0" max="100000000" step="0.01" value={draft.packageRate} onChange={(event) => setDraft((current) => ({ ...current, packageRate: event.target.value }))} className={fieldClass} />
          </label>
          <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-4">
            <button type="button" onClick={closeEditor} disabled={saving} className="rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm font-medium">Cancel</button>
            <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-[var(--primary-foreground)] disabled:opacity-50">{saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}{saving ? 'Saving…' : editingId ? 'Save changes' : 'Add subclient'}</button>
          </div>
        </form>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
        {loading ? <div className="flex items-center justify-center gap-2 px-5 py-14 text-sm text-[var(--muted)]"><Loader2 size={17} className="animate-spin" />Loading subclients…</div>
          : error && !items.length ? <p role="alert" className="px-5 py-10 text-center text-sm text-rose-700">{error}</p>
            : !items.length ? <div className="px-5 py-14 text-center"><Building2 size={25} className="mx-auto text-[var(--muted)]" /><h2 className="mt-3 text-sm font-semibold">No subclients yet</h2><p className="mt-1 text-xs text-[var(--muted)]">{canManage ? 'Add a subclient and configure its package checks and rate.' : 'Subclients for your client account will appear here.'}</p></div>
              : !filteredItems.length ? <div className="px-5 py-12 text-center"><Search size={23} className="mx-auto text-[var(--muted)]" /><h2 className="mt-3 text-sm font-semibold">No matching subclients</h2><p className="mt-1 text-xs text-[var(--muted)]">Adjust your search or filters and try again.</p><button type="button" onClick={() => { setSearch(''); setStatusFilter('ALL'); setActivityFilter('ALL'); }} className="mt-3 text-xs font-semibold text-[var(--primary)] hover:underline">Clear filters</button></div>
              : <div className="divide-y divide-[var(--border)]">
                {filteredItems.map((item) => {
                  const isExpanded = selectedSubclientId === item.id;
                  return <article key={item.id} className="p-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2"><h2 className="text-sm font-semibold">{item.name}</h2><span className="font-mono text-[11px] text-[var(--muted)]">{item.clientCode}</span><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${item.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-700' : 'bg-[var(--surface-muted)] text-[var(--muted)]'}`}>{item.status}</span></div>
                        <p className="mt-1 text-xs text-[var(--muted)]">{[item.contactName, item.contactEmail, item.contactPhone].filter(Boolean).join(' · ') || 'No contact details provided'}</p>
                        <p className="mt-1 text-[11px] text-[var(--muted)]">{item.candidateCount} candidates · {item.bgvCaseCount} BGV cases</p>
                        <div className="mt-3 flex flex-wrap gap-1.5">{item.serviceRates.map(({ checkType }) => <span key={checkType} className="rounded-md border border-[var(--border)] bg-[var(--surface-muted)] px-2 py-1 text-[10px]">{checkTypes.find((option) => option.type === checkType)?.label || checkType.replaceAll('_', ' ')}</span>)}</div>
                        <p className="mt-2 text-xs font-semibold">{item.packageRate === null ? 'Package rate not set' : `Package rate: ₹${Number(item.packageRate).toLocaleString('en-IN')} per candidate`}</p>
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2">
                        <button type="button" onClick={() => { setSelectedSubclientId(isExpanded ? null : item.id); setCandidatePage(1); setSubclientCandidates([]); setCandidateTotal(0); }} aria-expanded={isExpanded} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-semibold hover:bg-[var(--surface-muted)]">{isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}Details & candidates</button>
                        {canManage && <button type="button" onClick={() => openEdit(item)} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-semibold hover:bg-[var(--surface-muted)]"><Pencil size={13} />Edit</button>}
                        {canManage && <button type="button" onClick={() => void openPortalAccounts(item)} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-semibold hover:bg-[var(--surface-muted)]"><KeyRound size={13} />Portal login</button>}
                      </div>
                    </div>
                    {isExpanded && <div className="mt-5 border-t border-[var(--border)] pt-5">
                      <dl className="grid gap-3 rounded-xl bg-[var(--surface-muted)]/50 p-4 text-xs sm:grid-cols-2 lg:grid-cols-4">
                        {[['Subclient name', item.name], ['Subclient code', item.clientCode], ['Contact person', item.contactName], ['Contact email', item.contactEmail], ['Contact phone', item.contactPhone], ['Status', item.status], ['Package rate per candidate', item.packageRate === null ? 'Not set' : `₹${Number(item.packageRate).toLocaleString('en-IN')}`], ['Candidates', item.candidateCount.toLocaleString()], ['BGV cases', item.bgvCaseCount.toLocaleString()]].map(([label, value]) => <div key={label}><dt className="text-[10px] uppercase tracking-wide text-[var(--muted)]">{label}</dt><dd className="mt-1 break-words font-medium">{value || '—'}</dd></div>)}
                      </dl>
                      {canViewCandidates ? (<div className="mt-5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2"><Users size={15} className="text-[var(--primary)]" /><h3 className="text-sm font-semibold">Candidates under {item.name}</h3><span className="rounded-full bg-[var(--surface-muted)] px-2 py-0.5 text-[10px] text-[var(--muted)]">{candidateTotal}</span></div>
                        </div>
                        {candidateError && <p role="alert" className="mt-3 text-xs text-rose-700">{candidateError}</p>}
                        {candidatesLoading ? <p className="py-6 text-center text-xs text-[var(--muted)]">Loading candidates…</p>
                          : subclientCandidates.length === 0 ? <p className="py-6 text-center text-xs text-[var(--muted)]">No candidates are assigned to this subclient yet.</p>
                            : <div className="mt-3 overflow-x-auto rounded-lg border border-[var(--border)]"><table className="w-full min-w-[580px] text-left text-xs"><thead className="bg-[var(--surface-muted)] text-[10px] uppercase tracking-wide text-[var(--muted)]"><tr><th className="px-3 py-2.5">Candidate</th><th className="px-3 py-2.5">Reference</th><th className="px-3 py-2.5">Email</th><th className="px-3 py-2.5">Status</th><th className="px-3 py-2.5 text-right">Profile</th></tr></thead><tbody className="divide-y divide-[var(--border)]">{subclientCandidates.map((candidate) => <tr key={candidate.id}><td className="px-3 py-3 font-medium">{formatCandidateName(candidate)}</td><td className="px-3 py-3 font-mono text-[10px] text-[var(--muted)]">{candidate.candidateCode}</td><td className="px-3 py-3 text-[var(--muted)]">{candidate.email || '—'}</td><td className="px-3 py-3">{candidate.status.replaceAll('_', ' ')}</td><td className="px-3 py-3 text-right"><Link href={`/client-portal/candidates/${candidate.id}`} className="font-semibold text-[var(--primary)] hover:underline">View</Link></td></tr>)}</tbody></table></div>}
                        {candidateTotalPages > 1 && <div className="mt-3 flex items-center justify-between text-[11px]"><span className="text-[var(--muted)]">Page {candidatePage} of {candidateTotalPages}</span><div className="flex gap-2"><button type="button" disabled={candidatePage <= 1 || candidatesLoading} onClick={() => setCandidatePage((current) => current - 1)} className="rounded-md border border-[var(--border)] px-3 py-1.5 disabled:opacity-40">Previous</button><button type="button" disabled={candidatePage >= candidateTotalPages || candidatesLoading} onClick={() => setCandidatePage((current) => current + 1)} className="rounded-md border border-[var(--border)] px-3 py-1.5 disabled:opacity-40">Next</button></div></div>}
                      </div>) : <p className="mt-5 rounded-lg bg-[var(--surface-muted)] p-4 text-xs text-[var(--muted)]">Candidate access is not enabled for this portal account.</p>}
                    </div>}
                  </article>;
                })}
              </div>}
      </section>
      {portalAccountFor && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !portalUserSaving) setPortalAccountFor(null); }}>
        <section role="dialog" aria-modal="true" aria-labelledby="subclient-accounts-title" className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xl">
          <div className="flex items-start justify-between gap-3">
            <div><p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--primary)]">Subclient access</p><h2 id="subclient-accounts-title" className="mt-1 text-lg font-semibold">{portalAccountFor.name}</h2><p className="mt-1 text-xs text-[var(--muted)]">Subclient users can see only this subclient’s candidates, cases, and completed reports.</p></div>
            <button type="button" onClick={() => setPortalAccountFor(null)} aria-label="Close portal accounts" className="rounded-md p-2 text-[var(--muted)] hover:bg-[var(--surface-muted)]"><X size={16} /></button>
          </div>
          {portalUsersError && <p role="alert" className="mt-4 rounded-lg bg-rose-500/10 p-3 text-xs text-rose-700">{portalUsersError}</p>}
          {portalUserMessage && <p role="status" className="mt-4 rounded-lg bg-emerald-500/10 p-3 text-xs text-emerald-700">{portalUserMessage}</p>}
          <div className="mt-4 space-y-2">
            {portalUsersLoading ? <p className="py-4 text-center text-xs text-[var(--muted)]">Loading portal accounts…</p>
              : portalUsers.length ? portalUsers.map((account) => <div key={account.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--border)] p-3">
                <div className="min-w-0"><p className="truncate text-sm font-medium">{account.firstName} {account.lastName}</p><p className="truncate text-xs text-[var(--muted)]">{account.email} · {account.status}</p></div>
                <button type="button" onClick={() => void togglePortalAccount(account)} className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs font-semibold">{account.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}</button>
              </div>)
                : <p className="rounded-lg bg-[var(--surface-muted)] p-3 text-xs text-[var(--muted)]">No portal users configured yet.</p>}
          </div>
          <form onSubmit={(event) => void createPortalAccount(event)} className="mt-5 space-y-3 border-t border-[var(--border)] pt-5">
            <div className="flex items-center gap-2"><UserPlus size={15} className="text-[var(--primary)]" /><h3 className="text-sm font-semibold">Create subclient login</h3></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-medium text-[var(--muted)]">First name<input required maxLength={100} value={portalUserDraft.firstName} onChange={(event) => setPortalUserDraft((current) => ({ ...current, firstName: event.target.value }))} className={fieldClass} /></label>
              <label className="text-xs font-medium text-[var(--muted)]">Last name<input required maxLength={100} value={portalUserDraft.lastName} onChange={(event) => setPortalUserDraft((current) => ({ ...current, lastName: event.target.value }))} className={fieldClass} /></label>
              <label className="text-xs font-medium text-[var(--muted)] sm:col-span-2">Login email<input required type="email" maxLength={255} value={portalUserDraft.email} onChange={(event) => setPortalUserDraft((current) => ({ ...current, email: event.target.value }))} className={fieldClass} /></label>
              <label className="text-xs font-medium text-[var(--muted)] sm:col-span-2">Account setup
                <select value={portalAccountMethod} onChange={(event) => setPortalAccountMethod(event.target.value as typeof portalAccountMethod)} className={fieldClass}><option value="INVITATION">Send email invitation to set password</option><option value="PASSWORD">Set an initial password</option></select>
              </label>
              {portalAccountMethod === 'PASSWORD' && <label className="text-xs font-medium text-[var(--muted)] sm:col-span-2">Initial password<input required type="password" minLength={12} maxLength={128} autoComplete="new-password" value={portalUserDraft.password} onChange={(event) => setPortalUserDraft((current) => ({ ...current, password: event.target.value }))} className={fieldClass} /></label>}
            </div>
            <div className="flex justify-end"><button type="submit" disabled={portalUserSaving} className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2.5 text-xs font-semibold text-[var(--primary-foreground)] disabled:opacity-50">{portalUserSaving ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}{portalUserSaving ? 'Saving…' : 'Create login'}</button></div>
          </form>
        </section>
      </div>}
    </div>
  );
}
