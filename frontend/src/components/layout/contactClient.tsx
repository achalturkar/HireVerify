'use client';

import { useState } from 'react';
import {
  Mail,
  Phone,
  MapPin,
  Clock3,
  MessageSquareText,
  ShieldCheck,
  Loader2,
  CheckCircle2,
  AlertCircle,
  MessageCircle,
  FileText,
} from 'lucide-react';
import PublicNav from '@/src/components/ui/publicnav';
import BrandMark from '@/src/components/ui/BrandMark';

const PHONE_NUMBERS = [
  { label: 'Sales', number: '+91 96890 03720', href: 'tel:+919689003720', icon: MessageSquareText },
  { label: 'Support', number: '+91 83903 24344', href: 'tel:+918390324344', icon: ShieldCheck },
  { label: 'WhatsApp', number: '+91 96890 03720', href: 'https://wa.me/919689003720', icon: MessageCircle },
];

const CONTACT_OPTIONS = [
  {
    title: 'Sales & quotations',
    description: 'Discuss verification packages, pricing, onboarding, and rollout plans for your team.',
    phone: PHONE_NUMBERS[0],
    email: 'contact@brainhuntventures.com',
    icon: MessageSquareText,
  },
  {
    title: 'Technical support',
    description: 'Need help with candidate access, verification cases, checks, or reports?',
    phone: PHONE_NUMBERS[1],
    email: 'suhas@brainhuntventures.com',
    icon: ShieldCheck,
  },
  {
    title: 'WhatsApp & quick chat',
    description: 'Prefer messaging? Reach us directly on WhatsApp during business hours.',
    phone: PHONE_NUMBERS[2],
    email: null,
    icon: MessageCircle,
  },
];

const HERO_HIGHLIGHTS = [
  { icon: Clock3, label: 'Response within 1 business day' },
  { icon: ShieldCheck, label: 'Secure, role-based access by design' },
  { icon: FileText, label: 'PAN, UAN, Court & more' },
];

export default function ContactClient() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    message: '',
  });
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setStatus(null);

    try {
      const response = await fetch('/api/v1/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.message || 'Could not send your message.');
      }

      setStatus({ type: 'success', message: data?.message || 'Thanks! Your message has been sent successfully.' });
      setFormData({ name: '', email: '', phone: '', company: '', message: '' });
    } catch (error) {
      setStatus({
        type: 'error',
        message: error instanceof Error ? error.message : 'Could not send your message right now.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <PublicNav />

      <main className="relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_top,color-mix(in_srgb,var(--primary)_20%,transparent),transparent_65%)] pointer-events-none" />

        <section className="relative mx-auto flex max-w-7xl flex-col gap-10 px-6 py-20 lg:px-8">
          {/* Hero */}
          <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div className="max-w-2xl">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)]/80 px-3.5 py-1.5 text-[12px] font-medium text-[var(--muted)] backdrop-blur">
                <BrandMark size={16} />
                Contact HireVerify
              </div>
              <h1
                className="text-4xl font-semibold tracking-tight text-[var(--foreground)] sm:text-5xl"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Let&rsquo;s make background verification clearer, faster, and more reliable.
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-8 text-[var(--muted)]">
                Whether you&rsquo;re exploring the platform, planning a rollout, requesting a quotation, or need
                help with a candidate verification case, our team is ready to help.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <a
                  href={`mailto:${CONTACT_OPTIONS[0].email}`}
                  className="inline-flex items-center gap-2 rounded-full bg-[var(--primary)] px-5 py-3 text-sm font-semibold text-[var(--primary-foreground)] transition-colors hover:opacity-90"
                >
                  <Mail size={16} />
                  Email us
                </a>
                <a
                  href={PHONE_NUMBERS[0].href}
                  className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-5 py-3 text-sm font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--surface-muted)]"
                >
                  <Phone size={16} />
                  Call sales
                </a>
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px] text-[var(--muted)]">
                {HERO_HIGHLIGHTS.map(({ icon: Icon, label }) => (
                  <span key={label} className="flex items-center gap-1.5">
                    <Icon size={14} className="text-[var(--primary)]" />
                    {label}
                  </span>
                ))}
              </div>
            </div>

            {/* Quick contact card */}
            <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)]/90 p-6 shadow-[0_20px_80px_-30px_rgba(0,0,0,0.4)] backdrop-blur">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--primary)]/12 text-[var(--primary)]">
                  <MapPin size={18} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[var(--foreground)]">Primary contact</p>
                  <p className="text-sm text-[var(--muted)]">Nagpur, India • Remote-friendly support</p>
                </div>
              </div>

              <div className="mt-6 space-y-3">
                {PHONE_NUMBERS.map(({ label, number, href, icon: Icon }) => (
                  <a
                    key={label}
                    href={href}
                    target={href.startsWith('http') ? '_blank' : undefined}
                    rel={href.startsWith('http') ? 'noreferrer' : undefined}
                    className="flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--background)]/70 p-4 transition-colors hover:border-[var(--primary)]/40"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--primary)]/10 text-[var(--primary)]">
                        <Icon size={15} />
                      </div>
                      <div>
                        <p className="text-[13px] font-medium text-[var(--foreground)]">{label}</p>
                        <p className="text-[13px] text-[var(--muted)]">{number}</p>
                      </div>
                    </div>
                    <Phone size={14} className="text-[var(--muted)]" />
                  </a>
                ))}

                <div className="rounded-2xl border border-[var(--border)] bg-[var(--background)]/70 p-4">
                  <p className="text-sm font-semibold text-[var(--foreground)]">Email</p>
                  <a href="mailto:contact@brainhuntventures.com" className="mt-1 block text-sm text-[var(--primary)] hover:underline">
                    contact@brainhuntventures.com
                  </a>
                  <a href="mailto:suhas@brainhuntventures.com" className="mt-1 block text-sm text-[var(--primary)] hover:underline">
                    suhas@brainhuntventures.com
                  </a>
                </div>
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--background)]/70 p-4">
                  <p className="text-sm font-semibold text-[var(--foreground)]">Address</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    Plot No.3, 2nd Floor, Indraprastha Apartment, Dronacharya Nagar, Trimurti Nagar, Nagpur – 440022
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Three contact channels, each with its own number */}
          <div className="grid gap-4 md:grid-cols-3">
            {CONTACT_OPTIONS.map(({ title, description, phone, email, icon: Icon }) => (
              <div
                key={title}
                className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/70 p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--primary)]/30"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--primary)]/12 text-[var(--primary)]">
                  <Icon size={18} />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-[var(--foreground)]">{title}</h3>
                <p className="mt-2 text-sm leading-7 text-[var(--muted)]">{description}</p>
                <div className="mt-4 space-y-1.5 text-sm">
                  <a href={phone.href} className="flex items-center gap-1.5 text-[var(--foreground)] hover:text-[var(--primary)] transition-colors">
                    <Phone size={13} className="text-[var(--primary)]" />
                    {phone.number}
                  </a>
                  {email && (
                    <a href={`mailto:${email}`} className="flex items-center gap-1.5 text-[var(--muted)] hover:text-[var(--primary)] transition-colors">
                      <Mail size={13} />
                      {email}
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* CTA + form */}
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="flex flex-col gap-6">
              <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)]/70 p-8 shadow-sm">
                <div className="max-w-2xl">
                  <p
                    className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--primary)]"
                    style={{ fontFamily: 'var(--font-mono)' }}
                  >
                    Ready to get started?
                  </p>
                  <h2
                    className="mt-2 text-2xl font-semibold tracking-tight text-[var(--foreground)]"
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    Share your goals and we&rsquo;ll help you shape the right verification workflow.
                  </h2>
                  <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
                    Tell us about your team, your candidate volume, and the checks you need — PAN, UAN, court,
                    or others. We&rsquo;ll reach out with the next steps and, if you&rsquo;d like, a quotation.
                  </p>
                </div>
              </div>

              {/* Prefer to call callout */}
              <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)]/70 p-6 shadow-sm">
                <p className="text-sm font-semibold text-[var(--foreground)] mb-3">Prefer to talk it through?</p>
                <div className="flex flex-col gap-2">
                  {PHONE_NUMBERS.map(({ label, number, href, icon: Icon }) => (
                    <a
                      key={label}
                      href={href}
                      target={href.startsWith('http') ? '_blank' : undefined}
                      rel={href.startsWith('http') ? 'noreferrer' : undefined}
                      className="flex items-center gap-2.5 text-sm text-[var(--muted)] hover:text-[var(--primary)] transition-colors"
                    >
                      <Icon size={14} className="text-[var(--primary)]" />
                      <span className="font-medium text-[var(--foreground)]">{label}:</span>
                      {number}
                    </a>
                  ))}
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="rounded-3xl border border-[var(--border)] bg-[var(--surface)]/70 p-8 shadow-sm">
              {status && (
                <div
                  className={`mb-5 flex items-start gap-2.5 rounded-2xl border px-4 py-3 text-sm ${
                    status.type === 'success'
                      ? 'border-[var(--primary)]/30 bg-[var(--primary)]/10 text-[var(--primary)]'
                      : 'border-[var(--danger)]/30 bg-[var(--danger)]/10 text-[var(--danger)]'
                  }`}
                >
                  {status.type === 'success' ? (
                    <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
                  ) : (
                    <AlertCircle size={16} className="mt-0.5 shrink-0" />
                  )}
                  <span>{status.message}</span>
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2 text-sm">
                  <span className="font-medium text-[var(--foreground)]">Full name</span>
                  <input
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full rounded-2xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm outline-none ring-0 transition focus:border-[var(--primary)]"
                    placeholder="Alex Morgan"
                  />
                </label>
                <label className="space-y-2 text-sm">
                  <span className="font-medium text-[var(--foreground)]">Work email</span>
                  <input
                    required
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full rounded-2xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm outline-none ring-0 transition focus:border-[var(--primary)]"
                    placeholder="you@company.com"
                  />
                </label>
                <label className="space-y-2 text-sm">
                  <span className="font-medium text-[var(--foreground)]">Phone</span>
                  <input
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full rounded-2xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm outline-none ring-0 transition focus:border-[var(--primary)]"
                    placeholder="+91 98765 43210"
                  />
                </label>
                <label className="space-y-2 text-sm">
                  <span className="font-medium text-[var(--foreground)]">Company</span>
                  <input
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    className="w-full rounded-2xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm outline-none ring-0 transition focus:border-[var(--primary)]"
                    placeholder="Acme Labs"
                  />
                </label>
              </div>

              <label className="mt-4 block space-y-2 text-sm">
                <span className="font-medium text-[var(--foreground)]">How can we help?</span>
                <textarea
                  required
                  rows={5}
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  className="w-full rounded-2xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm outline-none ring-0 transition focus:border-[var(--primary)]"
                  placeholder="Tell us about your team, verification volume, and the checks you need — PAN, UAN, court, or others."
                />
              </label>

              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs leading-6 text-[var(--muted)]">
                  By submitting, you agree that we may contact you at the email address you provide.
                </p>
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--primary)] px-5 py-3 text-sm font-semibold text-[var(--primary-foreground)] transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
                  {loading ? 'Sending...' : 'Send message'}
                </button>
              </div>
            </form>
          </div>
        </section>
      </main>
    </div>
  );
}