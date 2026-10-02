'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ACHU_KNOWLEDGE } from '@/src/lib/help/achuKnowledge';
import {
  ArrowRight,
  BriefcaseBusiness,
  FileCheck2,
  FileDown,
  FilePlus2,
  FileText,
  HelpCircle,
  Users,
  ClipboardCheck,
  GitBranch,
  ShieldCheck,
  Landmark,
  UserCircle,
  Shield,
  Settings as SettingsIcon,
  LayoutList,
  Network,
  Mail,
  Phone,
  Receipt,
  Megaphone,
} from 'lucide-react';

const steps = [
  { number: '01', title: 'Create the client', description: 'Open Clients, select New client, and save the organization details and contact information.', href: '/company/clients', icon: BriefcaseBusiness },
  { number: '02', title: 'Add a candidate', description: 'Open Candidates, create the candidate, and associate the candidate with the correct client.', href: '/company/candidates', icon: Users },
  { number: '03', title: 'Create a BGV case', description: 'Open BGV Cases, choose the client and candidate, then select the verification checks for the package.', href: '/company/bgv-cases', icon: FileCheck2 },
  { number: '04', title: 'Complete verification details', description: 'Open the case, choose a check tab, enter findings, upload supporting documents, and save the verification.', href: '/company/verifications', icon: ClipboardCheck },
  { number: '05', title: 'Generate and view the report', description: 'Use View report from the case or Reports page. A case does not need to be marked Completed to preview or download its report.', href: '/company/reports', icon: FileText },
  { number: '06', title: 'Send completed reports', description: 'For client email delivery, select completed cases in Reports and choose Send selected to client.', href: '/company/reports', icon: FileDown },
  { number: '07', title: 'Manage invoices and payments', description: 'Set up your business billing profile, create and send client invoices, then record payments and track outstanding balances.', href: '/company/invoices', icon: Receipt },
];

// Sidebar sections that sit outside the core 6-step flow but still need a short explanation.
const otherSections = [
  {
    group: 'Verification',
    items: [
      { title: 'Manual BGV', description: 'Log a verification that was completed outside the portal (e.g. over phone or email) and attach the supporting evidence manually, without running it through the normal case flow.', href: '/company/manual-bgv', icon: FilePlus2 },
      { title: 'Verification Checks', description: 'The master list of check types (address, gap, reference, CV, social media, police record, etc.) that can be added to a BGV case package. Manage which checks are available here.', href: '/company/verification-checks', icon: ShieldCheck },
    ],
  },
  {
    group: 'Actions',
    items: [
      { title: 'Government Portals', description: 'Quick links to external government verification portals (e.g. for identity, education, or police checks) that you may need while working a case.', href: '/company/government-portals', icon: Landmark },
    ],
  },
  {
    group: 'Growth',
    items: [
      { title: 'Marketing', description: 'Connect a Gmail or Google Workspace sender with an app password, add only consented leads, and choose Campaign or Individual email. For individual email, confirm opt-in and record the consent source before previewing; unsubscribed leads are blocked.', href: '/company/marketing', icon: Megaphone },
    ],
  },
  {
    group: 'Organization',
    items: [
      { title: 'Company Profile', description: 'Your organization\u2019s name, address, logo, and contact details. This information can appear on generated reports, so keep it up to date.', href: '/company/profile', icon: UserCircle },
      { title: 'Users', description: 'Invite teammates, deactivate accounts, and control who on your team has access to the portal.', href: '/company/users', icon: Users },
      { title: 'Roles', description: 'Define what each user type can see and do \u2014 for example, restricting who can send reports to clients or edit company settings.', href: '/company/roles', icon: Shield },
      { title: 'Settings', description: 'Portal-wide preferences: notification behavior, default report options, and other configuration for your account.', href: '/company/settings', icon: SettingsIcon },
    ],
  },
];

const tabs = [
  { id: 'steps', label: 'Quick start' },
  { id: 'flowchart', label: 'Workflow' },
  { id: 'navigation', label: 'Modules' },
  { id: 'other', label: 'More tools' },
  { id: 'support', label: 'Support' },
] as const;

const moduleGroups = [
  {
    group: 'Setup',
    color: '#3FDCC0',
    items: [
      { name: 'Company Profile', href: '/company/profile', description: 'Build your company identity and branding before sending reports.' },
      { name: 'Users', href: '/company/users', description: 'Add your team and assign portal access.' },
      { name: 'Roles', href: '/company/roles', description: 'Define what each team member can view and manage.' },
    ],
  },
  {
    group: 'Client & candidate',
    color: '#5EA8D9',
    items: [
      { name: 'Clients', href: '/company/clients', description: 'Create the company or customer organizations you are verifying.' },
      { name: 'Candidates', href: '/company/candidates', description: 'Add candidate profiles and link them to the right client.' },
    ],
  },
  {
    group: 'Verification operations',
    color: '#F2AE55',
    items: [
      { name: 'BGV Cases', href: '/company/bgv-cases', description: 'Create a case, choose checks, and track the verification journey.' },
      { name: 'Manual BGV', href: '/company/manual-bgv', description: 'Record checks completed outside the normal portal flow.' },
      { name: 'Verification Checks', href: '/company/verification-checks', description: 'Manage the master checklist used in check packages.' },
      { name: 'Reports', href: '/company/reports', description: 'Preview, download, and share final verification reports.' },
    ],
  },
  {
    group: 'Billing',
    color: '#56B88A',
    items: [
      { name: 'Invoices', href: '/company/invoices', description: 'Configure your billing profile, create and send client invoices, download invoice PDFs, record payments, and monitor outstanding balances.' },
    ],
  },
  {
    group: 'Growth',
    color: '#E88564',
    items: [
      { name: 'Marketing', href: '/company/marketing', description: 'Manage consented leads, verify your Google email sender, confirm the consent source for new individual-email recipients, and review delivery results.' },
    ],
  },
  {
    group: 'Control & support',
    color: '#B18AF2',
    items: [
      { name: 'Government Portals', href: '/company/government-portals', description: 'Use external portals during the verification process when needed.' },
      { name: 'Audit activity', href: '/company/audit', description: 'Review recent actions taken in the platform.' },
      { name: 'Settings', href: '/company/settings', description: 'Update workspace preferences and account behavior.' },
      { name: 'Help', href: '/company/help', description: 'This guide and contact information for additional support.' },
    ],
  },
] as const;

type TabId = (typeof tabs)[number]['id'];

export default function CompanyHelpPage() {
  const [activeTab, setActiveTab] = useState<TabId>('steps');

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header className="max-w-4xl rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <div className="mb-3 flex items-center gap-2 text-[var(--primary)]">
          <HelpCircle size={18} />
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em]">Portal guide</span>
        </div>
        <h1 className="text-[28px] font-semibold">How HireVerify works</h1>
        <p className="mt-2 text-[13px] leading-6 text-[var(--muted)]">Use this flow to set up your organization, run BGV checks, share verification reports, and manage client billing.</p>
        <div className="mt-5 flex flex-wrap gap-2 text-[11px]">
          <span className="rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-2.5 py-1 text-[var(--muted)]">1. Setup</span>
          <span className="rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-2.5 py-1 text-[var(--muted)]">2. Add client</span>
          <span className="rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-2.5 py-1 text-[var(--muted)]">3. Add candidate</span>
          <span className="rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-2.5 py-1 text-[var(--muted)]">4. Run verification</span>
          <span className="rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-2.5 py-1 text-[var(--muted)]">5. Share report</span>
          <span className="rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-2.5 py-1 text-[var(--muted)]">6. Manage billing</span>
        </div>
      </header>

      <div className="flex items-center gap-1 border-b border-[var(--border)]">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 rounded-t-lg px-4 py-2 text-[13px] font-semibold transition-colors ${
              activeTab === tab.id
                ? 'border-b-2 border-[var(--primary)] text-[var(--primary)]'
                : 'text-[var(--muted)] hover:text-[var(--text)]'
            }`}
          >
            {tab.id === 'flowchart' && <GitBranch size={14} />}
            {tab.id === 'navigation' && <Network size={14} />}
            {tab.id === 'other' && <LayoutList size={14} />}
            {tab.id === 'support' && <HelpCircle size={14} />}
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'steps' && (
        <section className="grid gap-3 md:grid-cols-2">
          {steps.map(({ number, title, description, href, icon: Icon }) => (
            <Link
              key={number}
              href={href}
              className="group rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 transition-colors hover:border-[var(--primary)]/50 hover:bg-[var(--surface-muted)]"
            >
              <div className="flex items-start gap-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--primary)]/10 font-mono text-[11px] font-semibold text-[var(--primary)]">
                  {number}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-[15px] font-semibold">{title}</h2>
                    <Icon size={17} className="shrink-0 text-[var(--primary)]" />
                  </div>
                  <p className="mt-2 text-[12.5px] leading-5 text-[var(--muted)]">{description}</p>
                  <span className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--primary)]">
                    Open section <ArrowRight size={13} />
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </section>
      )}

      {activeTab === 'flowchart' && (
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <svg width="100%" viewBox="0 0 680 680" role="img" aria-labelledby="flow-title flow-desc">
            <title id="flow-title">HireVerify workflow</title>
            <desc id="flow-desc">Flowchart of the HireVerify process: create client, add candidate, create BGV case, complete verification details, generate and send reports, then manage invoices and payments.</desc>
            <defs>
              <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M2 1L8 5L2 9" fill="none" stroke="var(--primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </marker>
            </defs>

            {steps.map((step, i) => {
              const y = 40 + i * 96;
              const isLast = i === steps.length - 1;
              return (
                <g key={step.number}>
                  <rect x="140" y={y} width="400" height="56" rx="8" fill="var(--surface-muted)" stroke="var(--primary)" strokeOpacity="0.4" strokeWidth="0.5" />
                  <text x="340" y={y + 20} textAnchor="middle" dominantBaseline="central" fontSize="14" fontWeight="500" fill="var(--text)">
                    {step.number} · {step.title}
                  </text>
                  <text x="340" y={y + 40} textAnchor="middle" dominantBaseline="central" fontSize="12" fill="var(--muted)">
                    {step.description.length > 46 ? step.description.slice(0, 44) + '…' : step.description}
                  </text>
                  {!isLast && (
                    <line x1="340" y1={y + 56} x2="340" y2={y + 96} stroke="var(--primary)" strokeWidth="1.5" markerEnd="url(#arrow)" />
                  )}
                </g>
              );
            })}
          </svg>
        </section>
      )}

      {activeTab === 'navigation' && (
        <section className="space-y-5">
          <div className="rounded-2xl border border-[var(--primary)]/30 bg-[var(--primary)]/10 p-5">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--primary)] text-[var(--primary-foreground)]"><Network size={19} /></span>
              <div><h2 className="text-[16px] font-semibold">Complete portal map</h2><p className="mt-1 text-[12.5px] leading-5 text-[var(--muted)]">Use this map to understand every company navigation area, what it is for, and how the main tabs connect to the work.</p></div>
            </div>
          </div>
          <div className="space-y-4">
            {moduleGroups.map((group) => (
              <div key={group.group} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 className="text-[14px] font-semibold" style={{ color: group.color }}>{group.group}</h2>
                  <span className="text-[11px] text-[var(--muted)]">{group.items.length} modules</span>
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  {group.items.map((item) => (
                    <Link key={item.href} href={item.href} className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-3 transition-colors hover:border-[var(--primary)]/50">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[12.5px] font-semibold">{item.name}</p>
                        <ArrowRight size={13} className="text-[var(--muted)]" />
                      </div>
                      <p className="mt-1 text-[11.5px] leading-5 text-[var(--muted)]">{item.description}</p>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-[15px] font-semibold">Invoice workflow</h2>
                <p className="mt-1 text-[12px] leading-5 text-[var(--muted)]">Use Invoices to prepare client bills and keep payment status up to date.</p>
              </div>
              <Link href="/company/invoices" className="inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--primary)] hover:underline">
                Open Invoices <ArrowRight size={14} />
              </Link>
            </div>
            <ol className="mt-4 grid gap-3 sm:grid-cols-2">
              {[
                { title: 'Set up your billing profile', description: 'Add your business address, tax identifiers, and bank or UPI details for future invoices.' },
                { title: 'Create an invoice', description: 'Choose a client, add services or eligible BGV cases, and enter quantities, rates, discounts, and tax.' },
                { title: 'Review and send', description: 'Check the invoice details, preview it, then email it to your client or download the PDF.' },
                { title: 'Record payments', description: 'Add each received payment with its date, method, and reference so the balance stays current.' },
                { title: 'Track status and balance', description: 'Use invoice status and outstanding balances to follow drafts, sent invoices, partial payments, overdue bills, and paid invoices.' },
              ].map((step, index) => (
                <li key={step.title} className="flex gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--primary)]/10 text-[11px] font-semibold text-[var(--primary)]">{index + 1}</span>
                  <div>
                    <h3 className="text-[12px] font-semibold">{step.title}</h3>
                    <p className="mt-1 text-[11.5px] leading-5 text-[var(--muted)]">{step.description}</p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-[11.5px] leading-5 text-[var(--muted)]">
              <span className="font-semibold text-[var(--foreground)]">Before you start:</span> Check that your business billing profile and the client’s billing details are correct.
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <h2 className="text-[15px] font-semibold">BGV case tabs</h2>
            <p className="mt-1 text-[12px] text-[var(--muted)]">Inside a case, the visible tabs depend on the checks included in that case.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {['Candidate', 'PAN', 'Identity', 'Address', 'Address (Physical)', 'UAN', 'Education', 'Employment', 'Gap Check', 'Reference Check', 'CV Validation', 'Social Media', 'Criminal Record', 'CIBIL', '26AS', 'Police Verification', 'Police Record'].map((item) => (
                <span key={item} className="rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1.5 text-[11px] text-[var(--muted)]">{item}</span>
              ))}
            </div>
          </div>
        </section>
      )}

      {activeTab === 'other' && (
        <section className="space-y-6">
          {otherSections.map((group) => (
            <div key={group.group}>
              <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">{group.group}</h2>
              <div className="grid gap-3 md:grid-cols-2">
                {group.items.map(({ title, description, href, icon: Icon }) => (
                  <Link
                    key={title}
                    href={href}
                    className="group rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 transition-colors hover:border-[var(--primary)]/50 hover:bg-[var(--surface-muted)]"
                  >
                    <div className="flex items-start gap-4">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--primary)]/10 text-[var(--primary)]">
                        <Icon size={17} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-[15px] font-semibold">{title}</h3>
                        <p className="mt-2 text-[12.5px] leading-5 text-[var(--muted)]">{description}</p>
                        <span className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--primary)]">
                          Open section <ArrowRight size={13} />
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}

      {activeTab === 'support' && (
        <section className="grid gap-5 md:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-2xl border border-[var(--primary)]/30 bg-[var(--primary)]/10 p-6 md:col-span-2">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-2xl">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--primary)]">Built-in portal guide</p>
                <h2 className="mt-2 text-[22px] font-semibold">Meet ACHU</h2>
                <p className="mt-2 text-[13px] leading-6 text-[var(--muted)]">ACHU matches module names and common question phrases to a focused answer, numbered steps, and a direct page link. Its help topics are maintained from curated HireVerify guidance, so the assistant does not access candidate or case records. Use the Ask ACHU button at the bottom-right of the portal.</p>
              </div>
              <div className="max-w-md">
                <p className="mb-2 text-[11px] font-semibold text-[var(--muted)]">Topics ACHU can guide you through</p>
                <div className="flex flex-wrap gap-2">
                  {ACHU_KNOWLEDGE.filter((entry) => entry.id !== 'start' && entry.id !== 'help').map((entry) => (
                    <span key={entry.id} className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-[10.5px] text-[var(--muted)]">{entry.title}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-[var(--primary)]/30 bg-[var(--primary)]/10 p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--primary)]">Need assistance?</p>
            <h2 className="mt-2 text-[24px] font-semibold">Contact Brainhunt Ventures</h2>
            <p className="mt-2 max-w-xl text-[13px] leading-6 text-[var(--muted)]">For account access, verification workflow questions, report issues, or technical help, reach out to the support team directly.</p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <a href="mailto:contact@brainhuntventures.com" className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 transition-colors hover:border-[var(--primary)]">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--primary)]/10 text-[var(--primary)]"><Mail size={17} /></span>
                <span>
                  <span className="block text-[11px] text-[var(--muted)]">Email support</span>
                  <span className="mt-1 block break-all text-[12.5px] font-semibold">contact@brainhuntventures.com</span>
                </span>
              </a>
              <a href="tel:9359647748" className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 transition-colors hover:border-[var(--primary)]">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--primary)]/10 text-[var(--primary)]"><Phone size={17} /></span>
                <span>
                  <span className="block text-[11px] text-[var(--muted)]">Phone support</span>
                  <span className="mt-1 block text-[12.5px] font-semibold">9359647748</span>
                </span>
              </a>
            </div>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <h2 className="text-[15px] font-semibold">What to include</h2>
            <div className="mt-4 space-y-3 text-[12.5px] leading-5 text-[var(--muted)]">
              <p>• Your company name and registered email.</p>
              <p>• The page, case number, or candidate reference involved.</p>
              <p>• A short description of the issue and the expected outcome.</p>
              <p>• A screenshot or error message when reporting a technical problem.</p>
            </div>
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <h2 className="text-[15px] font-semibold">Important workflow notes</h2>
        <div className="mt-3 grid gap-2 text-[12.5px] leading-5 text-[var(--muted)]">
          <p>Each case can contain multiple checks, including physical address, gap, reference, CV, social media, and police record checks.</p>
          <p>Use View report whenever you need to inspect the current case report. Completing the case is only required for completed-case reporting and email delivery.</p>
          <p>Save verification findings before generating the report so the latest statuses, remarks, and documents are included.</p>
        </div>
      </section>
    </div>
  );
}