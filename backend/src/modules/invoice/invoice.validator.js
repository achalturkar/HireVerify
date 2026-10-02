'use strict';

const { body, param, query } = require('express-validator');

const idParamValidator = [param('id').isUUID()];

const listValidator = [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('search').optional().isString().isLength({ max: 200 }),
  query('companyId').optional().isUUID(),
  query('clientId').optional().isUUID(),
  query('status').optional().isIn(['DRAFT', 'SENT', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'VOID']),
  query('currency').optional().isIn(['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD']),
  query('invoiceDateFrom').optional().isISO8601({ strict: true }),
  query('invoiceDateTo').optional().isISO8601({ strict: true }),
  query('dueDateFrom').optional().isISO8601({ strict: true }),
  query('dueDateTo').optional().isISO8601({ strict: true }),
];

const invoiceBody = [
  body('clientId').isUUID(),
  body('clientAddress').optional({ values: 'falsy' }).isString().trim().isLength({ max: 1000 }),
  body('clientGst').optional({ values: 'falsy' }).isString().trim().isLength({ max: 30 }),
  body('clientPan').optional({ values: 'falsy' }).isString().trim().isLength({ max: 20 }),
  body('clientState').optional({ values: 'falsy' }).isString().trim().isLength({ max: 120 }),
  body('clientEmail').optional({ values: 'falsy' }).isEmail().normalizeEmail(),
  body('clientContactName').optional({ values: 'falsy' }).isString().trim().isLength({ max: 150 }),
  body('clientPhone').optional({ values: 'falsy' }).isString().trim().isLength({ max: 50 }),
  body('invoiceDate').isISO8601({ strict: true }),
  body('dueDate').isISO8601({ strict: true }),
  body('currency').optional().isIn(['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD']),
  body('placeOfSupply').optional({ values: 'falsy' }).isString().trim().isLength({ max: 120 }),
  body('purchaseOrderNumber').optional({ values: 'falsy' }).isString().trim().isLength({ max: 100 }),
  body('notes').optional({ values: 'falsy' }).isString().isLength({ max: 3000 }),
  body('terms').optional({ values: 'falsy' }).isString().isLength({ max: 3000 }),
  body('items').isArray({ min: 1, max: 100 }),
  body('items.*.description').isString().trim().isLength({ min: 1, max: 500 }),
  body('items.*.quantity').isFloat({ gt: 0, max: 100000 }),
  body('items.*.unitPrice').isFloat({ min: 0, max: 100000000 }),
  body('items.*.discountPercent').optional().isFloat({ min: 0, max: 100 }),
  body('items.*.taxPercent').optional().isFloat({ min: 0, max: 100 }),
  body('items.*.caseId').optional({ values: 'falsy' }).isUUID(),
  body('items.*.candidateName').optional({ values: 'falsy' }).isString().trim().isLength({ max: 255 }),
  body('items.*.serviceCode').optional({ values: 'falsy' }).isString().trim().isLength({ max: 30 }),
];

const profileValidator = [
  body('gstNumber').optional({ values: 'falsy' }).isString().trim().isLength({ max: 30 }),
  body('panNumber').optional({ values: 'falsy' }).isString().trim().isLength({ max: 20 }),
  body('country').optional({ values: 'falsy' }).isString().trim().isLength({ max: 120 }),
  body('state').optional({ values: 'falsy' }).isString().trim().isLength({ max: 120 }),
  body('city').optional({ values: 'falsy' }).isString().trim().isLength({ max: 120 }),
  body('postalCode').optional({ values: 'falsy' }).isString().trim().isLength({ max: 20 }),
  body('address').optional({ values: 'falsy' }).isString().trim().isLength({ max: 1000 }),
  body('bankAccountName').optional({ values: 'falsy' }).isString().trim().isLength({ max: 255 }),
  body('bankName').optional({ values: 'falsy' }).isString().trim().isLength({ max: 255 }),
  body('bankAccountNumber').optional({ values: 'falsy' }).isString().trim().isLength({ max: 80 }),
  body('bankIfscCode').optional({ values: 'falsy' }).isString().trim().isLength({ max: 20 }),
  body('bankSwiftCode').optional({ values: 'falsy' }).isString().trim().isLength({ max: 20 }),
  body('bankBranch').optional({ values: 'falsy' }).isString().trim().isLength({ max: 255 }),
  body('upiId').optional({ values: 'falsy' }).isString().trim().isLength({ max: 100 }),
];

const statusValidator = [...idParamValidator, body('status').isIn(['SENT'])];

const emailValidator = [...idParamValidator, body('email').optional().isEmail().normalizeEmail()];

const paymentValidator = [
  ...idParamValidator,
  body('amount').isFloat({ gt: 0, max: 100000000 }),
  body('paymentDate').isISO8601({ strict: true }),
  body('method').optional({ values: 'falsy' }).isIn(['BANK_TRANSFER', 'UPI', 'CARD', 'CASH', 'CHEQUE', 'OTHER']),
  body('reference').optional({ values: 'falsy' }).isString().trim().isLength({ max: 120 }),
  body('notes').optional({ values: 'falsy' }).isString().isLength({ max: 1000 }),
];

module.exports = { idParamValidator, listValidator, invoiceBody, profileValidator, emailValidator, paymentValidator, statusValidator };