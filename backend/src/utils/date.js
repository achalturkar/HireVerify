'use strict';

const { BadRequestError } = require('./errors');

const parseDateValue = (value, fieldName = 'date') => {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) throw new BadRequestError(`${fieldName} must be a valid date.`);
    return value;
  }

  const rawValue = String(value).trim();
  if (!rawValue) return null;

  const isoPattern = /^\d{4}-\d{2}-\d{2}(?:[T\s]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;
  let parsed;
  if (isoPattern.test(rawValue)) {
    const [year, month, day] = rawValue.slice(0, 10).split('-').map(Number);
    const candidate = new Date(`${rawValue.slice(0, 10)}T00:00:00.000Z`);
    if (
      Number.isNaN(candidate.getTime())
      || candidate.getUTCFullYear() !== year
      || candidate.getUTCMonth() !== month - 1
      || candidate.getUTCDate() !== day
    ) {
      throw new BadRequestError(`${fieldName} must be a valid date.`);
    }
    parsed = candidate;
  } else {
    parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) throw new BadRequestError(`${fieldName} must be a valid date.`);
  }

  return parsed;
};

module.exports = { parseDateValue };
