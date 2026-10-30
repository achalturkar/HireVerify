'use strict';

const { BadRequestError } = require('../../utils/errors');

const IDENTITY_FIELDS = [
  { key: 'aadhaarNumber', documentType: 'AADHAAR', label: 'Aadhaar', pattern: /^\d{12}$/ },
  { key: 'panNumber', documentType: 'PAN', label: 'PAN', pattern: /^[A-Z]{5}\d{4}[A-Z]$/ },
  { key: 'uanNumber', documentType: 'UAN', label: 'UAN', pattern: /^\d{12}$/ },
  { key: 'passportNumber', documentType: 'PASSPORT', label: 'Passport', pattern: /^[A-PR-WY][1-9]\d{6}$/ },
  { key: 'drivingLicenseNumber', documentType: 'DRIVING_LICENSE', label: 'Driving licence', pattern: /^[A-Z]{2}\d{2}\d{4,11}$/ },
  { key: 'voterIdNumber', documentType: 'VOTER_ID', label: 'Voter ID', pattern: /^[A-Z]{3}\d{7}$/ },
];

const CANDIDATE_FORM_SECTIONS = [
  'family',
  'education',
  'employment',
  'policeVerification',
  'address',
  'identity',
  'bgv',
  'reference',
  'court',
  'cibil',
  'world',
  'socialMedia',
  'otherChecks',
];
const ADDRESS_DOCUMENT_TYPES = [
  'ADDRESS_PROOF',
  'AADHAAR',
  'PASSPORT',
  'DRIVING_LICENSE',
  'VOTER_ID',
  'BANK_STATEMENT',
  'ELECTRICITY_BILL',
  'GAS_BILL',
  'WATER_BILL',
  'INTERNET_BILL',
  'TELEPHONE_BILL',
  'UTILITY_BILL',
  'RENT_AGREEMENT',
  'SALE_DEED',
  'RATION_CARD',
  'BANK_PASSBOOK',
  'CREDIT_CARD_STATEMENT',
  'VEHICLE_REGISTRATION_CERTIFICATE',
  'SOCIETY_MAINTENANCE_BILL',
  'RENT_RECEIPT',
  'AFFIDAVIT',
  'GPS_ADDRESS_PHOTO',
];
const EMPLOYMENT_DOCUMENT_TYPES = [
  'SALARY_SLIP',
  'FORM_16',
  'EXPERIENCE_LETTER',
  'RELIEVING_LETTER',
  'OFFER_LETTER',
  'APPOINTMENT_LETTER',
  'INCREMENT_LETTER',
  'PROMOTION_LETTER',
  'BANK_STATEMENT',
  'PF_STATEMENT',
  'EMPLOYMENT_CONTRACT',
  'RESIGNATION_ACCEPTANCE',
  'FULL_FINAL_SETTLEMENT',
  'INTERNSHIP_EXPERIENCE_LETTER',
  'INTERNSHIP_OFFER_LETTER',
  'ARTICLESHIP_DOCUMENT',
  'FREELANCER_INVOICE',
  'CONTRACT_COMPLETION_LETTER',
  'TERMINATION_LETTER',
  'OTHER',
];
const EDUCATION_DOCUMENT_TYPES = [
  'EDUCATION_CERTIFICATE',
  'DEGREE_CERTIFICATE',
  'DEGREE_FINAL_YEAR_MARKSHEET',
  'ALL_YEAR_MARKSHEETS',
  'CONSOLIDATED_MARKSHEET',
  'PROVISIONAL_CERTIFICATE',
  'FINAL_YEAR_MARKSHEET',
  'ONLINE_RESULT_DOCUMENT',
];
const CUSTOM_FORM_CATEGORIES = ['BGV', 'IDENTITY', 'EDUCATION', 'EMPLOYMENT', 'POLICE_VERIFICATION', 'REFERENCE', 'COURT', 'CIBIL', 'WORLD', 'SOCIAL_MEDIA', 'OTHER_CHECKS', 'OTHER'];
const CANDIDATE_FORM_REQUIRED_FIELDS = {
  phone: true,
  dateOfBirth: true,
  gender: false,
  candidateNotes: false,
  fatherName: false,
  motherName: false,
  maritalStatus: false,
  spouseName: false,
  childrenCount: false,
  qualification: false,
  courseName: false,
  institutionName: false,
  universityName: false,
  yearOfPassing: false,
  gradeOrPercentage: false,
  employerName: false,
  employeeId: false,
  designation: false,
  department: false,
  employmentType: false,
  startDate: false,
  endDate: false,
  workLocation: false,
  employerHrName: false,
  employerHrPhone: false,
};
const DEFAULT_SECTION_CONFIG = Object.fromEntries(
  CANDIDATE_FORM_SECTIONS.map((key) => [key, { enabled: key !== 'policeVerification' }]),
);
const DEFAULT_CANDIDATE_FORM_CONFIG = Object.fromEntries(
  IDENTITY_FIELDS.map(({ key }) => [key, { enabled: true, required: false, documentRequired: false }]),
);
DEFAULT_CANDIDATE_FORM_CONFIG.sections = DEFAULT_SECTION_CONFIG;
DEFAULT_CANDIDATE_FORM_CONFIG.address = {
  showVerificationLocationSelector: false,
  currentAddressEnabled: true,
  currentAddressRequired: true,
  permanentAddressEnabled: true,
  permanentAddressRequired: false,
  requireAnyDocument: false,
  documents: ADDRESS_DOCUMENT_TYPES.map((type) => ({ type, enabled: true, required: false })),
};
DEFAULT_CANDIDATE_FORM_CONFIG.customForms = [];
DEFAULT_CANDIDATE_FORM_CONFIG.employmentDocuments = EMPLOYMENT_DOCUMENT_TYPES.map((type) => ({
  type,
  enabled: true,
  required: false,
}));
DEFAULT_CANDIDATE_FORM_CONFIG.currentEmploymentEnabled = true;
DEFAULT_CANDIDATE_FORM_CONFIG.requireEmploymentDocumentPerEmployer = false;
DEFAULT_CANDIDATE_FORM_CONFIG.requiredEmploymentEmployerCount = 3;
DEFAULT_CANDIDATE_FORM_CONFIG.includeCurrentEmployerInDocumentRequirements = true;
DEFAULT_CANDIDATE_FORM_CONFIG.educationDocuments = EDUCATION_DOCUMENT_TYPES.map((type) => ({
  type,
  enabled: true,
  required: false,
}));
DEFAULT_CANDIDATE_FORM_CONFIG.fields = Object.fromEntries(
  Object.entries(CANDIDATE_FORM_REQUIRED_FIELDS).map(([key, required]) => [key, { required }]),
);
const normalizeConfig = (value) => {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const invitationExpiryDays = Number.isInteger(source.invitationExpiryDays)
    && source.invitationExpiryDays >= 1
    && source.invitationExpiryDays <= 30
    ? source.invitationExpiryDays
    : 2;
  const sourceFields = source.fields && typeof source.fields === 'object' && !Array.isArray(source.fields)
    ? source.fields
    : {};
  const fields = Object.fromEntries(Object.entries(CANDIDATE_FORM_REQUIRED_FIELDS).map(([key, defaultRequired]) => {
    const field = sourceFields[key] && typeof sourceFields[key] === 'object' ? sourceFields[key] : {};
    return [key, { required: typeof field.required === 'boolean' ? field.required : defaultRequired }];
  }));
  const identities = Object.fromEntries(IDENTITY_FIELDS.map(({ key }) => {
    const field = source[key] && typeof source[key] === 'object' ? source[key] : {};
    const enabled = typeof field.enabled === 'boolean' ? field.enabled : true;
    return [key, {
      enabled,
      required: enabled && field.required === true,
      documentRequired: enabled && field.documentRequired === true,
    }];
  }));
  const sourceSections = source.sections && typeof source.sections === 'object' && !Array.isArray(source.sections)
    ? source.sections
    : {};
  const sections = Object.fromEntries(CANDIDATE_FORM_SECTIONS.map((key) => {
    const section = sourceSections[key] && typeof sourceSections[key] === 'object' ? sourceSections[key] : {};
    return [key, { enabled: typeof section.enabled === 'boolean' ? section.enabled : DEFAULT_SECTION_CONFIG[key].enabled }];
  }));
  const customForms = Array.isArray(source.customForms)
    ? source.customForms.filter((form) => form && typeof form === 'object' && !Array.isArray(form)).map((form) => ({
      id: form.id,
      name: form.name,
      category: form.category,
      enabled: form.enabled !== false,
      required: form.enabled !== false && form.required === true,
      fileName: form.fileName,
    }))
    : [];
  const sourceEmploymentDocuments = Array.isArray(source.employmentDocuments) ? source.employmentDocuments : [];
  const employmentDocuments = EMPLOYMENT_DOCUMENT_TYPES.map((type) => {
    const document = sourceEmploymentDocuments.find((item) => item && item.type === type);
    const enabled = document ? document.enabled === true : true;
    return { type, enabled, required: enabled && document?.required === true };
  });
  const requireEmploymentDocumentPerEmployer = source.requireEmploymentDocumentPerEmployer === true;
  const currentEmploymentEnabled = source.currentEmploymentEnabled !== false;
  const requiredEmploymentEmployerCount = Number.isInteger(source.requiredEmploymentEmployerCount)
    && source.requiredEmploymentEmployerCount >= 1
    && source.requiredEmploymentEmployerCount <= 10
    ? source.requiredEmploymentEmployerCount
    : 3;
  const includeCurrentEmployerInDocumentRequirements = source.includeCurrentEmployerInDocumentRequirements !== false;
  const sourceEducationDocuments = Array.isArray(source.educationDocuments) ? source.educationDocuments : [];
  const educationDocuments = EDUCATION_DOCUMENT_TYPES.map((type) => {
    const document = sourceEducationDocuments.find((item) => item && item.type === type);
    const enabled = document ? document.enabled === true : true;
    return { type, enabled, required: enabled && document?.required === true };
  });
  const sourceAddress = source.address && typeof source.address === 'object' && !Array.isArray(source.address) ? source.address : {};
  const sourceAddressDocuments = Array.isArray(sourceAddress.documents) ? sourceAddress.documents : [];
  const address = {
    showVerificationLocationSelector: sourceAddress.showVerificationLocationSelector === true,
    currentAddressEnabled: sourceAddress.currentAddressEnabled !== false,
    currentAddressRequired: sourceAddress.currentAddressEnabled !== false && sourceAddress.currentAddressRequired !== false,
    permanentAddressEnabled: sourceAddress.permanentAddressEnabled !== false,
    permanentAddressRequired: sourceAddress.permanentAddressEnabled !== false && sourceAddress.permanentAddressRequired === true,
    requireAnyDocument: sourceAddress.requireAnyDocument === true,
    documents: ADDRESS_DOCUMENT_TYPES.map((type) => {
      const document = sourceAddressDocuments.find((item) => item && item.type === type);
      const enabled = document ? document.enabled === true : true;
      return { type, enabled, required: enabled && document?.required === true };
    }),
  };
  return {
    ...identities,
    invitationExpiryDays,
    fields,
    sections,
    address,
    customForms,
    employmentDocuments,
    currentEmploymentEnabled,
    requireEmploymentDocumentPerEmployer,
    requiredEmploymentEmployerCount,
    includeCurrentEmployerInDocumentRequirements,
    educationDocuments,
  };
};

const validateConfig = (value, clientId) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BadRequestError('Candidate form configuration must be an object.');
  }
  const allowedKeys = new Set([...IDENTITY_FIELDS.map(({ key }) => key), 'invitationExpiryDays', 'fields', 'sections', 'address', 'customForms', 'employmentDocuments', 'currentEmploymentEnabled', 'requireEmploymentDocumentPerEmployer', 'requiredEmploymentEmployerCount', 'includeCurrentEmployerInDocumentRequirements', 'educationDocuments']);
  for (const [key, field] of Object.entries(value)) {
    if (key === 'invitationExpiryDays') {
      if (!Number.isInteger(field) || field < 1 || field > 30) {
        throw new BadRequestError('Candidate portal link validity must be a whole number from 1 to 30 days.');
      }
      continue;
    }
    if (key === 'requireEmploymentDocumentPerEmployer') {
      if (typeof field !== 'boolean') {
        throw new BadRequestError('The legacy employment document requirement setting must be a boolean.');
      }
      continue;
    }
    if (key === 'currentEmploymentEnabled') {
      if (typeof field !== 'boolean') {
        throw new BadRequestError('Current employment visibility setting must be a boolean.');
      }
      continue;
    }
    if (key === 'requiredEmploymentEmployerCount') {
      if (!Number.isInteger(field) || field < 1 || field > 10) {
        throw new BadRequestError('The number of employers requiring documents must be a whole number from 1 to 10.');
      }
      continue;
    }
    if (key === 'includeCurrentEmployerInDocumentRequirements') {
      if (typeof field !== 'boolean') {
        throw new BadRequestError('The current employer document requirement setting must be a boolean.');
      }
      continue;
    }
    if (key === 'sections') {
      if (!field || typeof field !== 'object' || Array.isArray(field)) {
        throw new BadRequestError('Candidate form sections must be an object.');
      }
      for (const [sectionKey, section] of Object.entries(field)) {
        if (!CANDIDATE_FORM_SECTIONS.includes(sectionKey) || !section || typeof section !== 'object' || Array.isArray(section)
          || Object.keys(section).some((property) => property !== 'enabled' || typeof section[property] !== 'boolean')) {
          throw new BadRequestError(`Invalid candidate form section: ${sectionKey}.`);
        }
      }
      continue;
    }
    if (key === 'fields') {
      if (!field || typeof field !== 'object' || Array.isArray(field)) {
        throw new BadRequestError('Candidate field requirements must be an object.');
      }
      for (const [fieldKey, requirement] of Object.entries(field)) {
        if (!Object.prototype.hasOwnProperty.call(CANDIDATE_FORM_REQUIRED_FIELDS, fieldKey)
          || !requirement || typeof requirement !== 'object' || Array.isArray(requirement)
          || typeof requirement.required !== 'boolean'
          || Object.keys(requirement).some((property) => property !== 'required')) {
          throw new BadRequestError(`Invalid required setting for candidate field: ${fieldKey}.`);
        }
      }
      continue;
    }
    if (key === 'address') {
      if (!field || typeof field !== 'object' || Array.isArray(field)) {
        throw new BadRequestError('Candidate address settings must be an object.');
      }
      const allowedAddressKeys = new Set(['showVerificationLocationSelector', 'currentAddressEnabled', 'currentAddressRequired', 'permanentAddressEnabled', 'permanentAddressRequired', 'requireAnyDocument', 'documents']);
      for (const property of Object.keys(field)) {
        if (!allowedAddressKeys.has(property)) throw new BadRequestError(`Invalid candidate address setting: ${property}.`);
      }
      for (const property of ['showVerificationLocationSelector', 'currentAddressEnabled', 'currentAddressRequired', 'permanentAddressEnabled', 'permanentAddressRequired', 'requireAnyDocument']) {
        if (field[property] !== undefined && typeof field[property] !== 'boolean') {
          throw new BadRequestError(`Invalid ${property} setting for candidate address.`);
        }
      }
      if ((field.currentAddressRequired && field.currentAddressEnabled === false)
        || (field.permanentAddressRequired && field.permanentAddressEnabled === false)) {
        throw new BadRequestError('A required address field must be enabled.');
      }
      if (field.documents !== undefined) {
        if (!Array.isArray(field.documents) || field.documents.length !== ADDRESS_DOCUMENT_TYPES.length) {
          throw new BadRequestError('Address document settings are invalid.');
        }
        const types = new Set();
        for (const document of field.documents) {
          if (!document || typeof document !== 'object' || Array.isArray(document)
            || !ADDRESS_DOCUMENT_TYPES.includes(document.type)
            || typeof document.enabled !== 'boolean' || typeof document.required !== 'boolean'
            || (document.required && !document.enabled)
            || Object.keys(document).some((property) => !['type', 'enabled', 'required'].includes(property))) {
            throw new BadRequestError('An address document setting is invalid.');
          }
          if (types.has(document.type)) throw new BadRequestError('Address document types must be unique.');
          types.add(document.type);
        }
      }
      continue;
    }
    if (key === 'customForms') {
      if (!Array.isArray(field) || field.length > 20) {
        throw new BadRequestError('Candidate form templates must be an array with at most 20 items.');
      }
      const ids = new Set();
      for (const form of field) {
        if (!form || typeof form !== 'object' || Array.isArray(form)
          || !/^[0-9a-f-]{36}$/i.test(form.id || '')
          || typeof form.name !== 'string' || !form.name.trim() || form.name.trim().length > 100
          || !CUSTOM_FORM_CATEGORIES.includes(form.category)
          || typeof form.enabled !== 'boolean' || typeof form.required !== 'boolean'
          || typeof form.fileName !== 'string' || !form.fileName.trim() || form.fileName.length > 255 || /[\u0000-\u001f\u007f]/.test(form.fileName)
          || !/\.(pdf|doc|docx)$/i.test(form.fileName)
          || Object.keys(form).some((property) => !['id', 'name', 'category', 'enabled', 'required', 'fileName', 'fileUrl'].includes(property))
          || (form.fileUrl !== undefined && (
            !clientId
            || typeof form.fileUrl !== 'string'
            || !new RegExp(`^/uploads/clients/${clientId}/candidate-forms/[0-9a-f-]{36}\\.pdf$`, 'i').test(form.fileUrl)
          ))) {
          throw new BadRequestError('A candidate form template has invalid details.');
        }
        if (ids.has(form.id)) throw new BadRequestError('Candidate form template IDs must be unique.');
        if (form.required && !form.enabled) throw new BadRequestError(`${form.name} must be enabled when it is required.`);
        ids.add(form.id);
      }
      continue;
    }
    if (key === 'employmentDocuments') {
      if (!Array.isArray(field) || field.length !== EMPLOYMENT_DOCUMENT_TYPES.length) {
        throw new BadRequestError('Employment document settings are invalid.');
      }
      const types = new Set();
      for (const document of field) {
        if (!document || typeof document !== 'object' || Array.isArray(document)
          || !EMPLOYMENT_DOCUMENT_TYPES.includes(document.type)
          || typeof document.enabled !== 'boolean'
          || (document.required !== undefined && typeof document.required !== 'boolean')
          || (document.required === true && !document.enabled)
          || Object.keys(document).some((property) => !['type', 'enabled', 'required'].includes(property))) {
          throw new BadRequestError('An employment document setting is invalid.');
        }
        if (types.has(document.type)) throw new BadRequestError('Employment document types must be unique.');
        types.add(document.type);
      }
      continue;
    }
    if (key === 'educationDocuments') {
      if (!Array.isArray(field) || field.length !== EDUCATION_DOCUMENT_TYPES.length) {
        throw new BadRequestError('Education document settings are invalid.');
      }
      const types = new Set();
      for (const document of field) {
        if (!document || typeof document !== 'object' || Array.isArray(document)
          || !EDUCATION_DOCUMENT_TYPES.includes(document.type)
          || typeof document.enabled !== 'boolean' || typeof document.required !== 'boolean'
          || (document.required && !document.enabled)
          || Object.keys(document).some((property) => !['type', 'enabled', 'required'].includes(property))) {
          throw new BadRequestError('An education document setting is invalid.');
        }
        if (types.has(document.type)) throw new BadRequestError('Education document types must be unique.');
        types.add(document.type);
      }
      continue;
    }
    if (!allowedKeys.has(key) || !field || typeof field !== 'object' || Array.isArray(field)) {
      throw new BadRequestError(`Candidate form configuration contains an unsupported field: ${key}.`);
    }
    for (const property of Object.keys(field)) {
      if (!['enabled', 'required', 'documentRequired'].includes(property) || typeof field[property] !== 'boolean') {
        throw new BadRequestError(`Invalid ${property} setting for ${key}.`);
      }
    }
    if ((field.required || field.documentRequired) && field.enabled === false) {
      throw new BadRequestError(`${key} must be enabled when it is required.`);
    }
  }
  const normalized = normalizeConfig(value);
  if (normalized.requireEmploymentDocumentPerEmployer && !normalized.employmentDocuments.some((document) => document.enabled)) {
    throw new BadRequestError('Enable at least one employment document type before requiring one document per employer.');
  }
  if (normalized.address.requireAnyDocument
    && (!normalized.sections.address.enabled || !normalized.address.documents.some((document) => document.enabled))) {
    throw new BadRequestError('Enable the address section and at least one address document type before requiring an address document.');
  }
  for (const form of normalized.customForms) {
    if (!/^[0-9a-f-]{36}$/i.test(form.id || '')
      || typeof form.name !== 'string' || !form.name.trim() || form.name.trim().length > 100
      || !CUSTOM_FORM_CATEGORIES.includes(form.category)
      || typeof form.enabled !== 'boolean' || typeof form.required !== 'boolean'
      || typeof form.fileName !== 'string' || !form.fileName.trim() || form.fileName.length > 255 || /[\u0000-\u001f\u007f]/.test(form.fileName)
      || !/\.(pdf|doc|docx)$/i.test(form.fileName)) {
      throw new BadRequestError('A candidate form template has invalid details.');
    }
  }
  return normalized;
};

const normalizeIdentityValue = (key, value) => {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  if (key === 'aadhaarNumber' || key === 'uanNumber') return raw.replace(/\D/g, '');
  if (key === 'drivingLicenseNumber') return raw.toUpperCase().replace(/[\s-]/g, '');
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
};

const validateIdentityValues = (values) => {
  for (const field of IDENTITY_FIELDS) {
    if (values[field.key] === undefined || values[field.key] === null || values[field.key] === '') continue;
    const normalized = normalizeIdentityValue(field.key, values[field.key]);
    if (!field.pattern.test(normalized)) {
      throw new BadRequestError(`${field.label} number is invalid.`);
    }
  }
};

module.exports = {
  IDENTITY_FIELDS,
  CANDIDATE_FORM_SECTIONS,
  EMPLOYMENT_DOCUMENT_TYPES,
  EDUCATION_DOCUMENT_TYPES,
  CANDIDATE_FORM_REQUIRED_FIELDS,
  CUSTOM_FORM_CATEGORIES,
  ADDRESS_DOCUMENT_TYPES,
  DEFAULT_CANDIDATE_FORM_CONFIG,
  normalizeConfig,
  validateConfig,
  normalizeIdentityValue,
  validateIdentityValues,
};
