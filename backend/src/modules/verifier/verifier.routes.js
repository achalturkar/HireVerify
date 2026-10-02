'use strict';

const express = require('express');
const controller = require('./verifier.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorize } = require('../../middleware/authorize.middleware');
const { validate } = require('../../middleware/validate.middleware');
const v = require('./verifier.validator');

const router = express.Router();
router.use(authenticate);
router.get('/', authorize(['bgv.case.view', 'company.update'], { any: true }), validate(v.listValidator), controller.list);
router.post('/', authorize('company.update'), validate(v.createValidator), controller.create);
router.patch('/:id', authorize('company.update'), validate(v.updateValidator), controller.update);

module.exports = router;