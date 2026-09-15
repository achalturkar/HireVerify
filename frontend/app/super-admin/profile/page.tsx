'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, KeyRound, LockKeyhole, Mail, Moon, Palette, Phone, Save, ShieldCheck, Sun, UserRound } from 'lucide-react';
import { useAuth } from '@/src/auth/AuthProvider';
import { changePassword, updateProfile } from '@/src/lib/api/users';
import { useTheme } from '@/src/lib/theme-context';

function initials(firstName: string, lastName: string) {
  return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase() || 'SA';
}

function formatDate(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'Never';
}

const fieldClass = 'w-full rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2.5 text-[13px] text-[var(--foreground)] outline-none focus:border-[var(--primary)]';

export default function SuperAdminProfilePage() {
  const { user, accessToken, refreshUser } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!user) return;
    const task = Promise.resolve().then(() => {
      setFirstName(user.firstName || '');
      setLastName(user.lastName || '');
      setPhone(user.phone || '');
    });
    return () => { void task; };
  }, [user]);

  const permissionModules = useMemo(() => Array.from(new Set((user?.permissions || []).map((permission) => permission.split('.')[0]))).sort(), [user?.permissions]);

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!accessToken) return;
    setSavingProfile(true); setNotice(null);
    try {
      await updateProfile(accessToken, { firstName: firstName.trim(), lastName: lastName.trim(), phone: phone.trim() || undefined });
      await refreshUser();
      setNotice({ tone: 'success', text: 'Profile details updated successfully.' });
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : 'Unable to update profile.' });
    } finally { setSavingProfile(false); }
  };

  const savePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!accessToken) return;
    if (newPassword !== confirmPassword) { setNotice({ tone: 'error', text: 'New password and confirmation do not match.' }); return; }
    setSavingPassword(true); setNotice(null);
    try {
      await changePassword(accessToken, { currentPassword, newPassword, confirmPassword });
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
      setNotice({ tone: 'success', text: 'Password changed successfully.' });
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : 'Unable to change password.' });
    } finally { setSavingPassword(false); }
  };

  if (!user) return <div className="mx-auto max-w-5xl py-16 text-center text-[13px] text-[var(--muted)]">Loading profile...</div>;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header><p className="mb-2 text-[11px] uppercase tracking-[0.14em] text-[var(--primary)]" style={{ fontFamily: 'var(--font-mono)' }}>Account / Super Admin</p><h1 className="text-[28px] font-semibold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>Profile & security</h1><p className="mt-1 text-[13px] text-[var(--muted)]">Manage your identity, authentication, and portal preferences.</p></header>
      {notice && <div className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-[13px] ${notice.tone === 'success' ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'border-rose-500/25 bg-rose-500/10 text-rose-600 dark:text-rose-400'}`}>{notice.tone === 'success' && <Check size={15} />}{notice.text}</div>}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.5fr_1fr]">
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm"><div className="mb-6 flex items-center gap-4"><div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--primary)]/15 text-xl font-semibold text-[var(--primary)]">{initials(user.firstName, user.lastName)}</div><div><h2 className="text-[17px] font-semibold" style={{ fontFamily: 'var(--font-display)' }}>{user.firstName} {user.lastName}</h2><p className="mt-1 text-[12px] text-[var(--muted)]">{user.role?.name || 'Super Admin'} · Platform administrator</p></div></div><form onSubmit={saveProfile} className="space-y-5"><div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><label className="space-y-1.5"><span className="text-[12px] font-medium text-[var(--muted)]">First name</span><input value={firstName} onChange={(event) => setFirstName(event.target.value)} required className={fieldClass} /></label><label className="space-y-1.5"><span className="text-[12px] font-medium text-[var(--muted)]">Last name</span><input value={lastName} onChange={(event) => setLastName(event.target.value)} required className={fieldClass} /></label></div><label className="block space-y-1.5"><span className="flex items-center gap-1.5 text-[12px] font-medium text-[var(--muted)]"><Mail size={13} /> Work email</span><input value={user.email} readOnly className={`${fieldClass} cursor-not-allowed text-[var(--muted)]`} /></label><label className="block space-y-1.5"><span className="flex items-center gap-1.5 text-[12px] font-medium text-[var(--muted)]"><Phone size={13} /> Phone</span><input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Add a phone number" className={fieldClass} /></label><div className="flex justify-end"><button type="submit" disabled={savingProfile} className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2.5 text-[13px] font-semibold text-[var(--primary-foreground)] disabled:opacity-50"><Save size={15} />{savingProfile ? 'Saving...' : 'Save profile'}</button></div></form></section>

        <div className="space-y-5"><section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm"><div className="mb-5 flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--primary)]/15 text-[var(--primary)]"><ShieldCheck size={17} /></span><div><h2 className="text-[15px] font-semibold">Access level</h2><p className="text-[11px] text-[var(--muted)]">Your platform authority</p></div></div><div className="rounded-xl border border-[var(--primary)]/25 bg-[var(--primary)]/10 p-4"><p className="text-[14px] font-semibold text-[var(--foreground)]">{user.role?.name || 'Super Admin'}</p><p className="mt-1 text-[12px] text-[var(--muted)]">Full cross-company administration access</p></div><div className="mt-4 flex flex-wrap gap-2">{permissionModules.map((module) => <span key={module} className="rounded-md border border-[var(--border)] bg-[var(--surface-muted)] px-2.5 py-1 text-[10px] uppercase tracking-wide text-[var(--muted)]">{module}</span>)}</div></section><section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm"><div className="mb-4 flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400"><Palette size={17} /></span><div><h2 className="text-[15px] font-semibold">Portal appearance</h2><p className="text-[11px] text-[var(--muted)]">Saved for this browser</p></div></div><button onClick={toggleTheme} className="flex w-full items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3.5 py-3 text-left hover:border-[var(--primary)]"><span className="flex items-center gap-2 text-[13px] text-[var(--foreground)]">{theme === 'dark' ? <Moon size={15} /> : <Sun size={15} />}{theme === 'dark' ? 'Dark theme' : 'Light theme'}</span><span className="text-[11px] text-[var(--muted)]">Switch theme</span></button></section></div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.2fr_1fr]"><section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm"><div className="mb-5 flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-500/15 text-rose-600 dark:text-rose-400"><LockKeyhole size={17} /></span><div><h2 className="text-[15px] font-semibold">Change password</h2><p className="text-[11px] text-[var(--muted)]">Use a unique password for platform access</p></div></div><form onSubmit={savePassword} className="space-y-4"><label className="block space-y-1.5"><span className="text-[12px] font-medium text-[var(--muted)]">Current password</span><input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required autoComplete="current-password" className={fieldClass} /></label><div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><label className="space-y-1.5"><span className="text-[12px] font-medium text-[var(--muted)]">New password</span><input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required minLength={8} autoComplete="new-password" className={fieldClass} /></label><label className="space-y-1.5"><span className="text-[12px] font-medium text-[var(--muted)]">Confirm password</span><input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required minLength={8} autoComplete="new-password" className={fieldClass} /></label></div><div className="flex justify-end"><button type="submit" disabled={savingPassword} className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-4 py-2.5 text-[13px] font-semibold text-[var(--foreground)] hover:border-[var(--primary)] disabled:opacity-50"><KeyRound size={15} />{savingPassword ? 'Updating...' : 'Update password'}</button></div></form></section><section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm"><div className="mb-5 flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-500/15 text-sky-600 dark:text-sky-400"><UserRound size={17} /></span><div><h2 className="text-[15px] font-semibold">Account details</h2><p className="text-[11px] text-[var(--muted)]">Security and session information</p></div></div><dl className="space-y-4 text-[12px]"><div className="flex items-start justify-between gap-4"><dt className="text-[var(--muted)]">Account status</dt><dd className="font-medium text-emerald-600 dark:text-emerald-400">{user.status}</dd></div><div className="flex items-start justify-between gap-4"><dt className="text-[var(--muted)]">Last login</dt><dd className="text-right text-[var(--foreground)]">{formatDate(user.lastLoginAt)}</dd></div><div className="flex items-start justify-between gap-4"><dt className="text-[var(--muted)]">Password setup</dt><dd className="text-right text-[var(--foreground)]">{user.mustChangePassword ? 'Change required' : 'Configured'}</dd></div><div className="flex items-start justify-between gap-4"><dt className="text-[var(--muted)]">User ID</dt><dd className="max-w-[11rem] truncate text-right text-[var(--muted)]">{user.id}</dd></div></dl></section></div>
    </div>
  );
}
