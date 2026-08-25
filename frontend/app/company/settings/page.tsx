'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  User as UserIcon,
  ShieldCheck,
  KeyRound,
  Building2,
  Check,
  X,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  Camera,
  Lock,
} from 'lucide-react';
import { useAuth } from '@/src/auth/AuthProvider';
import { ApiError } from '@/src/lib/api';
import { updateProfile, changePassword } from '@/src/lib/api/users';
import { getCompany, updateCompany } from '@/src/lib/api/companies';
import type { User } from '@/src/types/user';

/* ------------------------------------------------------------------
   Theme tokens — same CSS variables as the rest of the app
   (--surface, --surface-muted, --border, --foreground, --muted,
   --primary, --primary-foreground from globals.css).
------------------------------------------------------------------- */

const card = 'bg-[var(--surface)] border border-[var(--border)]';
const cardBorderB = 'border-[var(--border)]';
const textPrimary = 'text-[var(--foreground)]';
const textMuted = 'text-[var(--muted)]';
const inputBase =
  'w-full rounded-lg bg-[var(--surface-muted)] border border-[var(--border)] px-3 py-2.5 text-[13.5px] text-[var(--foreground)] placeholder:text-[var(--muted)] outline-none focus:border-[var(--primary)]/50 focus:ring-1 focus:ring-[var(--primary)]/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
const tealChip = 'bg-[var(--primary)]/15 text-[var(--primary)]';

type Tab = 'profile' | 'security' | 'company';

function isApiError(err: unknown): err is ApiError {
  return err instanceof Error && 'status' in err;
}

function initials(firstName?: string, lastName?: string) {
  return `${firstName?.[0] ?? ''}${lastName?.[0] ?? ''}`.toUpperCase() || '?';
}

/* ------------------------------------------------------------------
   Password strength — same logic used on the login/reset-password
   flows, kept consistent app-wide.
------------------------------------------------------------------- */

const REQUIREMENTS: { label: string; test: (v: string) => boolean }[] = [
  { label: 'At least 8 characters', test: (v) => v.length >= 8 },
  { label: 'One uppercase letter', test: (v) => /[A-Z]/.test(v) },
  { label: 'One lowercase letter', test: (v) => /[a-z]/.test(v) },
  { label: 'One number', test: (v) => /[0-9]/.test(v) },
  { label: 'One special character', test: (v) => /[^A-Za-z0-9]/.test(v) },
];

function strengthMeta(score: number) {
  if (score <= 1) return { label: 'Weak', color: '#FF6B6B' };
  if (score <= 3) return { label: 'Fair', color: '#F2AE55' };
  return { label: score === 4 ? 'Good' : 'Strong', color: 'var(--primary)' };
}

export default function AccountSettingsPage() {
  const { user, accessToken, setUser } = useAuth() as {
    user: User | null;
    accessToken: string | null;
    setUser?: (u: User) => void;
  };

  const [tab, setTab] = useState<Tab>('profile');
  const isCompanyAdmin = Boolean(user?.role?.isCompanyAdmin || user?.role?.isSuperAdmin);

  const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'profile', label: 'Profile', icon: <UserIcon size={15} /> },
    { key: 'security', label: 'Password', icon: <KeyRound size={15} /> },
    ...(user?.companyId ? [{ key: 'company' as Tab, label: 'Company', icon: <Building2 size={15} /> }] : []),
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-7">
      <div>
        <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--primary)] mb-1.5" style={{ fontFamily: 'var(--font-mono)' }}>
          Account
        </p>
        <h1 className={`text-[26px] font-semibold tracking-tight ${textPrimary}`} style={{ fontFamily: 'var(--font-display)' }}>
          Account Settings
        </h1>
        <p className={`text-[13.5px] mt-1 ${textMuted}`}>Manage your profile, password, and company details.</p>
      </div>

      <div className="flex flex-col md:flex-row gap-7">
        <div className="md:w-52 shrink-0">
          <nav className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13px] font-medium whitespace-nowrap text-left transition-colors ${
                  tab === t.key ? tealChip : `${textMuted} hover:bg-[var(--surface-muted)]`
                }`}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex-1 min-w-0">
          {tab === 'profile' && <ProfileTab user={user} accessToken={accessToken} setUser={setUser} />}
          {tab === 'security' && <SecurityTab accessToken={accessToken} />}
          {tab === 'company' && user?.companyId && (
            <CompanyTab companyId={user.companyId} accessToken={accessToken} canEdit={isCompanyAdmin} />
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------
   Profile
------------------------------------------------------------------- */

function ProfileTab({
  user,
  accessToken,
  setUser,
}: {
  user: User | null;
  accessToken: string | null;
  setUser?: (u: User) => void;
}) {
  const [firstName, setFirstName] = useState(user?.firstName ?? '');
  const [lastName, setLastName] = useState(user?.lastName ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // The header block below reads from this, NOT from the `user` prop
  // directly. Relying on the prop meant the displayed name only updated
  // if AuthProvider's setUser (a) exists and (b) correctly propagates a
  // new object through context — unconfirmed, and apparently not
  // happening. This guarantees the header reflects a successful save
  // immediately, regardless of what AuthProvider does with setUser.
  const [displayUser, setDisplayUser] = useState(user);

  useEffect(() => {
    setFirstName(user?.firstName ?? '');
    setLastName(user?.lastName ?? '');
    // setPhone(user?.phone ?? '');
    setDisplayUser(user);
  }, [user?.id]);

  if (!displayUser) {
    return <div className={`rounded-2xl p-6 text-[13px] ${textMuted} ${card}`}>Loading…</div>;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setSaving(true);
    try {
      // Self-service endpoint (/users/me) — no id, and no roleId/status,
      // matching UpdateProfilePayload's whitelist.
      const updated = await updateProfile(accessToken, { firstName, lastName, phone });
      setDisplayUser(updated);
      setUser?.(updated); // best-effort global sync, not depended on above
      setSuccess(true);
    } catch (err) {
      setError(isApiError(err) ? err.message : 'Failed to update your profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      {success && (
        <div className="rounded-xl border px-4 py-3 text-[13px] flex items-center gap-2.5 bg-[var(--primary)]/10 border-[var(--primary)]/25 text-[var(--primary)]">
          <Check size={15} className="shrink-0" />
          Profile updated.
        </div>
      )}
      {error && (
        <div className="rounded-xl border px-4 py-3 text-[13px] flex items-start gap-2.5 bg-[#FF6B6B]/10 border-[#FF6B6B]/25 text-[#FF6B6B]">
          <AlertCircle size={15} className="shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      <div className={`rounded-2xl overflow-hidden ${card}`}>
        <div className={`px-6 py-5 border-b flex items-center gap-3.5 ${cardBorderB}`}>
          <div className={`w-12 h-12 rounded-full flex items-center justify-center text-[15px] font-semibold shrink-0 ${tealChip}`}>
            {initials(displayUser.firstName, displayUser.lastName)}
          </div>
          <div className="min-w-0">
            <p className={`text-[15px] font-semibold truncate ${textPrimary}`} style={{ fontFamily: 'var(--font-display)' }}>
              {displayUser.firstName} {displayUser.lastName}
            </p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {displayUser.role && (
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${tealChip}`}>
                  <ShieldCheck size={11} /> {displayUser.role.name}
                </span>
              )}
              {displayUser.company && (
                <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium bg-[var(--muted)]/15 text-[var(--muted)]">
                  <Building2 size={11} /> {displayUser.company.name}
                </span>
              )}
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={`block text-[11.5px] font-medium mb-1.5 ${textMuted}`}>First name</label>
              <input className={inputBase} value={firstName} onChange={(e) => setFirstName(e.target.value)} required disabled={saving} />
            </div>
            <div>
              <label className={`block text-[11.5px] font-medium mb-1.5 ${textMuted}`}>Last name</label>
              <input className={inputBase} value={lastName} onChange={(e) => setLastName(e.target.value)} required disabled={saving} />
            </div>
          </div>

          <div>
            <label className={`block text-[11.5px] font-medium mb-1.5 ${textMuted}`}>Phone</label>
            <input
              className={inputBase}
              value={phone ?? ''}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 555 000 0000"
              disabled={saving}
            />
          </div>

          <div>
            <label className={`block text-[11.5px] font-medium mb-1.5 ${textMuted}`}>Email</label>
            <input className={`${inputBase} opacity-60 cursor-not-allowed`} value={displayUser.email} disabled />
            <p className={`text-[11px] mt-1.5 ${textMuted}`}>Contact an administrator to change your email address.</p>
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-1.5 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] text-[13px] font-semibold px-4 py-2.5 hover:bg-[var(--primary)]/90 transition-colors disabled:opacity-40"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------
   Security / change password
------------------------------------------------------------------- */

function PasswordField({
  label,
  value,
  onChange,
  show,
  onToggleShow,
  placeholder,
  invalid,
  rightAdornment,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggleShow: () => void;
  placeholder: string;
  invalid?: boolean;
  rightAdornment?: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className={`text-[12px] ${textMuted}`}>{label}</label>
      <div className="relative">
        <span className={`absolute left-3 top-1/2 -translate-y-1/2 ${textMuted}`}>
          <Lock size={14} />
        </span>
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
          placeholder={placeholder}
          className={`${inputBase} pl-9 pr-16 ${invalid ? 'border-[#FF6B6B]/50 focus:border-[#FF6B6B]/60 focus:ring-[#FF6B6B]/20' : ''}`}
        />
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-2">
          {rightAdornment}
          <button type="button" onClick={onToggleShow} className={`${textMuted} hover:text-[var(--foreground)] transition-colors`} tabIndex={-1}>
            {show ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </span>
      </div>
    </div>
  );
}

function SecurityTab({ accessToken }: { accessToken: string | null }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const checks = useMemo(() => REQUIREMENTS.map((r) => ({ ...r, passed: r.test(newPassword) })), [newPassword]);
  const score = checks.filter((c) => c.passed).length;
  const strength = strengthMeta(score);
  const showStrength = newPassword.length > 0;

  const confirmTouched = confirmPassword.length > 0;
  const passwordsMatch = confirmPassword === newPassword && confirmPassword.length > 0;
  const passwordsMismatch = confirmTouched && !passwordsMatch;
  const samePasswordWarning = currentPassword.length > 0 && newPassword.length > 0 && currentPassword === newPassword;

  const canSubmit =
    currentPassword.length > 0 && newPassword.length > 0 && passwordsMatch && score === REQUIREMENTS.length && !samePasswordWarning && !loading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    if (newPassword !== confirmPassword) return setError('New password and confirmation do not match.');
    if (score < REQUIREMENTS.length) return setError('Please meet all password requirements before continuing.');
    if (samePasswordWarning) return setError('New password must be different from your current password.');

    setLoading(true);
    try {
      await changePassword(accessToken, { currentPassword, newPassword, confirmPassword });
      setSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(isApiError(err) ? err.message : 'Failed to change password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      {success && (
        <div className="rounded-xl border px-4 py-3 text-[13px] flex items-center gap-2.5 bg-[var(--primary)]/10 border-[var(--primary)]/25 text-[var(--primary)]">
          <ShieldCheck size={15} className="shrink-0" />
          Your password was changed successfully.
        </div>
      )}
      {error && (
        <div className="rounded-xl border px-4 py-3 text-[13px] flex items-start gap-2.5 bg-[#FF6B6B]/10 border-[#FF6B6B]/25 text-[#FF6B6B]">
          <AlertCircle size={15} className="shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      <div className={`rounded-2xl overflow-hidden ${card}`}>
        <div className={`px-6 pt-6 pb-4 border-b flex items-center gap-2.5 ${cardBorderB}`}>
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${tealChip}`}>
            <KeyRound size={15} />
          </div>
          <div>
            <h2 className={`text-[14px] font-semibold ${textPrimary}`} style={{ fontFamily: 'var(--font-display)' }}>
              Change password
            </h2>
            <p className={`text-[11.5px] ${textMuted}`}>You'll stay signed in on this device after changing it.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          <PasswordField
            label="Current password"
            value={currentPassword}
            onChange={setCurrentPassword}
            show={showCurrent}
            onToggleShow={() => setShowCurrent((v) => !v)}
            placeholder="Enter your current password"
          />

          <div>
            <PasswordField
              label="New password"
              value={newPassword}
              onChange={setNewPassword}
              show={showNew}
              onToggleShow={() => setShowNew((v) => !v)}
              placeholder="Enter a new password"
              invalid={samePasswordWarning}
            />
            {samePasswordWarning && <p className="text-[11px] text-[#FF6B6B] mt-1.5">New password must be different from your current one.</p>}

            {showStrength && (
              <div className="pt-2.5">
                <div className="flex items-center gap-1.5 mb-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-1 flex-1 rounded-full overflow-hidden bg-[var(--border)]">
                      <div className="h-full rounded-full transition-all duration-300" style={{ width: i < score ? '100%' : '0%', background: strength.color }} />
                    </div>
                  ))}
                </div>
                <span className="text-[11px] font-medium" style={{ color: strength.color }}>
                  {strength.label}
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1 mt-2">
                  {checks.map((c) => (
                    <div key={c.label} className="flex items-center gap-1.5">
                      {c.passed ? <Check size={11} className="text-[var(--primary)] shrink-0" /> : <X size={11} className={`shrink-0 ${textMuted}`} />}
                      <span className={`text-[11px] ${c.passed ? 'text-[var(--primary)]' : textMuted}`}>{c.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div>
            <PasswordField
              label="Confirm new password"
              value={confirmPassword}
              onChange={setConfirmPassword}
              show={showConfirm}
              onToggleShow={() => setShowConfirm((v) => !v)}
              placeholder="Re-enter your new password"
              invalid={passwordsMismatch}
              rightAdornment={confirmTouched ? passwordsMatch ? <Check size={14} className="text-[var(--primary)]" /> : <X size={14} className="text-[#FF6B6B]" /> : null}
            />
            {passwordsMismatch && <p className="text-[11px] text-[#FF6B6B] mt-1.5">Passwords don't match yet.</p>}
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={!canSubmit}
              className="flex items-center gap-1.5 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] text-[13px] font-semibold px-4 py-2.5 hover:bg-[var(--primary)]/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : null}
              {loading ? 'Changing…' : 'Change password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------
   Company — visible to everyone with a companyId; editable only for
   isCompanyAdmin / isSuperAdmin, mirroring how company.service.js's
   update() is a distinct, more privileged action from a self profile
   edit.
------------------------------------------------------------------- */

interface CompanyFormState {
  name: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  primaryColor: string;
}

const primaryColorPalette = ['#0E8C78', '#1F417A', '#2563EB', '#7C3AED', '#C2410C', '#BE123C', '#374151', '#0F766E'];

function CompanyTab({ companyId, accessToken, canEdit }: { companyId: string; accessToken: string | null; canEdit: boolean }) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState<CompanyFormState>({ name: '', contactEmail: '', contactPhone: '', address: '', primaryColor: '' });
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const c = await getCompany(companyId, accessToken);
        if (cancelled) return;
        setForm({
          name: c.name ?? '',
          contactEmail: c.contactEmail ?? '',
          contactPhone: c.contactPhone ?? '',
          address: c.address ?? '',
          primaryColor: c.primaryColor ?? '',
        });
        setLogoPreview(c.logoUrl);
      } catch (err) {
        if (!cancelled) setLoadError(isApiError(err) ? err.message : 'Failed to load company details.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId, accessToken]);

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;
    setLogoFile(file);
    setRemoveLogo(false);
    setLogoPreview(URL.createObjectURL(file));
  };

  const handleRemoveLogo = () => {
    setLogoFile(null);
    setRemoveLogo(true);
    setLogoPreview(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    setError(null);
    setSuccess(false);
    setSaving(true);
    try {
      const payload = new FormData();
      payload.append('name', form.name.trim());
      if (form.contactEmail.trim()) payload.append('contactEmail', form.contactEmail.trim());
      if (form.contactPhone.trim()) payload.append('contactPhone', form.contactPhone.trim());
      if (form.address.trim()) payload.append('address', form.address.trim());
      if (form.primaryColor.trim()) payload.append('primaryColor', form.primaryColor.trim());
      if (logoFile) payload.append('logo', logoFile);
      if (removeLogo) payload.append('removeLogo', 'true');

      const updated = await updateCompany(companyId, payload, accessToken);
      setLogoPreview(updated.logoUrl);
      setLogoFile(null);
      setRemoveLogo(false);
      setSuccess(true);
    } catch (err) {
      setError(isApiError(err) ? err.message : 'Failed to update company.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className={`rounded-2xl p-6 text-[13px] flex items-center gap-2 ${textMuted} ${card}`}>
        <Loader2 size={14} className="animate-spin" /> Loading company…
      </div>
    );
  }
  if (loadError) {
    return <div className="rounded-2xl p-6 text-[13px] bg-[#FF6B6B]/10 border border-[#FF6B6B]/25 text-[#FF6B6B]">{loadError}</div>;
  }

  return (
    <div className="space-y-5">
      {success && (
        <div className="rounded-xl border px-4 py-3 text-[13px] flex items-center gap-2.5 bg-[var(--primary)]/10 border-[var(--primary)]/25 text-[var(--primary)]">
          <Check size={15} className="shrink-0" />
          Company details updated.
        </div>
      )}
      {error && (
        <div className="rounded-xl border px-4 py-3 text-[13px] flex items-start gap-2.5 bg-[#FF6B6B]/10 border-[#FF6B6B]/25 text-[#FF6B6B]">
          <AlertCircle size={15} className="shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      <div className={`rounded-2xl overflow-hidden ${card}`}>
        <div className={`px-6 pt-6 pb-4 border-b flex items-center gap-2.5 ${cardBorderB}`}>
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${tealChip}`}>
            <Building2 size={15} />
          </div>
          <div>
            <h2 className={`text-[14px] font-semibold ${textPrimary}`} style={{ fontFamily: 'var(--font-display)' }}>
              Company details
            </h2>
            <p className={`text-[11.5px] ${textMuted}`}>
              {canEdit ? 'Visible on invites and reports issued by your company.' : 'Only company admins can edit these details.'}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl bg-[var(--surface-muted)] border border-[var(--border)] flex items-center justify-center overflow-hidden shrink-0">
              {logoPreview ? (
                <img src={logoPreview} alt="Company logo" className="w-full h-full object-cover" />
              ) : (
                <Building2 size={22} className={textMuted} />
              )}
            </div>
            {canEdit && (
              <div className="flex items-center gap-2">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--primary)]/25 bg-[var(--primary)]/10 px-3 py-2 text-[12px] font-medium text-[var(--primary)] hover:bg-[var(--primary)]/20 transition-colors">
                  <Camera size={13} />
                  Change logo
                  <input type="file" accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml" className="hidden" onChange={handleLogoSelect} />
                </label>
                {logoPreview && (
                  <button type="button" onClick={handleRemoveLogo} className="text-[12px] text-[#FF6B6B] hover:underline">
                    Remove
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={`block text-[11.5px] font-medium mb-1.5 ${textMuted}`}>Company name</label>
              <input
                className={inputBase}
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                disabled={!canEdit || saving}
                required
              />
            </div>
            <div>
              <label className={`block text-[11.5px] font-medium mb-1.5 ${textMuted}`}>Primary color</label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={/^#[0-9a-f]{6}$/i.test(form.primaryColor) ? form.primaryColor : '#3FDCC0'}
                  onChange={(e) => setForm((f) => ({ ...f, primaryColor: e.target.value.toUpperCase() }))}
                  disabled={!canEdit || saving}
                  className="h-11 w-12 cursor-pointer rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-1 disabled:cursor-not-allowed"
                  aria-label="Choose primary color"
                />
                <input
                  className={inputBase}
                  value={form.primaryColor}
                  onChange={(e) => setForm((f) => ({ ...f, primaryColor: e.target.value }))}
                  placeholder="#3FDCC0"
                  pattern="^#[0-9a-fA-F]{6}$"
                  disabled={!canEdit || saving}
                />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {primaryColorPalette.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, primaryColor: color }))}
                    disabled={!canEdit || saving}
                    className={`h-7 w-7 rounded-full border-2 transition-transform hover:scale-110 disabled:cursor-not-allowed disabled:opacity-50 ${form.primaryColor.toUpperCase() === color ? 'border-[var(--foreground)] ring-2 ring-[var(--primary)]/40' : 'border-white/20'}`}
                    style={{ backgroundColor: color }}
                    aria-label={`Select ${color}`}
                    title={color}
                  />
                ))}
                <span className={`text-[11px] ${textMuted}`}>Choose a palette color or enter a hex code.</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={`block text-[11.5px] font-medium mb-1.5 ${textMuted}`}>Contact email</label>
              <input
                type="email"
                className={inputBase}
                value={form.contactEmail}
                onChange={(e) => setForm((f) => ({ ...f, contactEmail: e.target.value }))}
                disabled={!canEdit || saving}
              />
            </div>
            <div>
              <label className={`block text-[11.5px] font-medium mb-1.5 ${textMuted}`}>Contact phone</label>
              <input
                className={inputBase}
                value={form.contactPhone}
                onChange={(e) => setForm((f) => ({ ...f, contactPhone: e.target.value }))}
                disabled={!canEdit || saving}
              />
            </div>
          </div>

          <div>
            <label className={`block text-[11.5px] font-medium mb-1.5 ${textMuted}`}>Address</label>
            <textarea
              className={`${inputBase} min-h-[80px] resize-none`}
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              disabled={!canEdit || saving}
            />
          </div>

          {canEdit && (
            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-1.5 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] text-[13px] font-semibold px-4 py-2.5 hover:bg-[var(--primary)]/90 transition-colors disabled:opacity-40"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}