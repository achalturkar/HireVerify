'use strict';

const express = require('express');
const controller = require('./platform-candidate.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorize, requireRole } = require('../../middleware/authorize.middleware');

const router = express.Router();

router.use(authenticate, requireRole({ superAdmin: true }), authorize('candidate.view'));
router.get('/', controller.listCandidates);

module.exports = router;