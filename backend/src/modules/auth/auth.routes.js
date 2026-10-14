'use strict';

const express = require('express');
const controller = require('./auth.controller');
const { validate } = require('../../middleware/validate.middleware');
const { authenticate } = require('../../middleware/auth.middleware');
const { authLimiter } = require('../../middleware/rateLimit.middleware');
const { requireRole } = require('../../middleware/authorize.middleware');
const v = require('./auth.validator');

const router = express.Router();

/**
 * @openapi
 * tags:
 *   - name: Auth
 *     description: Authentication endpoints (login, refresh, logout, me, change-password)
 */

/**
 * @openapi
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Login with email and password
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email, example: superadmin@portal.com }
 *               password: { type: string, example: Admin@123 }
 *     responses:
 *       200: { description: Login successful }
 *       401: { description: Invalid credentials }
 */
router.post('/login', authLimiter, validate(v.loginValidator), controller.login);

/**
 * @openapi
 * /auth/impersonation/start:
 *   post:
 *     tags: [Auth]
 *     summary: Start a short-lived, audited company-admin access session
 *     description: Superadmin only. Requires a reason and an active company-admin target. The returned access token expires after 15 minutes and has no refresh token.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [companyId, targetUserId, reason]
 *             properties:
 *               companyId: { type: string, format: uuid }
 *               targetUserId: { type: string, format: uuid }
 *               reason: { type: string, minLength: 10, maxLength: 500 }
 *     responses:
 *       200: { description: Temporary company-admin session created }
 *       403: { description: Superadmin access required }
 *       409: { description: An impersonation session is already active }
 */
router.post(
  '/impersonation/start',
  authenticate,
  requireRole({ superAdmin: true }),
  validate(v.impersonationStartValidator),
  controller.startImpersonation
);

/**
 * @openapi
 * /auth/impersonation/stop:
 *   post:
 *     tags: [Auth]
 *     summary: Revoke the current temporary company-admin session
 *     responses:
 *       200: { description: Temporary company-admin session ended }
 *       401: { description: Session expired or revoked }
 */
router.post('/impersonation/stop', authenticate, controller.stopImpersonation);

/**
 * @openapi
 * /auth/forgot-password:
 *   post:
 *     tags: [Auth]
 *     summary: Request a password reset link
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, format: email, example: user@example.com }
 *     responses:
 *       200: { description: Password reset requested }
 */
router.post('/forgot-password', authLimiter, validate(v.forgotPasswordValidator), controller.forgotPassword);

/**
 * @openapi
 * /auth/reset-password:
 *   post:
 *     tags: [Auth]
 *     summary: Reset password using a reset token
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, newPassword, confirmPassword]
 *             properties:
 *               token: { type: string }
 *               newPassword: { type: string, description: "min 8 chars, 1 upper, 1 lower, 1 digit, 1 special" }
 *               confirmPassword: { type: string }
 *     responses:
 *       200: { description: Password reset successful }
 */
router.post('/reset-password', authLimiter, validate(v.resetPasswordValidator), controller.resetPassword);

/**
 * @openapi
 * /auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Refresh access token (with refresh token rotation)
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken: { type: string }
 *     responses:
 *       200: { description: New token pair issued }
 *       401: { description: Invalid or expired refresh token }
 */
router.post('/refresh', authLimiter, validate(v.refreshValidator), controller.refresh);

/**
 * @openapi
 * /auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Logout — revokes refresh token
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refreshToken: { type: string }
 *     responses:
 *       200: { description: Logged out }
 */
router.post('/logout', validate(v.logoutValidator), controller.logout);

/**
 * @openapi
 * /auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Get current authenticated user (profile + permissions)
 *     responses:
 *       200: { description: Current user }
 *       401: { description: Unauthorized }
 */
router.get('/me', authenticate, controller.me);

/**
 * @openapi
 * /auth/change-password:
 *   post:
 *     tags: [Auth]
 *     summary: Change password (requires current password). Invalidates all sessions.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword]
 *             properties:
 *               currentPassword: { type: string }
 *               newPassword: { type: string, description: "min 8 chars, 1 upper, 1 lower, 1 digit, 1 special" }
 *     responses:
 *       201: { description: Password changed }
 *       401: { description: Incorrect current password }
 */
router.post(
  '/change-password',
  authenticate,
  validate(v.changePasswordValidator),
  controller.changePassword
);

module.exports = router;
