'use strict';

const express = require('express');
const multer = require('multer');
const controller = require('./platform-locations.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { requireRole } = require('../../middleware/authorize.middleware');
const { validate } = require('../../middleware/validate.middleware');
const { BadRequestError } = require('../../utils/errors');
const v = require('./platform-locations.validator');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 }, fileFilter: (_req, file, callback) => {
  if (!file.originalname.toLowerCase().endsWith('.csv')) return callback(new BadRequestError('Upload a .csv file.'));
  return callback(null, true);
} });
const superAdmin = [authenticate, requireRole({ superAdmin: true })];

router.get('/', controller.list);
router.get('/admin', ...superAdmin, controller.listAdmin);
router.post('/import', ...superAdmin, upload.single('file'), controller.importCsv);
router.post('/countries', ...superAdmin, validate(v.countryCreate), controller.createCountry);
router.patch('/countries/:id', ...superAdmin, validate(v.countryUpdate), controller.updateCountry);
router.post('/states', ...superAdmin, validate(v.stateCreate), controller.createState);
router.patch('/states/:id', ...superAdmin, validate(v.stateUpdate), controller.updateState);

module.exports = router;