import { describe, expect, it } from 'vitest';
import { candidateDocumentTypeLabel, candidatePortalFileUrl, getDisplayableCustomForms } from './candidate-portal-forms';

const forms = [
  { id: 'bgv-required', name: 'BGV form', category: 'BGV', enabled: false, required: true, fileName: 'bgv.pdf' },
  { id: 'bgv-optional', name: 'Optional BGV form', category: 'BGV', enabled: true, required: false, fileName: 'optional.pdf' },
  { id: 'identity', name: 'Identity form', category: 'IDENTITY', enabled: true, required: false, fileName: 'identity.pdf' },
] as const;

describe('displayable custom forms', () => {
  it('labels uploaded custom forms by category instead of OTHER', () => {
    expect(candidateDocumentTypeLabel(
      { documentType: 'OTHER', documentNumber: 'CUSTOM_FORM:bgv-required' },
      [...forms],
    )).toBe('BGV form');
    expect(candidateDocumentTypeLabel(
      { documentType: 'OTHER', documentNumber: 'CUSTOM_FORM:police-form' },
      [{ id: 'police-form', name: 'Police clearance', category: 'POLICE_VERIFICATION', enabled: true, required: false, fileName: 'pcc.pdf' }],
    )).toBe('PCC form');
  });

  it('resolves uploaded document URLs against the API origin', () => {
    expect(candidatePortalFileUrl('/uploads/candidate-form.pdf', '/api/v1')).toBe('/uploads/candidate-form.pdf');
    expect(candidatePortalFileUrl('/uploads/candidate-form.pdf', 'https://api.example.test/api/v1')).toBe('https://api.example.test/uploads/candidate-form.pdf');
    expect(candidatePortalFileUrl('https://files.example.test/candidate-form.pdf')).toBe('https://files.example.test/candidate-form.pdf');
  });

  it('shows all configured BGV forms, including disabled forms', () => {
    const result = getDisplayableCustomForms(
      'BGV',
      [...forms],
    );

    expect(result.map((form) => form.id)).toEqual(['bgv-required', 'bgv-optional']);
  });

  it('shows all configured police verification forms', () => {
    const policeForm = {
      id: 'police-form',
      name: 'Police clearance form',
      category: 'POLICE_VERIFICATION',
      enabled: false,
      required: true,
      fileName: 'police.pdf',
    } as const;

    const result = getDisplayableCustomForms(
      'POLICE_VERIFICATION',
      [policeForm],
    );

    expect(result.map((form) => form.id)).toEqual(['police-form']);
  });
});
