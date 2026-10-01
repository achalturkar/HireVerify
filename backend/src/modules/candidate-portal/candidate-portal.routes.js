'use strict';

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const controller = require('./candidate-portal.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorize, requireRole } = require('../../middleware/authorize.middleware');

const uploadRoot = path.resolve(process.cwd(), 'uploads', 'candidate-documents', 'portal');
const documentUpload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      const folder = /^[a-f0-9]{64}$/i.test(req.params.token) ? req.params.token : 'invalid-token';
      const dir = path.join(uploadRoot, folder);
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`),
  }),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, ['application/pdf', 'image/jpeg', 'image/png'].includes(file.mimetype)),
});

const router = express.Router();
router.post('/invitations/:candidateId', authenticate, requireRole({ companyAdmin: true }), authorize('candidate.update'), controller.issue);
router.post('/invitations/:candidateId/remind', authenticate, requireRole({ companyAdmin: true }), authorize('candidate.update'), controller.remind);
router.get('/invitations/:candidateId/status', authenticate, requireRole({ companyAdmin: true }), authorize('candidate.view'), controller.status);
router.patch('/invitations/:candidateId/lock', authenticate, requireRole({ companyAdmin: true }), authorize('candidate.update'), controller.lock);
router.get('/:token', controller.getPortal);
router.patch('/:token/profile', controller.updateProfile);
router.post('/:token/consent', controller.consent);
router.post('/:token/documents', documentUpload.single('file'), controller.uploadDocument);

module.exports = router;
