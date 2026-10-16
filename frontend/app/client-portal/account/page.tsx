'use client';

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  Building2,
  Check,
  CheckCircle2,
  CircleAlert,
  Globe2,
  KeyRound,
  Mail,
  MapPin,
  PencilLine,
  Phone,
  Save,
  ShieldCheck,
  UserRound,
  X,
} from 'lucide-react';
import { useAuth } from '@/src/auth/AuthProvider';
import { changePassword, updateProfile } from '@/src/lib/api/users';
import { ApiError } from '@/src/lib/api/http';

const inputClass = 'mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-[13px] text-[var(--foreground)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15';

type ProfileValues = {
  firstName: string;
  lastName: string;
  phone: string;
};

type InfoFieldProps = {
  label: string;
  value: string | null | undefined;
  icon?: ReactNode;
  href?: string;
};

function InfoField({ label, value, icon, href }: InfoFieldProps) {
  const content = value?.trim() || 'Not provided';

  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
        {icon}
        {label}
      </dt>
      <dd className="mt-1.5 break-words text-[13px] font-medium text-[var(--foreground)]">
        {href && value ? (
          <a href={href} className="text-[var(--primary)] hover:underline">{content}</a>
        ) : content}
      </dd>
    </div>
  );
}

function formatLastLogin(value: string | null) {
  if (!value) return 'No sign-in recorded';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'No sign-in recorded'
    : new Intl.DateTimeFormat('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
}

function errorText(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

export default function ClientPortalAccountPage() {
  const router = useRouter();
  const { user, loading, accessToken, refreshUser } = useAuth();
  const [profile, setProfile] = useState<ProfileValues>({ firstName: '', lastName: '', phone: '' });
  const [editingProfile, setEditingProfile] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [password, setPassword] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace('/login');
    else if (!user.role.isClientUser && !user.role.isCompanyAdmin) router.replace(user.role.isSuperAdmin ? '/super-admin/dashboard' : '/company/dashboard');
  }, [loading, router, user]);

  const client = user?.client;
  const address = [client?.addressLine1, client?.addressLine2, client?.city, client?.state, client?.postalCode, client?.country]
    .filter((part): part is string => Boolean(part?.trim()))
    .join(', ');
  const organizationFields = useMemo(() => [
    { label: 'Organization name', value: client?.name },
    { label: 'Client code', value: client?.clientCode },
    { label: 'Industry', value: client?.industry },
    { label: 'Website', value: client?.website },
    { label: 'Primary contact', value: client?.contactName },
    { label: 'Contact email', value: client?.contactEmail },
    { label: 'Contact phone', value: client?.contactPhone },
    { label: 'Business address', value: address },
  ], [address, client?.clientCode, client?.contactEmail, client?.contactName, client?.contactPhone, client?.industry, client?.name, client?.website]);
  const completedOrganizationFields = organizationFields.filter((field) => Boolean(field.value?.trim())).length;
  const organizationProgress = organizationFields.length
    ? Math.round((completedOrganizationFields / organizationFields.length) * 100)
    : 0;
  const profileFields = [user?.firstName, user?.lastName, user?.email, user?.phone];
  const completedProfileFields = profileFields.filter((value) => Boolean(value?.trim())).length;
  const profileProgress = Math.round((completedProfileFields / profileFields.length) * 100);
  const profileIsDirty = user ? (
    profile.firstName.trim() !== user.firstName ||
    profile.lastName.trim() !== user.lastName ||
    profile.phone.trim() !== (user.phone || '')
  ) : false;

  const beginProfileEdit = () => {
    if (!user) return;
    setProfile({
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      phone: user.phone || '',
    });
    setProfileSuccess(null);
    setProfileError(null);
    setEditingProfile(true);
  };

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setProfileError(null);
    setProfileSuccess(null);
    setSavingProfile(true);

    try {
      await updateProfile(accessToken, {
        firstName: profile.firstName.trim(),
        lastName: profile.lastName.trim(),
        phone: profile.phone.trim() || null,
      });
      await refreshUser();
      setEditingProfile(false);
      setProfileSuccess('Your contact information has been saved.');
    } catch (error) {
      setProfileError(errorText(error, 'Could not save your contact information. Please try again.'));
    } finally {
      setSavingProfile(false);
    }
  };

  const savePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (password.newPassword !== password.confirmPassword) {
      setPasswordError('Your new password and confirmation do not match.');
      return;
    }

    setSavingPassword(true);
    try {
      await changePassword(accessToken, password);
      setPassword({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setPasswordSuccess('Your password has been changed.');
    } catch (error) {
      setPasswordError(errorText(error, 'Could not change your password. Please try again.'));
    } finally {
      setSavingPassword(false);
    }
  };

  const cancelProfileEdit = () => {
    setProfile({
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
      phone: user?.phone || '',
    });
    setProfileError(null);
    setEditingProfile(false);
  };

  if (loading || (!user?.role.isClientUser && !user?.role.isCompanyAdmin)) {
    return <div className="flex min-h-[50vh] items-center justify-center text-sm text-[var(--muted)]">Loading account information…</div>;
  }

  const initials = `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase();
  const updateRequest = `mailto:${client?.contactEmail || ''}?${new URLSearchParams({
    subject: `Update ${client?.name || 'client'} organization details`,
    body: `Hello,\n\nPlease help us update the organization details shown in our client portal.\n\nClient: ${client?.name || 'Not available'}\nRequested by: ${user.firstName} ${user.lastName}\n\nDetails to update:\n`,
  }).toString()}`;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--primary)]">Your workspace</p>
          <h2 className="mt-1 text-2xl font-semibold">Account information</h2>
          <p className="mt-1 max-w-2xl text-[13px] leading-5 text-[var(--muted)]">
            Keep your contact details up to date and review the organization information connected to your portal.
          </p>
        </div>
        <a href="#security" className="inline-flex w-fit items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5 text-[12px] font-semibold hover:bg-[var(--surface-muted)]">
          <ShieldCheck size={15} /> Security settings
        </a>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6">
          <div className="flex flex-wrap items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[var(--primary)]/10 text-lg font-semibold text-[var(--primary)]" aria-hidden="true">
              {initials || <UserRound size={22} />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-semibold">{user.firstName} {user.lastName}</h3>
                <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">{user.status}</span>
              </div>
              <p className="mt-1 break-all text-[12px] text-[var(--muted)]">{user.email}</p>
              <p className="mt-2 text-[11px] text-[var(--muted)]">{user.role.name} · {client?.name || 'Client workspace'}</p>
            </div>
            {!editingProfile && (
              <button
                type="button"
                onClick={beginProfileEdit}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-2 text-[11px] font-semibold hover:bg-[var(--surface-muted)]"
              >
                <PencilLine size={13} /> Edit details
              </button>
            )}
          </div>

          <div className="mt-6 border-t border-[var(--border)] pt-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h4 className="text-[13px] font-semibold">Your contact information</h4>
                <p className="mt-0.5 text-[11px] text-[var(--muted)]">Used to identify and contact you about your account.</p>
              </div>
              <span className="shrink-0 text-[11px] font-semibold text-[var(--muted)]">{completedProfileFields}/{profileFields.length} details</span>
            </div>

            {editingProfile ? (
              <form onSubmit={saveProfile} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-[11px] font-medium text-[var(--muted)]">
                    First name
                    <input required maxLength={100} autoComplete="given-name" value={profile.firstName} onChange={(event) => setProfile((current) => ({ ...current, firstName: event.target.value }))} className={inputClass} />
                  </label>
                  <label className="block text-[11px] font-medium text-[var(--muted)]">
                    Last name
                    <input required maxLength={100} autoComplete="family-name" value={profile.lastName} onChange={(event) => setProfile((current) => ({ ...current, lastName: event.target.value }))} className={inputClass} />
                  </label>
                  <label className="block text-[11px] font-medium text-[var(--muted)] sm:col-span-2">
                    Phone number <span className="font-normal">(optional)</span>
                    <input maxLength={50} type="tel" autoComplete="tel" value={profile.phone} onChange={(event) => setProfile((current) => ({ ...current, phone: event.target.value }))} className={inputClass} placeholder="Add a phone number" />
                  </label>
                  <div className="sm:col-span-2">
                    <span className="block text-[11px] font-medium text-[var(--muted)]">Sign-in email</span>
                    <p className="mt-1.5 break-all rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2.5 text-[13px] text-[var(--muted)]">{user.email}</p>
                    <p className="mt-1 text-[10px] text-[var(--muted)]">For an email change, contact your account administrator.</p>
                  </div>
                </div>
                {profileError && <p role="alert" className="rounded-lg border border-rose-500/20 bg-rose-500/5 px-3 py-2.5 text-[12px] text-rose-700">{profileError}</p>}
                <div className="flex flex-wrap gap-2">
                  <button type="submit" disabled={savingProfile || !profileIsDirty} className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2.5 text-[12px] font-semibold text-[var(--primary-foreground)] disabled:cursor-not-allowed disabled:opacity-50">
                    <Save size={14} /> {savingProfile ? 'Saving…' : 'Save changes'}
                  </button>
                  <button type="button" disabled={savingProfile} onClick={cancelProfileEdit} className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-4 py-2.5 text-[12px] font-medium hover:bg-[var(--surface-muted)] disabled:opacity-50">
                    <X size={14} /> Cancel
                  </button>
                </div>
              </form>
            ) : (
              <>
                <dl className="grid gap-x-5 gap-y-5 sm:grid-cols-2">
                  <InfoField label="First name" value={user.firstName} icon={<UserRound size={12} />} />
                  <InfoField label="Last name" value={user.lastName} icon={<UserRound size={12} />} />
                  <InfoField label="Email address" value={user.email} icon={<Mail size={12} />} href={`mailto:${user.email}`} />
                  <InfoField label="Phone number" value={user.phone} icon={<Phone size={12} />} href={user.phone ? `tel:${user.phone}` : undefined} />
                </dl>
                {profileSuccess && <p role="status" className="mt-4 flex items-center gap-2 text-[12px] text-emerald-700"><CheckCircle2 size={15} />{profileSuccess}</p>}
              </>
            )}
          </div>
        </div>

        <aside className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--primary)]/10 text-[var(--primary)]"><CheckCircle2 size={17} /></span>
            <div>
              <h3 className="text-[14px] font-semibold">Account readiness</h3>
              <p className="mt-1 text-[11px] leading-5 text-[var(--muted)]">A few complete details help your team and verification provider reach the right person quickly.</p>
            </div>
          </div>

          <div className="mt-5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-medium">Your profile</span>
              <span className="font-semibold text-[var(--primary)]">{profileProgress}%</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--surface-muted)]" role="progressbar" aria-label="Your profile completeness" aria-valuemin={0} aria-valuemax={100} aria-valuenow={profileProgress}>
              <div className="h-full rounded-full bg-[var(--primary)] transition-[width]" style={{ width: `${profileProgress}%` }} />
            </div>
          </div>

          <ul className="mt-4 space-y-2.5">
            {[
              { label: 'Name', complete: Boolean(user.firstName && user.lastName) },
              { label: 'Sign-in email', complete: Boolean(user.email) },
              { label: 'Phone number', complete: Boolean(user.phone) },
            ].map(({ label, complete }) => (
              <li key={label} className="flex items-center gap-2 text-[11px]">
                {complete ? <Check size={13} className="text-emerald-600" /> : <CircleAlert size={13} className="text-amber-600" />}
                <span className={complete ? 'text-[var(--muted)]' : 'font-medium'}>{label}</span>
                {!complete && !editingProfile && <button type="button" onClick={() => setEditingProfile(true)} className="ml-auto text-[var(--primary)] hover:underline">Add</button>}
              </li>
            ))}
          </ul>

          <div className="mt-5 border-t border-[var(--border)] pt-4">
            <div className="flex items-center justify-between gap-2 text-[11px]">
              <span className="font-medium">Organization details</span>
              <span className="font-semibold text-[var(--muted)]">{completedOrganizationFields}/{organizationFields.length}</span>
            </div>
            <p className="mt-1.5 text-[10px] leading-4 text-[var(--muted)]">Last sign-in: {formatLastLogin(user.lastLoginAt)}</p>
            {organizationProgress < 100 && (
              <div className="mt-3 rounded-lg bg-amber-500/5 p-3 text-[10px] leading-4 text-[var(--muted)]">
                Some organization details are missing. Ask your account contact to update them so your records stay accurate.
              </div>
            )}
          </div>
        </aside>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--primary)]/10 text-[var(--primary)]"><Building2 size={17} /></span>
            <div>
              <h3 className="text-[14px] font-semibold">{client?.name || 'Organization details'}</h3>
              <p className="mt-1 text-[11px] leading-5 text-[var(--muted)]">These details are used to identify your organization and support your BGV records.</p>
            </div>
          </div>
          {client?.contactEmail && (
            <a href={updateRequest} className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-2 text-[11px] font-semibold hover:bg-[var(--surface-muted)]">
              <Mail size={13} /> Request an update
            </a>
          )}
        </div>

        {client ? (
          <dl className="mt-6 grid gap-x-6 gap-y-5 border-t border-[var(--border)] pt-5 sm:grid-cols-2 lg:grid-cols-3">
            <InfoField label="Organization" value={client.name} icon={<Building2 size={12} />} />
            <InfoField label="Client code" value={client.clientCode} />
            <InfoField label="Industry" value={client.industry} />
            <InfoField label="Website" value={client.website} icon={<Globe2 size={12} />} href={client.website ? (client.website.startsWith('http') ? client.website : `https://${client.website}`) : undefined} />
            <InfoField label="Primary contact" value={client.contactName} icon={<UserRound size={12} />} />
            <InfoField label="Contact email" value={client.contactEmail} icon={<Mail size={12} />} href={client.contactEmail ? `mailto:${client.contactEmail}` : undefined} />
            <InfoField label="Contact phone" value={client.contactPhone} icon={<Phone size={12} />} href={client.contactPhone ? `tel:${client.contactPhone}` : undefined} />
            <InfoField label="Business address" value={address} icon={<MapPin size={12} />} />
          </dl>
        ) : (
          <p className="mt-5 border-t border-[var(--border)] pt-5 text-[12px] text-[var(--muted)]">No organization is currently linked to this account. Contact your administrator for help.</p>
        )}

        {client && !client.contactEmail && (
          <p className="mt-4 flex items-start gap-2 rounded-lg bg-amber-500/5 px-3 py-2.5 text-[11px] leading-5 text-[var(--muted)]">
            <CircleAlert size={14} className="mt-0.5 shrink-0 text-amber-600" />
            To change organization details, contact your verification provider or account administrator.
          </p>
        )}
      </section>

      <section id="security" className="scroll-mt-24 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--primary)]/10 text-[var(--primary)]"><KeyRound size={17} /></span>
          <div>
            <h3 className="text-[14px] font-semibold">Password and security</h3>
            <p className="mt-1 text-[11px] leading-5 text-[var(--muted)]">Choose a unique password with at least 8 characters. You’ll need your current password to change it.</p>
          </div>
        </div>

        <form onSubmit={savePassword} className="mt-5 grid gap-4 border-t border-[var(--border)] pt-5 sm:grid-cols-2">
          <label className="block text-[11px] font-medium text-[var(--muted)] sm:col-span-2">
            Current password
            <input required autoComplete="current-password" type="password" value={password.currentPassword} onChange={(event) => setPassword((current) => ({ ...current, currentPassword: event.target.value }))} className={inputClass} />
          </label>
          <label className="block text-[11px] font-medium text-[var(--muted)]">
            New password
            <input required minLength={8} maxLength={128} autoComplete="new-password" type="password" value={password.newPassword} onChange={(event) => setPassword((current) => ({ ...current, newPassword: event.target.value }))} className={inputClass} />
          </label>
          <label className="block text-[11px] font-medium text-[var(--muted)]">
            Confirm new password
            <input required minLength={8} maxLength={128} autoComplete="new-password" type="password" value={password.confirmPassword} onChange={(event) => setPassword((current) => ({ ...current, confirmPassword: event.target.value }))} className={inputClass} />
          </label>
          {passwordError && <p role="alert" className="rounded-lg border border-rose-500/20 bg-rose-500/5 px-3 py-2.5 text-[12px] text-rose-700 sm:col-span-2">{passwordError}</p>}
          {passwordSuccess && <p role="status" className="flex items-center gap-2 text-[12px] text-emerald-700 sm:col-span-2"><CheckCircle2 size={15} />{passwordSuccess}</p>}
          <div className="sm:col-span-2">
            <button type="submit" disabled={savingPassword} className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2.5 text-[12px] font-semibold text-[var(--primary-foreground)] disabled:opacity-50">
              <ShieldCheck size={14} /> {savingPassword ? 'Updating password…' : 'Update password'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
