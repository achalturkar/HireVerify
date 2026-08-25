import Link from 'next/link';
import {
  LogIn,
  Mail,
  ArrowRight,
  BarChart3,
  Lock,
  FileEdit,
  Send,
  Timer,
  TrendingUp,
  FileText,
  Sparkles,
  ShieldCheck,
  Fingerprint,
  Landmark,
  Briefcase,
  GraduationCap,
  Gavel,
  Siren,
  Users2,
  CreditCard,
  FlaskConical,
  Globe2,
  BadgeCheck,
  IdCard,
  Building2,
  UserCheck,
  Home,
  Truck,
  MessageSquareWarning,
  Database,
  DoorOpen,
  Factory,
  Award,
  Clock3,
  Code2,
  ShoppingBag,
  Headset,
  HeartPulse,
  ClipboardCheck,
  Quote,
  CheckCircle2,
} from 'lucide-react';
import PublicNav from '@/src/components/ui/publicnav';
import FaqAccordion from '@/src/components/ui/FaqAccordion';
import BrandMark from '@/src/components/ui/BrandMark';
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Background Verification Platform | HireVerify",

  description:
    "HireVerify is a secure, multi-tenant background verification (BGV) platform. Run PAN, UAN, court and identity checks, manage candidates and clients, and deliver confidential verification reports — all from one dashboard.",

  keywords: [
    "background verification",
    "background verification platform",
    "BGV platform",
    "BGV software",
    "candidate background verification",
    "employee background verification",
    "pre employment verification",
    "PAN verification",
    "UAN verification",
    "court verification",
    "employee screening",
    "background check software India",
  ],

  alternates: {
    canonical: "/",
  },

  openGraph: {
    title: "HireVerify — Background Verification Platform",
    description:
      "Run PAN, UAN, court and identity checks, manage candidates and clients, and deliver confidential BGV reports from one secure platform.",
    url: "https://hireverify.brainhuntventures.com",
    images: [
      {
        url: "/og-home.png",
      },
    ],
  },
};

// Shared accent palette — reused across sections for consistent, deliberate color coding
const PALETTE = [
  '#6366f1', // indigo — identity/core
  '#0ea5e9', // sky — financial (PAN)
  '#14b8a6', // teal — employment (UAN) — echoes the brand mark
  '#f59e0b', // amber — court/legal
  '#22c55e', // green — clear/verified
  '#a855f7', // purple — documents
  '#ef4444', // red — flagged/discrepancy
  '#64748b', // slate — neutral/coming soon
];

// ---------------------------------------------------------------------------
// Core value proposition
// ---------------------------------------------------------------------------
const FEATURES = [
  {
    icon: Timer,
    title: 'Faster verification',
    description:
      'Reduce manual coordination with digital workflows that move a case from creation to final report without spreadsheets or email chains.',
    color: PALETTE[2],
  },
  {
    icon: ShieldCheck,
    title: 'Multiple verification checks',
    description:
      'Run PAN, UAN and court checks today, from one platform — with more verification types rolling out as they go live.',
    color: PALETTE[1],
  },
  {
    icon: ClipboardCheck,
    title: 'Centralized case management',
    description:
      'Every candidate, check and case lives in one dashboard, scoped correctly to the right company and client.',
    color: PALETTE[0],
  },
  {
    icon: FileText,
    title: 'Client-ready reports',
    description:
      'Generate clear, structured verification summaries for authorized client users — never shared with the candidate.',
    color: PALETTE[3],
  },
  {
    icon: Lock,
    title: 'Secure data handling',
    description:
      'Sensitive candidate information and verification findings stay behind role-based, tenant-isolated access control.',
    color: PALETTE[5],
  },
  {
    icon: BarChart3,
    title: 'Complete audit trail',
    description:
      'Every verification action, review and report event is logged — so status is always traceable, end to end.',
    color: PALETTE[4],
  },
];

// ---------------------------------------------------------------------------
// Verification services — PAN / UAN / Court are live today; everything else
// is presented honestly as upcoming, per current provider integration status.
// ---------------------------------------------------------------------------
const SERVICES: { icon: typeof ShieldCheck; title: string; description: string; status: 'available' }[] = [
  { icon: ShieldCheck, title: 'PAN Verification', description: 'Verify PAN details and identity information against trusted verification sources.', status: 'available' },
  { icon: Briefcase, title: 'UAN Verification', description: 'Verify employment-related UAN information through supported verification providers.', status: 'available' },
  { icon: Gavel, title: 'Court / Litigation Verification', description: 'Check available court and litigation records to flag potential verification concerns.', status: 'available' },
  { icon: Fingerprint, title: 'Identity Verification', description: 'Cross-check identity documents and submitted details for consistency.', status: 'available' },
  { icon: IdCard, title: 'Aadhaar Verification', description: 'Consent-based Aadhaar verification with masked storage of sensitive numbers.', status: 'available' },
  { icon: Home, title: 'Address Verification', description: 'Confirm current and permanent address details supplied by a candidate.', status: 'available' },
  { icon: Building2, title: 'Employment Verification', description: 'Confirm prior employment, tenure and designation directly with past employers.', status: 'available' },
  { icon: GraduationCap, title: 'Education Verification', description: 'Verify degrees, certificates and institute records for education history.', status: 'available' },
  { icon: Siren, title: 'Criminal Record Check', description: 'Screen available court and police-record sources for adverse findings.', status: 'available' },
  { icon: BadgeCheck, title: 'Police Verification', description: 'Character-certificate style checks coordinated through local processes.', status: 'available' },
  { icon: Users2, title: 'Reference Check', description: 'Structured reference checks with verified professional contacts.', status: 'available' },
  { icon: CreditCard, title: 'Credit / Financial Check', description: 'Financial-integrity screening for roles that handle money or risk.', status: 'available' },
  { icon: FlaskConical, title: 'Drug Test Verification', description: 'Lab-coordinated drug test results with a documented chain of custody.', status: 'available' },
  { icon: Globe2, title: 'Global Database Check', description: 'Sanctions, watchlist and adverse-media screening for cross-border hires.', status: 'available' },
  { icon: FileText, title: 'Passport Verification', description: 'Validate passport authenticity and status through supported channels.', status: 'available' },
  { icon: Truck, title: 'Driving Licence Verification', description: 'Check licence authenticity, class and validity where required for a role.', status: 'available' },
  { icon: Landmark, title: 'Vendor Verification', description: 'Registration and director-level due diligence on third-party vendors.', status: 'available' },
  { icon: UserCheck, title: 'Director Due Diligence', description: 'Deeper checks on company directors and signatory history.', status: 'available' },
  { icon: DoorOpen, title: 'Tenant Verification', description: 'Combined identity, address and background checks for tenancy screening.', status: 'available' },
  { icon: MessageSquareWarning, title: 'Social Media Screening', description: 'Configurable review of public profile signals, public data only.', status: 'available' },
  { icon: Database, title: 'Watchlist / DNH Check', description: 'Internal and external watchlist checks, including do-not-hire lists.', status: 'available' },
  { icon: Factory, title: 'Business Verification', description: 'Company-level KYB checks: incorporation, address and ownership.', status: 'available' },
];

// ---------------------------------------------------------------------------
// How it works — candidate is verified, client receives the report
// ---------------------------------------------------------------------------
const STEPS = [
  {
    icon: FileEdit,
    title: 'Create a candidate',
    description: 'Add the candidate under the right client and capture the information a case needs.',
    color: PALETTE[0],
  },
  {
    icon: Send,
    title: 'Choose verification checks',
    description: 'Select PAN, UAN, Court or other required checks, and collect candidate consent.',
    color: PALETTE[1],
  },
  {
    icon: Timer,
    title: 'Run verification',
    description: 'Requests are processed through integrated verification providers or manual review.',
    color: PALETTE[3],
  },
  {
    icon: TrendingUp,
    title: 'Review & share results',
    description: 'Review findings, resolve exceptions, and deliver the final report to the authorized client.',
    color: PALETTE[4],
  },
];

// ---------------------------------------------------------------------------
// Use cases — who runs their BGV program on the platform
// ---------------------------------------------------------------------------
const USE_CASES = [
  { icon: Users2, title: 'Recruitment Agencies', description: 'Manage verification for candidates placed across multiple clients, without mixing data between them.', color: PALETTE[0] },
  { icon: Briefcase, title: 'Staffing Companies', description: 'Run the same repeatable verification workflow at scale, across every assignment.', color: PALETTE[1] },
  { icon: Headset, title: 'HR Teams', description: 'Streamline pre-employment verification alongside your existing hiring process.', color: PALETTE[3] },
  { icon: Building2, title: 'Enterprises', description: 'Centralize verification across teams and business units under one account.', color: PALETTE[5] },
  { icon: ShieldCheck, title: 'Background Verification Agencies', description: 'Manage cases, checks and client-facing reports from one operating system.', color: PALETTE[6] },
];

// ---------------------------------------------------------------------------
// Industries — sectors the platform's verification workflow adapts to
// ---------------------------------------------------------------------------
const INDUSTRIES = [
  { icon: Code2, title: 'Technology & IT', description: 'Fast-moving hiring pipelines, verified without slowing down offer cycles.', color: PALETTE[0] },
  { icon: HeartPulse, title: 'Healthcare', description: 'Credential and background checks for patient-facing and clinical support roles.', color: PALETTE[6] },
  { icon: Landmark, title: 'BFSI', description: 'Banking, financial services and insurance hiring with integrity-sensitive checks.', color: PALETTE[1] },
  { icon: ShoppingBag, title: 'Retail & E-commerce', description: 'High-volume, seasonal hiring without losing track of case status.', color: PALETTE[3] },
  { icon: Factory, title: 'Manufacturing', description: 'Verification workflows built for large, distributed shop-floor workforces.', color: PALETTE[5] },
  { icon: Headset, title: 'BPO & ITES', description: 'Standardized screening across large applicant pools, at consistent turnaround.', color: PALETTE[2] },
  { icon: Truck, title: 'Logistics & Supply Chain', description: 'Address and identity checks suited to field and delivery workforces.', color: PALETTE[7] },
  { icon: Building2, title: 'Real Estate & Construction', description: 'Site and vendor personnel verification across multiple project locations.', color: PALETTE[4] },
  { icon: GraduationCap, title: 'Education', description: 'Background and education-credential checks for academic and campus staff.', color: PALETTE[0] },
];

const INDUSTRY_STATS = [
  { value: `${INDUSTRIES.length}`, label: 'Industries served' },
  { value: `${SERVICES.length}+`, label: 'Verification services' },
  { value: '4', label: 'User roles supported' },
];

const TRUST_STATS = [
  { icon: ShieldCheck, value: `${SERVICES.length}+`, label: 'Verification services available', color: PALETTE[0] },
  { icon: Lock, value: 'Isolated', label: 'Company & client-level tenancy', color: PALETTE[2] },
  { icon: BarChart3, value: 'Audited', label: 'Every action, tracked', color: PALETTE[3] },
  { icon: Clock3, value: '1 place', label: 'Cases, checks & reports', color: PALETTE[4] },
];

const SECURITY_POINTS = [
  { icon: Lock, title: 'Role-based access control', description: 'Company admins, super admins and custom roles only see what their permissions allow.' },
  { icon: Building2, title: 'Company-level tenant isolation', description: 'One company\u2019s candidates, cases and reports are never visible to another.' },
  // { icon: Users, title: 'Client-level access control', description: 'Client users see only the candidates and reports that belong to their organization.' },
  { icon: FileText, title: 'Controlled document access', description: 'Candidate documents are stored and served through access-controlled, expiring links.' },
  { icon: BarChart3, title: 'Audit logs', description: 'Verification actions, reviews and report events are logged for traceability.' },
  { icon: ShieldCheck, title: 'Secure authentication', description: 'Token-based authentication with rotation, designed to protect staff and client accounts.' },
];

const FAQS = [
  {
    question: 'What is HireVerify?',
    answer:
      'HireVerify is a background verification (BGV) platform for companies and their authorized client users. You create candidates and verification cases, run checks such as PAN, UAN and court verification, capture consent, and review secure reports — all in one place.',
  },
  {
    question: 'Which verification checks are supported?',
    answer:
      'Identity, PAN, Aadhaar, address, employment, education, court, criminal record, police, reference, credit, drug test, global database, passport, driving licence, vendor and several other checks are all available through integrated verification providers and manual review — run any combination from one case.',
  },
  {
    question: 'Can clients receive verification reports?',
    answer:
      'Yes. Once a case is reviewed and approved, authorized client users can view and download the final report from their own secure workspace. Candidates do not receive the final report — the report is a client deliverable.',
  },
  {
    question: 'Can I manage verification for multiple clients?',
    answer:
      'Yes. Candidates, cases and reports are scoped per client and company, so agencies managing multiple clients keep everything separated within a single account.',
  },
  {
    question: 'Can individuals request a personal verification?',
    answer:
      'Yes — individuals can initiate supported checks and track their own verification progress. The platform is built primarily for company and client use, with individual verification as a secondary option.',
  },
  {
    question: 'How is candidate data protected?',
    answer:
      'Access is controlled by role and by tenant — company and client boundaries are enforced throughout the platform, and every verification action is logged for audit purposes.',
  },
  {
    question: 'Which verification providers do you use?',
    answer:
      'Verification checks are processed through integrated third-party verification providers. Additional providers can be added as the platform expands, without changing how a case or report looks to you.',
  },
  {
    question: 'How do I get a quotation?',
    answer:
      'Use the "Get Quotation" button on this page or the Contact page to reach our team with your verification volume and requirements, and we\u2019ll get back to you with pricing.',
  },
];

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-[11px] uppercase tracking-[0.16em] text-[var(--primary)] mb-2.5"
      style={{ fontFamily: 'var(--font-mono)' }}
    >
      {children}
    </p>
  );
}

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col bg-[var(--background)] text-[var(--foreground)]">
      <PublicNav />

      <main className="flex-1">
        {/* ================= HERO ================= */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-x-0 -top-24 h-96 bg-[radial-gradient(circle_at_top,color-mix(in_srgb,var(--primary)_20%,transparent),transparent_60%)] pointer-events-none" />
          <div className="relative max-w-6xl mx-auto w-full px-6 pt-20 pb-16">
            <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-14 items-center">
              {/* Left: copy */}
              <div className="text-center lg:text-left">
                <div className="flex justify-center lg:justify-start mb-6">
                  <span className="flex h-14 w-14 items-center justify-center rounded-3xl bg-[var(--primary)]/15 text-[var(--primary)]">
                    <BrandMark size={28} />
                  </span>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] text-[11px] font-medium px-3 py-1.5 mb-4" style={{ color: PALETTE[4] }}>
                  <Award size={12} />
                  {SERVICES.length}+ verification checks · {INDUSTRIES.length} industries served
                </span>
                <Eyebrow>Background verification platform</Eyebrow>
                <h1
                  className="text-[38px] sm:text-[52px] font-semibold tracking-tight leading-[1.05]"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  <span className="text-[var(--foreground)]">Verify smarter.</span>
                  <br />
                  <span className="bg-gradient-to-r from-[var(--primary)] to-[var(--accent)] bg-clip-text text-transparent">
                    Hire with confidence.
                  </span>
                </h1>
                <p className="text-[15.5px] text-[var(--muted)] mt-5 max-w-xl mx-auto lg:mx-0 leading-relaxed">
                  Verify candidates with secure PAN, UAN, court and other background checks — all from one
                  centralized BGV platform built for companies and their clients.
                </p>

                <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 mt-8">
                  <Link
                    href="/login"
                    className="flex items-center gap-2 rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] text-[13.5px] font-semibold px-6 py-3 hover:opacity-90 transition-opacity"
                  >
                    <LogIn size={16} />
                    Get started
                  </Link>
                  <Link
                    href="/contact?intent=quote"
                    className="flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] text-[13.5px] font-medium px-6 py-3 hover:bg-[var(--surface-muted)] transition-colors"
                  >
                    <Quote size={16} />
                    Get a quotation
                  </Link>
                  <Link
                    href="#verifications"
                    className="flex items-center gap-2 text-[13.5px] font-medium px-3 py-3 text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                  >
                    Explore verifications
                    <ArrowRight size={14} />
                  </Link>
                </div>

                <div className="flex flex-wrap items-center justify-center lg:justify-start gap-x-6 gap-y-2 mt-9 text-[12.5px] text-[var(--muted)]">
                  <span className="flex items-center gap-1.5">
                    <Sparkles size={13} className="text-[var(--primary)]" />
                    Multi-tenant, company & client scoped
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Sparkles size={13} className="text-[var(--primary)]" />
                    Role-based access
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Sparkles size={13} className="text-[var(--primary)]" />
                    Client-ready reports
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Sparkles size={13} className="text-[var(--primary)]" />
                    Full audit trail
                  </span>
                </div>
              </div>

              {/* Right: signature element — a live-looking BGV case dashboard */}
              <div className="relative mx-auto w-full max-w-sm lg:max-w-none">
                <div className="absolute -inset-6 bg-[radial-gradient(circle,color-mix(in_srgb,var(--primary)_16%,transparent),transparent_70%)] pointer-events-none" />
                <div className="relative rounded-3xl border border-[var(--border)] bg-[var(--surface)] shadow-xl p-6">
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]" style={{ fontFamily: 'var(--font-mono)' }}>
                        BGV Dashboard
                      </p>
                      <p className="text-[14.5px] font-semibold mt-0.5" style={{ fontFamily: 'var(--font-display)' }}>
                        Case overview — demo data
                      </p>
                    </div>
                    <span className="flex items-center gap-1.5 rounded-full bg-[var(--primary)]/12 text-[var(--primary)] text-[11px] font-semibold px-3 py-1.5">
                      <BarChart3 size={12} />
                      Live
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-5">
                    {[
                      { label: 'Total cases', value: 24, color: PALETTE[0] },
                      { label: 'In progress', value: 8, color: PALETTE[1] },
                      { label: 'Completed', value: 13, color: PALETTE[4] },
                      { label: 'Needs review', value: 3, color: PALETTE[3] },
                    ].map((s) => (
                      <div
                        key={s.label}
                        className="flex flex-col items-center justify-center rounded-xl bg-[var(--surface-muted)] px-2 py-3 text-center min-h-[64px]"
                      >
                        <p className="text-[19px] font-semibold leading-none" style={{ fontFamily: 'var(--font-display)', color: s.color }}>
                          {s.value}
                        </p>
                        <p className="text-[10px] text-[var(--muted)] leading-tight mt-1.5">{s.label}</p>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-3 pt-1">
                    {[
                      { label: 'PAN', result: 'Verified', color: PALETTE[4] },
                      { label: 'UAN', result: 'Verified', color: PALETTE[4] },
                      { label: 'Court', result: 'No record found', color: PALETTE[2] },
                    ].map((c) => (
                      <div key={c.label} className="flex items-center justify-between text-[12.5px]">
                        <span className="flex items-center gap-2 text-[var(--foreground)] font-medium">
                          <CheckCircle2 size={14} style={{ color: c.color }} />
                          {c.label} verification
                        </span>
                        <span className="font-semibold" style={{ fontFamily: 'var(--font-mono)', color: c.color }}>
                          {c.result}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between mt-5 pt-5 border-t border-[var(--border)]">
                    <span className="text-[11.5px] text-[var(--muted)]">Overall case result</span>
                    <span
                      className="text-[15px] font-semibold px-3 py-1 rounded-full"
                      style={{ fontFamily: 'var(--font-display)', color: PALETTE[4], background: `${PALETTE[4]}1a` }}
                    >
                      Clear
                    </span>
                  </div>
                  <p className="text-[10px] text-[var(--muted)] mt-3 text-center">Illustrative data — not a real candidate</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ================= TRUST STRIP ================= */}
        <section className="border-y border-[var(--border)] bg-[var(--surface)]/60">
          <div className="max-w-6xl mx-auto w-full px-6 py-10">
            <p className="text-center text-[12.5px] text-[var(--muted)] mb-8" style={{ fontFamily: 'var(--font-mono)' }}>
              Built for teams that take hiring seriously
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-[var(--border)] rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
              {TRUST_STATS.map(({ icon: Icon, value, label, color }) => (
                <div key={label} className="flex flex-col items-center text-center gap-2.5 px-4 py-6">
                  <span
                    className="w-9 h-9 rounded-full flex items-center justify-center"
                    style={{ background: `${color}1f`, color }}
                  >
                    <Icon size={15} />
                  </span>
                  <p className="text-[20px] font-semibold leading-none" style={{ fontFamily: 'var(--font-display)', color }}>
                    {value}
                  </p>
                  <p className="text-[11.5px] text-[var(--muted)] leading-snug max-w-[9rem]">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ================= CORE VALUE PROPOSITION ================= */}
        <section id="features" className="max-w-6xl mx-auto w-full px-6 py-20 scroll-mt-20">
          <div className="text-center mb-12">
            <Eyebrow>Why HireVerify</Eyebrow>
            <h2 className="text-[26px] sm:text-[30px] font-semibold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
              Everything you need for modern background verification
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map(({ icon: Icon, title, description, color }) => (
              <div
                key={title}
                className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-6 py-6 transition-all hover:-translate-y-0.5 hover:shadow-md"
                style={{ borderColor: `${color}25` }}
              >
                <span
                  className="w-10 h-10 rounded-lg flex items-center justify-center mb-4"
                  style={{ background: `${color}1f`, color }}
                >
                  <Icon size={18} />
                </span>
                <h3 className="text-[15px] font-semibold mb-1.5" style={{ fontFamily: 'var(--font-display)' }}>
                  {title}
                </h3>
                <p className="text-[13.5px] text-[var(--muted)] leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ================= VERIFICATION SERVICES ================= */}
        <section id="verifications" className="relative py-20 scroll-mt-20 bg-[var(--surface)]/50 border-y border-[var(--border)]">
        <div className="max-w-6xl mx-auto w-full px-6">
          <div className="text-center mb-4">
            <Eyebrow>Verify what matters</Eyebrow>
            <h2 className="text-[26px] sm:text-[30px] font-semibold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
              {SERVICES.length}+ background verification services
            </h2>
            <p className="text-[14px] text-[var(--muted)] mt-3 max-w-xl mx-auto leading-relaxed">
              End-to-end checks under one roof — every service below is available through integrated
              verification providers and manual review, all tracked from a single case.
            </p>
          </div>

          <div className="flex items-center justify-center gap-2 mb-10 text-[12px] font-medium" style={{ color: PALETTE[4] }}>
            <CheckCircle2 size={13} />
            All services available
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {SERVICES.map(({ icon: Icon, title, description }, i) => {
              const color = PALETTE[i % PALETTE.length];
              return (
                <div
                  key={title}
                  className="group relative rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-5 py-5 transition-all hover:-translate-y-0.5 hover:shadow-md overflow-hidden"
                  style={{ borderColor: `${color}25` }}
                >
                  <div
                    className="absolute -right-5 -top-5 h-16 w-16 rounded-full opacity-0 group-hover:opacity-[0.10] transition-opacity pointer-events-none"
                    style={{ background: color }}
                  />
                  <div className="flex items-start justify-between mb-3">
                    <span
                      className="w-9 h-9 rounded-lg flex items-center justify-center"
                      style={{ background: `${color}1f`, color }}
                    >
                      <Icon size={16} />
                    </span>
                    <span
                      className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full"
                      style={{ background: `${PALETTE[4]}1a`, color: PALETTE[4] }}
                    >
                      <CheckCircle2 size={10} />
                      Available
                    </span>
                  </div>
                  <h3 className="text-[13.5px] font-semibold mb-1.5" style={{ fontFamily: 'var(--font-display)' }}>
                    {title}
                  </h3>
                  <p className="text-[12.5px] text-[var(--muted)] leading-relaxed">{description}</p>
                </div>
              );
            })}
          </div>
        </div>
        </section>

        {/* ================= HOW IT WORKS ================= */}
        <section id="how-it-works" className="max-w-5xl mx-auto w-full px-6 pb-20 scroll-mt-20">
          <div className="text-center mb-12">
            <Eyebrow>How it works</Eyebrow>
            <h2 className="text-[26px] sm:text-[30px] font-semibold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
              Background verification, simplified
            </h2>
          </div>

          <div className="relative">
            <div
              className="hidden sm:block absolute top-5 left-[12%] right-[12%] h-px bg-gradient-to-r from-[#6366f1] via-[#f59e0b] to-[#22c55e] opacity-40"
              aria-hidden="true"
            />
            <div className="grid gap-8 sm:grid-cols-4 sm:gap-4 relative">
              {STEPS.map(({ icon: Icon, title, description, color }, i) => (
                <div key={title} className="flex flex-col items-center text-center sm:items-start sm:text-left">
                  <span
                    className="relative z-10 w-10 h-10 rounded-full ring-[6px] ring-[var(--background)] flex items-center justify-center mb-3.5"
                    style={{ background: `${color}22`, color }}
                  >
                    <Icon size={17} />
                  </span>
                  <p className="text-[10.5px] uppercase tracking-[0.12em] mb-1 font-semibold" style={{ fontFamily: 'var(--font-mono)', color }}>
                    Step {String(i + 1).padStart(2, '0')}
                  </p>
                  <h3 className="text-[14.5px] font-semibold mb-1.5" style={{ fontFamily: 'var(--font-display)' }}>
                    {title}
                  </h3>
                  <p className="text-[13px] text-[var(--muted)] leading-relaxed">{description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ================= CLIENT BGV FLOW ================= */}
        <section className="max-w-6xl mx-auto w-full px-6 pb-20">
          <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] px-8 py-10">
            <div className="grid lg:grid-cols-[0.9fr_1.1fr] gap-10 items-center">
              <div>
                <Eyebrow>Client-centric verification</Eyebrow>
                <h2 className="text-[22px] sm:text-[26px] font-semibold tracking-tight mb-3" style={{ fontFamily: 'var(--font-display)' }}>
                  Built for client-centric verification
                </h2>
                <p className="text-[14px] text-[var(--muted)] leading-relaxed">
                  Create and manage verification cases for your clients, track every check, review results, and
                  deliver final reports from one centralized platform — the candidate is verified, the client
                  receives the report.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2.5 text-[12px]">
                {['Client', 'Candidate', 'BGV case', 'PAN / UAN / Court', 'Verification', 'Review', 'Final report', 'Client'].map((step, i, arr) => (
                  <div key={`${step}-${i}`} className="flex items-center gap-2.5">
                    <span className="rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-3.5 py-2 font-medium whitespace-nowrap">
                      {step}
                    </span>
                    {i < arr.length - 1 && <ArrowRight size={13} className="text-[var(--muted)] shrink-0" />}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ================= INDIVIDUAL BGV (secondary) ================= */}
        <section className="max-w-4xl mx-auto w-full px-6 pb-20">
          <div className="rounded-2xl border border-dashed border-[var(--border)] px-8 py-8 text-center">
            <h3 className="text-[16px] font-semibold mb-1.5" style={{ fontFamily: 'var(--font-display)' }}>
              Need a personal background verification?
            </h3>
            <p className="text-[13.5px] text-[var(--muted)] max-w-lg mx-auto leading-relaxed mb-5">
              Individuals can initiate supported background verification checks and track their verification
              process on their own.
            </p>
            <Link
              href="/contact?intent=individual"
              className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] text-[13px] font-medium px-5 py-2.5 hover:bg-[var(--surface-muted)] transition-colors"
            >
              Start individual verification
              <ArrowRight size={14} />
            </Link>
          </div>
        </section>

        {/* ================= DASHBOARD PREVIEW ================= */}
        <section id="dashboard" className="relative py-20 scroll-mt-20 bg-[var(--surface)]/50 border-y border-[var(--border)]">
        <div className="max-w-6xl mx-auto w-full px-6">
          <div className="text-center mb-10">
            <Eyebrow>Product preview</Eyebrow>
            <h2 className="text-[26px] sm:text-[30px] font-semibold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
              One dashboard. Complete visibility.
            </h2>
          </div>

          <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 sm:p-8 shadow-sm">
            <div className="grid sm:grid-cols-4 gap-4 mb-8">
              {[
                { label: 'Total candidates', value: 156, color: PALETTE[0] },
                { label: 'Active cases', value: 42, color: PALETTE[1] },
                { label: 'Completed', value: 103, color: PALETTE[4] },
                { label: 'Pending review', value: 11, color: PALETTE[3] },
              ].map((s) => (
                <div key={s.label} className="rounded-2xl bg-[var(--surface-muted)] px-4 py-4 text-center sm:text-left">
                  <p className="text-[24px] font-semibold" style={{ fontFamily: 'var(--font-display)', color: s.color }}>
                    {s.value}
                  </p>
                  <p className="text-[11.5px] text-[var(--muted)] mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>

            <div className="grid lg:grid-cols-[0.8fr_1.2fr] gap-8">
              <div>
                <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)] mb-4" style={{ fontFamily: 'var(--font-mono)' }}>
                  Verification breakdown
                </p>
                <div className="space-y-4">
                  {[
                    { label: 'PAN', pct: 98, color: PALETTE[1] },
                    { label: 'UAN', pct: 91, color: PALETTE[2] },
                    { label: 'Court', pct: 87, color: PALETTE[3] },
                  ].map((row) => (
                    <div key={row.label}>
                      <div className="flex items-center justify-between text-[12.5px] mb-1.5">
                        <span className="font-medium">{row.label}</span>
                        <span className="font-semibold" style={{ fontFamily: 'var(--font-mono)', color: row.color }}>
                          {row.pct}%
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-[var(--border)]/60 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${row.pct}%`, background: row.color }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)] mb-4" style={{ fontFamily: 'var(--font-mono)' }}>
                  Recent cases — demo data
                </p>
                <div className="overflow-x-auto -mx-2">
                  <table className="w-full text-[12.5px] min-w-[420px]">
                    <thead>
                      <tr className="text-left text-[var(--muted)]">
                        <th className="font-medium px-2 pb-2">Candidate</th>
                        <th className="font-medium px-2 pb-2">Verification</th>
                        <th className="font-medium px-2 pb-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { name: 'Candidate A', checks: 'PAN + UAN', status: 'Verified', color: PALETTE[4] },
                        { name: 'Candidate B', checks: 'PAN + Court', status: 'Under review', color: PALETTE[3] },
                        { name: 'Candidate C', checks: 'PAN + UAN + Court', status: 'Completed', color: PALETTE[0] },
                      ].map((row) => (
                        <tr key={row.name} className="border-t border-[var(--border)]">
                          <td className="px-2 py-2.5">{row.name}</td>
                          <td className="px-2 py-2.5 text-[var(--muted)]">{row.checks}</td>
                          <td className="px-2 py-2.5">
                            <span className="font-semibold px-2 py-0.5 rounded-full text-[11px]" style={{ color: row.color, background: `${row.color}1a` }}>
                              {row.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-[10.5px] text-[var(--muted)] mt-3">Fictional data for illustration only.</p>
              </div>
            </div>
          </div>
        </div>
        </section>

        {/* ================= SECURITY ================= */}
        <section id="security" className="max-w-6xl mx-auto w-full px-6 pb-20 scroll-mt-20">
          <div className="text-center mb-10">
            <Eyebrow>Security</Eyebrow>
            <h2 className="text-[26px] sm:text-[30px] font-semibold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
              Built with security in mind
            </h2>
            <p className="text-[14px] text-[var(--muted)] mt-3 max-w-xl mx-auto leading-relaxed">
              Designed with security and controlled access in mind, at every layer of the platform.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {SECURITY_POINTS.map(({ icon: Icon, title, description }) => (
              <div key={title} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-5 py-5">
                <span className="w-9 h-9 rounded-lg flex items-center justify-center mb-3.5 bg-[var(--primary)]/12 text-[var(--primary)]">
                  <Icon size={16} />
                </span>
                <h3 className="text-[13.5px] font-semibold mb-1.5" style={{ fontFamily: 'var(--font-display)' }}>
                  {title}
                </h3>
                <p className="text-[12.5px] text-[var(--muted)] leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ================= USE CASES ================= */}
        <section id="use-cases" className="max-w-6xl mx-auto w-full px-6 pb-20 scroll-mt-20">
          <div className="text-center mb-10">
            <Eyebrow>Who it's for</Eyebrow>
            <h2 className="text-[26px] sm:text-[30px] font-semibold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
              Built for every hiring environment
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {USE_CASES.map(({ icon: Icon, title, description, color }) => (
              <div
                key={title}
                className="relative rounded-3xl border border-[var(--border)] bg-[var(--surface)] px-5 py-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md overflow-hidden"
              >
                <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-[0.10] pointer-events-none" style={{ background: color }} />
                <span className="w-9 h-9 rounded-xl flex items-center justify-center mb-3.5" style={{ background: `${color}1f`, color }}>
                  <Icon size={16} />
                </span>
                <h3 className="text-[14px] font-semibold mb-1.5" style={{ fontFamily: 'var(--font-display)' }}>
                  {title}
                </h3>
                <p className="text-[13.5px] text-[var(--muted)] leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ================= INDUSTRIES ================= */}
        <section id="industries" className="relative py-20 scroll-mt-20 bg-[var(--surface)]/50 border-y border-[var(--border)]">
        <div className="max-w-6xl mx-auto w-full px-6">
          <div className="text-center mb-8">
            <Eyebrow>Built for every industry</Eyebrow>
            <h2 className="text-[26px] sm:text-[30px] font-semibold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
              Verification workflows that fit your sector
            </h2>
            <p className="text-[14px] text-[var(--muted)] mt-3 max-w-lg mx-auto leading-relaxed">
              Every sector screens differently. HireVerify adapts case types, required checks and turnaround
              expectations to what actually matters in your industry.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mt-7">
              <div className="flex items-center -space-x-2.5">
                {INDUSTRIES.slice(0, 6).map(({ title, color }) => (
                  <span
                    key={title}
                    title={title}
                    className="w-9 h-9 rounded-full ring-2 ring-[var(--background)] flex items-center justify-center text-[11px] font-semibold text-white shadow-sm"
                    style={{ background: color, fontFamily: 'var(--font-mono)' }}
                  >
                    {title.slice(0, 2).toUpperCase()}
                  </span>
                ))}
                <span
                  className="w-9 h-9 rounded-full ring-2 ring-[var(--background)] bg-[var(--primary)]/15 text-[var(--primary)] flex items-center justify-center text-[10.5px] font-semibold shadow-sm"
                  style={{ fontFamily: 'var(--font-mono)' }}
                >
                  +{INDUSTRIES.length - 6}
                </span>
              </div>
              <div className="hidden sm:block h-8 w-px bg-[var(--border)]" />
              <div className="flex items-center gap-5 sm:gap-7">
                {INDUSTRY_STATS.map(({ value, label }) => (
                  <div key={label} className="text-center">
                    <p className="text-[17px] font-semibold text-[var(--primary)]" style={{ fontFamily: 'var(--font-display)' }}>
                      {value}
                    </p>
                    <p className="text-[10.5px] text-[var(--muted)] leading-snug whitespace-nowrap">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {INDUSTRIES.map(({ icon: Icon, title, description, color }) => (
              <div
                key={title}
                className="group relative rounded-3xl border border-[var(--border)] bg-[var(--surface)] px-5 py-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md overflow-hidden"
              >
                <div
                  className="absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-[0.10] group-hover:opacity-[0.16] transition-opacity pointer-events-none"
                  style={{ background: color }}
                />
                <span className="w-9 h-9 rounded-xl flex items-center justify-center mb-3.5" style={{ background: `${color}1f`, color }}>
                  <Icon size={16} />
                </span>
                <h3 className="text-[14px] font-semibold mb-1.5" style={{ fontFamily: 'var(--font-display)' }}>
                  {title}
                </h3>
                <p className="text-[13.5px] text-[var(--muted)] leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </div>
        </section>

        {/* ================= FAQ ================= */}
        <section id="faq" className="max-w-3xl mx-auto w-full px-6 pb-20 scroll-mt-20">
          <div className="text-center mb-10">
            <Eyebrow>FAQ</Eyebrow>
            <h2 className="text-[26px] sm:text-[30px] font-semibold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
              Common questions
            </h2>
          </div>
          <FaqAccordion items={FAQS} />
        </section>

        {/* ================= CTA BAND ================= */}
        <section className="max-w-6xl mx-auto w-full px-6 pb-20">
          <div className="relative rounded-3xl border border-[var(--border)] bg-[var(--surface)] px-8 py-10 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-6 overflow-hidden">
            <div
              className="absolute inset-0 opacity-[0.06] pointer-events-none"
              style={{ background: 'linear-gradient(120deg, #6366f1, #14b8a6, #f59e0b)' }}
            />
            <div className="relative text-center sm:text-left">
              <h2 className="text-[19px] font-semibold" style={{ fontFamily: 'var(--font-display)' }}>
                Make every hiring decision with more confidence
              </h2>
              <p className="text-[14px] text-[var(--muted)] mt-1">
                Centralize candidate verification, simplify your workflow, and deliver clear results to your clients.
              </p>
            </div>
            <div className="relative flex flex-col sm:flex-row items-center gap-3 shrink-0">
              <Link
                href="/contact?intent=quote"
                className="flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] text-[13.5px] font-semibold px-5 py-3 hover:bg-[var(--surface-muted)] transition-colors"
              >
                <Quote size={15} />
                Get a quotation
              </Link>
              <Link
                href="/login"
                className="flex items-center gap-2 rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] text-[13.5px] font-semibold px-5 py-3 hover:opacity-90 transition-opacity"
              >
                Get started
                <ArrowRight size={15} />
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* ================= FOOTER ================= */}
      <footer className="border-t border-[var(--border)] bg-[var(--surface)] mt-auto">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-8 mb-10">
            <div className="lg:col-span-1">
              <span className="flex items-center gap-2 mb-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--primary)]/15 text-[var(--primary)]">
                  <BrandMark size={16} />
                </span>
                <span className="font-semibold text-[14px]" style={{ fontFamily: 'var(--font-display)' }}>
                  HireVerify
                </span>
              </span>
              <p className="text-[12.5px] text-[var(--muted)] leading-relaxed">
                Secure, multi-tenant background verification for companies and their clients.
              </p>
            </div>

            <div>
              <p className="text-[11px] uppercase tracking-[0.1em] text-[var(--muted)] mb-3" style={{ fontFamily: 'var(--font-mono)' }}>
                Product
              </p>
              <ul className="space-y-2 text-[13px]">
                <li><Link href="/#features" className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">Features</Link></li>
                <li><Link href="/#verifications" className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">Verifications</Link></li>
                <li><Link href="/#how-it-works" className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">How it works</Link></li>
                <li><Link href="/#security" className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">Security</Link></li>
              </ul>
            </div>

            <div>
              <p className="text-[11px] uppercase tracking-[0.1em] text-[var(--muted)] mb-3" style={{ fontFamily: 'var(--font-mono)' }}>
                Solutions
              </p>
              <ul className="space-y-2 text-[13px]">
                <li><Link href="/#industries" className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">Industries</Link></li>
                <li><Link href="/#use-cases" className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">Recruitment Agencies</Link></li>
                <li><Link href="/#use-cases" className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">HR Teams</Link></li>
                <li><Link href="/#use-cases" className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">Staffing Companies</Link></li>
                <li><Link href="/#use-cases" className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">Enterprises</Link></li>
              </ul>
            </div>

            <div>
              <p className="text-[11px] uppercase tracking-[0.1em] text-[var(--muted)] mb-3" style={{ fontFamily: 'var(--font-mono)' }}>
                Company
              </p>
              <ul className="space-y-2 text-[13px]">
                <li><Link href="/contact" className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">Contact</Link></li>
                <li><Link href="/contact?intent=quote" className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">Get a quotation</Link></li>
                <li><Link href="/#faq" className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">FAQ</Link></li>
              </ul>
            </div>

            <div>
              <p className="text-[11px] uppercase tracking-[0.1em] text-[var(--muted)] mb-3" style={{ fontFamily: 'var(--font-mono)' }}>
                Legal
              </p>
              <ul className="space-y-2 text-[13px]">
                <li><Link href="/privacy" className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">Privacy Policy</Link></li>
                <li><Link href="/terms" className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">Terms of Service</Link></li>
              </ul>
            </div>
          </div>

          <div className="pt-6 border-t border-[var(--border)] flex flex-col sm:flex-row items-center justify-between gap-4 text-[12px] text-[var(--muted)]">
            <span style={{ fontFamily: 'var(--font-mono)' }}>
              © {new Date().getFullYear()} HireVerify. All rights reserved.
            </span>
            <Link
              href="/login"
              className="flex items-center gap-2 text-[var(--foreground)] font-medium hover:text-[var(--primary)] transition-colors"
            >
              <Mail size={13} />
              Sign in
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}