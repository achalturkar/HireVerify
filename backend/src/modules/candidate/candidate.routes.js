'use strict';

const express = require('express');
const controller = require('./candidate.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorize } = require('../../middleware/authorize.middleware');
const { validate } = require('../../middleware/validate.middleware');
const v = require('./candidate.validator');

const router = express.Router();
router.use(authenticate);

router.route('/')
  .get(authorize('candidate.view'), validate(v.listValidator), controller.listCandidates)
  .post(authorize('candidate.create'), validate(v.createValidator), controller.createCandidate);

router.route('/:id')
  .get(authorize('candidate.view'), validate(v.idParamValidator), controller.getCandidate)
  .put(authorize('candidate.update'), validate(v.updateValidator), controller.updateCandidate)
  .delete(authorize('candidate.delete'), validate(v.idParamValidator), controller.deleteCandidate);

module.exports = router;
