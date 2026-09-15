'use strict';

const express = require('express');
const controller = require('./audit.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorize, requireRole } = require('../../middleware/authorize.middleware');

const router = express.Router();

router.use(authenticate, requireRole({ superAdmin: true }), authorize('audit.view'));
router.get('/', controller.listAuditLogs);

module.exports = router;