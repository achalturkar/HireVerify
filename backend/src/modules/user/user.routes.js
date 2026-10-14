'use strict';

const express = require('express');
const controller = require('./user.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorize, requireRole } = require('../../middleware/authorize.middleware');
const { validate } = require('../../middleware/validate.middleware');
const v = require('./user.validator');

const router = express.Router();
router.use(authenticate);

/**
 * @openapi
 * tags:
 *   - name: Users
 *     description: User management (company-scoped)
 */

/**
 * @openapi
 * /users/me:
 *   get:
 *     tags: [Users]
 *     summary: Get your own profile (no admin permission required)
 *   put:
 *     tags: [Users]
 *     summary: Update your own name/phone (never roleId or status)
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName: { type: string }
 *               lastName: { type: string }
 *               phone: { type: string }
 */
router
  .route('/me')
  .get(controller.getMyProfile)
  .put(validate(v.updateProfileValidator), controller.updateMyProfile);

/**
 * @openapi
 * /users/me/password:
 *   put:
 *     tags: [Users]
 *     summary: Change your own password (no admin permission required)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword, confirmPassword]
 *             properties:
 *               currentPassword: { type: string }
 *               newPassword: { type: string, minLength: 8 }
 *               confirmPassword: { type: string, minLength: 8 }
 */
router.put('/me/password', validate(v.changePasswordValidator), controller.changeMyPassword);

/**
 * @openapi
 * /users:
 *   get:
 *     tags: [Users]
 *     summary: List users
 *   post:
 *     tags: [Users]
 *     summary: Create a user (invite). Assigns role; sends welcome email with credentials.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [firstName, lastName, email, roleId]
 *             properties:
 *               firstName: { type: string }
 *               lastName: { type: string }
 *               email: { type: string, format: email }
 *               phone: { type: string }
 *               roleId: { type: string, format: uuid }
 *               companyId: { type: string, format: uuid, description: "Super Admin only" }
 *               password: { type: string, description: "Optional; if omitted, a strong password is generated" }
 */
router
  .route('/')
  .get(authorize('users.view'), validate(v.listValidator), controller.listUsers)
  .post(authorize('users.create'), validate(v.createValidator), controller.createUser);

/**
 * @openapi
 * /users/{id}:
 *   get:
 *     tags: [Users]
 *     summary: Get user by id
 *   put:
 *     tags: [Users]
 *     summary: Update user
 *   delete:
 *     tags: [Users]
 *     summary: Delete (soft) user
 */
router
  .route('/:id')
  .get(authorize('users.view'), validate(v.idParamValidator), controller.getUser)
  .put(authorize('users.update'), validate(v.updateValidator), controller.updateUser)
  .delete(authorize('users.delete'), validate(v.idParamValidator), controller.deleteUser);

router.put(
  '/:id/email',
  requireRole({ superAdmin: true }),
  validate(v.updateEmailValidator),
  controller.updateCompanyAdminEmail
);

module.exports = router;