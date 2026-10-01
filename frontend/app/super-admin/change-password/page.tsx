'use client';

import { useMemo, useState } from 'react';
import { Lock, Eye, EyeOff, Loader2, AlertCircle, Check, X, ShieldCheck, KeyRound } from 'lucide-react';
import { useAuth } from '@/src/auth/AuthProvider';
import { changePassword, ApiError } from '@/src/lib/auth';

/* ------------------------------------------------------------------
   Theme tokens — same light/dark pairing used across the company app
   (dashboard, settings). This page lives inside the authenticated
   shell, so it follows that convention rather than the public
   full-bleed auth-page style used by login/reset-password.
------------------------------------------------------------------- */

const card = 'bg-white dark:bg-[#161C3A] border border-slate-200 dark:border-white/[0.08]';
const cardBorderB = 'border-slate-200 dark:border-white/[0.08]';
const textPrimary = 'text-slate-900 dark:text-[#F2F4FA]';
const textMuted = 'text-slate-500 dark:text-[#8891B8]';
const textFaint = 'text-slate-400 dark:text-[#565F8C]';
const tealChip = 'bg-[var(--primary)]/10 dark:bg-[var(--primary)]/15 text-[var(--primary)]';
const inputBg = 'bg-slate-50 dark:bg-[#0B0F26]';
const inputBorder = 'border-slate-200 dark:border-white/[0.08]';
const trackBg = 'bg-slate-200 dark:bg-white/[0.08]';

/* ------------------------------------------------------------------
   Password strength — same five checks and scoring as reset-password,
   kept in sync so both flows communicate the same requirements.
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
  if (score === 4) return { label: 'Good', color: 'var(--primary)' };
  return { label: 'Strong', color: 'var(--primary)' };
}

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
        <span className={`absolute left-3 top-1/2 -translate-y-1/2 ${textFaint}`}>
          <Lock size={14} />
        </span>
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
          placeholder={placeholder}
          className={`w-full rounded-lg ${inputBg} border pl-9 pr-16 py-2.5 text-[13.5px] ${textPrimary} placeholder:text-slate-400 dark:placeholder:text-[#565F8C] outline-none focus:ring-1 transition-colors ${
            invalid
              ? 'border-[#FF6B6B]/50 focus:border-[#FF6B6B]/60 focus:ring-[#FF6B6B]/20'
              : `${inputBorder} focus:border-[var(--primary)]/50 focus:ring-[var(--primary)]/30`
          }`}
        />
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-2">
          {rightAdornment}
          <button
            type="button"
            onClick={onToggleShow}
            className={`transition-colors ${textFaint} hover:text-slate-600 dark:hover:text-[#AAB2D4]`}
            aria-label={show ? 'Hide password' : 'Show password'}
            tabIndex={-1}
          >
            {show ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </span>
      </div>
    </div>
  );
}

export default function ChangePasswordPage() {
  const { accessToken } = useAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const checks = useMemo(
    () => REQUIREMENTS.map((r) => ({ ...r, passed: r.test(newPassword) })),
    [newPassword]
  );
  const score = checks.filter((c) => c.passed).length;
  const strength = strengthMeta(score);
  const showStrength = newPassword.length > 0;

  const confirmTouched = confirmPassword.length > 0;
  const passwordsMatch = confirmPassword === newPassword && confirmPassword.length > 0;
  const passwordsMismatch = confirmTouched && !passwordsMatch;

  const samePasswordWarning =
    currentPassword.length > 0 && newPassword.length > 0 && currentPassword === newPassword;

  const canSubmit =
    currentPassword.length > 0 &&
    newPassword.length > 0 &&
    passwordsMatch &&
    score === REQUIREMENTS.length &&
    !samePasswordWarning &&
    !loading;

  const resetFields = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSuccess(false);

    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }
    if (score < REQUIREMENTS.length) {
      setError('Please meet all password requirements before continuing.');
      return;
    }
    if (samePasswordWarning) {
      setError('New password must be different from your current password.');
      return;
    }

    setLoading(true);
    try {
      await changePassword({ currentPassword, newPassword, confirmPassword }, accessToken);
      setSuccess(true);
      resetFields();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to change password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-7">
      {/* Header */}
      <div>
        <p
          className="text-[11px] uppercase tracking-[0.14em] text-[var(--primary)] mb-1.5"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          Account Security
        </p>
        <h1 className={`text-[26px] font-semibold tracking-tight ${textPrimary}`} style={{ fontFamily: 'var(--font-display)' }}>
          Change Password
        </h1>
        <p className={`text-[13.5px] mt-1 ${textMuted}`}>
          Update the password used to sign in to your company account.
        </p>
      </div>

      {/* Banner */}
      {success && (
        <div className="rounded-xl border px-4 py-3 text-[13px] flex items-center gap-2.5 bg-[var(--primary)]/10 border-[var(--primary)]/25 text-[var(--primary)]">
          <ShieldCheck size={15} className="shrink-0" />
          <span>Your password was changed successfully.</span>
        </div>
      )}
      {error && (
        <div className="rounded-xl border px-4 py-3 text-[13px] flex items-start gap-2.5 bg-[#FF6B6B]/10 border-[#FF6B6B]/25 text-[#FF6B6B]">
          <AlertCircle size={15} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Form card */}
      <div className={`rounded-2xl overflow-hidden ${card}`}>
        <div className={`px-6 pt-6 pb-4 border-b flex items-center gap-2.5 ${cardBorderB}`}>
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${tealChip}`}>
            <KeyRound size={15} />
          </div>
          <div>
            <h2 className={`text-[14px] font-semibold ${textPrimary}`} style={{ fontFamily: 'var(--font-display)' }}>
              Update your password
            </h2>
            <p className={`text-[11.5px] ${textFaint}`}>You'll stay signed in on this device after changing it.</p>
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
            {samePasswordWarning && (
              <p className="text-[11px] text-[#FF6B6B] mt-1.5">
                New password must be different from your current one.
              </p>
            )}

            {showStrength && (
              <div className="pt-2.5">
                <div className="flex items-center gap-1.5 mb-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className={`h-1 flex-1 rounded-full overflow-hidden ${trackBg}`}>
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{ width: i < score ? '100%' : '0%', background: strength.color }}
                      />
                    </div>
                  ))}
                </div>
                <span className="text-[11px] font-medium" style={{ color: strength.color }}>
                  {strength.label}
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1 mt-2">
                  {checks.map((c) => (
                    <div key={c.label} className="flex items-center gap-1.5">
                      {c.passed ? (
                        <Check size={11} className="text-[var(--primary)] shrink-0" />
                      ) : (
                        <X size={11} className={`shrink-0 ${textFaint}`} />
                      )}
                      <span className={`text-[11px] ${c.passed ? 'text-[var(--primary)]' : textFaint}`}>{c.label}</span>
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
              rightAdornment={
                confirmTouched ? (
                  passwordsMatch ? (
                    <Check size={14} className="text-[var(--primary)]" />
                  ) : (
                    <X size={14} className="text-[#FF6B6B]" />
                  )
                ) : null
              }
            />
            {passwordsMismatch && <p className="text-[11px] text-[#FF6B6B] mt-1.5">Passwords don't match yet.</p>}
          </div>

          <div className="flex items-center justify-end gap-3 pt-1">
            <button
              type="submit"
              disabled={!canSubmit}
              className="flex items-center gap-1.5 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] text-[13px] font-semibold px-4 py-2.5 hover:bg-[var(--primary)]/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Changing…
                </>
              ) : (
                'Change password'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}