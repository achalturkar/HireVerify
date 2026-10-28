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
  const formId = document.documentNumber?.startsWith('CUSTOM_FORM:')
    ? document.documentNumber.slice('CUSTOM_FORM:'.length)
    : null;
  const form = formId ? configuredForms.find((item) => item.id === formId) : null;
  if (!form) return document.documentType.replaceAll('_', ' ').toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase());
  if (form.category === 'BGV') return 'BGV form';
  if (form.category === 'POLICE_VERIFICATION') return 'PCC form';
  return `${form.name} form`;
}
