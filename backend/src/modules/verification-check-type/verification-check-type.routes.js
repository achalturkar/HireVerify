'use strict';

const express = require('express');
const controller = require('./verification-check-type.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { requireRole } = require('../../middleware/authorize.middleware');
const { validate } = require('../../middleware/validate.middleware');
const v = require('./verification-check-type.validator');

const router = express.Router();
router.use(authenticate);
router.get('/', validate(v.listValidator), controller.list);
router.post('/', requireRole({ superAdmin: true }), validate(v.createValidator), controller.create);
router.patch('/:id', requireRole({ superAdmin: true }), validate(v.updateValidator), controller.update);

module.exports = router;
