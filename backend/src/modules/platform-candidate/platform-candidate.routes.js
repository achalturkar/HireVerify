'use strict';

const express = require('express');
const controller = require('./platform-candidate.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorize, requireRole } = require('../../middleware/authorize.middleware');
const { validate } = require('../../middleware/validate.middleware');
const candidateValidator = require('../candidate/candidate.validator');

const router = express.Router();

router.use(authenticate, requireRole({ superAdmin: true }), authorize('candidate.view'));
router.get('/', controller.listCandidates);
router.get('/:id', validate(candidateValidator.idParamValidator), controller.getCandidate);
router.put('/:id', authorize('candidate.update'), validate(candidateValidator.updateValidator), controller.updateCandidate);

module.exports = router;