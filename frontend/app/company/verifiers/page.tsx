'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, ClipboardList, Pencil, Plus, RotateCcw, Save, UserRound, UsersRound, X } from 'lucide-react';
import { useAuth } from '@/src/auth/AuthProvider';
import { ApiError, createCompanyVerificationMode, createCompanyVerifier, listCompanyVerificationModes, listCompanyVerifiers, updateCompanyVerificationMode, updateCompanyVerifier } from '@/src/lib/api/bgv';
import type { CompanyVerificationMode, CompanyVerifier } from '@/src/lib/api/bgv';

const inputClass = 'w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-[13px] outline-none focus:border-[var(--primary)]';
type ManagementTab = 'verifiers' | 'modes';

export default function VerifiersPage() {
  const { accessToken, user } = useAuth();
  const canManage = Boolean(user?.role?.isCompanyAdmin || user?.role?.isSuperAdmin || user?.permissions?.includes('company.update'));
  const [tab, setTab] = useState<ManagementTab>('verifiers');
  const [verifiers, setVerifiers] = useState<CompanyVerifier[]>([]);
  const [modes, setModes] = useState<CompanyVerificationMode[]>([]);
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [modeName, setModeName] = useState('');
  const [editingMode, setEditingMode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const [loadedVerifiers, loadedModes] = await Promise.all([
        listCompanyVerifiers(accessToken, true),
        listCompanyVerificationModes(accessToken, true),
      ]);
      setVerifiers(loadedVerifiers);
      setModes(loadedModes);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load the verifier list.');
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const resetForm = () => { setEditing(null); setName(''); };
  const resetModeForm = () => { setEditingMode(null); setModeName(''); };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const normalized = name.trim();
    if (!normalized || !accessToken) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      if (editing) await updateCompanyVerifier(editing, { name: normalized }, accessToken);
      else await createCompanyVerifier(normalized, accessToken);
      resetForm();
      setNotice(editing ? 'Verifier updated.' : 'Verifier added.');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save this verifier.');
    } finally {
      setSaving(false);
    }
  };

  const saveMode = async (event: React.FormEvent) => {
    event.preventDefault();
    const normalized = modeName.trim();
    if (!normalized || !accessToken) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      if (editingMode) await updateCompanyVerificationMode(editingMode, { name: normalized }, accessToken);
      else await createCompanyVerificationMode(normalized, accessToken);
      resetModeForm();
      setNotice(editingMode ? 'Verification mode updated.' : 'Verification mode added.');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save this verification mode.');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (verifier: CompanyVerifier) => {
    if (!accessToken) return;
    setError(null);
    setNotice(null);
    try {
      await updateCompanyVerifier(verifier.id, { isActive: !verifier.isActive }, accessToken);
      setNotice(verifier.isActive ? 'Verifier archived.' : 'Verifier reactivated.');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update this verifier.');
    }
  };

  const toggleModeActive = async (mode: CompanyVerificationMode) => {
    if (!accessToken) return;
    setError(null);
    setNotice(null);
    try {
      await updateCompanyVerificationMode(mode.id, { isActive: !mode.isActive }, accessToken);
      setNotice(mode.isActive ? 'Verification mode archived.' : 'Verification mode reactivated.');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update this verification mode.');
    }
  };

  if (!canManage) return <div className="mx-auto max-w-5xl py-16 text-center text-[13px] text-[var(--muted)]">Company administrator access is required to manage verifiers.</div>;

  return <div className="mx-auto max-w-5xl space-y-7">
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--primary)]">Verification setup</p>
        <h1 className="text-[24px] font-semibold">{tab === 'verifiers' ? 'Verifiers' : 'Verification modes'}</h1>
        <p className="mt-1 text-[13px] text-[var(--muted)]">{tab === 'verifiers' ? 'Manage the names available for assignment to your company’s BGV checks.' : 'Manage the verification methods available on your company’s BGV checks.'}</p>
      </div>
      <span className="text-[12px] text-[var(--muted)]">{tab === 'verifiers' ? verifiers.filter((verifier) => verifier.isActive).length : modes.filter((mode) => mode.isActive).length} active</span>
    </header>

    <div role="tablist" aria-label="Verification setup" className="flex gap-2 border-b border-[var(--border)]">
      <button type="button" role="tab" aria-selected={tab === 'verifiers'} onClick={() => setTab('verifiers')} className={`inline-flex items-center gap-2 border-b-2 px-4 py-3 text-[13px] font-semibold ${tab === 'verifiers' ? 'border-[var(--primary)] text-[var(--primary)]' : 'border-transparent text-[var(--muted)]'}`}><UsersRound size={15} />Verifiers</button>
      <button type="button" role="tab" aria-selected={tab === 'modes'} onClick={() => setTab('modes')} className={`inline-flex items-center gap-2 border-b-2 px-4 py-3 text-[13px] font-semibold ${tab === 'modes' ? 'border-[var(--primary)] text-[var(--primary)]' : 'border-transparent text-[var(--muted)]'}`}><ClipboardList size={15} />Verification modes</button>
    </div>
    {(error || notice) && <p role={error ? 'alert' : 'status'} className={`text-[13px] ${error ? 'text-[#C94C4C]' : 'text-[#147A68]'}`}>{error || notice}</p>}

    {tab === 'verifiers' && <>
    <form onSubmit={save} className="flex flex-col gap-3 border-y border-[var(--border)] py-5 sm:flex-row sm:items-end">
      <label className="flex-1">
        <span className="mb-1.5 block text-[12px] font-medium">Verifier name</span>
        <input value={name} onChange={(event) => setName(event.target.value)} maxLength={100} required className={inputClass} placeholder="Enter a verifier name" />
      </label>
      <div className="flex gap-2">
        {editing && <button type="button" onClick={resetForm} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3.5 py-2.5 text-[12.5px]"><X size={14} />Cancel</button>}
        <button type="submit" disabled={saving || !name.trim()} className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-4 py-2.5 text-[12.5px] font-semibold text-[var(--primary-foreground)] disabled:opacity-50">{editing ? <Save size={14} /> : <Plus size={14} />}{saving ? 'Saving...' : editing ? 'Save changes' : 'Add verifier'}</button>
      </div>
    </form>

    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[14px] font-semibold">Company verifier roster</h2>
        <button type="button" onClick={() => void load()} disabled={loading} aria-label="Refresh verifiers" title="Refresh" className="grid h-8 w-8 place-items-center rounded-md border border-[var(--border)] text-[var(--muted)] disabled:opacity-50"><RotateCcw size={14} /></button>
      </div>
      {loading ? <p className="py-8 text-center text-[13px] text-[var(--muted)]">Loading verifiers...</p> : verifiers.length === 0 ? <div className="border-y border-[var(--border)] py-12 text-center"><UserRound size={24} className="mx-auto mb-2 text-[var(--muted)]" /><p className="text-[13px] font-medium">No verifiers yet</p><p className="mt-1 text-[12px] text-[var(--muted)]">Add a verifier above to make them available on BGV cases.</p></div> : <div className="divide-y divide-[var(--border)] border-y border-[var(--border)]">{verifiers.map((verifier) => <div key={verifier.id} className="flex flex-wrap items-center justify-between gap-3 py-3.5">
        <div className="flex min-w-0 items-center gap-3">
          <span className={`h-2 w-2 shrink-0 rounded-full ${verifier.isActive ? 'bg-[#159A7A]' : 'bg-[var(--muted)]'}`} />
          <div className="min-w-0"><p className="truncate text-[13px] font-medium">{verifier.name}</p><p className="mt-0.5 text-[11px] text-[var(--muted)]">{verifier.isActive ? 'Available for assignment' : 'Archived'}</p></div>
        </div>
        <div className="flex items-center gap-2">
          {verifier.isActive && <button type="button" onClick={() => { setEditing(verifier.id); setName(verifier.name); setError(null); setNotice(null); }} title={`Edit ${verifier.name}`} aria-label={`Edit ${verifier.name}`} className="grid h-8 w-8 place-items-center rounded-md border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)]"><Pencil size={14} /></button>}
          <button type="button" onClick={() => void toggleActive(verifier)} className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[11.5px] font-medium ${verifier.isActive ? 'border-[#C94C4C]/30 text-[#C94C4C]' : 'border-[#159A7A]/30 text-[#147A68]'}`}>{verifier.isActive ? <X size={13} /> : <Check size={13} />}{verifier.isActive ? 'Archive' : 'Reactivate'}</button>
        </div>
      </div>)}</div>}
    </section>
    </>}

    {tab === 'modes' && <>
    <form onSubmit={saveMode} className="flex flex-col gap-3 border-y border-[var(--border)] py-5 sm:flex-row sm:items-end">
      <label className="flex-1">
        <span className="mb-1.5 block text-[12px] font-medium">Verification mode</span>
        <input value={modeName} onChange={(event) => setModeName(event.target.value)} maxLength={100} minLength={2} required className={inputClass} placeholder="Enter a mode, such as On-site or Video call" />
      </label>
      <div className="flex gap-2">
        {editingMode && <button type="button" onClick={resetModeForm} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3.5 py-2.5 text-[12.5px]"><X size={14} />Cancel</button>}
        <button type="submit" disabled={saving || !modeName.trim()} className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-4 py-2.5 text-[12.5px] font-semibold text-[var(--primary-foreground)] disabled:opacity-50">{editingMode ? <Save size={14} /> : <Plus size={14} />}{saving ? 'Saving...' : editingMode ? 'Save changes' : 'Add mode'}</button>
      </div>
    </form>

    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[14px] font-semibold">Company verification modes</h2>
        <button type="button" onClick={() => void load()} disabled={loading} aria-label="Refresh verification modes" title="Refresh" className="grid h-8 w-8 place-items-center rounded-md border border-[var(--border)] text-[var(--muted)] disabled:opacity-50"><RotateCcw size={14} /></button>
      </div>
      {loading ? <p className="py-8 text-center text-[13px] text-[var(--muted)]">Loading verification modes...</p> : modes.length === 0 ? <div className="border-y border-[var(--border)] py-12 text-center"><ClipboardList size={24} className="mx-auto mb-2 text-[var(--muted)]" /><p className="text-[13px] font-medium">No verification modes yet</p><p className="mt-1 text-[12px] text-[var(--muted)]">Add a mode to make it available on BGV checks.</p></div> : <div className="divide-y divide-[var(--border)] border-y border-[var(--border)]">{modes.map((mode) => <div key={mode.id} className="flex flex-wrap items-center justify-between gap-3 py-3.5">
        <div className="flex min-w-0 items-center gap-3">
          <span className={`h-2 w-2 shrink-0 rounded-full ${mode.isActive ? 'bg-[#159A7A]' : 'bg-[var(--muted)]'}`} />
          <div className="min-w-0"><p className="truncate text-[13px] font-medium">{mode.name}</p><p className="mt-0.5 text-[11px] text-[var(--muted)]">{mode.isActive ? 'Available on BGV checks' : 'Archived'}</p></div>
        </div>
        <div className="flex items-center gap-2">
          {mode.isActive && <button type="button" onClick={() => { setEditingMode(mode.id); setModeName(mode.name); setError(null); setNotice(null); }} title={`Edit ${mode.name}`} aria-label={`Edit ${mode.name}`} className="grid h-8 w-8 place-items-center rounded-md border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)]"><Pencil size={14} /></button>}
          <button type="button" onClick={() => void toggleModeActive(mode)} className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[11.5px] font-medium ${mode.isActive ? 'border-[#C94C4C]/30 text-[#C94C4C]' : 'border-[#159A7A]/30 text-[#147A68]'}`}>{mode.isActive ? <X size={13} /> : <Check size={13} />}{mode.isActive ? 'Archive' : 'Reactivate'}</button>
        </div>
      </div>)}</div>}
    </section>
    </>}
  </div>;
}