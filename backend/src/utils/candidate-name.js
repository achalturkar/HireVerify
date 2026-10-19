'use strict';

const { BadRequestError } = require('./errors');

const normalizeNamePart = (value) => {
  if (value === undefined || value === null) return '';
  return String(value).trim();
};

const validateCandidateName = (name) => {
  const firstName = normalizeNamePart(name.firstName);
  const middleName = normalizeNamePart(name.middleName);
  const lastName = normalizeNamePart(name.lastName);
  const fullName = normalizeNamePart(name.fullName);

  if (firstName.length > 100 || middleName.length > 100 || lastName.length > 100) {
    throw new BadRequestError('First, middle, and last names cannot exceed 100 characters each.');
  }
  if (fullName.length > 255) {
    throw new BadRequestError('Full name cannot exceed 255 characters.');
  }

  return {
    ...name,
    firstName,
    middleName: middleName || null,
    lastName,
    fullName,
  };
};

const splitCandidateName = (value) => {
  const parts = String(value || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) {
    throw new BadRequestError('Enter the candidate’s full name, including first and last name.');
  }

  return validateCandidateName({
    fullName: parts.join(' '),
    firstName: parts[0],
    middleName: parts.length > 2 ? parts.slice(1, -1).join(' ') : null,
    lastName: parts[parts.length - 1],
  });
};

const normalizeCandidateName = (payload, existing) => {
  if (payload.fullName !== undefined) {
    return splitCandidateName(payload.fullName);
  }

  const firstName = payload.firstName === undefined ? existing?.firstName : String(payload.firstName).trim();
  const middleName = payload.middleName === undefined ? existing?.middleName : String(payload.middleName || '').trim() || null;
  const lastName = payload.lastName === undefined ? existing?.lastName : String(payload.lastName).trim();
  if (!firstName || !lastName) {
    throw new BadRequestError('First name and last name are required.');
  }

  const parts = [firstName, middleName, lastName].filter(Boolean);
  return validateCandidateName({ fullName: parts.join(' '), firstName, middleName: middleName || null, lastName });
};

const hasCandidateName = (payload) => ['fullName', 'firstName', 'middleName', 'lastName']
  .some((field) => payload[field] !== undefined);

module.exports = { splitCandidateName, normalizeCandidateName, hasCandidateName };
