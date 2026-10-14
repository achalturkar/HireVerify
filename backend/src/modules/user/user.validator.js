'use strict';

const { body, param, query } = require('express-validator');



const updateProfileValidator = [
  body('firstName').optional().isString().trim().isLength({ min: 1, max: 100 }),
  body('lastName').optional().isString().trim().isLength({ min: 1, max: 100 }),
  body('phone').optional({ nullable: true }).isString().isLength({ max: 50 }),
];

const changePasswordValidator = [
  body('currentPassword').isString().notEmpty(),
  body('newPassword').isString().isLength({ min: 8, max: 128 }),
  body('confirmPassword').isString().isLength({ min: 8, max: 128 }),
];


const createValidator = [
  body('firstName').isString().trim().isLength({ min: 1, max: 100 }),
  body('lastName').isString().trim().isLength({ min: 1, max: 100 }),
  body('email').isEmail().normalizeEmail(),
  body('phone').optional().isString().isLength({ max: 50 }),
  body('roleId').isUUID(),
  body('companyId').optional().isUUID(),
  body('password').optional().isString().isLength({ min: 8, max: 128 }),
];

const updateValidator = [
  param('id').isUUID(),
  body('firstName').optional().isString().trim().isLength({ min: 1, max: 100 }),
  body('lastName').optional().isString().trim().isLength({ min: 1, max: 100 }),
  body('phone').optional().isString().isLength({ max: 50 }),
  body('roleId').optional().isUUID(),
  body('status').optional().isIn(['ACTIVE', 'SUSPENDED', 'INACTIVE']),
];

const idParamValidator = [param('id').isUUID()];

const updateEmailValidator = [
  param('id').isUUID(),
  body('email').isEmail().normalizeEmail(),
];

const listValidator = [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('search').optional().isString(),
  query('status').optional().isIn(['ACTIVE', 'SUSPENDED', 'INACTIVE']),
  query('companyId').optional().isUUID(),
  query('sortBy').optional().isString(),
  query('sortOrder').optional().isIn(['asc', 'desc']),
];

module.exports = {
  createValidator,
  updateValidator,
  idParamValidator,
  updateEmailValidator,
  listValidator,
  updateProfileValidator,
  changePasswordValidator,
};
