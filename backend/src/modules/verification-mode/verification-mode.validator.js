'use strict';

const Joi = require('joi');

const idParamValidator = { params: Joi.object({ id: Joi.string().uuid().required() }) };
const listValidator = { query: Joi.object({ includeInactive: Joi.boolean().default(false) }) };
const createValidator = { body: Joi.object({ name: Joi.string().trim().min(2).max(100).required() }).required() };
const updateValidator = {
  params: Joi.object({ id: Joi.string().uuid().required() }),
  body: Joi.object({
    name: Joi.string().trim().min(2).max(100),
    isActive: Joi.boolean(),
  }).min(1).required(),
};

module.exports = { idParamValidator, listValidator, createValidator, updateValidator };
