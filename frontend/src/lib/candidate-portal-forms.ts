import {
  CANDIDATE_ADDRESS_DOCUMENT_TYPES,
  CANDIDATE_EDUCATION_DOCUMENT_TYPES,
  CANDIDATE_EMPLOYMENT_DOCUMENT_TYPES,
} from '../types/client';
import type { CandidateCustomForm } from '@/src/types/client';

type CandidateFormDocument = { documentNumber?: string | null };

export function candidatePortalFileUrl(fileUrl: string, apiBase = process.env.NEXT_PUBLIC_API ?? ''): string {
  if (/^https?:\/\//i.test(fileUrl)) return fileUrl;
  const fileOrigin = apiBase.replace(/\/api\/v1\/?$/, '');
  return `${fileOrigin}${fileUrl}`;
}

export function getDisplayableCustomForms(
  category: CandidateCustomForm['category'],
  configuredForms: CandidateCustomForm[],
): CandidateCustomForm[] {
  return configuredForms.filter((form) => form.category === category);
}

export function candidateDocumentTypeLabel(
  document: CandidateFormDocument & { documentType: string },
  configuredForms: CandidateCustomForm[],
): string {
  const supportingCategory = document.documentNumber?.startsWith('CHECK_SUPPORTING:')
    ? document.documentNumber.slice('CHECK_SUPPORTING:'.length)
    : null;
  const supportingCategoryLabels: Record<string, string> = {
    IDENTITY: 'Identity supporting document',
    BGV: 'BGV supporting document',
    POLICE_VERIFICATION: 'Police verification supporting document',
    REFERENCE: 'Reference check supporting document',
    COURT: 'Court check supporting document',
    CIBIL: 'CIBIL supporting document',
    WORLD: 'World check supporting document',
    SOCIAL_MEDIA: 'Social media supporting document',
    OTHER_CHECKS: 'Other check supporting document',
  };
  if (supportingCategory && supportingCategoryLabels[supportingCategory]) {
    return supportingCategoryLabels[supportingCategory];
  }

  const formId = document.documentNumber?.startsWith('CUSTOM_FORM:')
    ? document.documentNumber.slice('CUSTOM_FORM:'.length)
    : null;
  const form = formId ? configuredForms.find((item) => item.id === formId) : null;
  if (!form) {
    const configuredDocument = [
      ...CANDIDATE_ADDRESS_DOCUMENT_TYPES,
      ...CANDIDATE_EDUCATION_DOCUMENT_TYPES,
      ...CANDIDATE_EMPLOYMENT_DOCUMENT_TYPES,
    ].find((item) => item.type === document.documentType);
    return configuredDocument?.label
      ?? document.documentType.replaceAll('_', ' ').toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase());
  }
  if (form.category === 'BGV') return 'BGV form';
  if (form.category === 'POLICE_VERIFICATION') return 'PCC form';
  return `${form.name} form`;
}
