import { describe, expect, it } from 'vitest';
import { candidateDocumentStatusLabel } from './candidate-document-status';

describe('candidate document status labels', () => {
  it('labels a pending document as uploaded', () => {
    expect(candidateDocumentStatusLabel('PENDING')).toBe('Uploaded');
  });

  it('keeps verification outcomes readable', () => {
    expect(candidateDocumentStatusLabel('VERIFIED')).toBe('Verified');
    expect(candidateDocumentStatusLabel('REQUIRES_REVIEW')).toBe('Requires review');
    expect(candidateDocumentStatusLabel('REJECTED')).toBe('Rejected');
  });
});
