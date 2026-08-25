'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  LogIn,
  Loader2,
  AlertCircle,
  ShieldCheck,
  BarChart3,
  Users,
  ClipboardList,
  Sparkles,
  ArrowRight,
  Building2,
  CheckCircle2,
} from 'lucide-react';
import BrandMark from '@/src/components/ui/BrandMark';
import PublicNav from '@/src/components/ui/publicnav';

import PublicRoute from '@/src/auth/PublicRoute';
import { login } from '@/src/auth/auth-service';
import { ApiError } from '@/src/lib/api';

// Illustrative case shown in the "sample report" preview card — demo data only
const SIDE_CHECKS = [
  { label: 'PAN verification', result: 'Verified', color: '#3FDCC0' },
  { label: 'UAN verification', result: 'Verified', color: '#3FDCC0' },
  { label: 'Court verification', result: 'No record found', color: '#818CF8' },
];

const SIDE_HIGHLIGHTS = [
  { icon: ClipboardList, title: 'Centralized case management', color: '#3FDCC0' },
  { icon: Users, title: 'Invite & track candidates', color: '#818CF8' },
  { icon: BarChart3, title: 'Client-ready reports', color: '#F2AE55' },
  { icon: ShieldCheck, title: 'Role-based access', color: '#F472B6' },
];

function LoginContent() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const formatDisplayError = (err: unknown): string => {
    if (typeof err === 'string') {
      try {
        const parsed = JSON.parse(err);
        if (parsed && typeof parsed === 'object' && typeof parsed.message === 'string') {
          return parsed.message;
        }
      } catch {
        return err;
      }
      return err;
    }
    if (err instanceof Error && typeof err.message === 'string') {
      try {
        const parsed = JSON.parse(err.message);
        if (parsed && typeof parsed === 'object' && typeof parsed.message === 'string') {
          return parsed.message;
        }
      } catch {
        return err.message;
      }
    }
    if (typeof err === 'object' && err !== null) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const anyErr = err as any;
      if (typeof anyErr.message === 'string') return anyErr.message;
      if (typeof anyErr.toString === 'function') return anyErr.toString();
    }
    return 'An error occurred while signing in. Please try again.';
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    setError('');
    setLoading(true);

    try {
      const session = await login(email, password);

      let target = '/dashboard';
      if (session.user.role.isSuperAdmin) target = '/super-admin/dashboard';
      else if (session.user.role.isCompanyAdmin) target = '/company/dashboard';
      else target = '/company/dashboard';

      // Hard navigation on purpose: router.replace()+refresh() left the
      // target route reading stale auth state for a beat, causing a
      // flash back to /login before landing on the right dashboard.
      // A full navigation guarantees the new route picks up the fresh
      // session immediately.
      window.location.href = target;
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) {
          setError('Invalid email or password. Please try again.');
        } else if (err.status === 422) {
          setError(formatDisplayError(err.message) || 'Please check the email and password fields.');
        } else {
          setError(formatDisplayError(err.message) || 'An error occurred while signing in. Please try again.');
        }
      } else {
        setError(formatDisplayError(err));
      }
      setLoading(false);
    }
  }

  return (
    <div
      className="h-screen flex flex-col overflow-hidden"
      style={{ background: 'var(--background)' }}
    >
      {/* Ambient background glow */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            'radial-gradient(60% 50% at 18% 8%, rgba(63,220,192,0.14) 0%, transparent 60%), radial-gradient(50% 45% at 88% 92%, rgba(242,174,85,0.10) 0%, transparent 60%)',
        }}
      />
      <style>{`
        @keyframes ringPulse {
          0% { box-shadow: 0 0 0 0 rgba(63,220,192,0.35); }
          70% { box-shadow: 0 0 0 8px rgba(63,220,192,0); }
          100% { box-shadow: 0 0 0 0 rgba(63,220,192,0); }
        }
        .badge-ring { animation: ringPulse 2.4s ease-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .badge-ring { animation: none; }
        }
      `}</style>

      {/* PublicNav themes itself via CSS vars — no override needed here */}
      <div className="relative shrink-0">
        <PublicNav />
      </div>

      <div className="relative flex-1 min-h-0 grid lg:grid-cols-2 overflow-hidden">
        {/* Left: compact info / branding panel */}
        <div
          className="hidden lg:flex flex-col justify-center px-10 xl:px-14 py-6 border-r relative overflow-hidden min-h-0"
          style={{ borderColor: 'var(--border)' }}
        >
          <div
            className="pointer-events-none absolute -top-20 -left-20 h-64 w-64 rounded-full opacity-20 blur-3xl"
            style={{ background: '#3FDCC0' }}
          />
          <div
            className="pointer-events-none absolute -bottom-24 -right-8 h-56 w-56 rounded-full opacity-[0.12] blur-3xl"
            style={{ background: '#F2AE55' }}
          />

          <div className="relative max-w-md">
            <div
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10.5px] mb-3.5"
              style={{ borderColor: 'var(--border)', background: 'var(--surface-muted)', color: 'var(--muted)' }}
            >
              <Sparkles size={12} className="text-[#3FDCC0]" />
              Background verification platform
            </div>

            <h2
              className="text-[24px] xl:text-[28px] font-semibold tracking-tight leading-[1.15]"
              style={{ fontFamily: 'var(--font-display)', color: 'var(--foreground)' }}
            >
              Hiring decisions,{' '}
              <span className="bg-gradient-to-r from-[#3FDCC0] to-[#F2AE55] bg-clip-text text-transparent">
                backed by verified facts.
              </span>
            </h2>
            <p className="text-[13px] mt-2.5 leading-relaxed" style={{ color: 'var(--muted)' }}>
              Manage verification cases, review findings, and share approved reports securely
              with your clients once a candidate submits their information.
            </p>

            {/* Feature highlights — compact 2x2 grid */}
            <div className="grid grid-cols-2 gap-2.5 mt-5">
              {SIDE_HIGHLIGHTS.map(({ icon: Icon, title, color }) => (
                <div
                  key={title}
                  className="flex items-center gap-2 rounded-lg border px-2.5 py-2"
                  style={{ borderColor: 'var(--border)', background: 'var(--surface-muted)' }}
                >
                  <span
                    className="shrink-0 w-7 h-7 rounded-md flex items-center justify-center"
                    style={{ background: `${color}22`, color }}
                  >
                    <Icon size={13} />
                  </span>
                  <p className="text-[11.5px] font-medium leading-tight" style={{ color: 'var(--foreground)' }}>
                    {title}
                  </p>
                </div>
              ))}
            </div>

            {/* Mini live case preview */}
            <div
              className="mt-5 rounded-xl border p-4"
              style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
            >
              <div className="flex items-center justify-between mb-3">
                <p
                  className="text-[9.5px] uppercase tracking-[0.14em]"
                  style={{ fontFamily: 'var(--font-mono)', color: 'var(--muted)' }}
                >
                  Sample verification case
                </p>
                <span className="flex items-center gap-1 rounded-full bg-[#3FDCC0]/12 text-[#3FDCC0] text-[10px] font-semibold px-2 py-0.5">
                  <BarChart3 size={10} />
                  Ready
                </span>
              </div>
              <div className="space-y-2.5">
                {SIDE_CHECKS.map((check) => (
                  <div key={check.label} className="flex items-center justify-between text-[11.5px]">
                    <span className="flex items-center gap-1.5" style={{ color: 'var(--foreground)' }}>
                      <CheckCircle2 size={12} style={{ color: check.color }} />
                      {check.label}
                    </span>
                    <span style={{ color: check.color, fontFamily: 'var(--font-mono)' }}>{check.result}</span>
                  </div>
                ))}
              </div>
              <div
                className="flex items-center justify-between mt-3 pt-3 border-t"
                style={{ borderColor: 'var(--border)' }}
              >
                <span className="text-[10.5px]" style={{ color: 'var(--muted)' }}>
                  Overall case result
                </span>
                <span
                  className="text-[11.5px] font-semibold px-2 py-0.5 rounded-full"
                  style={{ color: '#3FDCC0', background: 'rgba(63,220,192,0.12)', fontFamily: 'var(--font-mono)' }}
                >
                  Clear
                </span>
              </div>
            </div>

            {/* Register company callout */}
            <div className="mt-4 rounded-xl border border-[#3FDCC0]/20 bg-[#3FDCC0]/[0.06] px-3.5 py-3 flex items-center gap-3">
              <span className="shrink-0 w-8 h-8 rounded-lg bg-[#3FDCC0]/15 text-[#3FDCC0] flex items-center justify-center">
                <Building2 size={15} />
              </span>
              <div className="min-w-0">
                <p className="text-[11.5px] font-semibold leading-tight" style={{ color: 'var(--foreground)' }}>
                  Want to register your company?
                </p>
                <Link
                  href="/contact"
                  className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-[#3FDCC0] hover:underline mt-1"
                >
                  Contact us
                  <ArrowRight size={11} />
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Right: login form */}
        <div className="flex items-center justify-center px-4 py-4 min-h-0 overflow-y-auto">
          <div className="w-full max-w-[360px]">
            <Link href="/" className="flex flex-col items-center mb-4 group lg:hidden" aria-label="Go to homepage">
              <span className="badge-ring w-9 h-9 rounded-xl bg-[#3FDCC0]/15 text-[#3FDCC0] flex items-center justify-center mb-2 transition-transform group-hover:scale-105 group-active:scale-95">
                <BrandMark size={18} />
              </span>
              <h1
                className="text-[18px] font-semibold tracking-tight group-hover:text-[#3FDCC0] transition-colors"
                style={{ fontFamily: 'var(--font-display)', color: 'var(--foreground)' }}
              >
                Welcome back
              </h1>
              <p className="text-[12px] mt-1" style={{ color: 'var(--muted)' }}>
                Sign in to your HireVerify account
              </p>
            </Link>

            {/* Desktop heading (no logo, since navbar already shows it) */}
            <div className="hidden lg:block mb-4 text-center">
              <h1
                className="text-[21px] font-semibold tracking-tight"
                style={{ fontFamily: 'var(--font-display)', color: 'var(--foreground)' }}
              >
                Welcome back
              </h1>
              <p className="text-[12.5px] mt-1" style={{ color: 'var(--muted)' }}>
                Sign in to your HireVerify account
              </p>
            </div>

            <form
              onSubmit={handleSubmit}
              className="rounded-2xl border shadow-[0_20px_60px_-15px_rgba(0,0,0,0.25)] px-5 py-5 space-y-3"
              style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
            >
              {error && (
                <div className="flex items-start gap-2 rounded-lg bg-[#FF6B6B]/10 border border-[#FF6B6B]/25 text-[#FF6B6B] text-[12.5px] px-3 py-2">
                  <AlertCircle size={14} className="shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[11.5px]" style={{ color: 'var(--muted)' }}>
                  Email
                </label>
                <div className="relative">
                  <span
                    className="absolute left-3 top-1/2 -translate-y-1/2"
                    style={{ color: 'var(--muted)' }}
                  >
                    <Mail size={14} />
                  </span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    placeholder="you@company.com"
                    className="w-full rounded-lg pl-8 pr-3 py-2 text-[13px] outline-none border focus:border-[#3FDCC0]/50 focus:ring-1 focus:ring-[#3FDCC0]/30 transition-colors"
                    style={{ background: 'var(--surface-muted)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11.5px]" style={{ color: 'var(--muted)' }}>
                    Password
                  </label>
                  <Link href="/forgot-password" className="text-[11.5px] text-[#3FDCC0] hover:underline">
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <span
                    className="absolute left-3 top-1/2 -translate-y-1/2"
                    style={{ color: 'var(--muted)' }}
                  >
                    <Lock size={14} />
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    placeholder="••••••••"
                    className="w-full rounded-lg pl-8 pr-8 py-2 text-[13px] outline-none border focus:border-[#3FDCC0]/50 focus:ring-1 focus:ring-[#3FDCC0]/30 transition-colors"
                    style={{ background: 'var(--surface-muted)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                    style={{ color: 'var(--muted)' }}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              <label
                className="flex items-center gap-2 text-[12px] cursor-pointer select-none"
                style={{ color: 'var(--muted)' }}
              >
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border accent-[#3FDCC0] cursor-pointer"
                  style={{ borderColor: 'var(--border)', background: 'var(--surface-muted)' }}
                />
                Keep me signed in
              </label>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-[#3FDCC0] text-[#0B0F26] text-[13px] font-semibold px-4 py-2.5 hover:brightness-[1.08] active:scale-[0.99] transition disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Signing in…
                  </>
                ) : (
                  <>
                    <LogIn size={14} />
                    Sign in
                  </>
                )}
              </button>
            </form>

            <p className="text-center text-[12px] mt-3.5" style={{ color: 'var(--muted)' }}>
              Need help?{' '}
              <Link href="/contact" className="text-[#3FDCC0] hover:underline">
                Contact us
              </Link>
            </p>

            {/* Mobile-only register callout (hidden on desktop since it's in the left panel) */}
            <div className="lg:hidden mt-3.5 rounded-xl border border-[#3FDCC0]/20 bg-[#3FDCC0]/[0.06] px-3.5 py-2.5 flex items-center gap-2.5">
              <span className="shrink-0 w-7 h-7 rounded-lg bg-[#3FDCC0]/15 text-[#3FDCC0] flex items-center justify-center">
                <Building2 size={13} />
              </span>
              <div className="min-w-0">
                <p className="text-[11.5px] font-semibold leading-tight" style={{ color: 'var(--foreground)' }}>
                  Want to register your company?
                </p>
                <Link
                  href="/contact"
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#3FDCC0] hover:underline"
                >
                  Contact us
                  <ArrowRight size={10} />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <PublicRoute>
      <LoginContent />
    </PublicRoute>
  );
}