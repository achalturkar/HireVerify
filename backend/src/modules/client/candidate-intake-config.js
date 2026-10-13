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

const DEFAULT_CANDIDATE_FORM_CONFIG = Object.fromEntries(
  IDENTITY_FIELDS.map(({ key }) => [key, { enabled: true, required: false, documentRequired: false }]),
);

const normalizeConfig = (value) => {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return Object.fromEntries(IDENTITY_FIELDS.map(({ key }) => {
    const field = source[key] && typeof source[key] === 'object' ? source[key] : {};
    const enabled = typeof field.enabled === 'boolean' ? field.enabled : true;
    return [key, {
      enabled,
      required: enabled && field.required === true,
      documentRequired: enabled && field.documentRequired === true,
    }];
  }));
};

const validateConfig = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BadRequestError('Candidate form configuration must be an object.');
  }
  const allowedKeys = new Set(IDENTITY_FIELDS.map(({ key }) => key));
  for (const [key, field] of Object.entries(value)) {
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
  return normalizeConfig(value);
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
  DEFAULT_CANDIDATE_FORM_CONFIG,
  normalizeConfig,
  validateConfig,
  normalizeIdentityValue,
  validateIdentityValues,
};
