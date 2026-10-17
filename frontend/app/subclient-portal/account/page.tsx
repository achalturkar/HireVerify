'use client';

import { useState, type FormEvent } from 'react';
import { KeyRound, Loader2 } from 'lucide-react';
import { useAuth } from '@/src/auth/AuthProvider';
import { changePassword } from '@/src/lib/api/users';

export default function SubclientAccountPage() {
  const { user, accessToken } = useAuth();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSaved(false);
    if (form.newPassword !== form.confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }
    setSaving(true);
    try {
      await changePassword(accessToken, form);
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setSaved(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update the password.');
    } finally {
      setSaving(false);
    }
  };
  const fieldClass = 'mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm outline-none focus:border-[var(--primary)]';

  return <div className="mx-auto max-w-2xl space-y-5">
    <header><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--primary)]">Account</p><h2 className="mt-1 text-2xl font-semibold">Account settings</h2></header>
    <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <h3 className="text-sm font-semibold">Profile</h3><dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2"><div><dt className="text-xs text-[var(--muted)]">Name</dt><dd className="mt-1 font-medium">{user?.firstName} {user?.lastName}</dd></div><div><dt className="text-xs text-[var(--muted)]">Email</dt><dd className="mt-1 font-medium">{user?.email}</dd></div><div><dt className="text-xs text-[var(--muted)]">Subclient</dt><dd className="mt-1 font-medium">{user?.client?.name}</dd></div></dl>
    </section>
    <form onSubmit={(event) => void submit(event)} className="space-y-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="flex items-center gap-2"><KeyRound size={16} className="text-[var(--primary)]" /><h3 className="text-sm font-semibold">Change password</h3></div>
      {error && <p role="alert" className="rounded-lg bg-rose-500/10 p-3 text-xs text-rose-700">{error}</p>}
      {saved && <p role="status" className="rounded-lg bg-emerald-500/10 p-3 text-xs text-emerald-700">Password updated.</p>}
      <label className="block text-xs font-medium text-[var(--muted)]">Current password<input required type="password" autoComplete="current-password" value={form.currentPassword} onChange={(event) => setForm((current) => ({ ...current, currentPassword: event.target.value }))} className={fieldClass} /></label>
      <label className="block text-xs font-medium text-[var(--muted)]">New password<input required type="password" minLength={12} autoComplete="new-password" value={form.newPassword} onChange={(event) => setForm((current) => ({ ...current, newPassword: event.target.value }))} className={fieldClass} /></label>
      <label className="block text-xs font-medium text-[var(--muted)]">Confirm new password<input required type="password" minLength={12} autoComplete="new-password" value={form.confirmPassword} onChange={(event) => setForm((current) => ({ ...current, confirmPassword: event.target.value }))} className={fieldClass} /></label>
      <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2.5 text-xs font-semibold text-[var(--primary-foreground)] disabled:opacity-50">{saving && <Loader2 size={14} className="animate-spin" />}{saving ? 'Updating…' : 'Update password'}</button>
    </form>
  </div>;
}
