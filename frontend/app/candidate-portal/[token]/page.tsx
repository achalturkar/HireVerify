'use client';

import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import {
  AlertCircle,
  BriefcaseBusiness,
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
  Paperclip,
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
import CandidateDocumentUpload from '@/src/components/candidate-portal/CandidateDocumentUpload';
import { resolveLogoUrl } from '@/src/lib/logo';

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

type PendingItem = { key: string; label: string; type: string; documentType?: string };

type PortalData = {
  candidate: Record<string, string | null>;
  company: { name: string; logoUrl?: string | null; primaryColor?: string | null };
  client?: { name: string } | null;
  case: { id: string; caseNumber: string; status: string } | null;
  documents: PortalDocument[];
  invitation: { expiresAt: string };
  progress: { pending: PendingItem[]; pendingCount: number; consentComplete: boolean; profileComplete: boolean };
};

type TabKey = 'overview' | 'details' | 'family' | 'identity' | 'education' | 'employment' | 'documents' | 'consent';
type SectionKey = 'details' | 'family' | 'identity' | 'education' | 'employment';
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

/* ------------------------------------------------------------------ */
/* Field configuration                                                 */
/* The keys must match what PATCH /candidate-portal/:token/profile    */
/* accepts. Rename them here if your backend uses different names.     */
/* ------------------------------------------------------------------ */
const DETAILS_FIELDS: FieldDef[] = [
  { key: 'firstName', label: 'First name', required: true },
  { key: 'lastName', label: 'Last name', required: true },
  { key: 'email', label: 'Email address', type: 'email', required: true, validate: (v) => (EMAIL_PATTERN.test(v) ? null : 'Enter a valid email address.') },
  { key: 'phone', label: 'Mobile number', type: 'tel', validate: (v) => (/^[+()\-\s\d]{7,18}$/.test(v) ? null : 'Enter a valid phone number.') },
  { key: 'dateOfBirth', label: 'Date of birth', type: 'date', validate: (v) => (v > todayISO() ? 'Date of birth cannot be in the future.' : null) },
  { key: 'gender', label: 'Gender', suggestions: ['Male', 'Female', 'Other', 'Prefer not to say'] },
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

const SECTION_FIELDS: Record<SectionKey, FieldDef[]> = {
  details: DETAILS_FIELDS,
  family: FAMILY_FIELDS,
  identity: IDENTITY_FIELDS,
  education: EDUCATION_FIELDS,
  employment: EMPLOYMENT_FIELDS,
};
const SECTION_LABEL: Record<SectionKey, string> = { details: 'Your details', family: 'Your family details', identity: 'Your ID numbers', education: 'Your education details', employment: 'Your employment details' };
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
  { key: 'education', label: 'Education', icon: GraduationCap },
  { key: 'employment', label: 'Employment', icon: BriefcaseBusiness },
  { key: 'documents', label: 'Documents', icon: FileCheck },
  { key: 'consent', label: 'Consent', icon: ShieldCheck },
];

const EDUCATION_TYPES = ['EDUCATION_CERTIFICATE'];
const EMPLOYMENT_TYPES = ['SALARY_SLIP', 'FORM_16', 'EXPERIENCE_LETTER', 'RELIEVING_LETTER', 'OFFER_LETTER', 'APPOINTMENT_LETTER', 'INCREMENT_LETTER', 'PROMOTION_LETTER', 'BANK_STATEMENT', 'PF_STATEMENT', 'EMPLOYMENT_CONTRACT', 'OTHER'];

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

const DOCUMENT_GROUPS = [
  { title: 'Address proof', description: 'A document that confirms your current or permanent address.', types: ['ADDRESS_PROOF'] },
  { title: 'Other documents', description: 'Anything else the verification team asked for.', types: ['OTHER'] },
];

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = ['application/pdf', 'image/jpeg', 'image/png'];
const FILE_ORIGIN = (process.env.NEXT_PUBLIC_API ?? '').replace(/\/api\/v1\/?$/, '');
const CONSENT_TEXT =
  'I consent to the background verification checks requested for my application and understand that the information I provide will be used for that purpose.';

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */
const humanize = (value: string) => value.replaceAll('_', ' ').toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase());

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

const toForm = (candidate: Record<string, string | null>): FormState =>
  Object.fromEntries(
    EDITABLE_KEYS.map((key) => {
      const value = candidate[key];
      if (value === null || value === undefined || value === '') return [key, ''];
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
  if (item.documentType) {
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

function Field({ def, value, error, onChange }: { def: FieldDef; value: string; error?: string; onChange: (value: string) => void }) {
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
        <textarea id={id} value={value} rows={3} aria-invalid={Boolean(error)} aria-describedby={describedBy} className={classes} onChange={(event) => onChange(event.target.value)} />
      ) : def.options ? (
        <select id={id} value={value} required={def.required} aria-invalid={Boolean(error)} aria-describedby={describedBy} className={classes} onChange={(event) => onChange(event.target.value)}>
          <option value="">Select {def.label.toLowerCase()}</option>
          {def.options.map((option) => <option key={option} value={option}>{humanize(option)}</option>)}
        </select>
      ) : (
        <input
          id={id}
          type={def.type ?? 'text'}
          value={value}
          list={listId}
          required={def.required}
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

function FieldGrid({ fields, form, errors, onChange }: { fields: FieldDef[]; form: FormState; errors: Record<string, string>; onChange: (key: string, value: string) => void }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {fields.map((def) => <Field key={def.key} def={def} value={form[def.key] ?? ''} error={errors[def.key]} onChange={(value) => onChange(def.key, value)} />)}
    </div>
  );
}

function SaveBar({ dirty, saving, label, onSave, bare = false }: { dirty: boolean; saving: boolean; label: string; onSave: () => void; bare?: boolean }) {
  return (
    <div className={`flex flex-wrap items-center gap-3 ${bare ? '' : 'mt-6 border-t border-slate-100 pt-4'}`}>
      <button type="button" onClick={onSave} disabled={!dirty || saving} className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50" style={{ backgroundColor: 'var(--accent)' }}>
        {saving ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Save size={15} aria-hidden="true" />}
        {label}
      </button>
      <span className="text-xs text-slate-500">{dirty ? 'You have unsaved changes.' : 'All changes saved.'}</span>
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

function ProgressRing({ percent }: { percent: number }) {
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  return (
    <div className="relative h-16 w-16 shrink-0" role="img" aria-label={`${percent}% complete`}>
      <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90">
        <circle cx="32" cy="32" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="6" />
        <circle cx="32" cy="32" r={radius} fill="none" stroke="var(--accent)" strokeWidth="6" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - percent / 100)} />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-sm font-semibold text-slate-900">{percent}%</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Multi-file attachment uploader                                      */
/* Pick several files at once, set each file's type, upload together.  */
/* ------------------------------------------------------------------ */
type QueuedFile = { id: string; file: File; documentType: string; status: 'queued' | 'uploading' | 'failed'; error?: string };

function AttachmentUploader({ token, title = '', description = '', types, variant = 'card', documentNumber = '', onUploaded }: {
  token: string;
  title?: string;
  description?: string;
  types: string[];
  variant?: 'card' | 'inline';
  /** Sent with each file, so an ID copy carries the number typed beside it. */
  documentNumber?: string;
  onUploaded: (count: number) => void | Promise<void>;
}) {
  const inputId = useId();
  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [dragging, setDragging] = useState(false);

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const problems: string[] = [];
    const accepted: QueuedFile[] = [];
    Array.from(list).forEach((file) => {
      const duplicate = queue.some((item) => item.file.name === file.name && item.file.size === file.size) || accepted.some((item) => item.file.name === file.name && item.file.size === file.size);
      if (duplicate) problems.push(`${file.name} is already in the list`);
      else if (!ALLOWED_MIME.includes(file.type)) problems.push(`${file.name} is not a PDF, JPG or PNG`);
      else if (file.size > MAX_FILE_BYTES) problems.push(`${file.name} is larger than ${MAX_FILE_BYTES / 1024 / 1024} MB`);
      else accepted.push({ id: `${file.name}-${file.size}-${file.lastModified}`, file, documentType: types[0], status: 'queued' });
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
                  {types.length > 1 ? (
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
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{humanize(item.documentType)}</span>
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

  if (variant === 'inline') return body;
  return <SectionCard icon={Paperclip} title={title} description={description}>{body}</SectionCard>;
}

/* ------------------------------------------------------------------ */
/* One card per ID: number field + upload + uploaded files             */
/* ------------------------------------------------------------------ */
function IdentityCard({ title, field, value, error, documents, token, onChange, onUploaded }: {
  title: string;
  field: FieldDef;
  value: string;
  error?: string;
  documents: PortalDocument[];
  token: string;
  onChange: (value: string) => void;
  onUploaded: (count: number) => void | Promise<void>;
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
        <Field def={field} value={value} error={error} onChange={onChange} />
        <div>
          <p className="mb-1.5 text-sm font-medium text-slate-700">Copy of {title}</p>
          <AttachmentUploader variant="inline" token={token} types={[docType]} documentNumber={numberForFile} onUploaded={onUploaded} />
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
  const [form, setForm] = useState<FormState>({});
  const [baseline, setBaseline] = useState<FormState>({});
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
      if (syncForm) {
        const next = toForm(data.candidate);
        setForm(next);
        setBaseline(next);
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

  const dirtyBySection = useMemo(() => {
    const result = {} as Record<SectionKey, boolean>;
    SECTIONS.forEach((section) => {
      result[section] = SECTION_FIELDS[section].some((field) => (form[field.key] ?? '') !== (baseline[field.key] ?? ''));
    });
    return result;
  }, [form, baseline]);
  const anyDirty = SECTIONS.some((section) => dirtyBySection[section]);

  useEffect(() => {
    if (!anyDirty) return undefined;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [anyDirty]);

  const pendingByTab = useMemo(() => {
    const flags: Record<TabKey, boolean> = { overview: false, details: false, family: false, identity: false, education: false, employment: false, documents: false, consent: false };
    if (!portal) return flags;
    portal.progress.pending.forEach((item) => { flags[tabForPending(item)] = true; });
    if (!portal.progress.profileComplete) flags.details = true;
    if (!baseline.panNumber || !baseline.aadhaarNumber) flags.identity = true;
    if (portal.case && !portal.progress.consentComplete) flags.consent = true;
    return flags;
  }, [portal, baseline]);

  const educationDocuments = useMemo(() => (portal?.documents ?? []).filter((document) => EDUCATION_TYPES.includes(document.documentType)), [portal]);
  const employmentDocuments = useMemo(() => (portal?.documents ?? []).filter((document) => EMPLOYMENT_TYPES.includes(document.documentType)), [portal]);
  const otherDocuments = useMemo(
    () => (portal?.documents ?? []).filter((document) => !IDENTITY_TYPES.includes(document.documentType) && !EDUCATION_TYPES.includes(document.documentType) && !EMPLOYMENT_TYPES.includes(document.documentType)),
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
    const fields = SECTION_FIELDS[section];
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
    const payload: Record<string, string> = {};
    const saved: FormState = {};
    fields.forEach((field) => {
      const raw = (form[field.key] ?? '').trim();
      saved[field.key] = raw;
      const value = field.normalize ? field.normalize(raw) : raw;
      if (value === '' && DATE_KEYS.has(field.key)) return;
      payload[field.key] = value;
    });
    void run(async () => {
      await api.patch(`/candidate-portal/${token}/profile`, payload);
      setBaseline((previous) => ({ ...previous, ...saved }));
      setForm((previous) => ({ ...previous, ...saved }));
      setMessage(`${SECTION_LABEL[section]} saved.`);
    });
  };

  const giveConsent = () =>
    run(async () => {
      await api.post(`/candidate-portal/${token}/consent`, { consentGiven: true });
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
  const totalSteps = Math.max(progress.pendingCount + portal.documents.length + (progress.profileComplete ? 1 : 0) + (progress.consentComplete ? 1 : 0), 1);
  const percent = progress.pendingCount === 0 ? 100 : Math.round(((totalSteps - progress.pendingCount) / totalSteps) * 100);
  const daysLeft = Math.ceil((new Date(portal.invitation.expiresAt).getTime() - Date.now()) / 86400000);
  const firstName = portal.candidate.firstName || 'there';
  const companyLogo = resolveLogoUrl(portal.company.logoUrl);
  const companyMonogram = portal.company.name.trim().split(/\s+/).slice(0, 2).map((word) => word[0]).join('').toUpperCase() || 'C';

  const sectionPanel = (section: SectionKey, icon: LucideIcon, title: string, description: string, saveLabel: string, extra?: ReactNode) => (
    <SectionCard icon={icon} title={title} description={description}>
      {extra}
      <FieldGrid fields={SECTION_FIELDS[section]} form={form} errors={fieldErrors} onChange={setField} />
      <SaveBar dirty={dirtyBySection[section]} saving={saving} label={saveLabel} onSave={() => saveSection(section)} />
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
        </div>

        <nav className="sticky top-0 z-10 -mx-1 mb-5 bg-[#f5f7f6]/95 px-1 py-2 backdrop-blur" aria-label="Portal sections">
          <div role="tablist" className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
            {TABS.map(({ key, label, icon: Icon }) => {
              const selected = activeTab === key;
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

        {activeTab === 'overview' && (
          <div role="tabpanel" id="panel-overview" aria-labelledby="tab-overview" className="space-y-5">
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
              <div className="flex items-center gap-4">
                <ProgressRing percent={percent} />
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold">{progress.pendingCount === 0 ? 'Everything is complete' : `${progress.pendingCount} ${progress.pendingCount === 1 ? 'step' : 'steps'} left`}</h2>
                  <p className="text-sm text-slate-500">{progress.pendingCount === 0 ? 'Thank you. The verification team will take it from here.' : 'Finish these steps so your verification can start.'}</p>
                  {portal.case && <p className="mt-1 text-xs text-slate-500">Case {portal.case.caseNumber}, {humanize(portal.case.status)}</p>}
                </div>
              </div>
              {progress.pending.length > 0 && (
                <ul className="mt-5 space-y-2">
                  {progress.pending.map((item) => (
                    <li key={item.key}>
                      <button type="button" onClick={() => setActiveTab(tabForPending(item))} className="flex w-full items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-3 text-left text-sm text-slate-800 transition hover:border-slate-300 hover:bg-white">
                        <span className="flex items-center gap-2.5"><span className="h-2 w-2 rounded-full bg-amber-500" aria-hidden="true" />{item.label}</span>
                        <span className="text-xs font-semibold" style={{ color: 'var(--accent)' }}>Complete</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <SectionCard icon={ShieldCheck} title="How it works" description="You can come back to this link any time before it expires.">
              <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  ['Confirm your details', 'Check your name, contact and address.'],
                  ['Add your IDs', 'Enter each ID number and attach a copy.'],
                  ['Add education and work', 'Fill in your history and attach the files.'],
                  ['Give consent', 'Authorise the checks so they can begin.'],
                ].map(([title, text], index) => (
                  <li key={title} className="rounded-xl bg-slate-50 p-4">
                    <span className="grid h-6 w-6 place-items-center rounded-full text-xs font-semibold text-white" style={{ backgroundColor: 'var(--accent)' }}>{index + 1}</span>
                    <p className="mt-2.5 text-sm font-semibold text-slate-900">{title}</p>
                    <p className="mt-1 text-sm text-slate-600">{text}</p>
                  </li>
                ))}
              </ol>
            </SectionCard>
          </div>
        )}

        {activeTab === 'details' && (
          <div role="tabpanel" id="panel-details" aria-labelledby="tab-details">
            {sectionPanel('details', UserRound, 'Your details', 'Make sure these match your official documents.', 'Save details')}
          </div>
        )}

        {activeTab === 'family' && (
          <div role="tabpanel" id="panel-family" aria-labelledby="tab-family">
            {sectionPanel('family', Users, 'Family details', 'Add your parents’ names as they appear on your official documents.', 'Save family details')}
          </div>
        )}

        {activeTab === 'identity' && (
          <div role="tabpanel" id="panel-identity" aria-labelledby="tab-identity" className="space-y-4">
            <div className="px-1">
              <h2 className="text-lg font-semibold">ID numbers and documents</h2>
              <p className="mt-1 text-sm text-slate-600">For each ID, enter the number exactly as printed and attach a clear copy. Skip any you do not have.</p>
              <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500"><Lock size={13} aria-hidden="true" />Sent over an encrypted connection and used only to verify you.</p>
            </div>
            {IDENTITY_ITEMS.map((item) => (
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
              />
            ))}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <SaveBar bare dirty={dirtyBySection.identity} saving={saving} label="Save ID numbers" onSave={() => saveSection('identity')} />
            </div>
          </div>
        )}

        {activeTab === 'education' && (
          <div role="tabpanel" id="panel-education" aria-labelledby="tab-education" className="space-y-5">
            {sectionPanel('education', GraduationCap, 'Education details', 'Tell us about your highest completed qualification.', 'Save education details')}
            <AttachmentUploader token={token} title="Education documents" description="Attach degree certificates, marksheets and other education records. Add as many files as you need." types={EDUCATION_TYPES} onUploaded={afterUpload} />
            <div className="px-1">
              <h3 className="mb-2 text-sm font-semibold text-slate-900">Uploaded education documents ({educationDocuments.length})</h3>
              <DocumentList documents={educationDocuments} emptyText="No education documents uploaded yet." />
            </div>
          </div>
        )}

        {activeTab === 'employment' && (
          <div role="tabpanel" id="panel-employment" aria-labelledby="tab-employment" className="space-y-5">
            {sectionPanel('employment', BriefcaseBusiness, 'Employment details', 'Tell us about your current or most recent job.', 'Save employment details')}
            <AttachmentUploader token={token} title="Employment documents" description="Attach experience letters and salary slips from every employer. Add as many files as you need." types={EMPLOYMENT_TYPES} onUploaded={afterUpload} />
            <div className="px-1">
              <h3 className="mb-2 text-sm font-semibold text-slate-900">Uploaded employment documents ({employmentDocuments.length})</h3>
              <DocumentList documents={employmentDocuments} emptyText="No employment documents uploaded yet." />
            </div>
          </div>
        )}

        {activeTab === 'documents' && (
          <div role="tabpanel" id="panel-documents" aria-labelledby="tab-documents" className="space-y-4">
            <div className="px-1">
              <h2 className="text-lg font-semibold">Address proof and other documents</h2>
              <p className="mt-1 text-sm text-slate-600">ID copies are on the ID numbers tab, and education and employment files are on their own tabs. Use PDF, JPG or PNG files where every corner and number is readable.</p>
            </div>
            {DOCUMENT_GROUPS.map((group) => (
              <CandidateDocumentUpload key={group.title} token={token} accent={accent} title={group.title} description={group.description} types={group.types} onUploaded={refreshPortal} />
            ))}
            <div className="px-1 pt-2">
              <h3 className="mb-2 text-sm font-semibold text-slate-900">Uploaded documents ({otherDocuments.length})</h3>
              <DocumentList documents={otherDocuments} emptyText="Nothing uploaded yet. Documents you add above will appear here." />
            </div>
          </div>
        )}

        {activeTab === 'consent' && (
          <div role="tabpanel" id="panel-consent" aria-labelledby="tab-consent">
            {progress.consentComplete ? (
              <section className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-600" size={20} aria-hidden="true" />
                <div>
                  <h2 className="font-semibold text-emerald-900">Consent recorded</h2>
                  <p className="mt-1 text-sm text-emerald-800">You have authorised the background verification checks. You don&apos;t need to do anything else here.</p>
                </div>
              </section>
            ) : !portal.case ? (
              <SectionCard icon={ShieldCheck} title="Consent" description="Consent opens once your verification case has been created.">
                <p className="text-sm text-slate-600">Check back soon, or contact {portal.company.name} if this stays empty.</p>
              </SectionCard>
            ) : (
              <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:p-6">
                <div className="mb-3 flex items-center gap-2">
                  <ShieldCheck size={18} className="text-amber-700" aria-hidden="true" />
                  <h2 className="font-semibold text-amber-950">Background verification consent</h2>
                </div>
                <p className="text-sm leading-6 text-amber-900">{CONSENT_TEXT}</p>
                <label className="mt-4 flex items-start gap-2.5 text-sm text-amber-950">
                  <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-1 h-4 w-4" />
                  I have read and agree to the consent statement.
                </label>
                <button type="button" onClick={giveConsent} disabled={!consent || saving} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-amber-700 px-4 py-2.5 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50">
                  {saving && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
                  Give consent
                </button>
              </section>
            )}
          </div>
        )}

        <footer className="mt-8 space-y-1 text-center text-xs text-slate-500">
          <p>Your information is sent over an encrypted connection and used only for this verification.</p>
          <p className={daysLeft <= 3 ? 'font-medium text-amber-700' : undefined}>
            This link expires on {formatDate(portal.invitation.expiresAt)}
            {daysLeft > 0 && daysLeft <= 3 ? ` (${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left)` : ''}.
          </p>
        </footer>
      </div>
    </main>
  );
}