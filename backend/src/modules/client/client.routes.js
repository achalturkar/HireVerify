'use strict';

const path = require('path');
const fs = require('fs/promises');
const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

const controller = require('./client.controller');

const { authenticate } = require('../../middleware/auth.middleware');
const { authorize } = require('../../middleware/authorize.middleware');
const { validate } = require('../../middleware/validate.middleware');
const { BadRequestError } = require('../../utils/errors');
const config = require('../../config');

const v = require('./client.validator');

const router = express.Router();

router.use(authenticate);

const ALLOWED_LOGO_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.svg'];
const ALLOWED_LOGO_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
const uploadDir = path.resolve(process.cwd(), config.upload.dir, 'clients');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    fs.mkdir(uploadDir, { recursive: true })
      .then(() => cb(null, uploadDir))
      .catch((err) => cb(err));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeExt = ALLOWED_LOGO_EXTENSIONS.includes(ext) ? ext : '.png';
    cb(null, `${Date.now()}-${uuidv4()}${safeExt}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const isValid = ALLOWED_LOGO_MIME_TYPES.includes(file.mimetype) && ALLOWED_LOGO_EXTENSIONS.includes(ext);
    if (!isValid) {
      return cb(new BadRequestError('Only JPG, PNG, WEBP, or SVG logo images are allowed.'));
    }
    cb(null, true);
  },
});

const uploadClientLogo = (req, res, next) => {
  upload.single('logo')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(new BadRequestError('Logo image must be 1 MB or smaller.'));
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
 *   - name: Clients
 *     description: Client Management
 */

/**
 * @openapi
 * /clients:
 *   get:
 *     tags: [Clients]
 *     summary: List Clients
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum:
 *             - ACTIVE
 *             - INACTIVE
 *       - in: query
 *         name: includeDeleted
 *         schema:
 *           type: boolean
 *
 *   post:
 *     tags: [Clients]
 *     summary: Create Client
 */

router
    .route('/')
    .get(
        authorize('client.view'),
        validate(v.listValidator),
        controller.listClients
    )
    .post(
        uploadClientLogo,
        authorize('client.create'),
        validate(v.createValidator),
        controller.createClient
    );

/**
 * @openapi
 * /clients/{id}:
 *   get:
 *     tags: [Clients]
 *     summary: Get Client
 *
 *   put:
 *     tags: [Clients]
 *     summary: Update Client
 *
 *   delete:
 *     tags: [Clients]
 *     summary: Delete Client
 */

router
    .route('/:id')
    .get(
        authorize('client.view'),
        validate(v.idParamValidator),
        controller.getClient
    )
    .put(
        uploadClientLogo,
        authorize('client.update'),
        validate(v.updateValidator),
        controller.updateClient
    )
    .delete(
        authorize('client.delete'),
        validate(v.idParamValidator),
        controller.deleteClient
    );

/**
 * @openapi
 * /clients/{id}/activate:
 *   post:
 *     tags: [Clients]
 *     summary: Activate Client
 */

router.post(
    '/:id/activate',
    authorize('client.update'),
    validate(v.idParamValidator),
    controller.activateClient
);

/**
 * @openapi
 * /clients/{id}/inactivate:
 *   post:
 *     tags: [Clients]
 *     summary: Inactivate Client
 */

router.post(
    '/:id/inactivate',
    authorize('client.update'),
    validate(v.idParamValidator),
    controller.inactivateClient
);

router.post(
    '/:id/restore',
    authorize('client.update'),
    validate(v.idParamValidator),
    controller.restoreClient
);

module.exports = router;