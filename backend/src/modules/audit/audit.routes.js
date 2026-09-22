'use strict';

const express = require('express');
const controller = require('./audit.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorize } = require('../../middleware/authorize.middleware');

const router = express.Router();

router.use(authenticate, authorize('audit.view'));
router.get('/', controller.listAuditLogs);

module.exports = router;