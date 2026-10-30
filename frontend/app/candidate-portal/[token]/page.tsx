'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
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
  Mail,
  MapPin,
  Paperclip,
  Phone,
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
import { candidateDocumentStatusLabel } from '@/src/lib/candidate-document-status';
import { candidateDocumentTypeLabel, getDisplayableCustomForms } from '@/src/lib/candidate-portal-forms';
import { CANDIDATE_ADDRESS_DOCUMENT_TYPES, CANDIDATE_EDUCATION_DOCUMENT_TYPES, CANDIDATE_EMPLOYMENT_DOCUMENT_TYPES, DEFAULT_CANDIDATE_FORM_CONFIG } from '@/src/types/client';
import type { CandidateCustomForm, CandidateFormConfig, CandidateFormRequiredFieldKey, CandidateIdentityFieldKey } from '@/src/types/client';

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
  id: string;
  isCurrent: boolean;
  isFresher?: boolean;
  employerName: string | null;
  employeeId: string | null;
  designation: string | null;
  department: string | null;
  employmentType: string | null;
  startDate: string | null;
  endDate: string | null;
  workLocation: string | null;
  employerHrName?: string | null;
  employerHrPhone?: string | null;
};
type PastEmploymentForm = {
  id: string;
  employerName: string;
  employeeId: string;
  designation: string;
  department: string;
  employmentType: string;
  startDate: string;
  endDate: string;
  workLocation: string;
  employerHrName: string;
  employerHrPhone: string;
};
type EducationRecord = {
  id: string;
  qualification: string;
  courseName: string;
  institutionName: string;
  universityName: string;
  yearOfPassing: string;
  gradeOrPercentage: string;
};

type PendingItem = { key: string; label: string; type: string; documentType?: string; employerId?: string; customFormId?: string; category?: string };

type PortalData = {
  candidate: Record<string, unknown> & { status?: string; employmentHistory?: EmploymentRecord[]; educationHistory?: EducationRecord[]; addressVerificationLocations?: string[] };
  company: { name: string; logoUrl?: string | null; primaryColor?: string | null };
  client?: { name: string; supportEmail?: string | null; supportPhone?: string | null } | null;
  candidateFormConfig?: CandidateFormConfig;
  case: { id: string; caseNumber: string; status: string; checks?: string[] } | null;
  documents: PortalDocument[];
  invitation: { expiresAt: string };
  progress: { pending: PendingItem[]; pendingCount: number; consentComplete: boolean; consentReady: boolean; formLocked: boolean; uploadsLocked: boolean; profileComplete: boolean };
};

type TabKey = 'overview' | 'details' | 'family' | 'identity' | 'address' | 'education' | 'employment' | 'policeVerification' | 'bgv' | 'reference' | 'court' | 'cibil' | 'world' | 'socialMedia' | 'otherChecks' | 'documents' | 'consent';
type SectionKey = 'details' | 'family' | 'identity' | 'education' | 'employment' | 'address';
type FormState = Record<string, string>;

type FieldDef = {
  key: string;
  label: string;
  type?: 'text' | 'email' | 'tel' | 'date';
  readOnly?: boolean;
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

const todayISO = () => new Date().toISOString().slice(0, 10);
const splitFullName = splitCandidateName;

/* ------------------------------------------------------------------ */
/* Field configuration                                                 */
/* The keys must match what PATCH /candidate-portal/:token/profile    */
/* accepts. Rename them here if your backend uses different names.     */
/* ------------------------------------------------------------------ */
const DETAILS_FIELDS: FieldDef[] = [
  { key: 'fullName', label: 'Full name', readOnly: true, required: true, wide: true, hint: 'Provided by the inviting company. Contact them to request a correction.' },
  { key: 'email', label: 'Email address', type: 'email', readOnly: true, required: true, hint: 'Provided by the inviting company. Contact them to request a correction.' },
  { key: 'phone', label: 'Mobile number', type: 'tel', required: true, validate: (v) => (/^[+()\-\s\d]{7,18}$/.test(v) ? null : 'Enter a valid phone number.') },
  { key: 'dateOfBirth', label: 'Date of birth', type: 'date', required: true, validate: (v) => (v > todayISO() ? 'Date of birth cannot be in the future.' : null) },
  { key: 'gender', label: 'Gender', suggestions: ['Male', 'Female', 'Other', 'Prefer not to say'] },
  { key: 'candidateNotes', label: 'Notes for the verification team', multiline: true, wide: true, placeholder: 'Share any clarification that may help review your information, such as a name variation or an employment gap.', maxLength: 2000 },
];

const ADDRESS_FIELDS: FieldDef[] = [
  { key: 'currentAddress', label: 'Current address', multiline: true, wide: true },
  { key: 'permanentAddress', label: 'Permanent address', multiline: true, wide: true },
];

const FAMILY_FIELDS: FieldDef[] = [
  { key: 'fatherName', label: "Father's name", maxLength: 255 },
  { key: 'motherName', label: "Mother's name", maxLength: 255 },
  { key: 'maritalStatus', label: 'Marital status', options: ['SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED', 'SEPARATED'] },
  { key: 'spouseName', label: 'Husband / spouse name', maxLength: 255 },
  { key: 'childrenCount', label: 'Number of children', options: Array.from({ length: 21 }, (_, index) => String(index)) },
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
const EDUCATION_RECORD_FIELDS: FieldDef[] = [
  { key: 'qualification', label: 'Qualification', suggestions: ['10th', '12th', 'Diploma', 'Graduate', 'Post graduate', 'Doctorate'] },
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
  { key: 'employerHrName', label: 'Employer HR contact name' },
  { key: 'employerHrPhone', label: 'Employer HR contact number', type: 'tel', validate: (value) => (/^[+()\-\s\d]{7,18}$/.test(value) ? null : 'Enter a valid HR contact number.') },
];
const CURRENT_EMPLOYMENT_FIELD_KEYS = new Set(EMPLOYMENT_FIELDS.map((field) => field.key));
const PAST_EMPLOYMENT_FIELDS: FieldDef[] = [
  { key: 'employerName', label: 'Employer name', wide: true },
  { key: 'employeeId', label: 'Employee ID' },
  { key: 'designation', label: 'Designation' },
  { key: 'department', label: 'Department' },
  { key: 'employmentType', label: 'Employment type', options: ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP', 'FREELANCE', 'CONSULTANT', 'OTHER'] },
  { key: 'startDate', label: 'Start date', type: 'date' },
  { key: 'endDate', label: 'End date', type: 'date' },
  { key: 'workLocation', label: 'Work location' },
  { key: 'employerHrName', label: 'Employer HR contact name' },
  { key: 'employerHrPhone', label: 'Employer HR contact number', type: 'tel', validate: (value) => (/^[+()\-\s\d]{7,18}$/.test(value) ? null : 'Enter a valid HR contact number.') },
];
const CURRENT_EMPLOYMENT_RECORD_ID = 'employment-current';
const emptyPastEmployment = (): PastEmploymentForm => ({
  id: `employment-past-${crypto.randomUUID()}`,
  employerName: '', employeeId: '', designation: '', department: '', employmentType: '', startDate: '', endDate: '', workLocation: '', employerHrName: '', employerHrPhone: '',
});
const hasPastEmploymentDetails = (record: PastEmploymentForm) =>
  Object.entries(record).some(([key, value]) => key !== 'id' && value.trim() !== '');
const emptyEducationRecord = (): EducationRecord => ({
  id: crypto.randomUUID(),
  qualification: '',
  courseName: '',
  institutionName: '',
  universityName: '',
  yearOfPassing: '',
  gradeOrPercentage: '',
});
const toEducationRecords = (candidate: PortalData['candidate']): EducationRecord[] => {
  const records = Array.isArray(candidate.educationHistory) ? candidate.educationHistory : [];
  if (records.length) {
    return records.map((record) => ({
      id: record.id,
      qualification: record.qualification ?? '',
      courseName: record.courseName ?? '',
      institutionName: record.institutionName ?? '',
      universityName: record.universityName ?? '',
      yearOfPassing: record.yearOfPassing ?? '',
      gradeOrPercentage: record.gradeOrPercentage ?? '',
    }));
  }
  const legacy: EducationRecord = {
    id: 'legacy-education',
    qualification: typeof candidate.highestQualification === 'string' ? candidate.highestQualification : '',
    courseName: typeof candidate.courseName === 'string' ? candidate.courseName : '',
    institutionName: typeof candidate.institutionName === 'string' ? candidate.institutionName : '',
    universityName: typeof candidate.universityName === 'string' ? candidate.universityName : '',
    yearOfPassing: typeof candidate.yearOfPassing === 'string' ? candidate.yearOfPassing : '',
    gradeOrPercentage: typeof candidate.gradeOrPercentage === 'string' ? candidate.gradeOrPercentage : '',
  };
  return Object.values(legacy).some((value) => value !== '' && value !== 'legacy-education') ? [legacy] : [];
};
const toPastEmploymentForms = (records: EmploymentRecord[] = []): PastEmploymentForm[] => {
  const pastRecords = records.filter((record) => !record.isCurrent).map((record, index) => ({
    id: record.id || `employment-past-${index + 1}`,
    employerName: record.employerName ?? '',
    employeeId: record.employeeId ?? '',
    designation: record.designation ?? '',
    department: record.department ?? '',
    employmentType: record.employmentType ?? '',
    startDate: record.startDate?.slice(0, 10) ?? '',
    endDate: record.endDate?.slice(0, 10) ?? '',
    workLocation: record.workLocation ?? '',
    employerHrName: record.employerHrName ?? '',
    employerHrPhone: record.employerHrPhone ?? '',
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
  { key: 'reference', label: 'Reference check', icon: Users },
  { key: 'court', label: 'Court check', icon: ShieldCheck },
  { key: 'cibil', label: 'CIBIL', icon: FileCheck },
  { key: 'world', label: 'World check', icon: ShieldCheck },
  { key: 'socialMedia', label: 'Social media', icon: ExternalLink },
  { key: 'education', label: 'Qualification', icon: GraduationCap },
  { key: 'employment', label: 'Employment', icon: BriefcaseBusiness },
  { key: 'policeVerification', label: 'Police verification', icon: ShieldCheck },
  { key: 'otherChecks', label: 'Other checks', icon: FileCheck },
  { key: 'documents', label: 'Documents', icon: FileCheck },
  { key: 'consent', label: 'Review & submit', icon: ShieldCheck },
];

const EDUCATION_TYPES: string[] = CANDIDATE_EDUCATION_DOCUMENT_TYPES.map(({ type }) => type);
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
  REFERENCE: ['REFERENCE', 'REFERENCE_CHECK'],
  COURT: ['COURT', 'COURT_CHECK'],
  CIBIL: ['CIBIL', 'CREDIT', 'CREDIT_CHECK'],
  WORLD: ['WORLD', 'WORLD_CHECK', 'GLOBAL_DATABASE'],
  SOCIAL_MEDIA: ['SOCIAL_MEDIA', 'SOCIAL_MEDIA_CHECK'],
  OTHER_CHECKS: [],
  OTHER: [],
};
const FORM_CATEGORY_SECTIONS: Partial<Record<CandidateCustomForm['category'], keyof CandidateFormConfig['sections']>> = {
  BGV: 'bgv',
  IDENTITY: 'identity',
  EDUCATION: 'education',
  EMPLOYMENT: 'employment',
  POLICE_VERIFICATION: 'policeVerification',
  REFERENCE: 'reference',
  COURT: 'court',
  CIBIL: 'cibil',
  WORLD: 'world',
  SOCIAL_MEDIA: 'socialMedia',
  OTHER_CHECKS: 'otherChecks',
};
const STANDARD_FORM_CHECKS = new Set([...Object.values(FORM_CHECKS).flat(), 'CIBIL']);

const DOCUMENT_GROUPS = [
  { title: 'Other documents', description: 'Anything else the verification team asked for.', types: ['OTHER'] },
];
const CHECK_SUPPORTING_DOCUMENT_PREFIX = 'CHECK_SUPPORTING:';
const CHECK_SUPPORTING_DOCUMENT_CATEGORIES = {
  IDENTITY: 'Identity',
  BGV: 'BGV',
  POLICE_VERIFICATION: 'Police verification',
  REFERENCE: 'Reference check',
  COURT: 'Court check',
  CIBIL: 'CIBIL',
  WORLD: 'World check',
  SOCIAL_MEDIA: 'Social media',
  OTHER_CHECKS: 'Other checks',
} as const;

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
  ({
    ...Object.fromEntries(
      EDITABLE_KEYS.map((key) => {
        if (key === 'fullName') return [key, formatCandidateName({
          fullName: typeof candidate.fullName === 'string' ? candidate.fullName : null,
          firstName: typeof candidate.firstName === 'string' ? candidate.firstName : null,
          middleName: typeof candidate.middleName === 'string' ? candidate.middleName : null,
          lastName: typeof candidate.lastName === 'string' ? candidate.lastName : null,
        })];
        const value = candidate[key];
        if ((typeof value !== 'string' && typeof value !== 'number') || value === '') return [key, ''];
        const text = DATE_KEYS.has(key) ? String(value).slice(0, 10) : String(value);
        const field = FIELD_BY_KEY[key];
        return [key, field.format ? field.format(text) : text];
      }),
    ),
    addressVerificationLocations: Array.isArray(candidate.addressVerificationLocations)
      ? candidate.addressVerificationLocations.filter((location): location is string => typeof location === 'string').join(',')
      : '',
    isFresher: Array.isArray(candidate.employmentHistory)
      && candidate.employmentHistory.some((record) =>
        record !== null && typeof record === 'object' && !Array.isArray(record)
        && 'isCurrent' in record && record.isCurrent === true
        && 'isFresher' in record && record.isFresher === true,
      )
      ? 'true'
      : 'false',
  });

const validateFields = (form: FormState, fields: FieldDef[], allowMissingRequired = false): Record<string, string> => {
  const errors: Record<string, string> = {};
  fields.forEach((field) => {
    if (field.readOnly) return;
    const raw = (form[field.key] ?? '').trim();
    if (!raw) {
      if (field.required && !allowMissingRequired) errors[field.key] = `${field.label} is required.`;
      return;
    }
    const problem = field.validate?.(field.normalize ? field.normalize(raw) : raw);
    if (problem) errors[field.key] = problem;
  });
  return errors;
};

const tabForPending = (item: PendingItem, identityTabEnabled = true): TabKey => {
  const text = `${item.type} ${item.key}`.toLowerCase();
  if (text.includes('consent')) return 'consent';
  if (item.category === 'POLICE_VERIFICATION') return 'policeVerification';
  if (item.category === 'FAMILY') return 'family';
  if (item.category === 'DETAILS') return 'details';
  if (item.category === 'BGV') return 'bgv';
  if (item.category === 'CIBIL') return 'cibil';
  if (item.category === 'OTHER_CHECKS') return 'otherChecks';
  if (item.category === 'EDUCATION') return 'education';
  if (item.category === 'EMPLOYMENT') return 'employment';
  if (item.category === 'ADDRESS') return 'address';
  if (item.category === 'IDENTITY') return identityTabEnabled ? 'identity' : 'documents';
  if (item.customFormId) return 'documents';
  if (item.key.startsWith('field-')) return identityTabEnabled ? 'identity' : 'documents';
  if (item.documentType) {
    if (item.documentType === 'ADDRESS_PROOF' || item.documentType === 'GPS_ADDRESS_PHOTO') return 'address';
    if (IDENTITY_TYPES.includes(item.documentType)) return identityTabEnabled ? 'identity' : 'documents';
    if (EDUCATION_TYPES.includes(item.documentType)) return 'education';
    if (EMPLOYMENT_TYPES.includes(item.documentType)) return 'employment';
    return 'documents';
  }
  return 'details';
};

const statusStyle = (status: string): { label: string; className: string; icon: LucideIcon } => {
  const value = status.toUpperCase();
  if (/(VERIFIED|APPROVED|ACCEPTED|COMPLETED)/.test(value)) return { label: candidateDocumentStatusLabel(status), className: 'bg-emerald-50 text-emerald-700 ring-emerald-200', icon: CheckCircle2 };
  if (/(REJECT|FAIL|INVALID)/.test(value)) return { label: candidateDocumentStatusLabel(status), className: 'bg-red-50 text-red-700 ring-red-200', icon: XCircle };
  return { label: candidateDocumentStatusLabel(status), className: 'bg-amber-50 text-amber-700 ring-amber-200', icon: Clock };
};

/* ------------------------------------------------------------------ */
/* Presentational components                                           */
/* ------------------------------------------------------------------ */
function SectionCard({ icon: Icon, title, description, children, required = false }: { icon: LucideIcon; title: string; description?: string; children: ReactNode; required?: boolean }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="mb-5 flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg" style={{ backgroundColor: 'var(--accent-soft)', color: 'var(--accent)' }}>
          <Icon size={18} aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-base font-semibold text-slate-900">{title}{required && <RequiredMark />}</h2>
          {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function RequiredMark() {
  return (
    <>
      <span className="ml-1 font-bold text-red-600" aria-hidden="true">*</span>
      <span className="sr-only"> required</span>
    </>
  );
}

function ClientContactCard({ client }: { client?: PortalData['client'] }) {
  if (!client?.supportEmail && !client?.supportPhone) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-slate-900">Questions or corrections?</h3>
        <p className="mt-1 text-sm leading-5 text-slate-600">Support contact details are not available.</p>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-slate-900">Questions or corrections?</h3>
      <p className="mt-1 text-sm leading-5 text-slate-600">Please check that the information and documents in your preview are correct. Contact the support team if you have a query or need to correct anything.</p>
      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
        {client.supportEmail && (
          <a href={`mailto:${client.supportEmail}`} className="inline-flex items-center gap-2 break-all text-sm font-medium hover:underline" style={{ color: 'var(--accent)' }}>
            <Mail size={15} aria-hidden="true" />{client.supportEmail}
          </a>
        )}
        {client.supportPhone && (
          <a href={`tel:${client.supportPhone.replace(/[^\d+]/g, '')}`} className="inline-flex items-center gap-2 text-sm font-medium hover:underline" style={{ color: 'var(--accent)' }}>
            <Phone size={15} aria-hidden="true" />{client.supportPhone}
          </a>
        )}
      </div>
    </div>
  );
}

function Field({ def, value, error, onChange, disabled = false }: { def: FieldDef; value: string; error?: string; onChange: (value: string) => void; disabled?: boolean }) {
  const id = `field-${def.key}`;
  const listId = def.suggestions ? `${id}-options` : undefined;
  const describedBy = [error ? `${id}-error` : null, def.hint ? `${id}-hint` : null].filter(Boolean).join(' ') || undefined;
  const isDisabled = disabled || def.readOnly === true;
  const classes = `w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[var(--accent)] focus:ring-2 focus:ring-[color:var(--accent-ring)] disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 ${error ? 'border-red-300' : 'border-slate-200'}`;
  return (
    <div className={def.wide ? 'sm:col-span-2' : undefined}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-slate-700">
        {def.label}
        {def.required && <RequiredMark />}
      </label>
      {def.multiline ? (
        <textarea id={id} value={value} rows={3} disabled={isDisabled} aria-invalid={Boolean(error)} aria-describedby={describedBy} className={classes} onChange={(event) => onChange(event.target.value)} />
      ) : def.options ? (
        <select id={id} value={value} required={def.required} disabled={isDisabled} aria-invalid={Boolean(error)} aria-describedby={describedBy} className={classes} onChange={(event) => onChange(event.target.value)}>
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
          disabled={isDisabled}
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
          <span className="text-xs text-slate-500">{saving ? 'Saving changes...' : dirty ? 'Changes save automatically. You can also save now.' : 'All changes saved.'}</span>
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

function DocumentList({ documents, emptyText, hideType = false, customForms = [], onDeleteDocument, deletingDocumentId = null, readOnly = false }: {
  documents: PortalDocument[];
  emptyText: string;
  hideType?: boolean;
  customForms?: CandidateCustomForm[];
  onDeleteDocument?: (document: PortalDocument) => void;
  deletingDocumentId?: string | null;
  readOnly?: boolean;
}) {
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
                    <p className="text-sm font-semibold text-slate-900">{candidateDocumentTypeLabel(document, customForms)}</p>
                    <p className="truncate text-sm text-slate-600">{document.fileName}</p>
                  </>
                )}
                <p className="mt-0.5 text-xs text-slate-500">{document.documentNumber && !/^[0-9a-f-]{36}$/i.test(document.documentNumber) ? `Number ${document.documentNumber}, ` : ''}uploaded {formatDate(document.uploadedAt)}</p>
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
              {onDeleteDocument && document.fileUrl && /^\/uploads\/candidate-documents\/portal\/[a-f0-9]{64}\/[^/\\]+$/i.test(document.fileUrl) && !readOnly && (
                <button type="button" onClick={() => onDeleteDocument(document)} disabled={Boolean(deletingDocumentId)} className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 hover:underline disabled:opacity-50">
                  {deletingDocumentId === document.id ? <Loader2 size={12} className="animate-spin" aria-hidden="true" /> : <Trash2 size={12} aria-hidden="true" />}
                  {deletingDocumentId === document.id ? 'Deleting…' : 'Delete file'}
                </button>
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

function AttachmentUploader({ token, title = '', description = '', types, requiredTypes = [], requireAnyType = false, variant = 'card', documentNumber = '', onUploaded, readOnly = false, documentCategory }: {
  token: string;
  title?: string;
  description?: string;
  types: string[];
  requiredTypes?: string[];
  requireAnyType?: boolean;
  variant?: 'card' | 'inline';
  /** Sent with each file, so an ID copy carries the number typed beside it. */
  documentNumber?: string;
  onUploaded: (count: number) => void | Promise<void>;
  readOnly?: boolean;
  documentCategory?: 'EMPLOYMENT' | 'ADDRESS' | 'EDUCATION';
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
                {documentTypeLabel(type)}{requiredTypes.includes(type) ? ' *' : ''}
              </option>
            ))}
          </select>
        </label>
      )}
      {requiredTypes.length > 0 && (
        <p className="mb-3 text-xs text-slate-600">
          <RequiredMark /> Required upload{requiredTypes.length > 1 ? 's' : ''}: {requiredTypes.map(documentTypeLabel).join(', ')}.
        </p>
      )}
      {requireAnyType && types.length > 0 && (
        <p className="mb-3 text-xs text-slate-600">
          <RequiredMark /> Upload at least one of these {documentCategory === 'ADDRESS' ? 'address document types' : 'document types for this employer'}: {types.map(documentTypeLabel).join(', ')}.
        </p>
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
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{documentTypeLabel(item.documentType)}{requiredTypes.includes(item.documentType) && <span className="ml-1 font-bold text-red-600">*</span>}</span>
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
  return <SectionCard icon={Paperclip} title={title} description={description} required={requiredTypes.length > 0}>{content}</SectionCard>;
}

/* ------------------------------------------------------------------ */
/* One card per ID: number field + upload + uploaded files             */
/* ------------------------------------------------------------------ */
function IdentityCard({ title, field, value, error, documents, token, onChange, onUploaded, onDeleteDocument, deletingDocumentId, documentRequired = false, readOnly = false, uploadReadOnly = false }: {
  title: string;
  field: FieldDef;
  value: string;
  error?: string;
  documents: PortalDocument[];
  token: string;
  onChange: (value: string) => void;
  onUploaded: (count: number) => void | Promise<void>;
  onDeleteDocument: (document: PortalDocument) => void;
  deletingDocumentId: string | null;
  documentRequired?: boolean;
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
          <p className="mb-1.5 text-sm font-medium text-slate-700">Copy of {title}{documentRequired && <RequiredMark />}</p>
          <AttachmentUploader variant="inline" token={token} types={[docType]} documentNumber={numberForFile} onUploaded={onUploaded} readOnly={uploadReadOnly} />
          {sorted.length > 0 && <div className="mt-3"><DocumentList documents={sorted} emptyText="" hideType onDeleteDocument={onDeleteDocument} deletingDocumentId={deletingDocumentId} readOnly={uploadReadOnly} /></div>}
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
  const initialPastEmployment = useMemo(() => emptyPastEmployment(), []);
  const [portal, setPortal] = useState<PortalData | null>(null);
  const [daysLeft, setDaysLeft] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>({});
  const [baseline, setBaseline] = useState<FormState>({});
  const [pastEmployments, setPastEmployments] = useState<PastEmploymentForm[]>([initialPastEmployment]);
  const [pastEmploymentBaseline, setPastEmploymentBaseline] = useState<PastEmploymentForm[]>([initialPastEmployment]);
  const [educationRecords, setEducationRecords] = useState<EducationRecord[]>([]);
  const [educationBaseline, setEducationBaseline] = useState<EducationRecord[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingDocumentId, setDeletingDocumentId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const profileReadOnly = portal?.progress.formLocked ?? false;
  const saveSectionRef = useRef<(section: SectionKey, automatic: boolean) => Promise<boolean>>(async () => false);
  const autoSaveBlockedSignature = useRef<string | null>(null);

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
        const savedEducationRecords = toEducationRecords(data.candidate);
        const nextEducationRecords = savedEducationRecords.length ? savedEducationRecords : [emptyEducationRecord()];
        setForm(next);
        setBaseline(next);
        setPastEmployments(nextPastEmployments);
        setPastEmploymentBaseline(nextPastEmployments);
        setEducationRecords(nextEducationRecords);
        setEducationBaseline(nextEducationRecords);
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
  const configuredField = useCallback((field: FieldDef, key: CandidateFormRequiredFieldKey = field.key as CandidateFormRequiredFieldKey): FieldDef => ({
    ...field,
    required: candidateFormConfig.fields?.[key]?.required ?? field.required ?? false,
  }), [candidateFormConfig.fields]);
  const employmentRequirementKey = useCallback((key: string): CandidateFormRequiredFieldKey => ({
    currentEmployer: 'employerName',
    employeeDesignation: 'designation',
    employeeDepartment: 'department',
    joiningDate: 'startDate',
  }[key] ?? key) as CandidateFormRequiredFieldKey, []);
  const educationRecordFields = EDUCATION_RECORD_FIELDS.map((field) => configuredField(field));
  const pastEmploymentFields = PAST_EMPLOYMENT_FIELDS.map((field) => configuredField(field));
  const customForms = candidateFormConfig.customForms ?? [];
  const identityConfigFor = (key: string) => candidateFormConfig[key as CandidateIdentityFieldKey];
  const isCategoryRequested = (category: CandidateCustomForm['category']) => {
    const selectedChecks = portal?.case?.checks ?? [];
    if (['REFERENCE', 'COURT', 'WORLD', 'SOCIAL_MEDIA'].includes(category)) return true;
    if (category === 'OTHER_CHECKS') {
      return !portal?.case || selectedChecks.length === 0 || selectedChecks.some((check) => !STANDARD_FORM_CHECKS.has(check));
    }
    return !portal?.case || selectedChecks.length === 0 || FORM_CHECKS[category].length === 0
      || selectedChecks.some((check) => FORM_CHECKS[category].includes(check));
  };
  const customFormsFor = (category: CandidateCustomForm['category']) => customForms.filter((form) =>
    form.enabled && form.category === category
    && isCategoryRequested(category)
    && (FORM_CATEGORY_SECTIONS[category] === undefined || candidateFormConfig.sections[FORM_CATEGORY_SECTIONS[category]].enabled)
    && (category !== 'EDUCATION' || candidateFormConfig.sections.education.enabled)
    && (category !== 'EMPLOYMENT' || candidateFormConfig.sections.employment.enabled)
    && (category !== 'POLICE_VERIFICATION' || candidateFormConfig.sections.policeVerification.enabled)
    && (category !== 'IDENTITY' || IDENTITY_FIELDS.some((field) => identityConfigFor(field.key)?.enabled !== false)),
  );
  const bgvForms = getDisplayableCustomForms('BGV', customFormsFor('BGV'));
  const policeVerificationForms = getDisplayableCustomForms('POLICE_VERIFICATION', customFormsFor('POLICE_VERIFICATION'));
  const visibleTabs = TABS.filter(({ key }) => {
    if (key === 'address') {
      const addressPending = portal?.progress.pending.some((item) => item.category === 'ADDRESS');
      return candidateFormConfig.sections.address.enabled || Boolean(addressPending);
    }
    if (key === 'family') return candidateFormConfig.sections.family.enabled;
    if (key === 'identity' || key === 'bgv' || key === 'reference' || key === 'court'
      || key === 'cibil' || key === 'world' || key === 'socialMedia' || key === 'otherChecks'
      || key === 'policeVerification' || key === 'education' || key === 'employment') {
      return candidateFormConfig.sections[key].enabled;
    }
    if (key === 'consent') return true;
    return true;
  });
  const visibleTabKeys = visibleTabs.map(({ key }) => key).join('|');
  const currentTab = visibleTabKeys.split('|').includes(activeTab) ? activeTab : 'overview';
  const effectiveSectionFields = useMemo(() => ({
    ...SECTION_FIELDS,
    education: [],
    details: DETAILS_FIELDS.map((field) => configuredField(field)),
    family: FAMILY_FIELDS
      .filter((field) => field.key !== 'spouseName' || form.maritalStatus === 'MARRIED')
      .map((field) => configuredField(field)),
    identity: SECTION_FIELDS.identity
      .filter((field) => candidateFormConfig.sections.identity.enabled && candidateFormConfig[field.key as CandidateIdentityFieldKey]?.enabled !== false)
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
    employment: EMPLOYMENT_FIELDS
      .filter((field) => candidateFormConfig.currentEmploymentEnabled || !CURRENT_EMPLOYMENT_FIELD_KEYS.has(field.key))
      .map((field) => {
        const configured = configuredField(field, employmentRequirementKey(field.key));
        return form.isFresher === 'true' ? { ...configured, required: false } : configured;
      }),
  }), [candidateFormConfig, configuredField, employmentRequirementKey, form.isFresher, form.maritalStatus]);

  const dirtyBySection = useMemo(() => {
    const result = {} as Record<SectionKey, boolean>;
    SECTIONS.forEach((section) => {
      result[section] = effectiveSectionFields[section].some((field) => (form[field.key] ?? '') !== (baseline[field.key] ?? ''));
    });
    result.address = result.address || (form.addressVerificationLocations ?? '') !== (baseline.addressVerificationLocations ?? '');
    result.employment = result.employment
      || (form.isFresher ?? 'false') !== (baseline.isFresher ?? 'false')
      || JSON.stringify(pastEmployments) !== JSON.stringify(pastEmploymentBaseline);
    result.education = JSON.stringify(educationRecords) !== JSON.stringify(educationBaseline);
    return result;
  }, [form, baseline, effectiveSectionFields, pastEmployments, pastEmploymentBaseline, educationRecords, educationBaseline]);
  const anyDirty = SECTIONS.some((section) => dirtyBySection[section]);
  const autoSaveSignature = JSON.stringify([form, pastEmployments, educationRecords]);

  useEffect(() => {
    if (!anyDirty) return undefined;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [anyDirty]);

  useEffect(() => {
    if (!anyDirty || saving || profileReadOnly || autoSaveBlockedSignature.current === autoSaveSignature) return undefined;
    const activeSection = SECTIONS.find((item) => item === currentTab);
    const section = activeSection && dirtyBySection[activeSection]
      ? activeSection
      : SECTIONS.find((item) => dirtyBySection[item]);
    if (!section) return undefined;
    const timer = window.setTimeout(() => {
      void saveSectionRef.current(section, true).then((saved) => {
        if (!saved) autoSaveBlockedSignature.current = autoSaveSignature;
      });
    }, 800);
    return () => window.clearTimeout(timer);
  }, [anyDirty, autoSaveSignature, currentTab, dirtyBySection, profileReadOnly, saving]);

  const pendingByTab = useMemo(() => {
    const flags: Record<TabKey, boolean> = { overview: false, details: false, family: false, identity: false, address: false, education: false, employment: false, policeVerification: false, bgv: false, reference: false, court: false, cibil: false, world: false, socialMedia: false, otherChecks: false, documents: false, consent: false };
    if (!portal) return flags;
    portal.progress.pending.forEach((item) => { flags[tabForPending(item, candidateFormConfig.sections.identity.enabled)] = true; });
    if (!portal.progress.profileComplete) flags.details = true;
    if (portal.case && !portal.progress.consentComplete) flags.consent = true;
    return flags;
  }, [portal, candidateFormConfig.sections.identity.enabled]);

  const educationDocuments = useMemo(() => (portal?.documents ?? []).filter((document) => EDUCATION_TYPES.includes(document.documentType)), [portal]);
  const employmentDocuments = useMemo(() => (portal?.documents ?? []).filter((document) => EMPLOYMENT_TYPES.includes(document.documentType)), [portal]);
  const currentEmployerDocuments = employmentDocuments.filter((document) =>
    document.documentNumber === CURRENT_EMPLOYMENT_RECORD_ID || !document.documentNumber,
  );
  const knownPastEmployerIds = new Set(pastEmployments.map((record) => record.id));
  const otherEmploymentDocuments = employmentDocuments.filter((document) =>
    Boolean(document.documentNumber)
    && document.documentNumber !== CURRENT_EMPLOYMENT_RECORD_ID
    && !knownPastEmployerIds.has(document.documentNumber || ''),
  );
  const supportingDocumentsFor = (category: keyof typeof CHECK_SUPPORTING_DOCUMENT_CATEGORIES) =>
    portal?.documents.filter((document) => document.documentNumber === `${CHECK_SUPPORTING_DOCUMENT_PREFIX}${category}`) ?? [];
  const supportingDocumentsSection = (category: keyof typeof CHECK_SUPPORTING_DOCUMENT_CATEGORIES) => (
    <SectionCard
      icon={Paperclip}
      title={`${CHECK_SUPPORTING_DOCUMENT_CATEGORIES[category]} supporting documents`}
      description="Upload any additional PDF or image that may help complete this verification. These uploads are optional."
    >
      <AttachmentUploader
        token={token}
        title="Upload supporting documents"
        description="Select any additional evidence requested for this check."
        types={['OTHER']}
        documentNumber={`${CHECK_SUPPORTING_DOCUMENT_PREFIX}${category}`}
        onUploaded={afterUpload}
        readOnly={uploadReadOnly}
      />
      <div className="mt-4">
        <DocumentList
          documents={supportingDocumentsFor(category)}
          emptyText="No supporting documents uploaded yet."
          onDeleteDocument={deleteUploadedDocument}
          deletingDocumentId={deletingDocumentId}
          readOnly={uploadReadOnly}
        />
      </div>
    </SectionCard>
  );
  const addressDocuments = useMemo(() => (portal?.documents ?? []).filter((document) => ADDRESS_TYPES.includes(document.documentType)), [portal]);
  const addressUploadTypes = Array.from(new Set([
    ...candidateFormConfig.address.documents.filter((document) => document.enabled).map((document) => document.type),
    ...(portal?.progress.pending ?? [])
      .filter((item): item is PendingItem & { documentType: string } => item.category === 'ADDRESS' && Boolean(item.documentType))
      .map((item) => item.documentType),
  ]));
  const requiredAddressUploadTypes = Array.from(new Set([
    ...candidateFormConfig.address.documents.filter((document) => document.enabled && document.required).map((document) => document.type),
    ...(portal?.progress.pending ?? [])
      .filter((item): item is PendingItem & { documentType: string } => item.category === 'ADDRESS' && item.key !== 'address-document-any' && Boolean(item.documentType))
      .map((item) => item.documentType),
  ]));
  const requireAnyAddressDocument = candidateFormConfig.address.requireAnyDocument
    || (portal?.progress.pending ?? []).some((item) => item.key === 'address-document-any');
  const employmentUploadTypes = Array.from(new Set([
    ...candidateFormConfig.employmentDocuments.filter((document) => document.enabled).map((document) => document.type),
    ...(portal?.progress.pending ?? [])
      .filter((item): item is PendingItem & { documentType: string } => item.category === 'EMPLOYMENT' && Boolean(item.documentType))
      .map((item) => item.documentType),
  ]));
  const isEmploymentEmployerRequirementApplied = (employerIndex: number) => {
    const includeCurrentEmployer = candidateFormConfig.currentEmploymentEnabled
      && candidateFormConfig.includeCurrentEmployerInDocumentRequirements;
    if (employerIndex === 0) return includeCurrentEmployer;
    const requiredPastEmployerCount = Math.max(
      0,
      candidateFormConfig.requiredEmploymentEmployerCount - (includeCurrentEmployer ? 1 : 0),
    );
    return employerIndex - 1 < requiredPastEmployerCount;
  };
  const requiredEmploymentTypesFor = (employerIndex: number) => isEmploymentEmployerRequirementApplied(employerIndex)
    && form.isFresher !== 'true' ? Array.from(new Set(
      candidateFormConfig.employmentDocuments
        .filter((document) => document.enabled && document.required)
        .map((document) => document.type),
    ))
    : [];
  const requireAnyEmploymentDocument = candidateFormConfig.requireEmploymentDocumentPerEmployer;
  const requireAnyEmploymentDocumentFor = (employerIndex: number) =>
    form.isFresher !== 'true' && requireAnyEmploymentDocument && isEmploymentEmployerRequirementApplied(employerIndex);
  const requiredEducationUploadTypes = (portal?.progress.pending ?? []).flatMap((item) =>
    item.category === 'EDUCATION' && item.documentType ? [item.documentType] : [],
  );
  const educationUploadTypes = Array.from(new Set([
    ...candidateFormConfig.educationDocuments.filter((document) => document.enabled).map((document) => document.type),
    ...(portal?.progress.pending ?? [])
      .filter((item): item is PendingItem & { documentType: string } => item.category === 'EDUCATION' && Boolean(item.documentType))
      .map((item) => item.documentType),
  ]));
  const run = async (action: () => Promise<void>): Promise<boolean> => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await action();
      await fetchPortal(false);
      return true;
    } catch (requestError: unknown) {
      setError(requestMessage(requestError, 'Something went wrong. Please try again.'));
      return false;
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

  const getAddressVerificationLocations = () => (form.addressVerificationLocations ?? '')
    .split(',')
    .filter((location) => (
      (location === 'current' && candidateFormConfig.address.currentAddressEnabled)
      || (location === 'permanent' && candidateFormConfig.address.permanentAddressEnabled)
    ));

  // Each tab saves only its own fields, so one section can never block another.
  const saveSection = async (section: SectionKey, automatic = false): Promise<boolean> => {
    const fields = effectiveSectionFields[section];
    const found = section === 'education'
      ? Object.fromEntries(educationRecords.flatMap((record) => educationRecordFields.flatMap((field) => {
        const value = record[field.key as keyof EducationRecord];
        const problem = !value.trim() && field.required
          ? `${field.label} is required.`
          : value.trim() ? field.validate?.(value.trim()) : null;
        return problem ? [[`education_${record.id}_${field.key}`, problem]] : [];
      })))
      : validateFields(form, fields, automatic);
    if (section === 'employment') {
      if (form.isFresher !== 'true') {
        pastEmployments.forEach((record, index) => {
          const recordStarted = hasPastEmploymentDetails(record);
          pastEmploymentFields.forEach((field) => {
            const value = record[field.key as keyof PastEmploymentForm].trim();
            const isRequired = field.required && recordStarted;
            const problem = !value && isRequired
              ? `${field.label} is required.`
              : value ? field.validate?.(value) : null;
            if (problem) found[`past_${index}_${field.key}`] = problem;
          });
        });
      }
    }
    if (section === 'education' && educationRecords.length === 0 && educationRecordFields.some((field) => field.required)) {
      found.education_required = 'Add at least one education record to complete the required education fields.';
    }
    setFieldErrors((previous) => {
      const next = { ...previous };
      fields.forEach((field) => delete next[field.key]);
      Object.keys(previous).filter((key) => key.startsWith('education_')).forEach((key) => delete next[key]);
      if (section === 'employment') {
        Object.keys(previous).filter((key) => key.startsWith('past_')).forEach((key) => delete next[key]);
      }
      return { ...next, ...found };
    });
    if (Object.keys(found).length) {
      if (!automatic) {
        setMessage('');
        setError('Please correct the highlighted fields.');
        const firstError = Object.keys(found)[0];
        setActiveTab(section === 'education' || firstError.startsWith('past_')
          ? section
          : SECTION_OF_KEY[firstError] ?? section);
      }
      return false;
    }
    const payload: Record<string, unknown> = {};
    const saved: FormState = {};
    fields.forEach((field) => {
      if (field.readOnly) return;
      const raw = (form[field.key] ?? '').trim();
      saved[field.key] = raw;
      const value = field.normalize ? field.normalize(raw) : raw;
      if (value === '' && DATE_KEYS.has(field.key)) return;
      payload[field.key] = section === 'family' && field.key === 'childrenCount'
        ? value === '' ? null : Number(value)
        : value;
    });
    if (section === 'family' && form.maritalStatus !== 'MARRIED') {
      payload.spouseName = '';
      saved.spouseName = '';
      setForm((previous) => ({ ...previous, spouseName: '' }));
    }
    if (section === 'address') {
      saved.addressVerificationLocations = getAddressVerificationLocations().join(',');
      payload.addressVerificationLocations = getAddressVerificationLocations();
    }
    if (section === 'education') {
      const records = educationRecords.filter((record) =>
        Object.values(record).some((value) => value !== record.id && value.trim())
        || educationDocuments.some((document) => document.documentNumber === record.id),
      );
      const first = records[0];
      payload.educationHistory = records;
      payload.highestQualification = first?.qualification || '';
      payload.courseName = first?.courseName || '';
      payload.institutionName = first?.institutionName || '';
      payload.universityName = first?.universityName || '';
      payload.yearOfPassing = first?.yearOfPassing || '';
      payload.gradeOrPercentage = first?.gradeOrPercentage || '';
      saved.highestQualification = first?.qualification || '';
      saved.courseName = first?.courseName || '';
      saved.institutionName = first?.institutionName || '';
      saved.universityName = first?.universityName || '';
      saved.yearOfPassing = first?.yearOfPassing || '';
      saved.gradeOrPercentage = first?.gradeOrPercentage || '';
    }
    if (section === 'employment') {
      saved.isFresher = form.isFresher === 'true' ? 'true' : 'false';
      const currentEmployer = {
        id: CURRENT_EMPLOYMENT_RECORD_ID,
        isCurrent: true,
        isFresher: form.isFresher === 'true',
        employerName: form.currentEmployer?.trim() || null,
        employeeId: form.employeeId?.trim() || null,
        designation: form.employeeDesignation?.trim() || null,
        department: form.employeeDepartment?.trim() || null,
        employmentType: form.employmentType?.trim() || null,
        startDate: form.joiningDate?.trim() || null,
        endDate: null,
        workLocation: form.workLocation?.trim() || null,
        employerHrName: form.employerHrName?.trim() || null,
        employerHrPhone: form.employerHrPhone?.trim() || null,
      };
      const pastRecords = pastEmployments
        .filter((record) => hasPastEmploymentDetails(record)
          || employmentDocuments.some((document) => document.documentNumber === record.id))
        .map((record) => ({ ...record, isCurrent: false }));
      payload.employmentHistory = [currentEmployer, ...pastRecords];
    }
    return run(async () => {
      await api.patch(`/candidate-portal/${token}/profile`, payload);
      setBaseline((previous) => ({ ...previous, ...saved }));
      setForm((previous) => {
        const next = { ...previous };
        Object.entries(saved).forEach(([key, value]) => {
          if ((previous[key] ?? '') === (form[key] ?? '')) next[key] = value;
        });
        return next;
      });
      if (section === 'employment') setPastEmploymentBaseline(pastEmployments);
      if (section === 'education') setEducationBaseline(educationRecords);
      setMessage(`${SECTION_LABEL[section]} saved.`);
    });
  };
  useEffect(() => {
    saveSectionRef.current = saveSection;
  });

  const saveAndPreview = async () => {
    const enabledSections = SECTIONS.filter((section) => (
      section !== 'family' || candidateFormConfig.sections.family.enabled
    ) && (
      section !== 'education' || candidateFormConfig.sections.education.enabled
    ) && (
      section !== 'employment' || candidateFormConfig.sections.employment.enabled
    ));
    const fields = enabledSections.flatMap((section) => effectiveSectionFields[section]);
    const found: Record<string, string> = validateFields(form, fields);
    if (candidateFormConfig.sections.education.enabled) {
      if (educationRecords.length === 0 && educationRecordFields.some((field) => field.required)) {
        found.education_required = 'Add at least one education record to complete the required education fields.';
      }
      educationRecords.forEach((record) => {
        educationRecordFields.forEach((field) => {
          const value = record[field.key as keyof EducationRecord].trim();
          const problem = !value && field.required
            ? `${field.label} is required.`
            : value ? field.validate?.(value) : null;
          if (problem) found[`education_${record.id}_${field.key}`] = problem;
        });
      });
    }
    if (candidateFormConfig.sections.employment.enabled) {
      if (form.isFresher !== 'true') {
        const hasPastEmployer = pastEmployments.some((record) => record.employerName.trim() !== '');
        if (!hasPastEmployer) {
          found.past_0_employerName = 'Add at least one past employer, or select “I am a fresher”.';
        }
        pastEmployments.forEach((record, index) => {
          const recordStarted = hasPastEmploymentDetails(record);
          pastEmploymentFields.forEach((field) => {
            const value = record[field.key as keyof PastEmploymentForm].trim();
            const isRequired = field.required && recordStarted;
            const problem = !value && isRequired
              ? `${field.label} is required.`
              : value ? field.validate?.(value) : null;
            if (problem) found[`past_${index}_${field.key}`] = problem;
          });
        });
      }
    }
    setFieldErrors(found);
    if (Object.keys(found).length) {
      setError('Please correct the highlighted fields before reviewing your submission.');
      const firstKey = Object.keys(found)[0];
      if (firstKey.startsWith('education_')) setActiveTab('education');
      else if (firstKey.startsWith('past_')) setActiveTab('employment');
      else setActiveTab(SECTION_OF_KEY[firstKey] ?? 'details');
      return;
    }

    if (anyDirty) {
      const payload: Record<string, unknown> = {};
      fields.filter((field) => !field.readOnly).forEach((field) => {
        const raw = (form[field.key] ?? '').trim();
        const value = field.normalize ? field.normalize(raw) : raw;
        payload[field.key] = field.key === 'childrenCount'
          ? value === '' ? null : Number(value)
          : value;
      });
      if (candidateFormConfig.sections.family.enabled && form.maritalStatus !== 'MARRIED') payload.spouseName = '';
      if (candidateFormConfig.sections.address.enabled) {
        payload.addressVerificationLocations = getAddressVerificationLocations();
      }
      if (candidateFormConfig.sections.education.enabled) {
        const records = educationRecords.filter((record) =>
          Object.values(record).some((value) => value !== record.id && value.trim())
          || educationDocuments.some((document) => document.documentNumber === record.id),
        );
        const first = records[0];
        payload.educationHistory = records;
        payload.highestQualification = first?.qualification || '';
        payload.courseName = first?.courseName || '';
        payload.institutionName = first?.institutionName || '';
        payload.universityName = first?.universityName || '';
        payload.yearOfPassing = first?.yearOfPassing || '';
        payload.gradeOrPercentage = first?.gradeOrPercentage || '';
      }
      if (candidateFormConfig.sections.employment.enabled) {
        payload.employmentHistory = [{
          id: CURRENT_EMPLOYMENT_RECORD_ID,
          isCurrent: true,
          isFresher: form.isFresher === 'true',
          employerName: form.currentEmployer?.trim() || null,
          employeeId: form.employeeId?.trim() || null,
          designation: form.employeeDesignation?.trim() || null,
          department: form.employeeDepartment?.trim() || null,
          employmentType: form.employmentType?.trim() || null,
          startDate: form.joiningDate?.trim() || null,
          endDate: null,
          workLocation: form.workLocation?.trim() || null,
          employerHrName: form.employerHrName?.trim() || null,
          employerHrPhone: form.employerHrPhone?.trim() || null,
        }, ...pastEmployments
          .filter((record) => hasPastEmploymentDetails(record)
            || employmentDocuments.some((document) => document.documentNumber === record.id))
          .map((record) => ({ ...record, isCurrent: false }))];
      }
      const saved = { ...form };
      if (candidateFormConfig.sections.family.enabled && form.maritalStatus !== 'MARRIED') saved.spouseName = '';
      saved.addressVerificationLocations = getAddressVerificationLocations().join(',');
      const success = await run(async () => {
        await api.patch(`/candidate-portal/${token}/profile`, payload);
        setBaseline(saved);
        setForm(saved);
        setEducationBaseline(educationRecords);
        setPastEmploymentBaseline(pastEmployments);
      });
      if (!success) return;
    }
    setConsent(false);
    setActiveTab('consent');
    setMessage('Your details are saved. Review the preview below before submitting consent.');
  };

  const giveConsent = async () => {
    if (!progress.consentReady) {
      const firstRequiredItem = progress.pending.find((item) => (
        (item.type === 'profile' && item.key !== 'profile')
        || (item.type === 'document' && Boolean(item.customFormId))
      ));
      setConsent(false);
      setError('Consent is unavailable until all required information and client-required forms are complete. Complete the outstanding item(s) below first.');
      setMessage('');
      if (firstRequiredItem) setActiveTab(tabForPending(firstRequiredItem, candidateFormConfig.sections.identity.enabled));
      return;
    }
    await run(async () => {
      if (anyDirty) throw new Error('Save your changes and review the preview before submitting consent.');
      await api.post(`/candidate-portal/${token}/consent`, {
        consentGiven: true,
        consentVersion: '1.1',
      });
      setConsent(false);
      setMessage('Your consent was recorded.');
    });
  };

  const afterUpload = (count: number) => {
    setError('');
    setMessage(`${count} ${count === 1 ? 'file' : 'files'} uploaded for review.`);
    return refreshPortal();
  };

  const deleteUploadedDocument = async (document: PortalDocument) => {
    if (!window.confirm(`Delete "${document.fileName}"? You can upload a replacement afterward.`)) return;
    setDeletingDocumentId(document.id);
    setError('');
    setMessage('');
    try {
      await api.delete(`/candidate-portal/${token}/documents/${encodeURIComponent(document.id)}`);
      await fetchPortal(false);
      setMessage('Document deleted. You can upload a replacement.');
    } catch (requestError: unknown) {
      setError(requestMessage(requestError, 'Could not delete this document. Please try again.'));
    } finally {
      setDeletingDocumentId(null);
    }
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
  const requiredConsentItems = progress.pending.filter((item) => (
    (item.type === 'profile' && item.key !== 'profile')
    || item.type === 'document'
  ));
  const nameParts = splitFullName(form.fullName || '');
  const firstName = nameParts?.firstName || (typeof portal.candidate.firstName === 'string' ? portal.candidate.firstName : 'there');
  const companyLogo = resolveLogoUrl(portal.company.logoUrl);
  const companyMonogram = portal.company.name.trim().split(/\s+/).slice(0, 2).map((word) => word[0]).join('').toUpperCase() || 'C';
  const requiredUploadItems = progress.pending.filter((item) => item.type === 'document');
  const overviewForms = (['BGV', 'IDENTITY', 'EDUCATION', 'EMPLOYMENT', 'POLICE_VERIFICATION', 'REFERENCE', 'COURT', 'CIBIL', 'WORLD', 'SOCIAL_MEDIA', 'OTHER_CHECKS', 'OTHER'] as CandidateCustomForm['category'][])
    .flatMap((category) => customFormsFor(category));
  const overviewInstructions: { tab: TabKey; title: string; description: string; details: string[] }[] = [
    {
      tab: 'details',
      title: 'Your details',
      description: 'Your name and email address are provided by the inviting company and cannot be edited here. Contact the company to request a correction. Complete the remaining personal information.',
      details: effectiveSectionFields.details.map((field) => `${field.label}${field.required ? ' (required)' : ''}`),
    },
  ];
  if (candidateFormConfig.sections.family.enabled) {
    overviewInstructions.push({
      tab: 'family',
      title: 'Family details',
      description: 'Add parent details, select your marital status, and provide spouse details if married.',
      details: effectiveSectionFields.family.map((field) => `${field.label}${field.required ? ' (required)' : ''}`),
    });
  }
  if (visibleTabs.some(({ key }) => key === 'identity')) {
    const identityDetails = IDENTITY_ITEMS
      .filter((item) => identityConfigFor(item.fieldKey)?.enabled !== false)
      .flatMap((item) => {
        const config = identityConfigFor(item.fieldKey);
        const field = FIELD_BY_KEY[item.fieldKey];
        return [
          `${field.label} number${config?.required ? ' (required)' : ''}`,
          ...(config?.documentRequired ? [`${field.label} document copy (required)`] : []),
        ];
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
      ...(candidateFormConfig.address.requireAnyDocument ? ['At least one enabled address document is required'] : []),
    ];
    overviewInstructions.push({
      tab: 'address',
      title: 'Address verification',
      description: 'Provide the enabled address details and any address proof requested by your client.',
      details: addressDetails,
    });
  }
  if (visibleTabs.some(({ key }) => key === 'cibil')) {
    overviewInstructions.push({
      tab: 'cibil',
      title: 'CIBIL form',
      description: 'Download the CIBIL template configured by your client, complete it and upload the finished form.',
      details: customFormsFor('CIBIL').map((form) => `${form.name}${form.required ? ' (required)' : ' (optional)'}`),
    });
  }
  if (visibleTabs.some(({ key }) => key === 'education')) {
    overviewInstructions.push({
      tab: 'education',
      title: 'Education history',
      description: 'Add each qualification as a separate record and attach its matching certificate or marksheet. Include any client-provided education form.',
      details: [
        ...educationRecordFields.map((field) => `${field.label}${field.required ? ' (required)' : ''}`),
        ...candidateFormConfig.educationDocuments.filter((document) => document.enabled).map((document) =>
          `Separate certificate or marksheet for each record${document.required ? ' (required)' : ''}`,
        ),
      ],
    });
  }
  if (visibleTabs.some(({ key }) => key === 'employment')) {
    const enabledEmploymentDocuments = candidateFormConfig.employmentDocuments.filter((document) => document.enabled);
    const isFresher = form.isFresher === 'true';
    overviewInstructions.push({
      tab: 'employment',
      title: 'Employment history',
      description: isFresher
        ? 'You indicated that you are a fresher. Past employment details and required employment documents are not needed.'
        : 'Enter your current employer first, then add past employers from most recent to oldest. You can enter up to 10 employers total.',
      details: isFresher
        ? effectiveSectionFields.employment.map((field) => field.label)
        : [
          ...effectiveSectionFields.employment.map((field) => `${field.label}${field.required ? ' (required)' : ''}`),
          'At least one past employer name is required unless you select “I am a fresher”',
          'Employer HR contact name and phone number',
          ...enabledEmploymentDocuments.map((document) => {
            const label = CANDIDATE_EMPLOYMENT_DOCUMENT_TYPES.find((item) => item.type === document.type)?.label ?? humanize(document.type);
            return `${label}${document.required ? ` (required for the first ${candidateFormConfig.requiredEmploymentEmployerCount} ${candidateFormConfig.includeCurrentEmployerInDocumentRequirements ? 'employers including current' : 'past employers'})` : ' (optional)'}`;
          }),
          ...(candidateFormConfig.requireEmploymentDocumentPerEmployer
            ? [`At least one enabled employment document required for the first ${candidateFormConfig.requiredEmploymentEmployerCount} ${candidateFormConfig.includeCurrentEmployerInDocumentRequirements ? 'employers including current' : 'past employers'}`]
            : []),
        ],
    });
  }
  if (portal.case) {
    overviewInstructions.push({
      tab: 'consent',
      title: 'Review and give consent',
      description: 'Check your saved personal, family, education and employment details and uploaded documents before giving consent.',
      details: ['Consent is needed before the requested verification checks can begin.', 'Your profile details are locked after consent is submitted.'],
    });
  } else {
    overviewInstructions.push({
      tab: 'consent',
      title: 'Review and submit',
      description: 'Check the information and documents you entered before submitting your consent.',
      details: ['Your profile details are locked after consent is submitted.'],
    });
  }

  const uploadReadOnly = portal.progress.uploadsLocked;
  const sectionPanel = (section: SectionKey, icon: LucideIcon, title: string, description: string, saveLabel: string, extra?: ReactNode) => (
    <SectionCard icon={icon} title={title} description={description}>
      {extra}
      <FieldGrid
        fields={section === 'family'
          ? effectiveSectionFields.family.filter((field) => field.key !== 'spouseName' || form.maritalStatus === 'MARRIED')
          : effectiveSectionFields[section]}
        form={form}
        errors={fieldErrors}
        disabled={profileReadOnly}
        onChange={setField}
      />
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
            <ClientContactCard client={portal.client} />
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
                            <span>
                              {detail.replace(/\s+\(required\)$/, '')}
                              {detail.endsWith(' (required)') && <RequiredMark />}
                            </span>
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
                            {item.label}<RequiredMark />
                          </span>
                          <button type="button" onClick={() => setActiveTab(tabForPending(item, candidateFormConfig.sections.identity.enabled))} className="text-xs font-semibold hover:underline" style={{ color: 'var(--accent)' }}>
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
            {sectionPanel('family', Users, 'Family details', 'Add parent details, select your marital status, and provide your spouse’s name when married. Select the number of children, including zero.', 'Save family details')}
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
                onDeleteDocument={deleteUploadedDocument}
                deletingDocumentId={deletingDocumentId}
                documentRequired={identityConfigFor(item.fieldKey)?.documentRequired}
                readOnly={profileReadOnly}
                uploadReadOnly={uploadReadOnly}
              />
            ))}
            {customFormsFor('IDENTITY').map((form) => (
              <CandidateFormTemplateUpload key={form.id} token={token} accent={accent} form={form} documents={portal.documents} onUploaded={refreshPortal} readOnly={uploadReadOnly} />
            ))}
            {supportingDocumentsSection('IDENTITY')}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <SaveBar bare dirty={dirtyBySection.identity} saving={saving} label="Save ID numbers" onSave={() => saveSection('identity')} readOnly={profileReadOnly} />
            </div>
          </div>
        )}

        {currentTab === 'address' && (
          <div role="tabpanel" id="panel-address" aria-labelledby="tab-address" className="space-y-5">
            {candidateFormConfig.sections.address.enabled && sectionPanel(
              'address',
              MapPin,
              'Current and permanent address',
              'Enter the addresses where you currently live and where you are permanently registered.',
              'Save addresses',
              candidateFormConfig.address.showVerificationLocationSelector
              && (candidateFormConfig.address.currentAddressEnabled || candidateFormConfig.address.permanentAddressEnabled) && (
                <fieldset className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <legend className="px-1 text-sm font-semibold text-slate-800">Which address should be verified?</legend>
                  <p className="mb-3 text-xs text-slate-600">Select one or both locations for address verification.</p>
                  <div className="flex flex-wrap gap-x-6 gap-y-3">
                    {([
                      ['current', 'Current address', candidateFormConfig.address.currentAddressEnabled],
                      ['permanent', 'Permanent address', candidateFormConfig.address.permanentAddressEnabled],
                    ] as const).filter(([, , enabled]) => enabled).map(([location, label]) => (
                      <label key={location} className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                        <input
                          type="checkbox"
                          checked={getAddressVerificationLocations().includes(location)}
                          onChange={(event) => {
                            const selected = new Set((form.addressVerificationLocations ?? '').split(',').filter(Boolean));
                            if (event.target.checked) selected.add(location);
                            else selected.delete(location);
                            setForm((previous) => ({ ...previous, addressVerificationLocations: [...selected].join(',') }));
                          }}
                          disabled={profileReadOnly}
                          className="h-4 w-4 accent-[var(--accent)]"
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </fieldset>
              ),
            )}
            <SectionCard icon={Camera} title="Address verification documents" description="Upload an accepted address proof such as Aadhaar, and a clear GPS-enabled photo of your current address when requested.">
              <div className="mb-4 flex flex-wrap gap-2">
                {addressUploadTypes.map((type) => {
                  const label = CANDIDATE_ADDRESS_DOCUMENT_TYPES.find((item) => item.type === type)?.label ?? humanize(type);
                  return <span key={type} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700">{label}{requiredAddressUploadTypes.includes(type) && <RequiredMark />}</span>;
                })}
              </div>
              {addressUploadTypes.length > 0 ? (
                <AttachmentUploader
                  token={token}
                  title="Upload address documents"
                  description="Choose the requested document type before adding your PDF or image."
                  types={addressUploadTypes}
                  requiredTypes={requiredAddressUploadTypes}
                  requireAnyType={requireAnyAddressDocument}
                  documentCategory="ADDRESS"
                  onUploaded={afterUpload}
                  readOnly={uploadReadOnly}
                />
              ) : <p className="text-sm text-slate-500">This client has not requested address verification documents.</p>}
              <div className="mt-4">
                <h3 className="mb-2 text-sm font-semibold text-slate-900">Uploaded address documents ({addressDocuments.length})</h3>
                <DocumentList documents={addressDocuments} emptyText="No address documents uploaded yet." onDeleteDocument={deleteUploadedDocument} deletingDocumentId={deletingDocumentId} readOnly={uploadReadOnly} />
              </div>
            </SectionCard>
          </div>
        )}

        {currentTab === 'education' && (
          <div role="tabpanel" id="panel-education" aria-labelledby="tab-education" className="space-y-5">
            <SectionCard icon={GraduationCap} title="Qualification" description="Add each qualification separately, up to five records. Attach the matching certificate or marksheet to each record so it can be reviewed with the right qualification.">
              <div className="space-y-4">
                {educationRecords.map((record, index) => {
                  const documents = educationDocuments.filter((document) => document.documentNumber === record.id);
                  return (
                    <section key={record.id} className="rounded-xl border border-slate-200 p-4">
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <div>
                          <h3 className="text-sm font-semibold text-slate-900">{index === 0 ? 'Higher Qualification' : `Education record ${index + 1}`}</h3>
                          <p className="mt-1 text-xs text-slate-500">Enter the qualification as it appears on your certificate.</p>
                        </div>
                        <button type="button" onClick={() => setEducationRecords((previous) => previous.filter((item) => item.id !== record.id))} disabled={profileReadOnly} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50">
                          <Trash2 size={14} aria-hidden="true" /> Remove
                        </button>
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        {educationRecordFields.map((field) => (
                          <Field
                            key={field.key}
                            def={{ ...field, key: `education_${record.id}_${field.key}` }}
                            value={record[field.key as keyof EducationRecord]}
                            error={fieldErrors[`education_${record.id}_${field.key}`]}
                            disabled={profileReadOnly}
                            onChange={(value) => setEducationRecords((previous) => previous.map((item) => (
                              item.id === record.id ? { ...item, [field.key]: field.format ? field.format(value) : value } : item
                            )))}
                          />
                        ))}
                      </div>
                      {educationUploadTypes.length > 0 && <div className="mt-5">
                        <h4 className="mb-2 text-sm font-medium text-slate-700">Certificate or marksheet for this qualification{requiredEducationUploadTypes.includes('EDUCATION_CERTIFICATE') && <RequiredMark />}</h4>
                        <AttachmentUploader
                          variant="inline"
                          token={token}
                          types={educationUploadTypes}
                          requiredTypes={requiredEducationUploadTypes}
                          documentNumber={record.id}
                          documentCategory="EDUCATION"
                          onUploaded={afterUpload}
                          readOnly={uploadReadOnly}
                        />
                        <div className="mt-3">
                          <DocumentList documents={documents} emptyText="No document attached to this education record yet." onDeleteDocument={deleteUploadedDocument} deletingDocumentId={deletingDocumentId} readOnly={uploadReadOnly} />
                        </div>
                      </div>}
                    </section>
                  );
                })}
                {educationRecords.length < 5 && (
                  <button
                    type="button"
                    onClick={() => setEducationRecords((previous) => [...previous, emptyEducationRecord()])}
                    disabled={profileReadOnly}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    <Plus size={16} aria-hidden="true" /> Add education
                  </button>
                )}
                {educationRecords.length > 5 ? (
                  <p role="alert" className="text-xs text-amber-700">
                    {educationRecords.length} saved records exceed the five-record limit. Remove at least {educationRecords.length - 5} before saving changes.
                  </p>
                ) : (
                  <p className="text-xs text-slate-500">{educationRecords.length} of 5 higher education records added. You can save a record before uploading its certificate.</p>
                )}
                <SaveBar dirty={dirtyBySection.education} saving={saving} label="Save education history" onSave={() => saveSection('education')} readOnly={profileReadOnly} />
              </div>
            </SectionCard>
            {educationDocuments.some((document) => !educationRecords.some((record) => record.id === document.documentNumber)) && (
              <SectionCard icon={Paperclip} title="Other education documents" description="Documents uploaded before the education records were added.">
                <DocumentList documents={educationDocuments.filter((document) => !educationRecords.some((record) => record.id === document.documentNumber))} emptyText="No unassigned education documents." onDeleteDocument={deleteUploadedDocument} deletingDocumentId={deletingDocumentId} readOnly={uploadReadOnly} />
              </SectionCard>
            )}
            {customFormsFor('EDUCATION').map((form) => (
              <CandidateFormTemplateUpload key={form.id} token={token} accent={accent} form={form} documents={portal.documents} onUploaded={refreshPortal} readOnly={uploadReadOnly} />
            ))}
          </div>
        )}

        {currentTab === 'employment' && (
          <div role="tabpanel" id="panel-employment" aria-labelledby="tab-employment" className="space-y-5">
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.isFresher === 'true'}
                onChange={(event) => {
                  setForm((previous) => ({
                    ...previous,
                    isFresher: event.target.checked ? 'true' : 'false',
                  }));
                  if (event.target.checked) {
                    setFieldErrors((previous) => Object.fromEntries(
                      Object.entries(previous).filter(([key]) => !key.startsWith('past_')),
                    ));
                  }
                }}
                disabled={profileReadOnly}
                className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent)]"
              />
              <span>
                <span className="block font-semibold text-slate-900">I am a fresher</span>
                <span className="mt-1 block text-xs text-slate-500">Select this if you have no employment history. Past employment details and required employment documents will not be requested.</span>
              </span>
            </label>
            {candidateFormConfig.currentEmploymentEnabled && sectionPanel('employment', BriefcaseBusiness, 'Current employer', 'Add your current employer and role details.', 'Save employment details')}
            {candidateFormConfig.currentEmploymentEnabled && candidateFormConfig.sections.employment.enabled && employmentUploadTypes.length > 0 && (
              <>
                <AttachmentUploader
                  token={token}
                  title="Current employer documents"
                  description={form.isFresher === 'true'
                    ? 'These documents are optional because you indicated that you are a fresher.'
                    : 'Upload the employment document types requested for your current employer.'}
                  types={employmentUploadTypes}
                  requiredTypes={requiredEmploymentTypesFor(0)}
                  requireAnyType={requireAnyEmploymentDocumentFor(0)}
                  documentCategory="EMPLOYMENT"
                  documentNumber={CURRENT_EMPLOYMENT_RECORD_ID}
                  onUploaded={afterUpload}
                  readOnly={uploadReadOnly}
                />
                <div className="px-1">
                  <h3 className="mb-2 text-sm font-semibold text-slate-900">Attached to your current employer ({currentEmployerDocuments.length})</h3>
                  <DocumentList documents={currentEmployerDocuments} emptyText="No document attached to your current employer." onDeleteDocument={deleteUploadedDocument} deletingDocumentId={deletingDocumentId} readOnly={uploadReadOnly} />
                </div>
              </>
            )}
            {candidateFormConfig.sections.employment.enabled && form.isFresher !== 'true' && (
              <SectionCard icon={BriefcaseBusiness} title="Past employers" description="Add your previous employment, starting with your most recent past employer. You can include up to 9 past employers.">
                <div className="space-y-4">
                  {pastEmployments.map((employment, index) => (
                    <div key={employment.id} className="rounded-xl border border-slate-200 p-4">
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <h3 className="text-sm font-semibold text-slate-900">Past employer {index + 1}</h3>
                        {pastEmployments.length > 1 && (
                          <button type="button" onClick={() => setPastEmployments((previous) => previous.filter((_, itemIndex) => itemIndex !== index))} disabled={profileReadOnly} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50">
                            <Trash2 size={14} aria-hidden="true" /> Remove
                          </button>
                        )}
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        {pastEmploymentFields.map((field) => (
                          <Field
                            key={`${index}-${field.key}`}
                            def={{
                              ...field,
                              required: field.key === 'employerName'
                                ? field.required && hasPastEmploymentDetails(employment)
                                  || !pastEmployments.some((record) => record.employerName.trim() !== '') && index === 0
                                : hasPastEmploymentDetails(employment) && field.required,
                              key: `past-${index}-${field.key}`,
                            }}
                            value={employment[field.key as keyof PastEmploymentForm]}
                            error={fieldErrors[`past_${index}_${field.key}`]}
                            disabled={profileReadOnly}
                            onChange={(value) => setPastEmployments((previous) => previous.map((item, itemIndex) => (
                              itemIndex === index ? { ...item, [field.key]: value } : item
                            )))}
                          />
                        ))}
                      </div>
                      {employmentUploadTypes.length > 0 && (
                        <div className="mt-4 border-t border-slate-100 pt-4">
                          {pastEmploymentBaseline.some((record) => record.id === employment.id) ? (
                            <AttachmentUploader
                              token={token}
                              title={`Documents for past employer ${index + 1}`}
                              description="Upload the employment document types requested for this employer."
                              types={employmentUploadTypes}
                              requiredTypes={requiredEmploymentTypesFor(index + 1)}
                              requireAnyType={requireAnyEmploymentDocumentFor(index + 1)}
                              documentCategory="EMPLOYMENT"
                              documentNumber={employment.id}
                              onUploaded={afterUpload}
                              readOnly={uploadReadOnly}
                            />
                          ) : (
                            <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">Save this employer’s details before uploading its documents.</p>
                          )}
                          <div className="mt-3">
                            <p className="mb-2 text-xs font-medium text-slate-500">Attached documents</p>
                            <DocumentList documents={employmentDocuments.filter((document) => document.documentNumber === employment.id)} emptyText="No document attached to this employer." onDeleteDocument={deleteUploadedDocument} deletingDocumentId={deletingDocumentId} readOnly={uploadReadOnly} />
                          </div>
                        </div>
                      )}
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
            {candidateFormConfig.sections.employment.enabled && employmentUploadTypes.length === 0 && (
              <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">This client has not requested employment document uploads.</p>
            )}
            {customFormsFor('EMPLOYMENT').map((form) => (
              <CandidateFormTemplateUpload key={form.id} token={token} accent={accent} form={form} documents={portal.documents} onUploaded={refreshPortal} readOnly={uploadReadOnly} />
            ))}
            {otherEmploymentDocuments.length > 0 && (
              <div className="px-1">
                <h3 className="mb-2 text-sm font-semibold text-slate-900">Other employment documents ({otherEmploymentDocuments.length})</h3>
                <DocumentList documents={otherEmploymentDocuments} emptyText="" onDeleteDocument={deleteUploadedDocument} deletingDocumentId={deletingDocumentId} readOnly={uploadReadOnly} />
              </div>
            )}
            {!candidateFormConfig.currentEmploymentEnabled && (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <SaveBar dirty={dirtyBySection.employment} saving={saving} label="Save employment history" onSave={() => saveSection('employment')} readOnly={profileReadOnly} />
              </div>
            )}
          </div>
        )}

        {currentTab === 'policeVerification' && (
          <div role="tabpanel" id="panel-policeVerification" aria-labelledby="tab-policeVerification" className="space-y-4">
            <div className="px-1">
              <h2 className="text-lg font-semibold">Police verification forms</h2>
              <p className="mt-1 text-sm text-slate-600">Download each client-provided form, complete it and upload the completed copy.</p>
            </div>
            {policeVerificationForms.map((form) => (
              <CandidateFormTemplateUpload key={form.id} token={token} accent={accent} form={form} documents={portal.documents} onUploaded={refreshPortal} readOnly={uploadReadOnly} downloadAvailable={form.enabled} uploadAvailable={form.enabled} />
            ))}
            {policeVerificationForms.length === 0 && <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">No police verification form is currently requested.</p>}
            {supportingDocumentsSection('POLICE_VERIFICATION')}
          </div>
        )}

        {currentTab === 'bgv' && (
          <div role="tabpanel" id="panel-bgv" aria-labelledby="tab-bgv" className="space-y-4">
            <div className="px-1">
              <h2 className="text-lg font-semibold">BGV forms</h2>
              <p className="mt-1 text-sm text-slate-600">Download each form provided by the client, complete it and upload the completed copy.</p>
            </div>
            {bgvForms.map((form) => (
              <CandidateFormTemplateUpload key={form.id} token={token} accent={accent} form={form} documents={portal.documents} onUploaded={refreshPortal} readOnly={uploadReadOnly} downloadAvailable={form.enabled} uploadAvailable={form.enabled} />
            ))}
            {supportingDocumentsSection('BGV')}
          </div>
        )}

        {currentTab === 'cibil' && (
          <div role="tabpanel" id="panel-cibil" aria-labelledby="tab-cibil" className="space-y-4">
            <div className="px-1">
              <h2 className="text-lg font-semibold">CIBIL form</h2>
              <p className="mt-1 text-sm text-slate-600">Download the client-provided CIBIL form, complete it and upload the completed copy. Required forms are marked with a red asterisk.</p>
            </div>
            {customFormsFor('CIBIL').map((form) => (
              <CandidateFormTemplateUpload key={form.id} token={token} accent={accent} form={form} documents={portal.documents} onUploaded={refreshPortal} readOnly={uploadReadOnly} />
            ))}
            {supportingDocumentsSection('CIBIL')}
          </div>
        )}

        {(['reference', 'court', 'world', 'socialMedia'] as const).map((key) => {
          const category = ({
            reference: 'REFERENCE',
            court: 'COURT',
            world: 'WORLD',
            socialMedia: 'SOCIAL_MEDIA',
          } as const)[key];
          const heading = { reference: 'Reference check', court: 'Court check', world: 'World check', socialMedia: 'Social media check' }[key];
          const forms = customFormsFor(category);
          return currentTab === key ? (
            <div key={key} role="tabpanel" id={`panel-${key}`} aria-labelledby={`tab-${key}`} className="space-y-4">
              <div className="px-1">
                <h2 className="text-lg font-semibold">{heading}</h2>
                <p className="mt-1 text-sm text-slate-600">Complete the requested client form and upload it here. Required items must be submitted before consent.</p>
              </div>
              {key === 'court' && (
                <SectionCard icon={MapPin} title="Address proof for court check" description="Court verification requires the same address proof documents as the address check.">
                  <AttachmentUploader
                    token={token}
                    title="Upload address proof"
                    description="Choose one of the enabled address document types configured for this client."
                    types={addressUploadTypes}
                    requiredTypes={requiredAddressUploadTypes}
                    requireAnyType={requireAnyAddressDocument}
                    documentCategory="ADDRESS"
                    onUploaded={afterUpload}
                    readOnly={uploadReadOnly}
                  />
                  <div className="mt-4"><DocumentList documents={addressDocuments} emptyText="No address documents uploaded yet." onDeleteDocument={deleteUploadedDocument} deletingDocumentId={deletingDocumentId} readOnly={uploadReadOnly} /></div>
                </SectionCard>
              )}
              {forms.map((form) => <CandidateFormTemplateUpload key={form.id} token={token} accent={accent} form={form} documents={portal.documents} onUploaded={refreshPortal} readOnly={uploadReadOnly} />)}
              {supportingDocumentsSection(category)}
            </div>
          ) : null;
        })}

        {currentTab === 'otherChecks' && (
          <div role="tabpanel" id="panel-otherChecks" aria-labelledby="tab-otherChecks" className="space-y-4">
            <div className="px-1">
              <h2 className="text-lg font-semibold">Other check forms</h2>
              <p className="mt-1 text-sm text-slate-600">Forms configured for additional checks in this verification case.</p>
            </div>
            {customFormsFor('OTHER_CHECKS').map((form) => (
              <CandidateFormTemplateUpload key={form.id} token={token} accent={accent} form={form} documents={portal.documents} onUploaded={refreshPortal} readOnly={uploadReadOnly} />
            ))}
            {supportingDocumentsSection('OTHER_CHECKS')}
          </div>
        )}

        {currentTab === 'documents' && (
          <div role="tabpanel" id="panel-documents" aria-labelledby="tab-documents" className="space-y-4">
            <div className="px-1">
              <h2 className="text-lg font-semibold">All uploaded documents</h2>
              <p className="mt-1 text-sm text-slate-600">This list includes every document you have uploaded, including identity, address, education, employment and completed forms.</p>
            </div>
            {DOCUMENT_GROUPS.map((group) => (
              <CandidateDocumentUpload key={group.title} token={token} accent={accent} title={group.title} description={group.description} types={group.types} onUploaded={refreshPortal} readOnly={uploadReadOnly} />
            ))}
            {customFormsFor('OTHER').map((form) => (
              <CandidateFormTemplateUpload key={form.id} token={token} accent={accent} form={form} documents={portal.documents} onUploaded={refreshPortal} readOnly={uploadReadOnly} />
            ))}
            <div className="px-1 pt-2">
              <h3 className="mb-2 text-sm font-semibold text-slate-900">Uploaded documents ({portal.documents.length})</h3>
              <DocumentList documents={portal.documents} emptyText="Nothing uploaded yet. Documents you add above will appear here." customForms={customForms} onDeleteDocument={deleteUploadedDocument} deletingDocumentId={deletingDocumentId} readOnly={uploadReadOnly} />
            </div>
          </div>
        )}

        {currentTab === 'consent' && (
          <div role="tabpanel" id="panel-consent" aria-labelledby="tab-consent">
            <div className="mb-5 space-y-5">
              <SectionCard icon={FileCheck} title="Review your information" description="Check every section and uploaded document before you submit. Use the edit buttons to return to a section and correct anything that is missing or inaccurate.">
                <div className="mb-5 flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{anyDirty ? 'You have unsaved changes' : 'Preview is up to date'}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-600">
                      {anyDirty ? 'Save your latest edits to refresh this preview. Consent is unavailable until the changes are saved.' : 'Your saved details and uploaded documents are shown below.'}
                    </p>
                  </div>
                  {anyDirty && (
                    <button type="button" onClick={() => void saveAndPreview()} disabled={saving || profileReadOnly} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50" style={{ backgroundColor: 'var(--accent)' }}>
                      {saving ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Save size={15} aria-hidden="true" />}
                      Save changes and refresh preview
                    </button>
                  )}
                </div>

                <ClientContactCard client={portal.client} />

                <div className="space-y-5">
                  <section>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <h3 className="text-sm font-semibold text-slate-900">Personal and family details</h3>
                      <div className="flex gap-3">
                        <button type="button" onClick={() => setActiveTab('details')} className="text-xs font-semibold hover:underline" style={{ color: 'var(--accent)' }}>Edit details</button>
                        {candidateFormConfig.sections.family.enabled && <button type="button" onClick={() => setActiveTab('family')} className="text-xs font-semibold hover:underline" style={{ color: 'var(--accent)' }}>Edit family</button>}
                      </div>
                    </div>
                    <dl className="grid gap-3 rounded-xl border border-slate-200 p-4 sm:grid-cols-2">
                      {[
                        { label: 'Full name', value: form.fullName, required: true },
                        { label: 'Email address', value: form.email, required: true },
                        { label: 'Mobile number', value: form.phone, required: candidateFormConfig.fields.phone.required },
                        { label: 'Date of birth', value: form.dateOfBirth ? formatDate(form.dateOfBirth) : '', required: candidateFormConfig.fields.dateOfBirth.required },
                        { label: 'Gender', value: form.gender, required: candidateFormConfig.fields.gender.required },
                        { label: "Father's name", value: form.fatherName, required: candidateFormConfig.fields.fatherName.required },
                        { label: "Mother's name", value: form.motherName, required: candidateFormConfig.fields.motherName.required },
                        { label: 'Marital status', value: form.maritalStatus ? humanize(form.maritalStatus) : '', required: candidateFormConfig.fields.maritalStatus.required },
                        ...(form.maritalStatus === 'MARRIED' ? [{ label: 'Husband / spouse name', value: form.spouseName, required: candidateFormConfig.fields.spouseName.required }] : []),
                        { label: 'Number of children', value: form.childrenCount, required: candidateFormConfig.fields.childrenCount.required },
                        { label: 'Current address', value: form.currentAddress, required: candidateFormConfig.address.currentAddressRequired },
                        { label: 'Permanent address', value: form.permanentAddress, required: candidateFormConfig.address.permanentAddressRequired },
                        { label: 'Notes for the verification team', value: form.candidateNotes, required: candidateFormConfig.fields.candidateNotes.required },
                      ].map(({ label, value, required }) => (
                        <div key={label} className="min-w-0">
                          <dt className="text-xs font-medium text-slate-500">{label}{required && <span className="ml-1 font-bold text-red-600" aria-hidden="true">*</span>}</dt>
                          <dd className="mt-1 break-words whitespace-pre-wrap text-sm text-slate-900">{value || 'Not provided'}</dd>
                        </div>
                      ))}
                    </dl>
                  </section>

                  {visibleTabs.some(({ key }) => key === 'identity') && (
                    <section>
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <h3 className="text-sm font-semibold text-slate-900">Identity information</h3>
                        <button type="button" onClick={() => setActiveTab('identity')} className="text-xs font-semibold hover:underline" style={{ color: 'var(--accent)' }}>Edit ID numbers</button>
                      </div>
                      <dl className="grid gap-3 rounded-xl border border-slate-200 p-4 sm:grid-cols-2">
                        {IDENTITY_ITEMS.filter((item) => identityConfigFor(item.fieldKey)?.enabled !== false).map((item) => {
                          const field = FIELD_BY_KEY[item.fieldKey];
                          const config = identityConfigFor(item.fieldKey);
                          const documents = portal.documents.filter((document) => document.documentType === item.docType);
                          return (
                            <div key={item.fieldKey}>
                              <dt className="text-xs font-medium text-slate-500">{field.label}{config?.required && <RequiredMark />}</dt>
                              <dd className="mt-1 break-words text-sm text-slate-900">{form[item.fieldKey] || 'Not provided'}</dd>
                              {config?.documentRequired && (
                                <div className="mt-2">
                                  <dt className="text-xs font-medium text-slate-500">Copy of {field.label}<RequiredMark /></dt>
                                  <dd className="mt-1 break-words text-sm text-slate-900">{documents.map((document) => document.fileName).join(', ') || 'Not uploaded'}</dd>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </dl>
                    </section>
                  )}

                  <section>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <h3 className="text-sm font-semibold text-slate-900">Education</h3>
                      <button type="button" onClick={() => setActiveTab('education')} className="text-xs font-semibold hover:underline" style={{ color: 'var(--accent)' }}>Edit education</button>
                    </div>
                    {educationRecords.length ? (
                      <div className="space-y-3">
                        {educationRecords.map((record, index) => (
                          <div key={record.id} className="rounded-xl border border-slate-200 p-4">
                            <h4 className="mb-3 text-sm font-medium text-slate-800">Education record {index + 1}</h4>
                            <dl className="grid gap-3 sm:grid-cols-2">
                              {educationRecordFields.map((field) => (
                                <div key={field.key}>
                                  <dt className="text-xs font-medium text-slate-500">{field.label}{field.required && <span className="ml-1 font-bold text-red-600" aria-hidden="true">*</span>}</dt>
                                  <dd className="mt-1 break-words text-sm text-slate-900">{record[field.key as keyof EducationRecord] || 'Not provided'}</dd>
                                </div>
                              ))}
                            </dl>
                            <div className="mt-4">
                              <p className="mb-2 text-xs font-medium text-slate-500">Attached documents</p>
                              <DocumentList documents={educationDocuments.filter((document) => document.documentNumber === record.id)} emptyText="No document attached to this record." onDeleteDocument={deleteUploadedDocument} deletingDocumentId={deletingDocumentId} readOnly={uploadReadOnly} />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : <p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">No education records provided.</p>}
                  </section>

                  <section>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <h3 className="text-sm font-semibold text-slate-900">Employment history</h3>
                      <button type="button" onClick={() => setActiveTab('employment')} className="text-xs font-semibold hover:underline" style={{ color: 'var(--accent)' }}>Edit employment</button>
                    </div>
                    {[
                      ...(candidateFormConfig.currentEmploymentEnabled ? [{
                        title: 'Current employer',
                        isCurrent: true,
                        employerName: form.currentEmployer,
                        employeeId: form.employeeId,
                        designation: form.employeeDesignation,
                        department: form.employeeDepartment,
                        employmentType: form.employmentType,
                        startDate: form.joiningDate,
                        endDate: '',
                        workLocation: form.workLocation,
                        employerHrName: form.employerHrName,
                        employerHrPhone: form.employerHrPhone,
                      }] : []),
                      ...(form.isFresher === 'true' ? [] : pastEmployments.filter((record) => hasPastEmploymentDetails(record)
                        || employmentDocuments.some((document) => document.documentNumber === record.id)).map((record, index) => ({
                        ...record,
                        title: `Past employer ${index + 1}`,
                        isCurrent: false,
                      }))),
                    ].map((record, index) => (
                      <dl key={`review-employment-${index}`} className="mb-3 grid gap-3 rounded-xl border border-slate-200 p-4 sm:grid-cols-2">
                        <div className="sm:col-span-2"><h4 className="text-sm font-medium text-slate-800">{record.title}</h4></div>
                        {[
                          { key: 'employerName', label: 'Employer', value: record.employerName, required: !record.isCurrent && form.isFresher !== 'true' && candidateFormConfig.fields.employerName.required },
                          { key: 'employeeId', label: 'Employee ID', value: record.employeeId, required: !record.isCurrent && form.isFresher !== 'true' && candidateFormConfig.fields.employeeId.required },
                          { key: 'designation', label: 'Designation', value: record.designation, required: !record.isCurrent && form.isFresher !== 'true' && candidateFormConfig.fields.designation.required },
                          { key: 'department', label: 'Department', value: record.department, required: !record.isCurrent && form.isFresher !== 'true' && candidateFormConfig.fields.department.required },
                          { key: 'employmentType', label: 'Employment type', value: record.employmentType ? humanize(record.employmentType) : '', required: !record.isCurrent && form.isFresher !== 'true' && candidateFormConfig.fields.employmentType.required },
                          { key: 'startDate', label: 'Start date', value: record.startDate ? formatDate(record.startDate) : '', required: !record.isCurrent && form.isFresher !== 'true' && candidateFormConfig.fields.startDate.required },
                          { key: 'endDate', label: 'End date', value: record.isCurrent || !record.endDate ? '' : formatDate(record.endDate), required: !record.isCurrent && form.isFresher !== 'true' && candidateFormConfig.fields.endDate.required },
                          { key: 'workLocation', label: 'Work location', value: record.workLocation, required: !record.isCurrent && form.isFresher !== 'true' && candidateFormConfig.fields.workLocation.required },
                          { key: 'employerHrName', label: 'Employer HR contact name', value: record.employerHrName, required: !record.isCurrent && form.isFresher !== 'true' && candidateFormConfig.fields.employerHrName.required },
                          { key: 'employerHrPhone', label: 'Employer HR contact number', value: record.employerHrPhone, required: !record.isCurrent && form.isFresher !== 'true' && candidateFormConfig.fields.employerHrPhone.required },
                        ].map(({ key, label, value, required }) => (
                          <div key={key}>
                            <dt className="text-xs font-medium text-slate-500">{label}{required && <span className="ml-1 font-bold text-red-600" aria-hidden="true">*</span>}</dt>
                            <dd className="mt-1 break-words text-sm text-slate-900">{value || 'Not provided'}</dd>
                          </div>
                        ))}
                      </dl>
                    ))}
                  </section>

                  <section>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <h3 className="text-sm font-semibold text-slate-900">Uploaded documents</h3>
                      <button type="button" onClick={() => setActiveTab('documents')} className="text-xs font-semibold hover:underline" style={{ color: 'var(--accent)' }}>View documents</button>
                    </div>
                    <DocumentList documents={portal.documents} emptyText="No documents uploaded yet." customForms={customForms} onDeleteDocument={deleteUploadedDocument} deletingDocumentId={deletingDocumentId} readOnly={uploadReadOnly} />
                  </section>
                </div>
              </SectionCard>
            </div>
            {progress.consentComplete ? (
              <section className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-600" size={20} aria-hidden="true" />
                <div>
                  <h2 className="font-semibold text-emerald-900">Consent recorded</h2>
                  <p className="mt-1 text-sm text-emerald-800">You have authorised the background verification checks. You can continue uploading any outstanding documents; profile details can no longer be edited.</p>
                </div>
              </section>
            ) : portal.case && ['COMPLETED', 'CANCELLED'].includes(portal.case.status) ? (
              <SectionCard icon={ShieldCheck} title="Consent" description="Consent is unavailable for a finalized verification case.">
                <p className="text-sm text-slate-600">This verification case is completed or cancelled. Contact {portal.company.name} if you need help.</p>
              </SectionCard>
            ) : !progress.consentReady ? (
              <SectionCard icon={ShieldCheck} title="Complete required items before consent" description="Consent will be available after all required profile information and documents are submitted.">
                <p className="text-sm leading-6 text-slate-700">
                  Please complete every outstanding item below.
                  {' Required education and employment documents, as well as BGV and police verification (PCC) forms, must be uploaded before consent.'}
                </p>
                {requiredConsentItems.length > 0 ? (
                  <ul className="mt-4 space-y-2">
                    {requiredConsentItems.map((item) => (
                      <li key={item.key} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3">
                        <span className="flex items-center gap-2.5 text-sm text-amber-950">
                          <AlertCircle size={16} className="shrink-0 text-amber-700" aria-hidden="true" />
                          {item.label}
                        </span>
                        <button
                          type="button"
                          onClick={() => setActiveTab(tabForPending(item, candidateFormConfig.sections.identity.enabled))}
                          className="shrink-0 rounded-lg px-3 py-2 text-xs font-semibold text-white"
                          style={{ backgroundColor: 'var(--accent)' }}
                        >
                          {item.type === 'document' ? (item.customFormId ? 'Complete this form' : 'Upload document') : 'Complete this section'}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
                    One or more required profile fields or forms still need attention. Return to the overview checklist and complete every item marked with a red asterisk.
                  </p>
                )}
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
                  <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} disabled={anyDirty} className="mt-0.5 h-4 w-4 shrink-0 accent-amber-700 disabled:opacity-50" />
                  <span>I have read and understood the statement above. I voluntarily agree to the background verification and authorize the use of my information for this purpose.</span>
                </label>
                {anyDirty && <p className="mt-3 text-sm font-medium text-amber-900">Save your changes and review the refreshed preview before you can submit consent.</p>}
                <button type="button" onClick={giveConsent} disabled={!consent || saving || anyDirty} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-amber-700 px-4 py-2.5 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50">
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