'use strict';

const express = require('express');
const controller = require('./platform-branding.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { requireRole } = require('../../middleware/authorize.middleware');

const router = express.Router();

router.get('/', controller.getBranding);
router.put('/', authenticate, requireRole({ superAdmin: true }), controller.updateBranding);

module.exports = router;