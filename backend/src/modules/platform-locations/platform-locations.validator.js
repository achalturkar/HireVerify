'use strict';

const { body, param } = require('express-validator');

const countryCreate = [body('name').isString().trim().isLength({ min: 2, max: 150 })];
const countryUpdate = [
  param('id').isUUID(),
  body('name').optional().isString().trim().isLength({ min: 2, max: 150 }),
  body('isActive').optional().isBoolean(),
  body().custom((_value, { req }) => Object.hasOwn(req.body, 'name') || Object.hasOwn(req.body, 'isActive')),
];
const stateCreate = [body('countryId').isUUID(), body('name').isString().trim().isLength({ min: 1, max: 150 })];
const stateUpdate = [
  param('id').isUUID(),
  body('countryId').optional().isUUID(),
  body('name').optional().isString().trim().isLength({ min: 1, max: 150 }),
  body('isActive').optional().isBoolean(),
  body().custom((_value, { req }) => Object.hasOwn(req.body, 'countryId') || Object.hasOwn(req.body, 'name') || Object.hasOwn(req.body, 'isActive')),
];

module.exports = { countryCreate, countryUpdate, stateCreate, stateUpdate };