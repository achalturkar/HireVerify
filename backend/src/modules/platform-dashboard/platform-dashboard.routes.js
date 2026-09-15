'use strict';

const express = require('express');
const controller = require('./platform-dashboard.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorize, requireRole } = require('../../middleware/authorize.middleware');

const router = express.Router();
router.get('/', authenticate, requireRole({ superAdmin: true }), authorize('company.view'), controller.getDashboard);

module.exports = router;