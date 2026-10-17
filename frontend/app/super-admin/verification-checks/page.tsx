'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, Loader2, Plus, Save } from 'lucide-react';
import { useAuth } from '@/src/auth/AuthProvider';
import { createVerificationCheckType, listVerificationCheckTypes, updateVerificationCheckType } from '@/src/lib/api/bgv';
import type { VerificationCheckType } from '@/src/types/bgv';

type CheckDraft = { label: string; description: string };

export default function VerificationChecksPage() {
  const { accessToken } = useAuth();
  const [checkTypes, setCheckTypes] = useState<VerificationCheckType[]>([]);
  const [drafts, setDrafts] = useState<Record<string, CheckDraft>>({});
  const [newLabel, setNewLabel] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const values = await listVerificationCheckTypes(accessToken, true);
      setCheckTypes(values);
      setDrafts(Object.fromEntries(values.map((item) => [item.type, { label: item.label, description: item.description || '' }])));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load verification check types.');
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const addCheckType = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving('new');
    setError(null);
    setNotice(null);
    try {
      const item = await createVerificationCheckType({ label: newLabel.trim(), description: newDescription.trim() || undefined }, accessToken);
      setCheckTypes((current) => [...current, item]);
      setDrafts((current) => ({ ...current, [item.type]: { label: item.label, description: item.description || '' } }));
      setNewLabel('');
      setNewDescription('');
      setNotice(`${item.label} added. It is now available for new cases.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not add verification check.');
    } finally {
      setSaving(null);
    }
  };

  const saveCheckType = async (item: VerificationCheckType) => {
    const draft = drafts[item.type];
    setSaving(item.type);
    setError(null);
    setNotice(null);
    try {
      const updated = await updateVerificationCheckType(item.type, {
        label: draft.label.trim(),
        description: draft.description.trim() || null,
      }, accessToken);
      setCheckTypes((current) => current.map((checkType) => checkType.type === item.type ? updated : checkType));
      setDrafts((current) => ({ ...current, [item.type]: { label: updated.label, description: updated.description || '' } }));
      setNotice(`${updated.label} saved.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save verification check.');
    } finally {
      setSaving(null);
    }
  };

  const toggleCheckType = async (item: VerificationCheckType) => {
    setSaving(item.type);
    setError(null);
    setNotice(null);
    try {
      const updated = await updateVerificationCheckType(item.type, { isActive: !item.isActive }, accessToken);
      setCheckTypes((current) => current.map((checkType) => checkType.type === item.type ? updated : checkType));
      setNotice(`${updated.label} ${updated.isActive ? 'enabled' : 'disabled'}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update verification check.');
    } finally {
      setSaving(null);
    }
  };

  return <div className="mx-auto max-w-5xl space-y-6">
    <header>
      <p className="mb-2 text-[11px] uppercase tracking-[0.14em] text-[var(--primary)]">Platform / BGV setup</p>
      <h1 className="text-[28px] font-semibold tracking-tight">Verification checks</h1>
      <p className="mt-1 text-[13px] text-[var(--muted)]">Add and manage the checks companies can select for BGV cases. New checks use the existing manual review workflow.</p>
    </header>

    {error && <p role="alert" className="rounded-lg border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-[13px] text-rose-600">{error}</p>}
    {notice && <p role="status" className="flex items-center gap-2 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-[13px] text-emerald-700"><Check size={15} />{notice}</p>}

    <form onSubmit={(event) => void addCheckType(event)} className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <div>
        <h2 className="text-[15px] font-semibold">Add a check</h2>
        <p className="mt-1 text-[12px] text-[var(--muted)]">The system generates a permanent key from the name. The name can be changed later; the key is used by saved case history.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-[12px] font-medium text-[var(--muted)]">Check name
          <input required minLength={2} maxLength={100} value={newLabel} onChange={(event) => setNewLabel(event.target.value)} placeholder="e.g. Professional License" className="mt-1 block w-full rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2.5 text-[13px] text-[var(--foreground)]" />
        </label>
        <label className="text-[12px] font-medium text-[var(--muted)]">Description (optional)
          <input maxLength={500} value={newDescription} onChange={(event) => setNewDescription(event.target.value)} placeholder="Briefly describe what this check covers" className="mt-1 block w-full rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2.5 text-[13px] text-[var(--foreground)]" />
        </label>
      </div>
      <button type="submit" disabled={saving !== null || !newLabel.trim()} className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2.5 text-[13px] font-semibold text-[var(--primary-foreground)] disabled:opacity-50">
        {saving === 'new' ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}Add check
      </button>
    </form>

    <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
        <div><h2 className="text-[15px] font-semibold">Available check types</h2><p className="mt-1 text-[12px] text-[var(--muted)]">{checkTypes.filter((item) => item.isActive).length} active · {checkTypes.length} total</p></div>
      </div>
      {loading ? <div className="py-12 text-center text-[13px] text-[var(--muted)]">Loading checks...</div> : checkTypes.length === 0 ? <div className="py-12 text-center text-[13px] text-[var(--muted)]">No verification checks configured.</div> : <div className="divide-y divide-[var(--border)]">
        {checkTypes.map((item) => {
          const draft = drafts[item.type] || { label: item.label, description: item.description || '' };
          const changed = draft.label !== item.label || draft.description !== (item.description || '');
          return <div key={item.type} className="grid gap-3 px-5 py-4 lg:grid-cols-[minmax(0,1fr)_170px_auto] lg:items-center">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-[11px] font-medium text-[var(--muted)]">Display name
                <input value={draft.label} maxLength={100} onChange={(event) => setDrafts((current) => ({ ...current, [item.type]: { ...draft, label: event.target.value } }))} className="mt-1 block w-full rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-[12px] text-[var(--foreground)]" />
              </label>
              <label className="text-[11px] font-medium text-[var(--muted)]">Description
                <input value={draft.description} maxLength={500} onChange={(event) => setDrafts((current) => ({ ...current, [item.type]: { ...draft, description: event.target.value } }))} className="mt-1 block w-full rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-[12px] text-[var(--foreground)]" />
              </label>
              <p className="font-mono text-[10px] text-[var(--muted)] sm:col-span-2">Key: {item.type} · {item.defaultProvider === 'SUREPASS' ? 'Provider-backed check' : 'Manual review'}</p>
            </div>
            <span className={`text-[11px] font-semibold ${item.isActive ? 'text-emerald-600' : 'text-[var(--muted)]'}`}>{item.isActive ? 'Available to companies' : 'Disabled for new cases'}</span>
            <div className="flex gap-2">
              <button type="button" disabled={!changed || saving !== null || !draft.label.trim()} onClick={() => void saveCheckType(item)} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-2 text-[11px] font-semibold disabled:opacity-40">
                {saving === item.type ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}Save
              </button>
              <button type="button" disabled={saving !== null} onClick={() => void toggleCheckType(item)} className="rounded-lg border border-[var(--border)] px-3 py-2 text-[11px] font-semibold disabled:opacity-40">{item.isActive ? 'Disable' : 'Enable'}</button>
            </div>
          </div>;
        })}
      </div>}
    </section>
  </div>;
}
