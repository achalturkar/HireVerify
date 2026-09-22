'use strict';

const path = require('path');
const fs = require('fs/promises');
const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const controller = require('./company.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorize } = require('../../middleware/authorize.middleware');
const { validate } = require('../../middleware/validate.middleware');
const { BadRequestError } = require('../../utils/errors');
const config = require('../../config');
const v = require('./company.validator');

const router = express.Router();
router.use(authenticate);

const ALLOWED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.svg'];
const ALLOWED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
const uploadDir = path.resolve(process.cwd(), config.upload.dir, 'companies');

// 'logo' = company logo, 'signature' = authorized signatory's signature,
// 'stamp' = company seal/stamp.
const IMAGE_FIELDS = ['logo', 'signature', 'stamp'];

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    fs.mkdir(uploadDir, { recursive: true })
      .then(() => cb(null, uploadDir))
      .catch((err) => cb(err));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeExt = ALLOWED_IMAGE_EXTENSIONS.includes(ext) ? ext : '.png';
    cb(null, `${file.fieldname}-${Date.now()}-${uuidv4()}${safeExt}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 1024 * 1024 }, // 1 MB per file
  fileFilter: (req, file, cb) => {
    if (!IMAGE_FIELDS.includes(file.fieldname)) {
      return cb(new BadRequestError(`Unexpected file field: ${file.fieldname}`));
    }
    const ext = path.extname(file.originalname).toLowerCase();
    const isValid = ALLOWED_IMAGE_MIME_TYPES.includes(file.mimetype) && ALLOWED_IMAGE_EXTENSIONS.includes(ext);
    if (!isValid) {
      return cb(new BadRequestError('Only JPG, PNG, WEBP, or SVG images are allowed.'));
    }
    cb(null, true);
  },
});

const uploadCompanyFiles = (req, res, next) => {
  upload.fields([
    { name: 'logo', maxCount: 1 },
    { name: 'signature', maxCount: 1 },
    { name: 'stamp', maxCount: 1 },
  ])(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(new BadRequestError('Each image must be 1 MB or smaller.'));
      }
      return next(new BadRequestError(err.message));
    }
    if (err) return next(err);
    return next();
  });
};

/**
 * @openapi
 * tags:
 *   - name: Companies
 *     description: Company (tenant) management — Super Admin only
 */

/**
 * @openapi
 * /companies:
 *   get:
 *     tags: [Companies]
 *     summary: List companies (with search, pagination, filtering)
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [ACTIVE, SUSPENDED, INACTIVE] }
 *       - in: query
 *         name: includeDeleted
 *         schema: { type: boolean, default: false }
 *     responses:
 *       200: { description: Companies list }
 *   post:
 *     tags: [Companies]
 *     summary: Create a company (also creates Company Admin role + user, sends welcome email)
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [name, adminFirstName, adminLastName, adminEmail]
 *             properties:
 *               name: { type: string }
 *               slug: { type: string }
 *               contactEmail: { type: string, format: email }
 *               contactPhone: { type: string }
 *               logo: { type: string, format: binary }
 *               signature: { type: string, format: binary, description: "Authorized signatory's signature image" }
 *               stamp: { type: string, format: binary, description: "Company seal/stamp image" }
 *               primaryColor: { type: string }
 *               address: { type: string }
 *               settings: { type: object }
 *               adminFirstName: { type: string }
 *               adminLastName: { type: string }
 *               adminEmail: { type: string, format: email }
 *               adminPassword: { type: string, description: "Optional. If omitted, a strong password is generated." }
 *     responses:
 *       201: { description: Company created }
 */
router.get('/analytics', authorize('company.view'), controller.getCompanyAnalytics);

router
  .route('/')
  .get(authorize('company.view'), validate(v.listValidator), controller.listCompanies)
  .post(uploadCompanyFiles, authorize('company.create'), validate(v.createValidator), controller.createCompany);

/**
 * @openapi
 * /companies/{id}:
 *   get:
 *     tags: [Companies]
 *     summary: Get company by id
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *   put:
 *     tags: [Companies]
 *     summary: Update a company
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *   delete:
 *     tags: [Companies]
 *     summary: Soft delete a company
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 */
router
  .route('/:id')
  .get(authorize('company.view'), validate(v.idParamValidator), controller.getCompany)
  .put(uploadCompanyFiles, authorize('company.update'), validate(v.updateValidator), controller.updateCompany)
  .delete(authorize('company.delete'), validate(v.idParamValidator), controller.deleteCompany);

/**
 * @openapi
 * /companies/{id}/stats:
 *   get:
 *     tags: [Companies]
 *     summary: Get company-level dashboard statistics (counts)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Company stats }
 */
router.get('/:id/stats', authorize('company.view'), validate(v.idParamValidator), controller.getCompanyStats);

/**
 * @openapi
 * /companies/{id}/details:
 *   get:
 *     tags: [Companies]
 *     summary: Get company detail information including admin, stats, and audit logs
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Company details }
 */
router.get('/:id/details', authorize('company.view'), validate(v.idParamValidator), controller.getCompanyDetails);

/**
 * @openapi
 * /companies/{id}/suspend:
 *   post:
 *     tags: [Companies]
 *     summary: Suspend a company
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 */
router.post(
  '/:id/suspend',
  authorize('company.suspend'),
  validate(v.idParamValidator),
  controller.suspendCompany
);

/**
 * @openapi
 * /companies/{id}/activate:
 *   post:
 *     tags: [Companies]
 *     summary: Activate a company
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 */
router.post(
  '/:id/activate',
  authorize('company.suspend'),
  validate(v.idParamValidator),
  controller.activateCompany
);

module.exports = router;