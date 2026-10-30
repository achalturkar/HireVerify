import { candidateDocumentTypeLabel } from './candidate-portal-forms';
import type { CandidateCustomForm } from '../types/client';

type DocumentRecord = {
  documentType: string;
  documentNumber?: string | null;
};

type CandidateDocumentContext = {
  client?: { candidateFormConfig?: { customForms?: CandidateCustomForm[] } | null } | null;
  subclient?: { candidateFormConfig?: { customForms?: CandidateCustomForm[] } | null } | null;
  educationHistory?: unknown;
  employmentHistory?: unknown;
  highestQualification?: unknown;
  currentEmployer?: unknown;
};

function records(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
    : [];
}

function configuredForms(candidate: CandidateDocumentContext): CandidateCustomForm[] {
  return candidate.subclient?.candidateFormConfig?.customForms
    ?? candidate.client?.candidateFormConfig?.customForms
    ?? [];
}

export function candidateDocumentDisplayName(document: DocumentRecord, candidate: CandidateDocumentContext): string {
  const customFormLabel = document.documentNumber?.startsWith('CUSTOM_FORM:')
    ? candidateDocumentTypeLabel(document, configuredForms(candidate))
    : null;
  if (customFormLabel && customFormLabel !== 'Other') return customFormLabel;

  const documentTypeLabel = candidateDocumentTypeLabel(document, configuredForms(candidate));
  if (document.documentType === 'OTHER') return 'Other document';
  if (document.documentType === 'EDUCATION_CERTIFICATE') {
    const educationRecord = records(candidate.educationHistory).find((record) => record.id === document.documentNumber)
      ?? (records(candidate.educationHistory).length === 1 ? records(candidate.educationHistory)[0] : null);
    const qualification = educationRecord?.qualification || candidate.highestQualification;
    return qualification ? `${documentTypeLabel} — ${String(qualification)}` : documentTypeLabel;
  }

  const employerRecord = records(candidate.employmentHistory).find((record) => record.id === document.documentNumber);
  const employerName = employerRecord?.employerName
    || (document.documentNumber === 'employment-current' ? candidate.currentEmployer : null);
  const employmentDocumentTypes = new Set([
    'SALARY_SLIP', 'FORM_16', 'EXPERIENCE_LETTER', 'RELIEVING_LETTER', 'OFFER_LETTER',
    'APPOINTMENT_LETTER', 'INCREMENT_LETTER', 'PROMOTION_LETTER', 'PF_STATEMENT',
    'EMPLOYMENT_CONTRACT',
  ]);
  if (employerName && employmentDocumentTypes.has(document.documentType)) {
    return `${documentTypeLabel} — ${String(employerName)}`;
  }
  return documentTypeLabel;
}

export function candidateDocumentReviewLabel(status: string): string {
  const normalized = status.toUpperCase();
  if (normalized === 'PENDING' || normalized === 'REVIEW_PENDING') return 'Uploaded';
  return status.replaceAll('_', ' ').toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase());
}

export function candidateDocumentReviewClass(status: string): string {
  const normalized = status.toUpperCase();
  if (normalized === 'PENDING' || normalized === 'REVIEW_PENDING') return 'bg-emerald-50 text-emerald-700';
  if (normalized === 'REQUIRES_REVIEW') return 'bg-amber-50 text-amber-800';
  if (/(REJECT|FAIL|INVALID)/.test(normalized)) return 'bg-rose-50 text-rose-700';
  if (/(VERIFIED|APPROVED|ACCEPTED|COMPLETED)/.test(normalized)) return 'bg-emerald-50 text-emerald-700';
  return 'bg-[var(--surface-muted)] text-[var(--muted)]';
}

export function isDocumentRejected(status: string): boolean {
  return /(REJECT|FAIL|INVALID)/.test(status.toUpperCase());
}
