'use strict';

const express = require('express');
const controller = require('./bgv-case.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorize } = require('../../middleware/authorize.middleware');
const { validate } = require('../../middleware/validate.middleware');
const v = require('./bgv-case.validator');

const router = express.Router();
router.use(authenticate);
router.route('/').get(authorize('bgv.case.view'), validate(v.listValidator), controller.listCases).post(authorize('bgv.case.create'), validate(v.createValidator), controller.createCase);
router.get('/export', authorize('bgv.case.view'), validate(v.listValidator), controller.exportCases);
router.get('/:id', authorize('bgv.case.view'), validate(v.idParamValidator), controller.getCase);
router.patch('/:id/status', authorize('bgv.case.update'), validate(v.transitionValidator), controller.transitionCase);
router.patch('/:id', authorize('bgv.case.update'), validate(v.updateMetaValidator), controller.updateCaseMeta);
router.patch('/:id/checks', authorize('bgv.case.update'), validate(v.updateChecksValidator), controller.updateChecks);
router.delete('/:id', authorize('bgv.case.update'), validate(v.idParamValidator), controller.deleteCase);
router.get('/:id/report', authorize('bgv.report.download'), validate(v.idParamValidator), controller.downloadReport);
module.exports = router;
