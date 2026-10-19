'use client';

import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import {
  AlertCircle,
  BriefcaseBusiness,
  Camera,
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileCheck,
  FileText,
  GraduationCap,
  Hash,
  LayoutDashboard,
  Loader2,
  Lock,
  MapPin,
  Paperclip,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
  Upload,
  UserRound,
  Users,
  XCircle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import api from '@/services/api';
import DateInput from '@/src/components/DateInput';
import CandidateDocumentUpload from '@/src/components/candidate-portal/CandidateDocumentUpload';
import CandidateFormTemplateUpload from '@/src/components/candidate-portal/CandidateFormTemplateUpload';
import { formatCandidateName, splitCandidateName } from '@/src/lib/candidate-name';
import { resolveLogoUrl } from '@/src/lib/logo';
import { CANDIDATE_ADDRESS_DOCUMENT_TYPES, CANDIDATE_EMPLOYMENT_DOCUMENT_TYPES, DEFAULT_CANDIDATE_FORM_CONFIG } from '@/src/types/client';
import type { CandidateCustomForm, CandidateFormConfig, CandidateIdentityFieldKey } from '@/src/types/client';

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */
type PortalDocument = {
  id: string;
  documentType: string;
  documentNumber?: string | null;
  fileName: string;
  fileUrl?: string;
  verificationStatus: string;
  uploadedAt: string;
};

type EmploymentRecord = {
  isCurrent: boolean;
  employerName: string | null;
  employeeId: string | null;
  designation: string | null;
  department: string | null;
  employmentType: string | null;
  startDate: string | null;
  endDate: string | null;
  workLocation: string | null;
};
type PastEmploymentForm = {
  employerName: string;
  employeeId: string;
  designation: string;
  department: string;
  employmentType: string;
  startDate: string;
  endDate: string;
  workLocation: string;
};

type PendingItem = { key: string; label: string; type: string; documentType?: string; customFormId?: string; category?: string };

type PortalData = {
  candidate: Record<string, unknown> & { status?: string; employmentHistory?: EmploymentRecord[] };
  company: { name: string; logoUrl?: string | null; primaryColor?: string | null };
  client?: { name: string } | null;
  candidateFormConfig?: CandidateFormConfig;
  case: { id: string; caseNumber: string; status: string; checks?: string[] } | null;
  documents: PortalDocument[];
  invitation: { expiresAt: string };
  progress: { pending: PendingItem[]; pendingCount: number; consentComplete: boolean; consentReady: boolean; formLocked: boolean; uploadsLocked: boolean; profileComplete: boolean };
};

type TabKey = 'overview' | 'details' | 'family' | 'identity' | 'address' | 'education' | 'employment' | 'policeVerification' | 'bgv' | 'otherChecks' | 'documents' | 'consent';
type SectionKey = 'details' | 'family' | 'identity' | 'education' | 'employment' | 'address';
type FormState = Record<string, string>;

type FieldDef = {
  key: string;
  label: string;
  type?: 'text' | 'email' | 'tel' | 'date';
  required?: boolean;
  multiline?: boolean;
  wide?: boolean;
  placeholder?: string;
  hint?: string;
  maxLength?: number;
  inputMode?: 'numeric' | 'text';
  suggestions?: string[];
  options?: string[];
  /** Applied while typing (for example upper-casing a PAN). */
  format?: (value: string) => string;
  /** Applied before validating and before sending to the API. */
  normalize?: (value: string) => string;
  /** Return an error message, or null when the value is fine. Runs on non-empty values only. */
  validate?: (value: string) => string | null;
};

/* ------------------------------------------------------------------ */
/* Validation helpers                                                  */
/* ------------------------------------------------------------------ */
const digitsOnly = (value: string) => value.replace(/\D/g, '');
const upperAlnum = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, '');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const todayISO = () => new Date().toISOString().slice(0, 10);
const splitFullName = splitCandidateName;

/* ------------------------------------------------------------------ */
/* Field configuration                                                 */
/* The keys must match what PATCH /candidate-portal/:token/profile    */
/* accepts. Rename them here if your backend uses different names.     */
/* ------------------------------------------------------------------ */
const DETAILS_FIELDS: FieldDef[] = [
  { key: 'fullName', label: 'Full name', required: true, wide: true, validate: (value) => (splitFullName(value) ? null : 'Enter your first and last name.') },
  { key: 'email', label: 'Email address', type: 'email', required: true, validate: (v) => (EMAIL_PATTERN.test(v) ? null : 'Enter a valid email address.') },
  { key: 'phone', label: 'Mobile number', type: 'tel', required: true, validate: (v) => (/^[+()\-\s\d]{7,18}$/.test(v) ? null : 'Enter a valid phone number.') },
  { key: 'dateOfBirth', label: 'Date of birth', type: 'date', required: true, validate: (v) => (v > todayISO() ? 'Date of birth cannot be in the future.' : null) },
  { key: 'gender', label: 'Gender', suggestions: ['Male', 'Female', 'Other', 'Prefer not to say'] },
];

const ADDRESS_FIELDS: FieldDef[] = [
  { key: 'currentAddress', label: 'Current address', multiline: true, wide: true },
  { key: 'permanentAddress', label: 'Permanent address', multiline: true, wide: true },
];

const FAMILY_FIELDS: FieldDef[] = [
  { key: 'fatherName', label: "Father's name", maxLength: 255 },
  { key: 'motherName', label: "Mother's name", maxLength: 255 },
];

const IDENTITY_FIELDS: FieldDef[] = [
  {
    key: 'aadhaarNumber', label: 'Aadhaar number', placeholder: '1234 5678 9012', hint: '12 digits', maxLength: 14, inputMode: 'numeric',
    format: (v) => digitsOnly(v).slice(0, 12).replace(/(\d{4})(?=\d)/g, '$1 '),
    normalize: digitsOnly,
    validate: (v) => (/^\d{12}$/.test(v) ? null : 'Enter a valid 12-digit Aadhaar number.'),
  },
  {
    key: 'panNumber', label: 'PAN', placeholder: 'ABCDE1234F', hint: '5 letters, 4 digits, 1 letter', maxLength: 10,
    format: (v) => upperAlnum(v).slice(0, 10),
    validate: (v) => (/^[A-Z]{5}\d{4}[A-Z]$/.test(v) ? null : 'Enter a valid PAN, for example ABCDE1234F.'),
  },
  {
    key: 'uanNumber', label: 'UAN (EPFO)', placeholder: '100123456789', hint: '12-digit Universal Account Number', maxLength: 12, inputMode: 'numeric',
    format: (v) => digitsOnly(v).slice(0, 12),
    validate: (v) => (/^\d{12}$/.test(v) ? null : 'UAN must be 12 digits.'),
  },
  {
    key: 'passportNumber', label: 'Passport number', placeholder: 'A1234567', maxLength: 8,
    format: (v) => upperAlnum(v).slice(0, 8),
    validate: (v) => (/^[A-PR-WY][1-9]\d{6}$/.test(v) ? null : 'Enter a valid passport number, for example A1234567.'),
  },
  {
    key: 'drivingLicenseNumber', label: 'Driving licence number', placeholder: 'MH12 20110012345', maxLength: 20,
    format: (v) => v.toUpperCase().replace(/[^A-Z0-9\s-]/g, ''),
    normalize: (v) => v.replace(/[\s-]/g, ''),
    validate: (v) => (/^[A-Z]{2}\d{2}\d{4,11}$/.test(v) ? null : 'Enter a valid driving licence number.'),
  },
  {
    key: 'voterIdNumber', label: 'Voter ID (EPIC) number', placeholder: 'ABC1234567', maxLength: 10,
    format: (v) => upperAlnum(v).slice(0, 10),
    validate: (v) => (/^[A-Z]{3}\d{7}$/.test(v) ? null : 'Enter a valid voter ID, for example ABC1234567.'),
  },
];

const EDUCATION_FIELDS: FieldDef[] = [
  { key: 'highestQualification', label: 'Highest qualification', suggestions: ['10th', '12th', 'Diploma', 'Graduate', 'Post graduate', 'Doctorate'] },
  { key: 'courseName', label: 'Course or degree', placeholder: 'For example B.Tech Computer Science' },
  { key: 'institutionName', label: 'College or school', wide: true },
  { key: 'universityName', label: 'University or board' },
  {
    key: 'yearOfPassing', label: 'Year of passing', placeholder: '2021', maxLength: 4, inputMode: 'numeric',
    format: (v) => digitsOnly(v).slice(0, 4),
    validate: (v) => {
      const year = Number(v);
      return /^\d{4}$/.test(v) && year >= 1950 && year <= new Date().getFullYear() + 1 ? null : 'Enter a valid 4-digit year.';
    },
  },
  { key: 'gradeOrPercentage', label: 'Percentage or CGPA', placeholder: 'For example 78% or 8.4 CGPA' },
];

const EMPLOYMENT_FIELDS: FieldDef[] = [
  { key: 'currentEmployer', label: 'Current employer', wide: true },
  { key: 'employeeId', label: 'Employee ID' },
  { key: 'employeeDesignation', label: 'Designation' },
  { key: 'employeeDepartment', label: 'Department' },
  { key: 'employmentType', label: 'Employment type', options: ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP', 'FREELANCE', 'CONSULTANT', 'OTHER'] },
  { key: 'joiningDate', label: 'Joining date', type: 'date' },
  { key: 'workLocation', label: 'Work location' },
];
const PAST_EMPLOYMENT_FIELDS: FieldDef[] = [
  { key: 'employerName', label: 'Employer name', wide: true },
  { key: 'employeeId', label: 'Employee ID' },
  { key: 'designation', label: 'Designation' },
  { key: 'department', label: 'Department' },
  { key: 'employmentType', label: 'Employment type', options: ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP', 'FREELANCE', 'CONSULTANT', 'OTHER'] },
  { key: 'startDate', label: 'Start date', type: 'date' },
  { key: 'endDate', label: 'End date', type: 'date' },
  { key: 'workLocation', label: 'Work location' },
];
const emptyPastEmployment = (): PastEmploymentForm => ({
  employerName: '', employeeId: '', designation: '', department: '', employmentType: '', startDate: '', endDate: '', workLocation: '',
});
const toPastEmploymentForms = (records: EmploymentRecord[] = []): PastEmploymentForm[] => {
  const pastRecords = records.filter((record) => !record.isCurrent).map((record) => ({
    employerName: record.employerName ?? '',
    employeeId: record.employeeId ?? '',
    designation: record.designation ?? '',
    department: record.department ?? '',
    employmentType: record.employmentType ?? '',
    startDate: record.startDate?.slice(0, 10) ?? '',
    endDate: record.endDate?.slice(0, 10) ?? '',
    workLocation: record.workLocation ?? '',
  }));
  return pastRecords.length ? pastRecords : [emptyPastEmployment()];
};

const SECTION_FIELDS: Record<SectionKey, FieldDef[]> = {
  details: DETAILS_FIELDS,
  family: FAMILY_FIELDS,
  identity: IDENTITY_FIELDS,
  education: EDUCATION_FIELDS,
  employment: EMPLOYMENT_FIELDS,
  address: ADDRESS_FIELDS,
};
const SECTION_LABEL: Record<SectionKey, string> = { details: 'Your details', family: 'Your family details', identity: 'Your ID numbers', education: 'Your education details', employment: 'Your employment details', address: 'Your address details' };
const SECTIONS = Object.keys(SECTION_FIELDS) as SectionKey[];
const ALL_FIELDS = SECTIONS.flatMap((section) => SECTION_FIELDS[section]);
const EDITABLE_KEYS = ALL_FIELDS.map((field) => field.key);
const FIELD_BY_KEY: Record<string, FieldDef> = Object.fromEntries(ALL_FIELDS.map((field) => [field.key, field]));
const SECTION_OF_KEY: Record<string, SectionKey> = Object.fromEntries(SECTIONS.flatMap((section) => SECTION_FIELDS[section].map((field) => [field.key, section])));
const DATE_KEYS = new Set(ALL_FIELDS.filter((field) => field.type === 'date').map((field) => field.key));

/* ------------------------------------------------------------------ */
/* Tabs and document configuration                                     */
/* ------------------------------------------------------------------ */
const TABS: { key: TabKey; label: string; icon: LucideIcon }[] = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'details', label: 'Details', icon: UserRound },
  { key: 'family', label: 'Family', icon: Users },
  { key: 'identity', label: 'ID numbers', icon: Hash },
  { key: 'address', label: 'Address', icon: MapPin },
  { key: 'bgv', label: 'BGV forms', icon: FileText },
  { key: 'education', label: 'Education', icon: GraduationCap },
  { key: 'employment', label: 'Employment', icon: BriefcaseBusiness },
  { key: 'policeVerification', label: 'Police verification', icon: ShieldCheck },
  { key: 'otherChecks', label: 'Other checks', icon: FileCheck },
  { key: 'documents', label: 'Documents', icon: FileCheck },
  { key: 'consent', label: 'Consent', icon: ShieldCheck },
];

const EDUCATION_TYPES = ['EDUCATION_CERTIFICATE'];
const EMPLOYMENT_TYPES: string[] = CANDIDATE_EMPLOYMENT_DOCUMENT_TYPES.map(({ type }) => type);
const ADDRESS_TYPES: string[] = CANDIDATE_ADDRESS_DOCUMENT_TYPES.map(({ type }) => type);

// Each ID pairs its number field with its document type, so the number and the copy live in one card.
const IDENTITY_ITEMS = [
  { title: 'Aadhaar card', docType: 'AADHAAR', fieldKey: 'aadhaarNumber' },
  { title: 'PAN card', docType: 'PAN', fieldKey: 'panNumber' },
  { title: 'UAN (EPFO)', docType: 'UAN', fieldKey: 'uanNumber' },
  { title: 'Passport', docType: 'PASSPORT', fieldKey: 'passportNumber' },
  { title: 'Driving licence', docType: 'DRIVING_LICENSE', fieldKey: 'drivingLicenseNumber' },
  { title: 'Voter ID', docType: 'VOTER_ID', fieldKey: 'voterIdNumber' },
];
const IDENTITY_TYPES = IDENTITY_ITEMS.map((item) => item.docType);
const FORM_CHECKS: Record<CandidateCustomForm['category'], string[]> = {
  BGV: [],
  IDENTITY: ['IDENTITY', 'IDENTITY_VERIFICATION', 'PAN', 'AADHAAR', 'UAN', 'PASSPORT', 'DRIVING_LICENSE', 'VOTER_ID', 'DOCUMENT', 'DOCUMENT_FORGERY'],
  EDUCATION: ['EDUCATION', 'EDUCATION_VERIFICATION'],
  EMPLOYMENT: ['EMPLOYMENT', 'EMPLOYMENT_VERIFICATION', 'UAN'],
  POLICE_VERIFICATION: ['POLICE', 'POLICE_VERIFICATION', 'POLICE_RECORD', 'COURT'],
  OTHER_CHECKS: [],
  OTHER: [],
};
const STANDARD_FORM_CHECKS = new Set(Object.values(FORM_CHECKS).flat());

const DOCUMENT_GROUPS = [
  { title: 'Other documents', description: 'Anything else the verification team asked for.', types: ['OTHER'] },
];

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = ['application/pdf', 'image/jpeg', 'image/png'];
const FILE_ORIGIN = (process.env.NEXT_PUBLIC_API ?? '').replace(/\/api\/v1\/?$/, '');
const consentTextFor = (companyName: string, clientName?: string) =>
  `I voluntarily authorize ${companyName}${clientName ? `, on behalf of ${clientName},` : ''} to collect and verify the information and documents I provide and to conduct the background verification checks requested for my application. I confirm that the information I have provided is accurate to the best of my knowledge. I understand that the verification results may be shared with ${clientName || companyName} and authorized personnel for this verification purpose. I have read and agree to this consent statement.`;

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */
const humanize = (value: string) => value.replaceAll('_', ' ').toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase());
const documentTypeLabel = (type: string) => CANDIDATE_EMPLOYMENT_DOCUMENT_TYPES.find((item) => item.type === type)?.label
  ?? CANDIDATE_ADDRESS_DOCUMENT_TYPES.find((item) => item.type === type)?.label
  ?? humanize(type);

const formatDate = (value?: string | null) => {
  if (!value) return '-';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '-' : parsed.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatSize = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

const safeColor = (value?: string | null) => {
  const match = typeof value === 'string' ? value.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i) : null;
  if (!match) return '#0d9488';
  const hex = match[1].length === 3 ? [...match[1]].map((digit) => digit + digit).join('') : match[1];
  return `#${hex}`;
};

const fileHref = (url?: string) => {
  if (!url) return null;
  return /^https?:\/\//i.test(url) ? url : `${FILE_ORIGIN}${url}`;
};

const requestMessage = (error: unknown, fallback: string): string => {
  if (typeof error === 'object' && error !== null) {
    const raw = (error as { response?: { data?: { message?: unknown } } }).response?.data?.message;
    if (typeof raw === 'string' && raw) return raw;
    if (Array.isArray(raw) && raw.length) return raw.filter((item) => typeof item === 'string').join(', ');
    if (typeof raw === 'object' && raw !== null && typeof (raw as { message?: unknown }).message === 'string') return (raw as { message: string }).message;
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
};

const toForm = (candidate: Record<string, unknown>): FormState =>
  Object.fromEntries(
    EDITABLE_KEYS.map((key) => {
      if (key === 'fullName') return [key, formatCandidateName({
        fullName: typeof candidate.fullName === 'string' ? candidate.fullName : null,
        firstName: typeof candidate.firstName === 'string' ? candidate.firstName : null,
        middleName: typeof candidate.middleName === 'string' ? candidate.middleName : null,
        lastName: typeof candidate.lastName === 'string' ? candidate.lastName : null,
      })];
      const value = candidate[key];
      if (typeof value !== 'string' || value === '') return [key, ''];
      const text = DATE_KEYS.has(key) ? String(value).slice(0, 10) : String(value);
      const field = FIELD_BY_KEY[key];
      return [key, field.format ? field.format(text) : text];
    }),
  );

const validateFields = (form: FormState, fields: FieldDef[]): Record<string, string> => {
  const errors: Record<string, string> = {};
  fields.forEach((field) => {
    const raw = (form[field.key] ?? '').trim();
    if (!raw) {
      if (field.required) errors[field.key] = `${field.label} is required.`;
      return;
    }
    const problem = field.validate?.(field.normalize ? field.normalize(raw) : raw);
    if (problem) errors[field.key] = problem;
  });
  return errors;
};

const tabForPending = (item: PendingItem): TabKey => {
  const text = `${item.type} ${item.key}`.toLowerCase();
  if (text.includes('consent')) return 'consent';
  if (item.category === 'POLICE_VERIFICATION') return 'policeVerification';
  if (item.category === 'BGV') return 'bgv';
  if (item.category === 'OTHER_CHECKS') return 'otherChecks';
  if (item.category === 'EDUCATION') return 'education';
  if (item.category === 'EMPLOYMENT') return 'employment';
  if (item.category === 'ADDRESS') return 'address';
  if (item.category === 'IDENTITY') return 'identity';
  if (item.customFormId) return 'documents';
  if (item.key.startsWith('field-')) return 'identity';
  if (item.documentType) {
    if (item.documentType === 'ADDRESS_PROOF' || item.documentType === 'GPS_ADDRESS_PHOTO') return 'address';
    if (IDENTITY_TYPES.includes(item.documentType)) return 'identity';
    if (EDUCATION_TYPES.includes(item.documentType)) return 'education';
    if (EMPLOYMENT_TYPES.includes(item.documentType)) return 'employment';
    return 'documents';
  }
  return 'details';
};

const statusStyle = (status: string): { label: string; className: string; icon: LucideIcon } => {
  const value = status.toUpperCase();
  if (/(VERIFIED|APPROVED|ACCEPTED|COMPLETED)/.test(value)) return { label: humanize(status), className: 'bg-emerald-50 text-emerald-700 ring-emerald-200', icon: CheckCircle2 };
  if (/(REJECT|FAIL|INVALID)/.test(value)) return { label: humanize(status), className: 'bg-red-50 text-red-700 ring-red-200', icon: XCircle };
  return { label: humanize(status), className: 'bg-amber-50 text-amber-700 ring-amber-200', icon: Clock };
};

/* ------------------------------------------------------------------ */
/* Presentational components                                           */
/* ------------------------------------------------------------------ */
function SectionCard({ icon: Icon, title, description, children }: { icon: LucideIcon; title: string; description?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="mb-5 flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg" style={{ backgroundColor: 'var(--accent-soft)', color: 'var(--accent)' }}>
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

function Field({ def, value, error, onChange, disabled = false }: { def: FieldDef; value: string; error?: string; onChange: (value: string) => void; disabled?: boolean }) {
  const id = `field-${def.key}`;
  const listId = def.suggestions ? `${id}-options` : undefined;
  const describedBy = [error ? `${id}-error` : null, def.hint ? `${id}-hint` : null].filter(Boolean).join(' ') || undefined;
  const classes = `w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[var(--accent)] focus:ring-2 focus:ring-[color:var(--accent-ring)] ${error ? 'border-red-300' : 'border-slate-200'}`;
  return (
    <div className={def.wide ? 'sm:col-span-2' : undefined}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-slate-700">
        {def.label}
        {def.required && <span className="text-red-500" aria-hidden="true"> *</span>}
      </label>
      {def.multiline ? (
        <textarea id={id} value={value} rows={3} disabled={disabled} aria-invalid={Boolean(error)} aria-describedby={describedBy} className={classes} onChange={(event) => onChange(event.target.value)} />
      ) : def.options ? (
        <select id={id} value={value} required={def.required} disabled={disabled} aria-invalid={Boolean(error)} aria-describedby={describedBy} className={classes} onChange={(event) => onChange(event.target.value)}>
          <option value="">Select {def.label.toLowerCase()}</option>
          {def.options.map((option) => <option key={option} value={option}>{humanize(option)}</option>)}
        </select>
      ) : def.type === 'date' ? (
        <DateInput
          value={value}
          onChange={onChange}
          className={classes}
          ariaLabel={def.label}
          max={def.key === 'dateOfBirth' ? todayISO() : undefined}
          required={def.required}
        />
      ) : (
        <input
          id={id}
          type={def.type ?? 'text'}
          value={value}
          list={listId}
          required={def.required}
          disabled={disabled}
          placeholder={def.placeholder}
          maxLength={def.maxLength}
          inputMode={def.inputMode}
          max={def.key === 'dateOfBirth' ? todayISO() : undefined}
          autoComplete="off"
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          className={classes}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
      {listId && <datalist id={listId}>{def.suggestions?.map((option) => <option key={option} value={option} />)}</datalist>}
      {def.hint && !error && <p id={`${id}-hint`} className="mt-1 text-xs text-slate-500">{def.hint}</p>}
      {error && <p id={`${id}-error`} className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

function FieldGrid({ fields, form, errors, onChange, disabled = false }: { fields: FieldDef[]; form: FormState; errors: Record<string, string>; onChange: (key: string, value: string) => void; disabled?: boolean }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {fields.map((def) => <Field key={def.key} def={def} value={form[def.key] ?? ''} error={errors[def.key]} disabled={disabled} onChange={(value) => onChange(def.key, value)} />)}
    </div>
  );
}

function SaveBar({ dirty, saving, label, onSave, bare = false, readOnly = false }: { dirty: boolean; saving: boolean; label: string; onSave: () => void; bare?: boolean; readOnly?: boolean }) {
  return (
    <div className={`flex flex-wrap items-center gap-3 ${bare ? '' : 'mt-6 border-t border-slate-100 pt-4'}`}>
      {readOnly
        ? <span className="text-xs text-slate-500">Details are locked after consent or case completion. Contact the company administrator if a correction is needed.</span>
        : <>
          <button type="button" onClick={onSave} disabled={!dirty || saving} className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50" style={{ backgroundColor: 'var(--accent)' }}>
            {saving ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Save size={15} aria-hidden="true" />}
            {label}
          </button>
          <span className="text-xs text-slate-500">{dirty ? 'You have unsaved changes.' : 'All changes saved.'}</span>
        </>}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const style = statusStyle(status);
  const Icon = style.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${style.className}`}>
      <Icon size={12} aria-hidden="true" />
      {style.label}
    </span>
  );
}

function DocumentList({ documents, emptyText, hideType = false }: { documents: PortalDocument[]; emptyText: string; hideType?: boolean }) {
  if (!documents.length) {
    return <p className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-sm text-slate-500">{emptyText}</p>;
  }
  return (
    <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
      {documents.map((document) => {
        const href = fileHref(document.fileUrl);
        const rejected = /(REJECT|FAIL|INVALID)/i.test(document.verificationStatus);
        return (
          <li key={document.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500"><FileText size={17} aria-hidden="true" /></span>
              <div className="min-w-0">
                {hideType ? (
                  <p className="truncate text-sm font-semibold text-slate-900">{document.fileName}</p>
                ) : (
                  <>
                    <p className="text-sm font-semibold text-slate-900">{humanize(document.documentType)}</p>
                    <p className="truncate text-sm text-slate-600">{document.fileName}</p>
                  </>
                )}
                <p className="mt-0.5 text-xs text-slate-500">{document.documentNumber ? `Number ${document.documentNumber}, ` : ''}uploaded {formatDate(document.uploadedAt)}</p>
                {rejected && <p className="mt-1 text-xs text-red-600">This document was not accepted. Upload a clearer copy.</p>}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-3 sm:flex-col sm:items-end sm:gap-1.5">
              <StatusBadge status={document.verificationStatus} />
              {href && (
                <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold hover:underline" style={{ color: 'var(--accent)' }}>
                  View file <ExternalLink size={12} aria-hidden="true" />
                </a>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/* ------------------------------------------------------------------ */
/* Multi-file attachment uploader                                      */
/* Pick several files at once, set each file's type, upload together.  */
/* ------------------------------------------------------------------ */
type QueuedFile = { id: string; file: File; documentType: string; status: 'queued' | 'uploading' | 'failed'; error?: string };

function AttachmentUploader({ token, title = '', description = '', types, variant = 'card', documentNumber = '', onUploaded, readOnly = false, documentCategory }: {
  token: string;
  title?: string;
  description?: string;
  types: string[];
  variant?: 'card' | 'inline';
  /** Sent with each file, so an ID copy carries the number typed beside it. */
  documentNumber?: string;
  onUploaded: (count: number) => void | Promise<void>;
  readOnly?: boolean;
  documentCategory?: 'EMPLOYMENT' | 'ADDRESS';
}) {
  const inputId = useId();
  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const [selectedDocumentType, setSelectedDocumentType] = useState(types[0] ?? '');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!types.includes(selectedDocumentType)) setSelectedDocumentType(types[0] ?? '');
  }, [selectedDocumentType, types]);

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const problems: string[] = [];
    const accepted: QueuedFile[] = [];
    Array.from(list).forEach((file) => {
      const duplicate = queue.some((item) => item.file.name === file.name && item.file.size === file.size) || accepted.some((item) => item.file.name === file.name && item.file.size === file.size);
      if (duplicate) problems.push(`${file.name} is already in the list`);
      else if (!ALLOWED_MIME.includes(file.type)) problems.push(`${file.name} is not a PDF, JPG or PNG`);
      else if (documentCategory === 'ADDRESS' && selectedDocumentType === 'GPS_ADDRESS_PHOTO' && !['image/jpeg', 'image/png'].includes(file.type)) problems.push(`${file.name} must be a JPG or PNG GPS address photo`);
      else if (file.size > MAX_FILE_BYTES) problems.push(`${file.name} is larger than ${MAX_FILE_BYTES / 1024 / 1024} MB`);
      else accepted.push({ id: `${file.name}-${file.size}-${file.lastModified}`, file, documentType: selectedDocumentType, status: 'queued' });
    });
    setQueue((previous) => [...previous, ...accepted]);
    setNotice(problems.join('. '));
  };

  const uploadAll = async () => {
    setBusy(true);
    setNotice('');
    let uploaded = 0;
    for (const item of queue) {
      setQueue((previous) => previous.map((entry) => (entry.id === item.id ? { ...entry, status: 'uploading', error: undefined } : entry)));
      try {
        const body = new FormData();
        body.append('file', item.file);
        body.append('documentType', item.documentType);
        body.append('documentNumber', documentNumber);
        if (documentCategory) body.append('documentCategory', documentCategory);
        await api.post(`/candidate-portal/${token}/documents`, body);
        uploaded += 1;
        setQueue((previous) => previous.filter((entry) => entry.id !== item.id));
      } catch (requestError: unknown) {
        setQueue((previous) => previous.map((entry) => (entry.id === item.id ? { ...entry, status: 'failed', error: requestMessage(requestError, 'Upload failed. Try again.') } : entry)));
      }
    }
    setBusy(false);
    if (uploaded > 0) await onUploaded(uploaded);
  };

  const body = (
    <>
      {types.length > 1 && (
        <label className="mb-3 block text-sm font-medium text-slate-700">
          Document type
          <select
            value={selectedDocumentType}
            onChange={(event) => setSelectedDocumentType(event.target.value)}
            disabled={busy}
            className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm"
          >
            {types.map((type) => (
              <option key={type} value={type}>
                {documentTypeLabel(type)}
              </option>
            ))}
          </select>
        </label>
      )}
      <label
        htmlFor={inputId}
        onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => { event.preventDefault(); setDragging(false); addFiles(event.dataTransfer.files); }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed px-4 ${variant === 'inline' ? 'py-4' : 'py-7'} text-center transition ${dragging ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'border-slate-300 bg-slate-50 hover:border-slate-400'}`}
      >
        <Upload size={20} className="text-slate-500" aria-hidden="true" />
        <span className="text-sm font-semibold text-slate-800">Choose files or drop them here</span>
        <span className="text-xs text-slate-500">You can add several at once. PDF, JPG or PNG, up to {MAX_FILE_BYTES / 1024 / 1024} MB each.</span>
        <input id={inputId} type="file" multiple accept="application/pdf,image/jpeg,image/png" className="sr-only" disabled={busy} onChange={(event) => { addFiles(event.target.files); event.target.value = ''; }} />
      </label>

      {notice && <p role="alert" className="mt-3 text-sm text-red-600">{notice}</p>}

      {queue.length > 0 && (
        <>
          <ul className="mt-4 divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
            {queue.map((item) => (
              <li key={item.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <FileText size={16} className="shrink-0 text-slate-400" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">{item.file.name}</p>
                    <p className={`text-xs ${item.status === 'failed' ? 'text-red-600' : 'text-slate-500'}`}>
                      {item.status === 'failed' ? item.error : item.status === 'uploading' ? 'Uploading...' : formatSize(item.file.size)}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {types.length > 1 && !documentCategory ? (
                    <select
                      aria-label={`Document type for ${item.file.name}`}
                      value={item.documentType}
                      disabled={busy}
                      onChange={(event) => setQueue((previous) => previous.map((entry) => (entry.id === item.id ? { ...entry, documentType: event.target.value } : entry)))}
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm"
                    >
                      {types.map((type) => <option key={type} value={type}>{humanize(type)}</option>)}
                    </select>
                  ) : variant === 'inline' ? null : (
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{documentTypeLabel(item.documentType)}</span>
                  )}
                  <button type="button" disabled={busy} onClick={() => setQueue((previous) => previous.filter((entry) => entry.id !== item.id))} className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-40" aria-label={`Remove ${item.file.name}`}>
                    <Trash2 size={15} aria-hidden="true" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <button type="button" onClick={uploadAll} disabled={busy} className="mt-4 inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50" style={{ backgroundColor: 'var(--accent)' }}>
            {busy ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Upload size={15} aria-hidden="true" />}
            Upload {queue.length} {queue.length === 1 ? 'file' : 'files'}
          </button>
        </>
      )}
    </>
  );

  const content = readOnly
    ? <p className="text-xs text-slate-500">Uploads are locked after the verification case is completed or cancelled.</p>
    : body;
  if (variant === 'inline') return content;
  return <SectionCard icon={Paperclip} title={title} description={description}>{content}</SectionCard>;
}

/* ------------------------------------------------------------------ */
/* One card per ID: number field + upload + uploaded files             */
/* ------------------------------------------------------------------ */
function IdentityCard({ title, field, value, error, documents, token, onChange, onUploaded, readOnly = false, uploadReadOnly = false }: {
  title: string;
  field: FieldDef;
  value: string;
  error?: string;
  documents: PortalDocument[];
  token: string;
  onChange: (value: string) => void;
  onUploaded: (count: number) => void | Promise<void>;
  readOnly?: boolean;
  uploadReadOnly?: boolean;
}) {
  const docType = IDENTITY_ITEMS.find((item) => item.fieldKey === field.key)?.docType ?? 'OTHER';
  const sorted = [...documents].sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
  const raw = value.trim();
  const normalized = field.normalize ? field.normalize(raw) : raw;
  const numberForFile = normalized && !field.validate?.(normalized) ? normalized : '';
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg" style={{ backgroundColor: 'var(--accent-soft)', color: 'var(--accent)' }}><Hash size={18} aria-hidden="true" /></span>
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        </div>
        {sorted[0] ? <StatusBadge status={sorted[0].verificationStatus} /> : <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">No file yet</span>}
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <Field def={field} value={value} error={error} disabled={readOnly} onChange={onChange} />
        <div>
          <p className="mb-1.5 text-sm font-medium text-slate-700">Copy of {title}</p>
          <AttachmentUploader variant="inline" token={token} types={[docType]} documentNumber={numberForFile} onUploaded={onUploaded} readOnly={uploadReadOnly} />
          {sorted.length > 0 && <div className="mt-3"><DocumentList documents={sorted} emptyText="" hideType /></div>}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */
export default function CandidatePortalPage() {
  const { token } = useParams<{ token: string }>();
  const [portal, setPortal] = useState<PortalData | null>(null);
  const [daysLeft, setDaysLeft] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>({});
  const [baseline, setBaseline] = useState<FormState>({});
  const [pastEmployments, setPastEmployments] = useState<PastEmploymentForm[]>([emptyPastEmployment()]);
  const [pastEmploymentBaseline, setPastEmploymentBaseline] = useState<PastEmploymentForm[]>([emptyPastEmployment()]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<TabKey>('overview');

  // syncForm is only true on the first load, so uploads and saves never wipe edits in other sections.
  const fetchPortal = useCallback(
    async (syncForm: boolean) => {
      const response = await api.get(`/candidate-portal/${token}`);
      const body = response.data as { success?: boolean; message?: unknown; data?: unknown } | undefined;
      if (body?.success === false) {
        throw new Error(typeof body.message === 'string' ? body.message : 'The candidate portal request failed.');
      }
      const payload = body?.data ?? body;
      const data = (payload && typeof payload === 'object' && 'data' in payload ? payload.data : payload) as PortalData | undefined;
      if (!data?.candidate || !data.company || !data.progress) {
        throw new Error(typeof body?.message === 'string' ? body.message : 'The candidate portal response was incomplete. Ask the company to resend the link.');
      }
      setPortal(data);
      setDaysLeft(Math.ceil((new Date(data.invitation.expiresAt).getTime() - Date.now()) / 86400000));
      if (syncForm) {
        const next = toForm(data.candidate);
        const nextPastEmployments = toPastEmploymentForms(data.candidate.employmentHistory);
        setForm(next);
        setBaseline(next);
        setPastEmployments(nextPastEmployments);
        setPastEmploymentBaseline(nextPastEmployments);
      }
    },
    [token],
  );

  const refreshPortal = useCallback(async () => {
    try {
      await fetchPortal(false);
    } catch {
      // Keep showing the current data if a background refresh fails.
    }
  }, [fetchPortal]);

  useEffect(() => {
    if (!token) return undefined;
    let active = true;
    (async () => {
      try {
        await fetchPortal(true);
      } catch (requestError: unknown) {
        if (active) setError(requestMessage(requestError, 'This portal link is no longer available.'));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [token, fetchPortal]);

  useEffect(() => {
    if (!message) return undefined;
    const timer = setTimeout(() => setMessage(''), 6000);
    return () => clearTimeout(timer);
  }, [message]);

  const accent = useMemo(() => safeColor(portal?.company.primaryColor), [portal]);
  const candidateFormConfig = portal?.candidateFormConfig ?? DEFAULT_CANDIDATE_FORM_CONFIG;
  const customForms = candidateFormConfig.customForms ?? [];
  const identityConfigFor = (key: string) => candidateFormConfig[key as CandidateIdentityFieldKey];
  const isCategoryRequested = (category: CandidateCustomForm['category']) => {
    const selectedChecks = portal?.case?.checks ?? [];
    if (category === 'OTHER_CHECKS') {
      return !portal?.case || selectedChecks.length === 0 || selectedChecks.some((check) => !STANDARD_FORM_CHECKS.has(check));
    }
    return !portal?.case || selectedChecks.length === 0 || FORM_CHECKS[category].length === 0
      || selectedChecks.some((check) => FORM_CHECKS[category].includes(check));
  };
  const customFormsFor = (category: CandidateCustomForm['category']) => customForms.filter((form) =>
    form.enabled && form.category === category
    && isCategoryRequested(category)
    && (category !== 'EDUCATION' || candidateFormConfig.sections.education.enabled)
    && (category !== 'EMPLOYMENT' || candidateFormConfig.sections.employment.enabled)
    && (category !== 'POLICE_VERIFICATION' || candidateFormConfig.sections.policeVerification.enabled)
    && (category !== 'IDENTITY' || IDENTITY_FIELDS.some((field) => identityConfigFor(field.key)?.enabled !== false)),
  );
  const visibleTabs = TABS.filter(({ key }) => {
    if (key === 'address') {
      const addressConfig = candidateFormConfig.address;
      const addressPending = portal?.progress.pending.some((item) => item.category === 'ADDRESS');
      return Boolean(addressPending || (candidateFormConfig.sections.address.enabled && (
        addressConfig.currentAddressEnabled
        || addressConfig.permanentAddressEnabled
        || addressConfig.documents.some((document) => document.enabled)
      )));
    }
    if (key === 'identity') {
      const identityIsRequired = IDENTITY_FIELDS.some((field) => {
        const fieldConfig = identityConfigFor(field.key);
        return fieldConfig?.enabled !== false && (fieldConfig?.required || fieldConfig?.documentRequired);
      });
      return (IDENTITY_FIELDS.some((field) => identityConfigFor(field.key)?.enabled !== false) || customFormsFor('IDENTITY').length > 0)
        && (isCategoryRequested('IDENTITY') || identityIsRequired);
    }
    if (key === 'family') return candidateFormConfig.sections.family.enabled;
    if (key === 'education') return candidateFormConfig.sections.education.enabled && isCategoryRequested('EDUCATION');
    if (key === 'employment') return candidateFormConfig.sections.employment.enabled && isCategoryRequested('EMPLOYMENT');
    if (key === 'policeVerification') return candidateFormConfig.sections.policeVerification.enabled
      && isCategoryRequested('POLICE_VERIFICATION')
      && customFormsFor('POLICE_VERIFICATION').length > 0;
    if (key === 'bgv') return customFormsFor('BGV').length > 0;
    if (key === 'otherChecks') return customFormsFor('OTHER_CHECKS').length > 0;
    return true;
  });
  const visibleTabKeys = visibleTabs.map(({ key }) => key).join('|');
  const currentTab = visibleTabKeys.split('|').includes(activeTab) ? activeTab : 'overview';
  const effectiveSectionFields = useMemo(() => ({
    ...SECTION_FIELDS,
    identity: SECTION_FIELDS.identity
      .filter((field) => candidateFormConfig[field.key as CandidateIdentityFieldKey]?.enabled !== false)
      .map((field) => ({
        ...field,
        required: candidateFormConfig[field.key as CandidateIdentityFieldKey]?.required ?? false,
      })),
    address: SECTION_FIELDS.address
      .filter((field) => candidateFormConfig.sections.address.enabled && (field.key === 'currentAddress'
        ? candidateFormConfig.address.currentAddressEnabled
        : candidateFormConfig.address.permanentAddressEnabled))
      .map((field) => ({
        ...field,
        required: field.key === 'currentAddress'
          ? candidateFormConfig.address.currentAddressRequired
          : candidateFormConfig.address.permanentAddressRequired,
      })),
  }), [candidateFormConfig]);

  const dirtyBySection = useMemo(() => {
    const result = {} as Record<SectionKey, boolean>;
    SECTIONS.forEach((section) => {
      result[section] = effectiveSectionFields[section].some((field) => (form[field.key] ?? '') !== (baseline[field.key] ?? ''));
    });
    result.employment = result.employment || JSON.stringify(pastEmployments) !== JSON.stringify(pastEmploymentBaseline);
    return result;
  }, [form, baseline, effectiveSectionFields, pastEmployments, pastEmploymentBaseline]);
  const anyDirty = SECTIONS.some((section) => dirtyBySection[section]);

  useEffect(() => {
    if (!anyDirty) return undefined;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [anyDirty]);

  const pendingByTab = useMemo(() => {
    const flags: Record<TabKey, boolean> = { overview: false, details: false, family: false, identity: false, address: false, education: false, employment: false, policeVerification: false, bgv: false, otherChecks: false, documents: false, consent: false };
    if (!portal) return flags;
    portal.progress.pending.forEach((item) => { flags[tabForPending(item)] = true; });
    if (!portal.progress.profileComplete) flags.details = true;
    if (portal.case && !portal.progress.consentComplete) flags.consent = true;
    return flags;
  }, [portal]);

  const educationDocuments = useMemo(() => (portal?.documents ?? []).filter((document) => EDUCATION_TYPES.includes(document.documentType)), [portal]);
  const employmentDocuments = useMemo(() => (portal?.documents ?? []).filter((document) => EMPLOYMENT_TYPES.includes(document.documentType)), [portal]);
  const addressDocuments = useMemo(() => (portal?.documents ?? []).filter((document) => ADDRESS_TYPES.includes(document.documentType)), [portal]);
  const addressUploadTypes = Array.from(new Set([
    ...candidateFormConfig.address.documents.filter((document) => document.enabled).map((document) => document.type),
    ...(portal?.progress.pending ?? [])
      .filter((item): item is PendingItem & { documentType: string } => item.category === 'ADDRESS' && Boolean(item.documentType))
      .map((item) => item.documentType),
  ]));
  const otherDocuments = useMemo(
    () => (portal?.documents ?? []).filter((document) => !IDENTITY_TYPES.includes(document.documentType) && !EDUCATION_TYPES.includes(document.documentType) && !EMPLOYMENT_TYPES.includes(document.documentType) && !ADDRESS_TYPES.includes(document.documentType)),
    [portal],
  );

  const run = async (action: () => Promise<void>) => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await action();
      await fetchPortal(false);
    } catch (requestError: unknown) {
      setError(requestMessage(requestError, 'Something went wrong. Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  const setField = (key: string, value: string) => {
    const field = FIELD_BY_KEY[key];
    setForm((previous) => ({ ...previous, [key]: field?.format ? field.format(value) : value }));
    setFieldErrors((previous) => {
      if (!previous[key]) return previous;
      const next = { ...previous };
      delete next[key];
      return next;
    });
  };

  // Each tab saves only its own fields, so one section can never block another.
  const saveSection = (section: SectionKey) => {
    const fields = effectiveSectionFields[section];
    const found = validateFields(form, fields);
    setFieldErrors((previous) => {
      const next = { ...previous };
      fields.forEach((field) => delete next[field.key]);
      return { ...next, ...found };
    });
    if (Object.keys(found).length) {
      setMessage('');
      setError('Please correct the highlighted fields.');
      setActiveTab(SECTION_OF_KEY[Object.keys(found)[0]]);
      return;
    }
    const payload: Record<string, unknown> = {};
    const saved: FormState = {};
    fields.forEach((field) => {
      const raw = (form[field.key] ?? '').trim();
      saved[field.key] = raw;
      if (field.key === 'fullName') {
        const name = splitFullName(raw);
        if (name) {
          payload.fullName = name.fullName;
          payload.firstName = name.firstName;
          payload.middleName = name.middleName || '';
          payload.lastName = name.lastName;
        }
        return;
      }
      const value = field.normalize ? field.normalize(raw) : raw;
      if (value === '' && DATE_KEYS.has(field.key)) return;
      payload[field.key] = value;
    });
    if (section === 'employment') {
      const currentEmployer = {
        isCurrent: true,
        employerName: form.currentEmployer?.trim() || null,
        employeeId: form.employeeId?.trim() || null,
        designation: form.employeeDesignation?.trim() || null,
        department: form.employeeDepartment?.trim() || null,
        employmentType: form.employmentType?.trim() || null,
        startDate: form.joiningDate?.trim() || null,
        endDate: null,
        workLocation: form.workLocation?.trim() || null,
      };
      const pastRecords = pastEmployments
        .filter((record) => Object.values(record).some((value) => value.trim()))
        .map((record) => ({ ...record, isCurrent: false }));
      payload.employmentHistory = [currentEmployer, ...pastRecords];
    }
    void run(async () => {
      await api.patch(`/candidate-portal/${token}/profile`, payload);
      setBaseline((previous) => ({ ...previous, ...saved }));
      setForm((previous) => ({ ...previous, ...saved }));
      if (section === 'employment') setPastEmploymentBaseline(pastEmployments);
      setMessage(`${SECTION_LABEL[section]} saved.`);
    });
  };

  const giveConsent = () =>
    run(async () => {
      await api.post(`/candidate-portal/${token}/consent`, {
        consentGiven: true,
        consentVersion: '1.1',
      });
      setConsent(false);
      setMessage('Your consent was recorded.');
    });

  const afterUpload = (count: number) => {
    setError('');
    setMessage(`${count} ${count === 1 ? 'file' : 'files'} uploaded for review.`);
    return refreshPortal();
  };

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 text-slate-600" aria-busy="true">
        <Loader2 className="animate-spin" aria-label="Loading" />
      </main>
    );
  }

  if (!portal) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 p-6">
        <div className="max-w-sm text-center">
          <AlertCircle className="mx-auto mb-4 text-red-500" aria-hidden="true" />
          <h1 className="text-xl font-semibold text-slate-900">This link is not available</h1>
          <p className="mt-2 text-sm text-slate-600">{error || 'Ask the company that invited you to send a new link.'}</p>
        </div>
      </main>
    );
  }

  const theme = { '--accent': accent, '--accent-soft': `${accent}1a`, '--accent-ring': `${accent}33` } as CSSProperties;
  const { progress } = portal;
  const nameParts = splitFullName(form.fullName || '');
  const firstName = nameParts?.firstName || (typeof portal.candidate.firstName === 'string' ? portal.candidate.firstName : 'there');
  const companyLogo = resolveLogoUrl(portal.company.logoUrl);
  const companyMonogram = portal.company.name.trim().split(/\s+/).slice(0, 2).map((word) => word[0]).join('').toUpperCase() || 'C';
  const requiredUploadItems = progress.pending.filter((item) => item.type === 'document' && !item.customFormId);
  const overviewForms = (['BGV', 'IDENTITY', 'EDUCATION', 'EMPLOYMENT', 'POLICE_VERIFICATION', 'OTHER_CHECKS', 'OTHER'] as CandidateCustomForm['category'][])
    .flatMap((category) => customFormsFor(category));
  const overviewInstructions: { tab: TabKey; title: string; description: string; details: string[] }[] = [
    {
      tab: 'details',
      title: 'Your details',
      description: 'Enter your personal information exactly as it appears on your official documents.',
      details: DETAILS_FIELDS.map((field) => `${field.label}${field.required ? ' (required)' : ''}`),
    },
  ];
  if (candidateFormConfig.sections.family.enabled) {
    overviewInstructions.push({
      tab: 'family',
      title: 'Family details',
      description: 'Provide parent details where available.',
      details: FAMILY_FIELDS.map((field) => field.label),
    });
  }
  if (visibleTabs.some(({ key }) => key === 'identity')) {
    const identityDetails = IDENTITY_ITEMS
      .filter((item) => identityConfigFor(item.fieldKey)?.enabled !== false)
      .map((item) => {
        const config = identityConfigFor(item.fieldKey);
        const field = FIELD_BY_KEY[item.fieldKey];
        const requirements = [
          config?.required ? 'number required' : 'number if available',
          config?.documentRequired ? 'document copy required' : null,
        ].filter(Boolean);
        return `${field.label} (${requirements.join('; ')})`;
      });
    overviewInstructions.push({
      tab: 'identity',
      title: 'Identity information',
      description: 'Enter the ID numbers enabled for your client. Upload copies marked as required.',
      details: identityDetails,
    });
  }
  if (visibleTabs.some(({ key }) => key === 'address')) {
    const addressDetails = [
      ...(candidateFormConfig.address.currentAddressEnabled
        ? [`Current address${candidateFormConfig.address.currentAddressRequired ? ' (required)' : ''}`]
        : []),
      ...(candidateFormConfig.address.permanentAddressEnabled
        ? [`Permanent address${candidateFormConfig.address.permanentAddressRequired ? ' (required)' : ''}`]
        : []),
      ...candidateFormConfig.address.documents.filter((document) => document.enabled).map((document) => {
        const label = CANDIDATE_ADDRESS_DOCUMENT_TYPES.find((item) => item.type === document.type)?.label ?? humanize(document.type);
        return `${label}${document.required ? ' (required)' : ' (optional)'}`;
      }),
    ];
    overviewInstructions.push({
      tab: 'address',
      title: 'Address verification',
      description: 'Provide the enabled address details and any address proof requested by your client.',
      details: addressDetails,
    });
  }
  if (visibleTabs.some(({ key }) => key === 'education')) {
    overviewInstructions.push({
      tab: 'education',
      title: 'Education history',
      description: 'Enter your education details and prepare supporting records or any client-provided education form.',
      details: [...effectiveSectionFields.education.map((field) => field.label), 'Education certificates or marksheets'],
    });
  }
  if (visibleTabs.some(({ key }) => key === 'employment')) {
    const enabledEmploymentDocuments = candidateFormConfig.employmentDocuments.filter((document) => document.enabled);
    overviewInstructions.push({
      tab: 'employment',
      title: 'Employment history',
      description: 'Enter your current employer first, then add past employers from most recent to oldest. You can enter up to 10 employers total.',
      details: [
        'Current employer and role details',
        'Past employer name, role and employment dates',
        ...enabledEmploymentDocuments.map((document) => {
          const label = CANDIDATE_EMPLOYMENT_DOCUMENT_TYPES.find((item) => item.type === document.type)?.label ?? humanize(document.type);
          return `${label}${document.required ? ' (required)' : ' (optional)'}`;
        }),
      ],
    });
  }
  if (portal.case) {
    overviewInstructions.push({
      tab: 'consent',
      title: 'Review and give consent',
      description: 'Review your information and give consent after completing the required details, documents and forms.',
      details: ['Consent is needed before the requested verification checks can begin.'],
    });
  }

  const profileReadOnly = portal.progress.formLocked;
  const uploadReadOnly = portal.progress.uploadsLocked;
  const sectionPanel = (section: SectionKey, icon: LucideIcon, title: string, description: string, saveLabel: string, extra?: ReactNode) => (
    <SectionCard icon={icon} title={title} description={description}>
      {extra}
      <FieldGrid fields={effectiveSectionFields[section]} form={form} errors={fieldErrors} disabled={profileReadOnly} onChange={setField} />
      <SaveBar dirty={dirtyBySection[section]} saving={saving} label={saveLabel} onSave={() => saveSection(section)} readOnly={profileReadOnly} />
    </SectionCard>
  );

  return (
    <main className="min-h-screen bg-[#f5f7f6] text-slate-900" style={theme}>
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-10">
        <header className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="h-1.5" style={{ backgroundColor: 'var(--accent)' }} />
          <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-5">
            <div className="flex min-w-0 items-center gap-4">
              <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 sm:h-16 sm:w-16">
                {companyLogo ? (
                  <Image src={companyLogo} alt={`${portal.company.name} logo`} width={128} height={72} unoptimized className="h-full w-full object-contain p-1.5" />
                ) : (
                  <span className="grid h-full w-full place-items-center text-lg font-bold tracking-wide text-white" style={{ backgroundColor: 'var(--accent)' }}>{companyMonogram}</span>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Candidate verification portal</p>
                <p className="mt-1 truncate text-lg font-semibold text-slate-950 sm:text-xl">{portal.company.name}</p>
                {portal.client?.name && <p className="mt-0.5 truncate text-sm text-slate-600">On behalf of {portal.client.name}</p>}
              </div>
            </div>
            <span className="inline-flex w-fit shrink-0 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700">
              <Lock size={14} style={{ color: 'var(--accent)' }} aria-hidden="true" />Private, secure link
            </span>
          </div>
        </header>

        <section className="mb-6 px-1 sm:px-2">
          <p className="text-xs font-semibold uppercase tracking-[0.1em]" style={{ color: 'var(--accent)' }}>Verification request</p>
          <h1 className="mt-1 text-2xl font-semibold leading-tight tracking-tight text-slate-950 sm:text-3xl">Hello {firstName}, let&apos;s complete your verification</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            {portal.client?.name ? `${portal.client.name} has asked ${portal.company.name} to verify your background.` : `${portal.company.name} needs a few details to verify your background.`}
          </p>
        </section>

        <div aria-live="polite">
          {(message || error) && (
            <div role={error ? 'alert' : 'status'} className={`mb-5 flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm ${error ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
              {error ? <AlertCircle size={16} aria-hidden="true" /> : <CheckCircle2 size={16} aria-hidden="true" />}
              {error || message}
            </div>
          )}
          {profileReadOnly && <p role="status" className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">Your profile details are locked after consent. You can continue uploading documents until the verification case is completed or cancelled.</p>}
        </div>

        <nav className="sticky top-0 z-10 -mx-1 mb-5 bg-[#f5f7f6]/95 px-1 py-2 backdrop-blur" aria-label="Portal sections">
          <div role="tablist" className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
            {visibleTabs.map(({ key, label, icon: Icon }) => {
              const selected = currentTab === key;
              const pending = pendingByTab[key];
              return (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  id={`tab-${key}`}
                  aria-selected={selected}
                  aria-controls={`panel-${key}`}
                  onClick={() => setActiveTab(key)}
                  className={`relative flex shrink-0 items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-semibold transition sm:flex-1 ${selected ? 'text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
                  style={selected ? { backgroundColor: 'var(--accent)' } : undefined}
                >
                  <Icon size={15} aria-hidden="true" />
                  <span className="whitespace-nowrap">{label}</span>
                  {key !== 'overview' && <span className="sr-only">{pending ? ', action needed' : ', complete'}</span>}
                  {key !== 'overview' && pending && !selected && <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden="true" />}
                  {key !== 'overview' && !pending && <Check size={12} className={selected ? 'text-white' : 'text-emerald-600'} aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        </nav>

        {currentTab === 'overview' && (
          <div role="tabpanel" id="panel-overview" aria-labelledby="tab-overview" className="space-y-5">
            <SectionCard icon={FileCheck} title="What to fill in" description={`Follow these instructions for the checks and form settings${portal.client?.name ? ` configured by ${portal.client.name}` : ' configured for your verification'}.`}>
              <ol className="space-y-3">
                {overviewInstructions.map((instruction, index) => (
                  <li key={instruction.tab} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-slate-900">{index + 1}. {instruction.title}</h3>
                        <p className="mt-1 text-sm leading-5 text-slate-600">{instruction.description}</p>
                      </div>
                      <button type="button" onClick={() => setActiveTab(instruction.tab)} className="shrink-0 text-xs font-semibold hover:underline" style={{ color: 'var(--accent)' }}>
                        Open section
                      </button>
                    </div>
                    {instruction.details.length > 0 && (
                      <ul className="mt-3 grid gap-1.5 text-xs text-slate-600 sm:grid-cols-2">
                        {instruction.details.map((detail) => (
                          <li key={detail} className="flex items-start gap-2">
                            <Check size={13} className="mt-0.5 shrink-0" style={{ color: 'var(--accent)' }} aria-hidden="true" />
                            <span>{detail}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ol>
            </SectionCard>

            <SectionCard icon={FileCheck} title="What you need to prepare" description="These requirements are based on the checks and forms selected for your client.">
              <div className="space-y-5">
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-slate-900">Documents to upload</h3>
                  {requiredUploadItems.length > 0 ? (
                    <ul className="space-y-2">
                      {requiredUploadItems.map((item) => (
                        <li key={item.key} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3">
                          <span className="flex items-center gap-2.5 text-sm text-slate-800">
                            <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" aria-hidden="true" />
                            {item.label}
                          </span>
                          <button type="button" onClick={() => setActiveTab(tabForPending(item))} className="text-xs font-semibold hover:underline" style={{ color: 'var(--accent)' }}>
                            Go to upload
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-sm text-emerald-800">
                      No required document uploads are outstanding.
                    </p>
                  )}
                </div>

                <div>
                  <h3 className="mb-2 text-sm font-semibold text-slate-900">Forms to download</h3>
                  {overviewForms.length > 0 ? (
                    <ul className="space-y-2">
                      {overviewForms.map((form) => (
                        <CandidateFormTemplateUpload
                          key={form.id}
                          token={token}
                          accent={accent}
                          form={form}
                          documents={portal.documents}
                          onUploaded={refreshPortal}
                          readOnly={profileReadOnly}
                          downloadOnly
                        />
                      ))}
                    </ul>
                  ) : (
                    <p className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-slate-600">
                      No additional forms are configured for your verification.
                    </p>
                  )}
                </div>
              </div>
            </SectionCard>

          </div>
        )}

        {currentTab === 'details' && (
          <div role="tabpanel" id="panel-details" aria-labelledby="tab-details">
            {sectionPanel('details', UserRound, 'Your details', 'Make sure these match your official documents.', 'Save details')}
          </div>
        )}

        {currentTab === 'family' && (
          <div role="tabpanel" id="panel-family" aria-labelledby="tab-family">
            {sectionPanel('family', Users, 'Family details', 'Add your parents’ names as they appear on your official documents.', 'Save family details')}
          </div>
        )}

        {currentTab === 'identity' && (
          <div role="tabpanel" id="panel-identity" aria-labelledby="tab-identity" className="space-y-4">
            <div className="px-1">
              <h2 className="text-lg font-semibold">ID numbers and documents</h2>
              <p className="mt-1 text-sm text-slate-600">Complete the identity fields required for this client and attach the requested document copies.</p>
              <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500"><Lock size={13} aria-hidden="true" />Sent over an encrypted connection and used only to verify you.</p>
            </div>
            {IDENTITY_ITEMS.filter((item) => identityConfigFor(item.fieldKey)?.enabled !== false).map((item) => (
              <IdentityCard
                key={item.docType}
                title={item.title}
                field={FIELD_BY_KEY[item.fieldKey]}
                value={form[item.fieldKey] ?? ''}
                error={fieldErrors[item.fieldKey]}
                documents={portal.documents.filter((document) => document.documentType === item.docType)}
                token={token}
                onChange={(value) => setField(item.fieldKey, value)}
                onUploaded={afterUpload}
                readOnly={profileReadOnly}
                uploadReadOnly={uploadReadOnly}
              />
            ))}
            {customFormsFor('IDENTITY').map((form) => (
              <CandidateFormTemplateUpload key={form.id} token={token} accent={accent} form={form} documents={portal.documents} onUploaded={refreshPortal} readOnly={uploadReadOnly} />
            ))}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <SaveBar bare dirty={dirtyBySection.identity} saving={saving} label="Save ID numbers" onSave={() => saveSection('identity')} readOnly={profileReadOnly} />
            </div>
          </div>
        )}

        {currentTab === 'address' && (
          <div role="tabpanel" id="panel-address" aria-labelledby="tab-address" className="space-y-5">
            {candidateFormConfig.sections.address.enabled && sectionPanel('address', MapPin, 'Current and permanent address', 'Enter the addresses where you currently live and where you are permanently registered.', 'Save addresses')}
            <SectionCard icon={Camera} title="Address verification documents" description="Upload an accepted address proof such as Aadhaar, and a clear GPS-enabled photo of your current address when requested.">
              <div className="mb-4 flex flex-wrap gap-2">
                {candidateFormConfig.address.documents.filter((document) => document.enabled).map((document) => {
                  const label = CANDIDATE_ADDRESS_DOCUMENT_TYPES.find((item) => item.type === document.type)?.label ?? humanize(document.type);
                  return <span key={document.type} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700">{label}{document.required ? ' · required' : ''}</span>;
                })}
              </div>
              {addressUploadTypes.length > 0 ? (
                <AttachmentUploader
                  token={token}
                  title="Upload address documents"
                  description="Choose the requested document type before adding your PDF or image."
                  types={addressUploadTypes}
                  documentCategory="ADDRESS"
                  onUploaded={afterUpload}
                  readOnly={uploadReadOnly}
                />
              ) : <p className="text-sm text-slate-500">This client has not requested address verification documents.</p>}
              <div className="mt-4">
                <h3 className="mb-2 text-sm font-semibold text-slate-900">Uploaded address documents ({addressDocuments.length})</h3>
                <DocumentList documents={addressDocuments} emptyText="No address documents uploaded yet." />
              </div>
            </SectionCard>
          </div>
        )}

        {currentTab === 'education' && (
          <div role="tabpanel" id="panel-education" aria-labelledby="tab-education" className="space-y-5">
            {sectionPanel('education', GraduationCap, 'Education details', 'Tell us about your highest completed qualification.', 'Save education details')}
            <AttachmentUploader token={token} title="Education documents" description="Attach degree certificates, marksheets and other education records. Add as many files as you need." types={EDUCATION_TYPES} onUploaded={afterUpload} readOnly={uploadReadOnly} />
            {customFormsFor('EDUCATION').map((form) => (
              <CandidateFormTemplateUpload key={form.id} token={token} accent={accent} form={form} documents={portal.documents} onUploaded={refreshPortal} readOnly={uploadReadOnly} />
            ))}
            <div className="px-1">
              <h3 className="mb-2 text-sm font-semibold text-slate-900">Uploaded education documents ({educationDocuments.length})</h3>
              <DocumentList documents={educationDocuments} emptyText="No education documents uploaded yet." />
            </div>
          </div>
        )}

        {currentTab === 'employment' && (
          <div role="tabpanel" id="panel-employment" aria-labelledby="tab-employment" className="space-y-5">
            {sectionPanel('employment', BriefcaseBusiness, 'Current employer', 'Add your current employer and role details.', 'Save employment details')}
            {candidateFormConfig.sections.employment.enabled && (
              <SectionCard icon={BriefcaseBusiness} title="Past employers" description="Add your previous employment, starting with your most recent past employer. You can include up to 9 past employers.">
                <div className="space-y-4">
                  {pastEmployments.map((employment, index) => (
                    <div key={`past-employer-${index}`} className="rounded-xl border border-slate-200 p-4">
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <h3 className="text-sm font-semibold text-slate-900">Past employer {index + 1}</h3>
                        {pastEmployments.length > 1 && (
                          <button type="button" onClick={() => setPastEmployments((previous) => previous.filter((_, itemIndex) => itemIndex !== index))} disabled={profileReadOnly} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50">
                            <Trash2 size={14} aria-hidden="true" /> Remove
                          </button>
                        )}
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        {PAST_EMPLOYMENT_FIELDS.map((field) => (
                          <Field
                            key={`${index}-${field.key}`}
                            def={{ ...field, key: `past-${index}-${field.key}` }}
                            value={employment[field.key as keyof PastEmploymentForm]}
                            disabled={profileReadOnly}
                            onChange={(value) => setPastEmployments((previous) => previous.map((item, itemIndex) => (
                              itemIndex === index ? { ...item, [field.key]: value } : item
                            )))}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                  {1 + pastEmployments.length < 10 && (
                    <button type="button" onClick={() => setPastEmployments((previous) => [...previous, emptyPastEmployment()])} disabled={profileReadOnly} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                      <Plus size={16} aria-hidden="true" /> Add more
                    </button>
                  )}
                  <p className="text-xs text-slate-500">{1 + pastEmployments.length} of 10 employer records shown, including your current employer.</p>
                </div>
              </SectionCard>
            )}
            {candidateFormConfig.sections.employment.enabled && candidateFormConfig.employmentDocuments.some((item) => item.enabled) ? (
              <AttachmentUploader token={token} title="Employment documents" description="Select the document type first, then attach the matching file. You can upload multiple files for the selected type." types={candidateFormConfig.employmentDocuments.filter((item) => item.enabled).map((item) => item.type)} documentCategory="EMPLOYMENT" onUploaded={afterUpload} readOnly={uploadReadOnly} />
            ) : (
              <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">This client has not requested employment document uploads.</p>
            )}
            {customFormsFor('EMPLOYMENT').map((form) => (
              <CandidateFormTemplateUpload key={form.id} token={token} accent={accent} form={form} documents={portal.documents} onUploaded={refreshPortal} readOnly={uploadReadOnly} />
            ))}
            <div className="px-1">
              <h3 className="mb-2 text-sm font-semibold text-slate-900">Uploaded employment documents ({employmentDocuments.length})</h3>
              <DocumentList documents={employmentDocuments} emptyText="No employment documents uploaded yet." />
            </div>
          </div>
        )}

        {currentTab === 'policeVerification' && (
          <div role="tabpanel" id="panel-policeVerification" aria-labelledby="tab-policeVerification" className="space-y-4">
            <div className="px-1">
              <h2 className="text-lg font-semibold">Police verification forms</h2>
              <p className="mt-1 text-sm text-slate-600">Download each client-provided form, complete it and upload the completed copy.</p>
            </div>
            {customFormsFor('POLICE_VERIFICATION').map((form) => (
              <CandidateFormTemplateUpload key={form.id} token={token} accent={accent} form={form} documents={portal.documents} onUploaded={refreshPortal} readOnly={uploadReadOnly} />
            ))}
            {customFormsFor('POLICE_VERIFICATION').length === 0 && <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">No police verification form is currently requested.</p>}
          </div>
        )}

        {currentTab === 'bgv' && (
          <div role="tabpanel" id="panel-bgv" aria-labelledby="tab-bgv" className="space-y-4">
            <div className="px-1">
              <h2 className="text-lg font-semibold">BGV forms</h2>
              <p className="mt-1 text-sm text-slate-600">Download each form provided by the client, complete it and upload the completed copy.</p>
            </div>
            {customFormsFor('BGV').map((form) => (
              <CandidateFormTemplateUpload key={form.id} token={token} accent={accent} form={form} documents={portal.documents} onUploaded={refreshPortal} readOnly={uploadReadOnly} />
            ))}
          </div>
        )}

        {currentTab === 'otherChecks' && (
          <div role="tabpanel" id="panel-otherChecks" aria-labelledby="tab-otherChecks" className="space-y-4">
            <div className="px-1">
              <h2 className="text-lg font-semibold">Other check forms</h2>
              <p className="mt-1 text-sm text-slate-600">Forms configured for additional checks in this verification case.</p>
            </div>
            {customFormsFor('OTHER_CHECKS').map((form) => (
              <CandidateFormTemplateUpload key={form.id} token={token} accent={accent} form={form} documents={portal.documents} onUploaded={refreshPortal} readOnly={uploadReadOnly} />
            ))}
          </div>
        )}

        {currentTab === 'documents' && (
          <div role="tabpanel" id="panel-documents" aria-labelledby="tab-documents" className="space-y-4">
            <div className="px-1">
              <h2 className="text-lg font-semibold">Other documents</h2>
              <p className="mt-1 text-sm text-slate-600">ID copies are on the ID numbers tab, and education and employment files are on their own tabs. Use PDF, JPG or PNG files where every corner and number is readable.</p>
            </div>
            {DOCUMENT_GROUPS.map((group) => (
              <CandidateDocumentUpload key={group.title} token={token} accent={accent} title={group.title} description={group.description} types={group.types} onUploaded={refreshPortal} readOnly={uploadReadOnly} />
            ))}
            {customFormsFor('OTHER').map((form) => (
              <CandidateFormTemplateUpload key={form.id} token={token} accent={accent} form={form} documents={portal.documents} onUploaded={refreshPortal} readOnly={uploadReadOnly} />
            ))}
            <div className="px-1 pt-2">
              <h3 className="mb-2 text-sm font-semibold text-slate-900">Uploaded documents ({otherDocuments.length})</h3>
              <DocumentList documents={otherDocuments} emptyText="Nothing uploaded yet. Documents you add above will appear here." />
            </div>
          </div>
        )}

        {currentTab === 'consent' && (
          <div role="tabpanel" id="panel-consent" aria-labelledby="tab-consent">
            {progress.consentComplete ? (
              <section className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-600" size={20} aria-hidden="true" />
                <div>
                  <h2 className="font-semibold text-emerald-900">Consent recorded</h2>
                  <p className="mt-1 text-sm text-emerald-800">You have authorised the background verification checks. You can continue uploading any outstanding documents; profile details can no longer be edited.</p>
                </div>
              </section>
            ) : !progress.consentReady ? (
              <SectionCard icon={ShieldCheck} title="Consent" description="Consent is unavailable for a finalized verification case.">
                <p className="text-sm text-slate-600">This verification case is completed or cancelled. Contact {portal.company.name} if you need help.</p>
              </SectionCard>
            ) : (
              <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:p-6">
                <div className="mb-3 flex items-center gap-2">
                  <ShieldCheck size={18} className="text-amber-700" aria-hidden="true" />
                  <h2 className="font-semibold text-amber-950">Background verification consent</h2>
                </div>
                <p className="text-sm leading-6 text-amber-900">{consentTextFor(portal.company.name, portal.client?.name)}</p>
                {!portal.case && <p className="mt-2 text-sm text-amber-900">You can submit consent now. It will be linked to your verification case when one is created.</p>}
                <label className="mt-4 flex cursor-pointer items-start gap-2.5 rounded-lg border border-amber-300 bg-white/70 p-3 text-sm text-amber-950">
                  <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-amber-700" />
                  <span>I have read and understood the statement above. I voluntarily agree to the background verification and authorize the use of my information for this purpose.</span>
                </label>
                <button type="button" onClick={giveConsent} disabled={!consent || saving} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-amber-700 px-4 py-2.5 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50">
                  {saving && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
                  Submit consent
                </button>
              </section>
            )}
          </div>
        )}

        <footer className="mt-8 space-y-1 text-center text-xs text-slate-500">
          <p>Your information is sent over an encrypted connection and used only for this verification.</p>
          <p className={daysLeft !== null && daysLeft <= 3 ? 'font-medium text-amber-700' : undefined}>
            This link expires on {formatDate(portal.invitation.expiresAt)}
            {daysLeft !== null && daysLeft > 0 && daysLeft <= 3 ? ` (${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left)` : ''}.
          </p>
        </footer>
      </div>
    </main>
  );
}