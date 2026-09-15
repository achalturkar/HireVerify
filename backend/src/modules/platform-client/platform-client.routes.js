'use strict';

const express = require('express');
const controller = require('./platform-client.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorize, requireRole } = require('../../middleware/authorize.middleware');

const router = express.Router();

router.use(authenticate, requireRole({ superAdmin: true }), authorize('client.view'));
router.get('/', controller.listClients);

module.exports = router;