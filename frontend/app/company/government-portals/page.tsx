'use client';

import { ExternalLink, FileCheck2, FileText, Fingerprint, Landmark, ReceiptText, Scale, CarFront, BadgeIndianRupee, Building2, CreditCard, ShieldCheck, SearchCheck, BriefcaseBusiness } from 'lucide-react';

const portals = [
  {
    name: 'Check Aadhaar validity',
    description: 'Validate the status of an Aadhaar number through UIDAI.',
    href: 'https://myaadhaar.uidai.gov.in/check-aadhaar-validity/en',
    icon: Fingerprint,
    label: 'Open service',
  },
  {
    name: 'PAN Services',
    description: 'Access official Income Tax services for PAN-related checks and services.',
    href: 'https://www.incometax.gov.in/iec/foportal/',
    icon: FileText,
    label: 'Open service',
  },
  {
    name: 'UAN / EPFO Member Portal',
    description: 'Access UAN and employment provident fund services.',
    href: 'https://unifiedportal-mem.epfindia.gov.in/memberinterface/',
    icon: BadgeIndianRupee,
    label: 'Open service',
  },
  {
    name: 'Driving Licence Services',
    description: 'Use Parivahan services for driving licence verification.',
    href: 'https://parivahan.gov.in/parivahan//',
    icon: CarFront,
    label: 'Open service',
  },
  {
    name: 'Court Records',
    description: 'Search official Indian court services and case records.',
    href: 'https://ecourts.gov.in/ecourts_home/',
    icon: Scale,
    label: 'Open service',
  },
  {
    name: 'TDS Services',
    description: 'Access official TDS information and services through the tax portal.',
    href: 'https://www.incometax.gov.in/iec/foportal/help/all-topics/tds',
    icon: ReceiptText,
    label: 'Open service',
  },
  {
    name: 'Form 26AS',
    description: 'Sign in to access Form 26AS tax credit details.',
    href: 'https://eportal.incometax.gov.in/iec/foservices/#/login',
    icon: Landmark,
    label: 'Open service',
  },
  {
    name: 'Form 16',
    description: 'Access official TRACES information for Form 16 services.',
    href: 'https://contents.tdscpc.gov.in/en/form-16.html',
    icon: FileCheck2,
    label: 'Open service',
  },
  {
    name: 'Police Character / PCC Services',
    description: 'Access official police and passport services for character or police clearance checks.',
    href: 'https://digitalpolice.gov.in/',
    icon: ShieldCheck,
    label: 'Open service',
  },
  {
    name: 'Maharashtra Police PCC',
    description: 'Apply for and track a Police Clearance Certificate through Maharashtra Police.',
    href: 'https://pcs.mahaonline.gov.in/Forms/Home.aspx',
    icon: ShieldCheck,
    label: 'Open service',
  },
  {
    name: 'CIBIL Credit Report',
    description: 'Open the official TransUnion CIBIL portal for credit report services.',
    href: 'https://www.cibil.com/',
    icon: CreditCard,
    label: 'Open service',
  },
  {
    name: 'MCA Company Search',
    description: 'Verify employer company registration and public corporate information.',
    href: 'https://www.mca.gov.in/content/mca/global/en/mca/master-data/MDS.html',
    icon: Building2,
    label: 'Open service',
  },
  {
    name: 'GSTIN Verification',
    description: 'Check an employer or business GST registration on the official GST portal.',
    href: 'https://www.gst.gov.in/',
    icon: SearchCheck,
    label: 'Open service',
  },
  {
    name: 'National Career Service',
    description: 'Access the official employment and employer services portal.',
    href: 'https://www.ncs.gov.in/',
    icon: BriefcaseBusiness,
    label: 'Open service',
  },
];

export default function GovernmentPortalsPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--primary)]">Quick access</p>
        <h1 className="text-[26px] font-semibold">Government Portals</h1>
        <p className="mt-1 text-[13px] text-[var(--muted)]">Quick access to official services used during background verification.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {portals.map((portal) => {
          const Icon = portal.icon;
          return (
            <a key={portal.name} href={portal.href} target="_blank" rel="noopener noreferrer" className="group flex min-h-[226px] flex-col rounded-xl border border-[#D8D8D8] bg-white p-5 text-[#111827] shadow-[0_2px_5px_rgba(0,0,0,0.14)] transition hover:-translate-y-0.5 hover:border-[var(--primary)] hover:shadow-md">
              <div className="flex items-start justify-between gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg border-2 border-[#17276B] bg-[#F8FBFF] text-[#087BB8]">
                  <Icon size={28} strokeWidth={1.8} />
                </div>
                <ExternalLink size={16} className="mt-1 text-[#17276B] opacity-0 transition group-hover:opacity-100" />
              </div>
              <h2 className="mt-5 text-[17px] font-bold leading-tight group-hover:text-[#087BB8]">{portal.name}</h2>
              <p className="mt-2 text-[14px] leading-snug text-[#111827]">{portal.description}</p>
              <span className="mt-auto pt-4 text-[12px] font-semibold text-[#087BB8]">{portal.label} <span aria-hidden="true">-&gt;</span></span>
            </a>
          );
        })}
      </div>
    </div>
  );
}
