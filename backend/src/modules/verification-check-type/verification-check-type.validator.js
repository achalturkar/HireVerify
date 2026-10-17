'use strict';

const Joi = require('joi');

const idParamValidator = { params: Joi.object({ id: Joi.string().pattern(/^[A-Z][A-Z0-9_]{1,59}$/).required() }) };
const listValidator = { query: Joi.object({ includeInactive: Joi.string().valid('true', 'false') }) };
const createValidator = { body: Joi.object({
  label: Joi.string().trim().min(2).max(100).required(),
  description: Joi.string().trim().max(500).allow('', null),
}).required() };
const updateValidator = { params: idParamValidator.params, body: Joi.object({
  label: Joi.string().trim().min(2).max(100),
  description: Joi.string().trim().max(500).allow('', null),
  isActive: Joi.boolean(),
}).min(1).required() };

module.exports = { idParamValidator, listValidator, createValidator, updateValidator };
