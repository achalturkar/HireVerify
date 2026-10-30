'use client';

import { useState } from 'react';
import Image from 'next/image';
import {
  BriefcaseBusiness,
  Check,
  FileCheck,
  FileText,
  GraduationCap,
  Hash,
  LayoutDashboard,
  Lock,
  MapPin,
  ShieldCheck,
  UserRound,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { CANDIDATE_ADDRESS_DOCUMENT_TYPES, CANDIDATE_EDUCATION_DOCUMENT_TYPES, CANDIDATE_EMPLOYMENT_DOCUMENT_TYPES, DEFAULT_CANDIDATE_FORM_CONFIG } from '@/src/types/client';
import type { CandidateFormConfig } from '@/src/types/client';
import type { Candidate } from '@/src/types/candidate';
import { candidatePortalFileUrl } from '@/src/lib/candidate-portal-forms';
import { candidateDocumentDisplayName, candidateDocumentReviewClass, candidateDocumentReviewLabel } from '@/src/lib/candidate-document-display';
import { formatCandidateName } from '@/src/lib/candidate-name';
import { resolveLogoUrl } from '@/src/lib/logo';

type PreviewDocument = {
  id: string;
  documentType: string;
  documentNumber?: string | null;
  fileName: string;
  fileUrl: string;
  verificationStatus: string;
  uploadedAt: string;
};

type PreviewCandidate = Candidate & {
  company?: { name: string; logoUrl?: string | null; primaryColor?: string | null } | null;
  documents?: PreviewDocument[];
};

type PreviewTab = 'overview' | 'details' | 'family' | 'identity' | 'address' | 'bgv' | 'reference' | 'court' | 'cibil' | 'world' | 'socialMedia' | 'education' | 'employment' | 'police' | 'other' | 'documents' | 'consent';

const IDENTITY_FIELDS = [
  { key: 'aadhaarNumber', label: 'Aadhaar number', documentType: 'AADHAAR' },
  { key: 'panNumber', label: 'PAN', documentType: 'PAN' },
  { key: 'uanNumber', label: 'UAN (EPFO)', documentType: 'UAN' },
  { key: 'passportNumber', label: 'Passport number', documentType: 'PASSPORT' },
  { key: 'drivingLicenseNumber', label: 'Driving licence number', documentType: 'DRIVING_LICENSE' },
  { key: 'voterIdNumber', label: 'Voter ID', documentType: 'VOTER_ID' },
] as const;

const allTabs: { key: PreviewTab; label: string; icon: LucideIcon }[] = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'details', label: 'Details', icon: UserRound },
  { key: 'family', label: 'Family', icon: Users },
  { key: 'identity', label: 'ID numbers', icon: Hash },
  { key: 'address', label: 'Address', icon: MapPin },
  { key: 'bgv', label: 'BGV forms', icon: FileText },
  { key: 'reference', label: 'Reference check', icon: Users },
  { key: 'court', label: 'Court check', icon: ShieldCheck },
  { key: 'cibil', label: 'CIBIL', icon: FileCheck },
  { key: 'world', label: 'World check', icon: ShieldCheck },
  { key: 'socialMedia', label: 'Social media', icon: FileText },
  { key: 'education', label: 'Qualification', icon: GraduationCap },
  { key: 'employment', label: 'Employment', icon: BriefcaseBusiness },
  { key: 'police', label: 'Police verification', icon: ShieldCheck },
  { key: 'other', label: 'Other checks', icon: FileCheck },
  { key: 'documents', label: 'Documents', icon: FileCheck },
  { key: 'consent', label: 'Review & submit', icon: ShieldCheck },
];

function isFilled(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.length > 0;
  return String(value).trim() !== '';
}

function displayValue(value: unknown): string {
  if (!isFilled(value)) return '';
  if (Array.isArray(value)) return value.map((item) => String(item).replaceAll('_', ' ')).join(', ');
  const text = String(value);
  const date = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (date) return `${date[3]}/${date[2]}/${date[1]}`;
  if (['MALE', 'FEMALE', 'NON_BINARY', 'OTHER', 'SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED', 'SEPARATED'].includes(text)) {
    return text.replaceAll('_', ' ').toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase());
  }
  return text;
}

function ReadonlyField({ label, value, required, wide = false }: { label: string; value: unknown; required?: boolean; wide?: boolean }) {
  return (
    <div className={wide ? 'sm:col-span-2' : undefined}>
      <label className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}{required && <span className="ml-1 text-red-600" aria-hidden="true">*</span>}
      </label>
      <div className="min-h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800">
        {isFilled(value) ? <span className="whitespace-pre-wrap break-words">{displayValue(value)}</span> : <span className="text-slate-400">Not provided</span>}
      </div>
    </div>
  );
}

function PortalCard({ icon: Icon, title, description, children }: { icon: LucideIcon; title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="mb-5 flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-[#23477f]">
          <Icon size={18} aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

export default function CandidatePortalPreview({ candidate }: { candidate: PreviewCandidate }) {
  const [activeTab, setActiveTab] = useState<PreviewTab>('overview');
  const config: CandidateFormConfig =
    candidate.subclient?.candidateFormConfig
    ?? candidate.client?.candidateFormConfig
    ?? DEFAULT_CANDIDATE_FORM_CONFIG;
  const documents = candidate.documents ?? [];
  const companyName = candidate.company?.name || 'Verification company';
  const clientName = candidate.subclient?.name || candidate.client?.name;
  const supportEmail = candidate.subclient?.supportEmail || candidate.client?.supportEmail;
  const supportPhone = candidate.subclient?.supportPhone || candidate.client?.supportPhone;
  const accent = candidate.company?.primaryColor || '#23477f';
  const logo = resolveLogoUrl(candidate.company?.logoUrl);
  const enabledIdentity = IDENTITY_FIELDS.filter((field) => config[field.key]?.enabled !== false);
  const customForms = config.customForms.filter((form) => form.enabled);
  const visibleTabs = allTabs.filter(({ key }) => {
    if (key === 'family') return config.sections.family.enabled;
    if (key === 'education') return config.sections.education.enabled;
    if (key === 'employment') return config.sections.employment.enabled;
    if (key === 'address') return config.sections.address.enabled;
    if (key === 'identity') return config.sections.identity.enabled;
    if (key === 'bgv') return config.sections.bgv.enabled;
    if (key === 'reference') return config.sections.reference.enabled;
    if (key === 'court') return config.sections.court.enabled;
    if (key === 'cibil') return config.sections.cibil.enabled;
    if (key === 'world') return config.sections.world.enabled;
    if (key === 'socialMedia') return config.sections.socialMedia.enabled;
    if (key === 'police') return config.sections.policeVerification.enabled;
    if (key === 'other') return config.sections.otherChecks.enabled;
    return true;
  });

  const documentsFor = (types: string[], number?: string) => documents.filter((document) =>
    types.includes(document.documentType) && (number === undefined || document.documentNumber === number),
  );
  const employmentDocumentsForPreview = (types: string[]) => documents.filter((document) =>
    types.includes(document.documentType)
    && (config.currentEmploymentEnabled || (
      document.documentNumber !== 'employment-current'
      && document.documentNumber !== null
      && document.documentNumber !== undefined
    )),
  );

  const renderDocuments = (items: PreviewDocument[], emptyText: string) => (
    items.length ? (
      <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200">
        {items.map((document) => (
          <li key={document.id} className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-900">{candidateDocumentDisplayName(document, candidate)}</p>
              <p className="mt-0.5 truncate text-xs text-slate-500">
                {document.fileName} · Uploaded {new Date(document.uploadedAt).toLocaleDateString('en-IN')}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${candidateDocumentReviewClass(document.verificationStatus)}`}>
                {candidateDocumentReviewLabel(document.verificationStatus)}
              </span>
              <a href={candidatePortalFileUrl(document.fileUrl)} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-[#23477f] hover:underline">
                Open file
              </a>
            </div>
          </li>
        ))}
      </ul>
    ) : <p className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">{emptyText}</p>
  );

  const supportingDocumentsFor = (category: string) => documents.filter(
    (document) => document.documentNumber === `CHECK_SUPPORTING:${category}`,
  );
  const renderSupportingDocuments = (category: string) => (
    <PortalCard icon={FileCheck} title={`${category.replaceAll('_', ' ')} supporting documents`}>
      {renderDocuments(supportingDocumentsFor(category), 'No supporting documents uploaded.')}
    </PortalCard>
  );

  const renderCustomForms = (category: string) => {
    const forms = customForms.filter((form) => form.category === category);
    if (!forms.length) return <p className="text-sm text-slate-500">No forms configured for this section.</p>;
    return (
      <div className="space-y-4">
        {forms.map((form) => {
          const uploaded = documents.filter((document) => document.documentNumber === `CUSTOM_FORM:${form.id}`);
          return (
            <div key={form.id} className="rounded-xl border border-slate-200 p-4">
              <h3 className="text-sm font-semibold text-slate-900">{form.name}{form.required && <span className="ml-1 text-red-600">*</span>}</h3>
              <p className="mt-1 text-xs text-slate-500">Form instructions: {form.fileName}</p>
              <div className="mt-3">{renderDocuments(uploaded, 'No completed form uploaded.')}</div>
            </div>
          );
        })}
      </div>
    );
  };

  const formSections: Record<'details' | 'family' | 'identity' | 'address' | 'education' | 'employment', React.ReactNode> = {
    details: (
      <PortalCard icon={UserRound} title="Your details" description="Personal information submitted for this verification.">
        <div className="grid gap-4 sm:grid-cols-2">
          <ReadonlyField label="Full name" value={formatCandidateName(candidate)} required wide />
          <ReadonlyField label="Email address" value={candidate.email} required />
          <ReadonlyField label="Mobile number" value={candidate.phone} required />
          <ReadonlyField label="Date of birth" value={candidate.dateOfBirth} required />
          <ReadonlyField label="Gender" value={candidate.gender} />
          <ReadonlyField label="Notes for the verification team" value={candidate.candidateNotes} wide />
        </div>
      </PortalCard>
    ),
    family: (
      <PortalCard icon={Users} title="Family details" description="Family information supplied by the candidate.">
        <div className="grid gap-4 sm:grid-cols-2">
          <ReadonlyField label="Father's name" value={candidate.fatherName} />
          <ReadonlyField label="Mother's name" value={candidate.motherName} />
          <ReadonlyField label="Marital status" value={candidate.maritalStatus} />
          <ReadonlyField label="Husband / spouse name" value={candidate.spouseName} />
          <ReadonlyField label="Number of children" value={candidate.childrenCount} />
        </div>
      </PortalCard>
    ),
    identity: (
      <div className="space-y-4">
        <div className="px-1">
          <h2 className="text-lg font-semibold">ID numbers and documents</h2>
          <p className="mt-1 text-sm text-slate-600">Identity details and uploaded copies saved from the candidate portal.</p>
          <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500"><Lock size={13} aria-hidden="true" />Private candidate information. Access is limited to authorized staff.</p>
        </div>
        {enabledIdentity.map((field) => (
          <PortalCard key={field.key} icon={Hash} title={field.label}>
            <div className="grid gap-4 sm:grid-cols-2">
              <ReadonlyField label="Number" value={candidate[field.key]} required={config[field.key].required} />
              <div className="sm:col-span-2">
                <h3 className="mb-2 text-sm font-medium text-slate-700">Uploaded identity document</h3>
                {renderDocuments(documentsFor([field.documentType]), 'No identity document uploaded.')}
              </div>
            </div>
          </PortalCard>
        ))}
        {customForms.some((form) => form.category === 'IDENTITY') && <PortalCard icon={FileText} title="Additional identity forms">{renderCustomForms('IDENTITY')}</PortalCard>}
        {renderSupportingDocuments('IDENTITY')}
      </div>
    ),
    address: (
      <div className="space-y-5">
        <PortalCard icon={MapPin} title="Current and permanent address" description="Addresses supplied for this verification.">
          <div className="grid gap-4 sm:grid-cols-2">
            {config.address.currentAddressEnabled && <ReadonlyField label="Current address" value={candidate.currentAddress} required={config.address.currentAddressRequired} wide />}
            {config.address.permanentAddressEnabled && <ReadonlyField label="Permanent address" value={candidate.permanentAddress} required={config.address.permanentAddressRequired} wide />}
            {config.address.showVerificationLocationSelector && <ReadonlyField label="Addresses selected for verification" value={candidate.addressVerificationLocations} wide />}
          </div>
        </PortalCard>
        <PortalCard icon={FileCheck} title="Address verification documents">
          {config.address.requireAnyDocument && <p className="mb-3 text-xs font-medium text-slate-700">At least one enabled address document is required.</p>}
          {renderDocuments(documentsFor(CANDIDATE_ADDRESS_DOCUMENT_TYPES.map(({ type }) => type)), 'No address documents uploaded.')}
        </PortalCard>
      </div>
    ),
    education: (
      <div className="space-y-5">
        <PortalCard icon={GraduationCap} title="Qualification" description="Education details submitted by the candidate.">
          {(candidate.educationHistory?.length ?? 0) > 0 ? (
            <div className="space-y-4">
              {candidate.educationHistory?.map((record, index) => {
                const linkedDocuments = record.id ? documents.filter((document) => document.documentNumber === record.id) : [];
                return (
                  <div key={record.id ?? `${record.qualification}-${index}`} className="rounded-xl border border-slate-200 p-4">
                    <h3 className="mb-3 text-sm font-semibold">{record.qualification || `Qualification ${index + 1}`}</h3>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <ReadonlyField label="Qualification" value={record.qualification} />
                      <ReadonlyField label="Course or degree" value={record.courseName} />
                      <ReadonlyField label="Institution" value={record.institutionName} />
                      <ReadonlyField label="University or board" value={record.universityName} />
                      <ReadonlyField label="Year of passing" value={record.yearOfPassing} />
                      <ReadonlyField label="Grade or percentage" value={record.gradeOrPercentage} />
                    </div>
                    <div className="mt-4">{renderDocuments(linkedDocuments.length ? linkedDocuments : documentsFor(CANDIDATE_EDUCATION_DOCUMENT_TYPES.map(({ type }) => type)), 'No certificate uploaded for this qualification.')}</div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <ReadonlyField label="Highest qualification" value={candidate.highestQualification} />
              <ReadonlyField label="Course or degree" value={candidate.courseName} />
              <ReadonlyField label="Institution" value={candidate.institutionName} />
              <ReadonlyField label="University or board" value={candidate.universityName} />
              <ReadonlyField label="Year of passing" value={candidate.yearOfPassing} />
              <ReadonlyField label="Grade or percentage" value={candidate.gradeOrPercentage} />
            </div>
          )}
        </PortalCard>
        <PortalCard icon={FileCheck} title="Education documents">{renderDocuments(documentsFor(CANDIDATE_EDUCATION_DOCUMENT_TYPES.map(({ type }) => type)), 'No education documents uploaded.')}</PortalCard>
      </div>
    ),
    employment: (
      <div className="space-y-5">
        <PortalCard icon={BriefcaseBusiness} title="Employment history" description="Employment details submitted by the candidate.">
          {(candidate.employmentHistory?.filter((record) => config.currentEmploymentEnabled || !record.isCurrent).length ?? 0) > 0 ? (
            <div className="space-y-4">
              {candidate.employmentHistory?.filter((record) => config.currentEmploymentEnabled || !record.isCurrent).map((record, index) => (
                <div key={`${record.employerName}-${index}`} className="rounded-xl border border-slate-200 p-4">
                  <h3 className="mb-3 text-sm font-semibold">{record.isFresher ? 'Candidate marked as fresher' : record.employerName || `Employment ${index + 1}`}</h3>
                  {!record.isFresher && <div className="grid gap-4 sm:grid-cols-2">
                    <ReadonlyField label="Employer" value={record.employerName} />
                    <ReadonlyField label="Employee ID" value={record.employeeId} />
                    <ReadonlyField label="Designation" value={record.designation} />
                    <ReadonlyField label="Department" value={record.department} />
                    <ReadonlyField label="Employment type" value={record.employmentType} />
                    <ReadonlyField label="Joining date" value={record.startDate} />
                    <ReadonlyField label="End date" value={record.endDate} />
                    <ReadonlyField label="Work location" value={record.workLocation} />
                    <ReadonlyField label="Employer HR contact name" value={record.employerHrName} />
                    <ReadonlyField label="Employer HR contact number" value={record.employerHrPhone} />
                  </div>}
                  <div className="mt-4">{renderDocuments(record.id ? documents.filter((document) => document.documentNumber === record.id) : documentsFor(['SALARY_SLIP', 'EXPERIENCE_LETTER']), 'No documents uploaded for this employment record.')}</div>
                </div>
              ))}
            </div>
          ) : (
            config.currentEmploymentEnabled
              ? <div className="grid gap-4 sm:grid-cols-2">
                <ReadonlyField label="Current employer" value={candidate.currentEmployer} />
                <ReadonlyField label="Employee ID" value={candidate.employeeId} />
                <ReadonlyField label="Designation" value={candidate.employeeDesignation} />
                <ReadonlyField label="Department" value={candidate.employeeDepartment} />
                <ReadonlyField label="Employment type" value={candidate.employmentType} />
                <ReadonlyField label="Joining date" value={candidate.joiningDate} />
                <ReadonlyField label="Work location" value={candidate.workLocation} />
                <ReadonlyField label="Employer HR contact name" value={candidate.employerHrName} />
                <ReadonlyField label="Employer HR contact number" value={candidate.employerHrPhone} />
              </div>
              : <p className="text-sm text-slate-500">No past employment details submitted.</p>
          )}
        </PortalCard>
        <PortalCard icon={FileCheck} title="Employment documents">{renderDocuments(employmentDocumentsForPreview(CANDIDATE_EMPLOYMENT_DOCUMENT_TYPES.map(({ type }) => type)), 'No employment documents uploaded.')}</PortalCard>
      </div>
    ),
  };

  const overviewItems = [
    { key: 'details' as const, label: 'Your details', description: 'Personal and contact information', enabled: true },
    { key: 'family' as const, label: 'Family details', description: 'Parent, spouse and dependent information', enabled: config.sections.family.enabled },
    { key: 'identity' as const, label: 'ID numbers', description: 'Identity values and document copies', enabled: config.sections.identity.enabled },
    { key: 'address' as const, label: 'Address', description: 'Current and permanent address details', enabled: config.sections.address.enabled },
    { key: 'education' as const, label: 'Qualification', description: 'Education history and certificates', enabled: config.sections.education.enabled },
    { key: 'employment' as const, label: 'Employment', description: 'Current and past employment records', enabled: config.sections.employment.enabled },
  ].filter((item) => item.enabled);

  const fullName = formatCandidateName(candidate);
  const consent = [...(candidate.consents ?? [])].sort((a, b) => new Date(b.consentedAt ?? b.createdAt).getTime() - new Date(a.consentedAt ?? a.createdAt).getTime())[0];

  return (
    <main className="rounded-2xl bg-[#f5f7f6] p-3 text-slate-900 sm:p-5">
      <div className="mx-auto max-w-4xl space-y-5">
        <header className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="h-1.5" style={{ backgroundColor: accent }} />
          <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-5">
            <div className="flex min-w-0 items-center gap-4">
              <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 sm:h-16 sm:w-16">
                {logo ? <Image src={logo} alt={`${companyName} logo`} width={128} height={72} unoptimized className="h-full w-full object-contain p-1.5" /> : <span className="text-lg font-bold text-white" style={{ backgroundColor: accent }}>{companyName.slice(0, 2).toUpperCase()}</span>}
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Candidate verification portal</p>
                <p className="mt-1 truncate text-lg font-semibold text-slate-950 sm:text-xl">{companyName}</p>
                {clientName && <p className="mt-0.5 truncate text-sm text-slate-600">On behalf of {clientName}</p>}
              </div>
            </div>
            <span className="inline-flex w-fit shrink-0 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700">
              <Lock size={14} style={{ color: accent }} aria-hidden="true" />Company-only preview · Read only
            </span>
          </div>
        </header>

        <section className="px-1 sm:px-2">
          <p className="text-xs font-semibold uppercase tracking-[0.1em]" style={{ color: accent }}>Verification request</p>
          <h2 className="mt-1 text-2xl font-semibold leading-tight tracking-tight text-slate-950 sm:text-3xl">Candidate form for {fullName}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">This is the saved form data from the candidate portal. Company access remains available even when the candidate&apos;s portal link has expired.</p>
        </section>

        <nav className="sticky top-0 z-10 -mx-1 bg-[#f5f7f6]/95 px-1 py-2 backdrop-blur" aria-label="Candidate form sections">
          <div role="tablist" className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
            {visibleTabs.map(({ key, label, icon: Icon }) => {
              const selected = activeTab === key;
              return (
                <button key={key} type="button" role="tab" id={`candidate-preview-tab-${key}`} aria-selected={selected} aria-controls={`candidate-preview-panel-${key}`} onClick={() => setActiveTab(key)}
                  className={`flex shrink-0 items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-semibold transition ${selected ? 'text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
                  style={selected ? { backgroundColor: accent } : undefined}>
                  <Icon size={15} aria-hidden="true" /><span className="whitespace-nowrap">{label}</span>
                  {key !== 'overview' && <Check size={12} className={selected ? 'text-white' : 'text-emerald-600'} aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        </nav>

        <div role="tabpanel" id={`candidate-preview-panel-${activeTab}`} aria-labelledby={`candidate-preview-tab-${activeTab}`} className="space-y-5">
          {activeTab === 'overview' && (
            <>
              <section className="rounded-xl border border-slate-200 bg-white p-4">
                <h3 className="text-sm font-semibold text-slate-900">Questions or corrections?</h3>
                <p className="mt-1 text-sm leading-5 text-slate-600">This company preview is read only. The information shown below is saved from the candidate&apos;s portal submission.</p>
                <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-700">
                  {supportEmail && <span>{supportEmail}</span>}
                  {supportPhone && <span>{supportPhone}</span>}
                  {!supportEmail && !supportPhone && <span>Contact the candidate or your verification support team for corrections.</span>}
                </div>
              </section>
              <PortalCard icon={FileCheck} title="What to fill in" description={`Form sections and requirements configured${clientName ? ` for ${clientName}` : ' for this verification'}.`}>
                <ol className="space-y-3">
                  {overviewItems.map((item, index) => (
                    <li key={item.key} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h3 className="text-sm font-semibold">{index + 1}. {item.label}</h3>
                          <p className="mt-1 text-sm text-slate-600">{item.description}</p>
                        </div>
                        <button type="button" onClick={() => setActiveTab(item.key)} className="text-xs font-semibold hover:underline" style={{ color: accent }}>Open section</button>
                      </div>
                    </li>
                  ))}
                  {customForms.map((form) => (
                    <li key={form.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <h3 className="text-sm font-semibold">{form.name}{form.required && <span className="ml-1 text-red-600">*</span>}</h3>
                      <p className="mt-1 text-sm text-slate-600">Configured form · {form.category.replaceAll('_', ' ')}</p>
                    </li>
                  ))}
                </ol>
              </PortalCard>
              {candidate.intakeProgress?.pending?.length ? (
                <PortalCard icon={FileCheck} title="Information still required">
                  <ul className="list-inside list-disc space-y-1 text-sm text-slate-700">
                    {candidate.intakeProgress.pending.map((item) => <li key={item.key}>{item.label}</li>)}
                  </ul>
                </PortalCard>
              ) : null}
            </>
          )}

          {(['details', 'family', 'identity', 'address', 'education', 'employment'] as const).includes(activeTab as 'details' | 'family' | 'identity' | 'address' | 'education' | 'employment') && formSections[activeTab as keyof typeof formSections]}
          {activeTab === 'bgv' && <PortalCard icon={FileText} title="BGV forms">{renderCustomForms('BGV')}</PortalCard>}
          {activeTab === 'reference' && <><PortalCard icon={Users} title="Reference check">{renderCustomForms('REFERENCE')}</PortalCard>{renderSupportingDocuments('REFERENCE')}</>}
          {activeTab === 'court' && <><PortalCard icon={ShieldCheck} title="Court check">{renderCustomForms('COURT')}</PortalCard>{renderSupportingDocuments('COURT')}</>}
          {activeTab === 'cibil' && <><PortalCard icon={FileCheck} title="CIBIL forms">{renderCustomForms('CIBIL')}</PortalCard>{renderSupportingDocuments('CIBIL')}</>}
          {activeTab === 'world' && <><PortalCard icon={ShieldCheck} title="World check">{renderCustomForms('WORLD')}</PortalCard>{renderSupportingDocuments('WORLD')}</>}
          {activeTab === 'socialMedia' && <><PortalCard icon={FileText} title="Social media check">{renderCustomForms('SOCIAL_MEDIA')}</PortalCard>{renderSupportingDocuments('SOCIAL_MEDIA')}</>}
          {activeTab === 'police' && <PortalCard icon={ShieldCheck} title="Police verification">{renderCustomForms('POLICE_VERIFICATION')}</PortalCard>}
          {activeTab === 'other' && <><PortalCard icon={FileCheck} title="Other checks">{<div className="space-y-5">{renderCustomForms('OTHER_CHECKS')}{renderCustomForms('OTHER')}</div>}</PortalCard>{renderSupportingDocuments('OTHER_CHECKS')}</>}
          {activeTab === 'documents' && <PortalCard icon={FileCheck} title="Uploaded documents" description="Files saved from the candidate portal.">{renderDocuments(documents, 'The candidate has not uploaded documents yet.')}</PortalCard>}
          {activeTab === 'consent' && (
            <PortalCard icon={ShieldCheck} title="Review & submit" description="Consent status recorded for this candidate.">
              {consent ? (
                <dl className="grid gap-4 sm:grid-cols-2">
                  <div><dt className="text-xs font-medium text-slate-500">Consent status</dt><dd className="mt-1 text-sm font-medium">{consent.revokedAt ? 'Revoked' : consent.consentGiven ? 'Given' : 'Not given'}</dd></div>
                  <div><dt className="text-xs font-medium text-slate-500">Submitted</dt><dd className="mt-1 text-sm">{consent.consentedAt ? new Date(consent.consentedAt).toLocaleString('en-IN') : 'Not submitted'}</dd></div>
                  {consent.consentVersion && <div><dt className="text-xs font-medium text-slate-500">Consent version</dt><dd className="mt-1 text-sm">{consent.consentVersion}</dd></div>}
                </dl>
              ) : <p className="text-sm text-slate-600">No consent submission is recorded.</p>}
            </PortalCard>
          )}
        </div>
        <p className="px-1 pb-1 text-center text-xs text-slate-500">Read-only company preview · Candidate portal status does not affect this saved form.</p>
      </div>
    </main>
  );
}
