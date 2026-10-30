import { describe, expect, it } from 'vitest';
import { candidateDocumentDisplayName, candidateDocumentReviewClass, candidateDocumentReviewLabel, isDocumentRejected } from './candidate-document-display';
import type { CandidateCustomForm } from '../types/client';

const customForms: CandidateCustomForm[] = [
  { id: 'bgv', name: 'Background verification', category: 'BGV', enabled: true, required: true, fileName: 'bgv.pdf' },
  { id: 'pcc', name: 'Police clearance', category: 'POLICE_VERIFICATION', enabled: true, required: true, fileName: 'pcc.pdf' },
];
const candidate = {
  client: { candidateFormConfig: { customForms } },
  educationHistory: [{ id: 'education-1', qualification: 'Bachelor of Commerce' }],
  employmentHistory: [{ id: 'employer-1', employerName: 'Acme Services' }],
};

describe('candidate document display', () => {
  it('uses configured names for BGV and PCC form uploads', () => {
    expect(candidateDocumentDisplayName(
      { documentType: 'OTHER', documentNumber: 'CUSTOM_FORM:bgv' },
      candidate,
    )).toBe('BGV form');
    expect(candidateDocumentDisplayName(
      { documentType: 'OTHER', documentNumber: 'CUSTOM_FORM:pcc' },
      candidate,
    )).toBe('PCC form');
    expect(candidateDocumentDisplayName({ documentType: 'OTHER' }, candidate)).toBe('Other document');
  });

  it('labels supporting documents by verification check', () => {
    expect(candidateDocumentDisplayName(
      { documentType: 'OTHER', documentNumber: 'CHECK_SUPPORTING:CIBIL' },
      candidate,
    )).toBe('CIBIL supporting document');
    expect(candidateDocumentDisplayName(
      { documentType: 'OTHER', documentNumber: 'CHECK_SUPPORTING:REFERENCE' },
      candidate,
    )).toBe('Reference check supporting document');
  });

  it('adds the employer or qualification to related documents', () => {
    expect(candidateDocumentDisplayName(
      { documentType: 'SALARY_SLIP', documentNumber: 'employer-1' },
      candidate,
    )).toBe('Salary slip — Acme Services');
    expect(candidateDocumentDisplayName(
      { documentType: 'EDUCATION_CERTIFICATE', documentNumber: 'education-1' },
      candidate,
    )).toBe('Education certificate — Bachelor of Commerce');
  });

  it('distinguishes an uploaded file from its review status', () => {
    expect(isDocumentRejected('REJECTED')).toBe(true);
    expect(isDocumentRejected('VERIFIED')).toBe(false);
    expect(candidateDocumentReviewLabel('PENDING')).toBe('Uploaded');
    expect(candidateDocumentReviewLabel('VERIFIED')).toBe('Verified');
    expect(candidateDocumentReviewClass('PENDING')).toContain('text-emerald');
    expect(candidateDocumentReviewClass('REJECTED')).toContain('text-rose');
  });
});
