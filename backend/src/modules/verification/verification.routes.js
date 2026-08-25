'use strict';

const express = require('express');
const controller = require('./verification.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorize } = require('../../middleware/authorize.middleware');
const { validate } = require('../../middleware/validate.middleware');
const v = require('./verification.validator');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const uploadRoot = path.resolve(process.cwd(), 'uploads', 'candidate-documents');
const documentUpload = multer({ storage: multer.diskStorage({ destination: (req, _file, cb) => { const dir = path.join(uploadRoot, req.params.id); fs.mkdirSync(dir, { recursive: true }); cb(null, dir); }, filename: (_req, file, cb) => cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`) }), limits: { fileSize: 15 * 1024 * 1024 } });

const router = express.Router();
router.use(authenticate);
router.get('/', authorize('bgv.verification.view'), validate(v.listValidator), controller.list);
router.post('/', authorize('bgv.verification.create'), validate(v.createValidator), controller.create);
router.get('/:id', authorize('bgv.verification.view'), validate(v.idParamValidator), controller.get);
router.patch('/:id', authorize('bgv.verification.review'), validate(v.updateValidator), controller.update);
router.post('/:id/retry', authorize('bgv.verification.retry'), validate(v.idParamValidator), controller.retry);
router.post('/:id/execute-pan', authorize('bgv.verification.create'), validate(v.executePanValidator), controller.executePan);
router.get('/:id/pdf', authorize('bgv.verification.view'), validate(v.idParamValidator), controller.downloadPdf);
router.patch('/:id/lock', authorize('bgv.verification.review'), validate(v.lockValidator), controller.lock);
router.post('/:id/documents', authorize('bgv.document.upload'), validate(v.documentValidator), documentUpload.single('file'), controller.uploadDocument);
router.delete('/:id/documents/:documentId', authorize('bgv.document.delete'), controller.deleteDocument);
module.exports = router;
