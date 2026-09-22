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
  Network,
  Mail,
  Phone,
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
  { id: 'navigation', label: 'Full navigation' },
  { id: 'other', label: 'Other sections' },
  { id: 'support', label: 'Support contact' },
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

      {activeTab === 'navigation' && (
        <section className="space-y-5">
          <div className="rounded-2xl border border-[var(--primary)]/30 bg-[var(--primary)]/10 p-5">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--primary)] text-[var(--primary-foreground)]"><Network size={19} /></span>
              <div><h2 className="text-[16px] font-semibold">Complete portal map</h2><p className="mt-1 text-[12.5px] leading-5 text-[var(--muted)]">Use this map to understand every company navigation area, what it is for, and how the main tabs connect to the work.</p></div>
            </div>
          </div>
          <div className="relative space-y-4 pl-5 before:absolute before:bottom-5 before:left-[19px] before:top-5 before:w-px before:bg-[var(--primary)]/30">
            {[
              { group: 'Workspace', color: '#3FDCC0', items: [{ name: 'Dashboard', href: '/company/dashboard', description: 'At-a-glance workload, status, reports, and operational summary.' }, { name: 'Analytics', href: '/company/analytics', description: 'Monthly/yearly trends, growth, completion, checks, clients, candidates, and reports.' }] },
              { group: 'Engagement', color: '#5EA8D9', items: [{ name: 'Clients', href: '/company/clients', description: 'Create and manage client organizations.' }, { name: 'Candidates', href: '/company/candidates', description: 'Create candidates and associate them with clients.' }] },
              { group: 'Verification', color: '#F2AE55', items: [{ name: 'BGV Cases', href: '/company/bgv-cases', description: 'Create cases, select checks, update status, and open candidate verification tabs.' }, { name: 'Reports', href: '/company/reports', description: 'Review, download, and send completed reports.' }, { name: 'Manual BGV', href: '/company/manual-bgv', description: 'Record verification completed outside the portal.' }, { name: 'Verification Checks', href: '/company/verifications', description: 'Review verification check records and outcomes.' }] },
              { group: 'Actions', color: '#B18AF2', items: [{ name: 'Government Portals', href: '/company/government-portals', description: 'Open external portals used during verification work.' }] },
              { group: 'Organization', color: '#FF6B6B', items: [{ name: 'Company Profile', href: '/company/profile', description: 'Maintain company identity, logo, contact, and report branding.' }, { name: 'Users', href: '/company/users', description: 'Invite teammates and manage user access.' }, { name: 'Roles', href: '/company/roles', description: 'Configure role capabilities and permissions.' }, { name: 'Audit activity', href: '/company/audit', description: 'Review all recorded company activity.' }, { name: 'Settings', href: '/company/settings', description: 'Manage workspace preferences.' }, { name: 'Help', href: '/company/help', description: 'Use this guide and contact support.' }] },
            ].map((group) => <div key={group.group} className="relative"><span className="absolute -left-5 top-5 h-3 w-3 rounded-full border-2 border-[var(--surface)]" style={{ backgroundColor: group.color }} /><div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4"><div className="mb-3 flex items-center justify-between"><h2 className="text-[14px] font-semibold" style={{ color: group.color }}>{group.group}</h2><span className="text-[11px] text-[var(--muted)]">{group.items.length} sections</span></div><div className="grid gap-2 md:grid-cols-2">{group.items.map((item) => <Link key={item.href} href={item.href} className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-3 transition-colors hover:border-[var(--primary)]/50"><div className="flex items-center justify-between gap-2"><p className="text-[12.5px] font-semibold">{item.name}</p><ArrowRight size={13} className="text-[var(--muted)]" /></div><p className="mt-1 text-[11.5px] leading-5 text-[var(--muted)]">{item.description}</p></Link>)}</div></div></div>)}
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"><h2 className="text-[15px] font-semibold">BGV case tabs</h2><p className="mt-1 text-[12px] text-[var(--muted)]">Inside a case, the visible tabs depend on the checks included in that case.</p><div className="mt-4 flex flex-wrap gap-2">{['Candidate', 'PAN', 'Identity', 'Address', 'Address (Physical)', 'UAN', 'Education', 'Employment', 'Gap Check', 'Reference Check', 'CV Validation', 'Social Media', 'Criminal Record', 'CIBIL', '26AS', 'Police Verification', 'Police Record'].map((item) => <span key={item} className="rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1.5 text-[11px] text-[var(--muted)]">{item}</span>)}</div></div>
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
        <section className="grid gap-5 md:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl border border-[var(--primary)]/30 bg-[var(--primary)]/10 p-6"><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--primary)]">Need assistance?</p><h2 className="mt-2 text-[24px] font-semibold">Contact Brainhunt Ventures</h2><p className="mt-2 max-w-xl text-[13px] leading-6 text-[var(--muted)]">For portal access, verification workflow, report generation, account, or technical support questions, contact the support team directly.</p><div className="mt-6 grid gap-3 sm:grid-cols-2"><a href="mailto:contact@brainhuntventures.com" className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 transition-colors hover:border-[var(--primary)]"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--primary)]/10 text-[var(--primary)]"><Mail size={17} /></span><span><span className="block text-[11px] text-[var(--muted)]">Email support</span><span className="mt-1 block break-all text-[12.5px] font-semibold">contact@brainhuntventures.com</span></span></a><a href="tel:9359647748" className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 transition-colors hover:border-[var(--primary)]"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--primary)]/10 text-[var(--primary)]"><Phone size={17} /></span><span><span className="block text-[11px] text-[var(--muted)]">Phone support</span><span className="mt-1 block text-[12.5px] font-semibold">9359647748</span></span></a></div></div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6"><h2 className="text-[15px] font-semibold">What to include</h2><div className="mt-4 space-y-3 text-[12.5px] leading-5 text-[var(--muted)]"><p>• Your company name and registered email.</p><p>• The page, case number, or candidate reference involved.</p><p>• A short description of what happened and the expected result.</p><p>• A screenshot or error message when reporting a technical issue.</p></div></div>
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