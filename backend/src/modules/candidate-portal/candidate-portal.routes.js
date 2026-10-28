'use strict';

const express = require('express');
const crypto = require('crypto');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const controller = require('./candidate-portal.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorize, requireRole } = require('../../middleware/authorize.middleware');
const { BadRequestError } = require('../../utils/errors');

const uploadRoot = path.resolve(process.cwd(), 'uploads', 'candidate-documents', 'portal');
const documentUpload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      const folder = /^[a-f0-9]{64}$/i.test(req.params.token) ? req.params.token : 'invalid-token';
      const dir = path.join(uploadRoot, folder);
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_req, file, cb) => {
      const extension = path.extname(file.originalname).toLowerCase();
      cb(null, `${crypto.randomBytes(16).toString('hex')}${extension}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const mimeType = file.mimetype.toLowerCase();
    const genericMime = mimeType === 'application/octet-stream';
    const validType = (extension === '.pdf' && (mimeType === 'application/pdf' || genericMime))
      || (extension === '.doc' && (mimeType === 'application/msword' || mimeType === 'application/vnd.ms-word' || genericMime))
      || (extension === '.docx' && (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || genericMime))
      || (['.jpg', '.jpeg'].includes(extension) && (mimeType === 'image/jpeg' || genericMime))
      || (extension === '.png' && (mimeType === 'image/png' || genericMime));
    if (!validType) {
      return cb(new BadRequestError('Use a PDF, DOC, DOCX, JPG, or PNG file with a matching extension.'));
    }
    return cb(null, true);
  },
});
const uploadCandidateDocument = (req, res, next) => {
  documentUpload.single('file')(req, res, (error) => {
    if (error instanceof multer.MulterError) {
      return next(new BadRequestError(error.code === 'LIMIT_FILE_SIZE' ? 'Documents must be 10 MB or smaller.' : error.message));
    }
    if (error) return next(error);
    next();
  });
};

const router = express.Router();
router.post('/invitations/:candidateId', authenticate, requireRole({ companyAdmin: true }), authorize('candidate.update'), controller.issue);
router.post('/invitations/:candidateId/remind', authenticate, requireRole({ companyAdmin: true }), authorize('candidate.update'), controller.remind);
router.get('/invitations/:candidateId/status', authenticate, requireRole({ companyAdmin: true }), authorize('candidate.view'), controller.status);
router.patch('/invitations/:candidateId/lock', authenticate, requireRole({ companyAdmin: true }), authorize('candidate.update'), controller.lock);
router.post('/invitations/:candidateId/unlock-for-corrections', authenticate, requireRole({ companyAdmin: true }), authorize('candidate.update'), controller.unlockForCorrections);
router.use('/:token', (_req, res, next) => {
  res.set({ 'Cache-Control': 'private, no-store, max-age=0', Pragma: 'no-cache' });
  next();
});
router.get('/:token/forms/:formId', controller.downloadFormTemplate);
router.get('/:token', controller.getPortal);
router.patch('/:token/profile', controller.updateProfile);
router.post('/:token/consent', controller.consent);
router.post('/:token/documents', controller.validateUpload, uploadCandidateDocument, controller.uploadDocument);
router.delete('/:token/documents/:documentId', controller.validateUpload, controller.deleteCustomFormDocument);

module.exports = router;
