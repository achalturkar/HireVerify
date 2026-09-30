'use strict';

const { body, param, query } = require('express-validator');
const validatorLib = require('validator');

// logoUrl comes back from two different places: a user manually pasting an
// external image URL, OR our own service round-tripping the path it just
// wrote to disk (e.g. "/uploads/clients/xxx.png") when a client is edited
// without touching the logo. isURL() alone only accepts the first case —
// rejecting the second meant every edit of an existing client 400'd before
// reaching the controller, even if nothing about the logo changed.
const isLogoUrlValid = (value) => {
  if (typeof value !== 'string') return false;
  if (value.startsWith('/')) return true; // our own storage path
  return validatorLib.isURL(value);
};

/**
 * Create Client Validation
 */
const createValidator = [
  body('companyId')
    .isUUID()
    .withMessage('Valid companyId is required'),

  body('clientCode')
    .trim()
    .notEmpty()
    .isLength({ min: 2, max: 50 }),

  body('name')
    .trim()
    .notEmpty()
    .isLength({ min: 2, max: 255 }),

  body('logoUrl')
    .optional({ checkFalsy: true })
    .custom(isLogoUrlValid)
    .withMessage('logoUrl must be a valid URL'),

  body('website')
    .optional()
    .isURL(),

  body('industry')
    .optional()
    .isLength({ max: 150 }),

  body('contactName')
    .optional()
    .isLength({ max: 150 }),

  body('contactEmail')
    .optional()
    .isEmail()
    .normalizeEmail(),

  body('contactPhone')
    .optional()
    .isLength({ max: 50 }),

  body('gstNumber')
    .optional()
    .isLength({ max: 30 }),

  body('panNumber')
    .optional()
    .isLength({ max: 20 }),

  body('addressLine1')
    .optional()
    .isLength({ max: 500 }),

  body('addressLine2')
    .optional()
    .isLength({ max: 500 }),

  body('city')
    .optional()
    .isLength({ max: 100 }),

  body('state')
    .optional()
    .isLength({ max: 100 }),

  body('country')
    .optional()
    .isLength({ max: 100 }),

  body('postalCode')
    .optional()
    .isLength({ max: 20 }),
];

/**
 * Update Client Validation
 */
const updateValidator = [
  param('id').isUUID(),

  body('clientCode')
    .optional()
    .isLength({ min: 2, max: 50 }),

  body('name')
    .optional()
    .isLength({ min: 2, max: 255 }),

  body('logoUrl')
    .optional({ checkFalsy: true })
    .custom(isLogoUrlValid)
    .withMessage('logoUrl must be a valid URL'),

  body('website')
    .optional({ values: 'falsy' })
    .isURL(),

  body('industry')
    .optional({ values: 'falsy' })
    .isLength({ max: 150 }),

  body('contactName')
    .optional({ values: 'falsy' })
    .isLength({ max: 150 }),

  body('contactEmail')
    .optional({ values: 'falsy' })
    .isEmail()
    .normalizeEmail(),

  body('contactPhone')
    .optional({ values: 'falsy' })
    .isLength({ max: 50 }),

  body('gstNumber')
    .optional({ values: 'falsy' })
    .isLength({ max: 30 }),

  body('panNumber')
    .optional({ values: 'falsy' })
    .isLength({ max: 20 }),

  body('addressLine1')
    .optional({ values: 'falsy' })
    .isLength({ max: 500 }),

  body('addressLine2')
    .optional({ values: 'falsy' })
    .isLength({ max: 500 }),

  body('city')
    .optional({ values: 'falsy' })
    .isLength({ max: 100 }),

  body('state')
    .optional({ values: 'falsy' })
    .isLength({ max: 100 }),

  body('country')
    .optional({ values: 'falsy' })
    .isLength({ max: 100 }),

  body('postalCode')
    .optional({ values: 'falsy' })
    .isLength({ max: 20 }),

  body('status')
    .optional()
    .isIn(['ACTIVE', 'INACTIVE']),
];

/**
 * ID Validation
 */
const idParamValidator = [
  param('id').isUUID(),
];

/**
 * List Validation
 */
const listValidator = [
  query('page')
    .optional()
    .isInt({ min: 1 }),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 500 }),

  query('search')
    .optional()
    .isString(),

  query('status')
    .optional()
    .isIn(['ACTIVE', 'INACTIVE']),

  query('includeDeleted')
    .optional()
    .isBoolean(),

  query('sortBy')
    .optional()
    .isIn([
      'name',
      'clientCode',
      'createdAt',
      'updatedAt',
      'status',
    ]),

  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc']),
];

module.exports = {
  createValidator,
  updateValidator,
  idParamValidator,
  listValidator,
};