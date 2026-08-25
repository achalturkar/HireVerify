'use strict';

const { body, param, query } = require('express-validator');

const createValidator = [
  body('name').isString().trim().isLength({ min: 2, max: 255 }),
  body('slug').optional().isString().trim().isLength({ min: 2, max: 255 }),
  body('contactEmail').optional().isEmail().normalizeEmail(),
  body('contactPhone').optional().isString().isLength({ max: 50 }),
  body('logoUrl').optional().isURL(),
  body('signatureUrl').optional().isURL(),
  body('stampUrl').optional().isURL(),
  body('primaryColor').optional().isString().matches(/^#[0-9a-fA-F]{3,6}$/),
  body('address').optional().isString().isLength({ max: 1000 }),
  body('settings').optional().isObject(),

  body('adminFirstName').isString().trim().isLength({ min: 1, max: 100 }),
  body('adminLastName').isString().trim().isLength({ min: 1, max: 100 }),
  body('adminEmail').isEmail().normalizeEmail(),
  body('adminPassword').optional().isString().isLength({ min: 8, max: 128 }),
];
const updateValidator = [
  param('id').isUUID(),
  body('name').optional().isString().trim().isLength({ min: 2, max: 255 }),
  body('shortCode').optional({ values: 'falsy' }).isString().trim().isLength({ min: 2, max: 10 }).matches(/^[A-Za-z0-9]+$/),
  body('slug').optional().isString().trim().isLength({ min: 2, max: 255 }),
  body('contactEmail').optional().isEmail().normalizeEmail(),
  body('contactPhone').optional().isString().isLength({ max: 50 }),
  body('logoUrl').optional().isURL(),
  body('signatureUrl').optional().isURL(),
  body('stampUrl').optional().isURL(),
  body('removeLogo').optional().isBoolean(),
  body('removeSignature').optional().isBoolean(),
  body('removeStamp').optional().isBoolean(),
  body('primaryColor').optional().isString().matches(/^#[0-9a-fA-F]{3,6}$/),
  body('address').optional().isString().isLength({ max: 1000 }),
  body('settings').optional().isObject(),
];

const idParamValidator = [param('id').isUUID()];

const listValidator = [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('search').optional().isString(),
  query('status').optional().isIn(['ACTIVE', 'SUSPENDED', 'INACTIVE']),
  query('includeDeleted').optional().isBoolean(),
  query('sortBy').optional().isString(),
  query('sortOrder').optional().isIn(['asc', 'desc']),
];

module.exports = { createValidator, updateValidator, idParamValidator, listValidator };