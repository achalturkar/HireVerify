'use client';

import { useState } from 'react';
import Link from 'next/link';
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
} from 'lucide-react';

const steps = [
  { number: '01', title: 'Create the client', description: 'Open Clients, select New client, and save the organization details and contact information.', href: '/company/clients', icon: BriefcaseBusiness },
  { number: '02', title: 'Add a candidate', description: 'Open Candidates, create the candidate, and associate the candidate with the correct client.', href: '/company/candidates', icon: Users },
  { number: '03', title: 'Create a BGV case', description: 'Open BGV Cases, choose the client and candidate, then select the verification checks for the package.', href: '/company/bgv-cases', icon: FileCheck2 },
  { number: '04', title: 'Complete verification details', description: 'Open the case, choose a check tab, enter findings, upload supporting documents, and save the verification.', href: '/company/verifications', icon: ClipboardCheck },
  { number: '05', title: 'Generate and view the report', description: 'Use View report from the case or Reports page. A case does not need to be marked Completed to preview or download its report.', href: '/company/reports', icon: FileText },
  { number: '06', title: 'Send completed reports', description: 'For client email delivery, select completed cases in Reports and choose Send selected to client.', href: '/company/reports', icon: FileDown },
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
  { id: 'steps', label: 'Steps' },
  { id: 'flowchart', label: 'Flowchart' },
  { id: 'other', label: 'Other sections' },
] as const;

type TabId = (typeof tabs)[number]['id'];

export default function CompanyHelpPage() {
  const [activeTab, setActiveTab] = useState<TabId>('steps');

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header className="max-w-3xl">
        <div className="mb-3 flex items-center gap-2 text-[var(--primary)]">
          <HelpCircle size={18} />
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em]">Portal guide</span>
        </div>
        <h1 className="text-[28px] font-semibold">How HireVerify works</h1>
        <p className="mt-2 text-[13px] leading-6 text-[var(--muted)]">Follow these steps to set up a client, create a candidate case, complete checks, and produce the verification report.</p>
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
            {tab.id === 'other' && <LayoutList size={14} />}
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
          <svg width="100%" viewBox="0 0 680 616" role="img" aria-labelledby="flow-title flow-desc">
            <title id="flow-title">HireVerify workflow</title>
            <desc id="flow-desc">Flowchart of the six-step HireVerify process: create client, add candidate, create BGV case, complete verification details, generate and view report, send completed reports.</desc>
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