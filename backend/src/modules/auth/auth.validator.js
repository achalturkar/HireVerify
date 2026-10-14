'use strict';

const { body } = require('express-validator');

const strongPassword = (field) =>
  body(field)
    .isString()
    .isLength({ min: 8, max: 128 }).withMessage(`${field} must be 8-128 chars`)
    .matches(/[a-z]/).withMessage(`${field} must contain lowercase letter`)
    .matches(/[A-Z]/).withMessage(`${field} must contain uppercase letter`)
    .matches(/\d/).withMessage(`${field} must contain a digit`)
    .matches(/[!@#$%^&*(),.?":{}|<>_\-\[\]\\/]/).withMessage(`${field} must contain a special char`);

const loginValidator = [
  body('email').isEmail().withMessage('Valid email required').normalizeEmail(),
  body('password').isString().isLength({ min: 1 }).withMessage('Password is required'),
];

const refreshValidator = [
  body('refreshToken').isString().isLength({ min: 20 }).withMessage('Refresh token is required'),
];

const forgotPasswordValidator = [
  body('email').isEmail().withMessage('Valid email required').normalizeEmail(),
];

const resetPasswordValidator = [
  body('token').isString().isLength({ min: 1 }).withMessage('Reset token is required'),
  strongPassword('newPassword'),
  body('confirmPassword')
    .isString()
    .custom((value, { req }) => value === req.body.newPassword)
    .withMessage('Passwords must match'),
];

const logoutValidator = [
  body('refreshToken').optional().isString(),
];

const impersonationStartValidator = [
  body('companyId').isUUID().withMessage('Valid company ID required'),
  body('targetUserId').isUUID().withMessage('Valid company admin ID required'),
  body('reason')
    .isString()
    .trim()
    .isLength({ min: 10, max: 500 })
    .withMessage('Reason must be between 10 and 500 characters'),
];

const changePasswordValidator = [
  body('currentPassword').isString().isLength({ min: 1 }).withMessage('Current password is required'),
  strongPassword('newPassword'),
];

module.exports = {
  loginValidator,
  refreshValidator,
  forgotPasswordValidator,
  resetPasswordValidator,
  logoutValidator,
  impersonationStartValidator,
  changePasswordValidator,
  strongPassword,
};
