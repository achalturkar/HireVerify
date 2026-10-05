import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Building2, CheckCircle2, Mail, ShieldCheck } from 'lucide-react';
import PublicNav from '@/src/components/ui/publicnav';
import BrandMark from '@/src/components/ui/BrandMark';

const signupStructuredData = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  '@id': 'https://hireverify.brainhuntventures.com/signup#webpage',
  name: 'HireVerify Company Signup',
  description:
    'Request a HireVerify company account for background verification and employee screening.',
  url: 'https://hireverify.brainhuntventures.com/signup',
  isPartOf: { '@id': 'https://hireverify.brainhuntventures.com/#organization' },
  about: { '@id': 'https://hireverify.brainhuntventures.com/#organization' },
  potentialAction: {
    '@type': 'ContactAction',
    name: 'Request a HireVerify company account',
    target: 'https://hireverify.brainhuntventures.com/contact#contact-form',
  },
};

export const metadata: Metadata = {
  title: {
    absolute: 'HireVerify Company Signup | Brainhunt Ventures',
  },
  description:
    'Request a company account for HireVerify, the background verification platform by Brainhunt Ventures. Contact our team to discuss onboarding, verification checks, and pricing.',
  keywords: [
    'HireVerify signup',
    'HireVerify company account',
    'background verification platform signup',
    'BGV software demo India',
    'employee screening onboarding',
  ],
  alternates: { canonical: '/signup' },
  openGraph: {
    title: 'Request a HireVerify Company Account | Brainhunt Ventures',
    description:
      'Get started with HireVerify for candidate background verification. Contact Brainhunt Ventures to discuss your company onboarding and verification needs.',
    url: 'https://hireverify.brainhuntventures.com/signup',
    siteName: 'HireVerify by Brainhunt Ventures',
    locale: 'en_IN',
    type: 'website',
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'Request a HireVerify company account',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'HireVerify Company Signup | Brainhunt Ventures',
    description:
      'Request company onboarding for the HireVerify background verification platform.',
    images: ['/opengraph-image'],
  },
};

const onboardingSteps = [
  {
    number: '01',
    title: 'Tell us about your organization',
    description:
      'Share your company details, hiring workflow, and the number of candidate checks you expect to manage.',
  },
  {
    number: '02',
    title: 'Plan your verification workflow',
    description:
      'Discuss the background checks, candidate experience, client access, and reporting your team needs.',
  },
  {
    number: '03',
    title: 'Coordinate account onboarding',
    description:
      'The Brainhunt Ventures team will follow up to discuss availability, onboarding, and next steps for your account.',
  },
];

export default function SignupPage() {
  return (
    <div className="public-brand-surface min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <PublicNav />
      <main>
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(circle_at_top,color-mix(in_srgb,var(--primary)_18%,transparent),transparent_65%)]" />
          <div className="relative mx-auto max-w-5xl px-6 py-20 sm:py-24">
            <div className="mx-auto max-w-3xl text-center">
              <span className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--primary)]/12 text-[var(--primary)]">
                <BrandMark size={32} />
              </span>
              <p className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-[var(--primary)]">
                HireVerify by Brainhunt Ventures
              </p>
              <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
                Get started with background verification for your company
              </h1>
              <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-[var(--muted)]">
                Request company onboarding for HireVerify, a BGV platform for managing candidate checks,
                verification cases, and authorized client reports in one place.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link
                  href="/contact#contact-form"
                  className="inline-flex items-center gap-2 rounded-full bg-[var(--primary)] px-6 py-3 text-sm font-semibold text-[var(--primary-foreground)] transition-opacity hover:opacity-90"
                >
                  <Building2 size={16} />
                  Request a company account
                  <ArrowRight size={15} />
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-6 py-3 text-sm font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--surface-muted)]"
                >
                  <ShieldCheck size={16} />
                  Already have an account? Sign in
                </Link>
              </div>
              <p className="mt-4 text-sm text-[var(--muted)]">
                Company accounts are arranged with our team. This page does not create an account automatically.
              </p>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-6 pb-20">
          <div className="mb-8 text-center">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              How to request HireVerify onboarding
            </h2>
            <p className="mx-auto mt-3 max-w-2xl leading-7 text-[var(--muted)]">
              Start a conversation with Brainhunt Ventures so we can understand your background screening
              needs and guide you through the right next steps.
            </p>
          </div>
          <ol className="grid gap-4 md:grid-cols-3">
            {onboardingSteps.map((step) => (
              <li
                key={step.number}
                className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6"
              >
                <span className="text-xs font-semibold tracking-[0.14em] text-[var(--primary)]">
                  STEP {step.number}
                </span>
                <h3 className="mt-3 text-lg font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm leading-7 text-[var(--muted)]">{step.description}</p>
              </li>
            ))}
          </ol>
          <div className="mt-8 flex flex-col items-center justify-between gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 sm:flex-row">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 shrink-0 text-[var(--primary)]" size={19} />
              <div>
                <h2 className="font-semibold">Need to discuss your BGV requirements?</h2>
                <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                  Contact the HireVerify team for company onboarding, a product discussion, or a quotation.
                </p>
              </div>
            </div>
            <Link
              href="/contact#contact-form"
              className="inline-flex shrink-0 items-center gap-2 rounded-full border border-[var(--border)] px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-[var(--surface-muted)]"
            >
              <Mail size={15} />
              Contact us
              <ArrowRight size={14} />
            </Link>
          </div>
        </section>
      </main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(signupStructuredData) }}
      />
    </div>
  );
}
