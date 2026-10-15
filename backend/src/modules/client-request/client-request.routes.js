'use strict';

const express = require('express');
const Joi = require('joi');
const controller = require('./client-request.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorize } = require('../../middleware/authorize.middleware');
const { ForbiddenError, UnprocessableEntityError } = require('../../utils/errors');

const router = express.Router();
router.use(authenticate);

const categories = ['ACCOUNT', 'CANDIDATE', 'CASE', 'REPORT', 'INVOICE', 'TECHNICAL_SUPPORT', 'OTHER'];
const statuses = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];

const listValidator = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    search: Joi.string().trim().max(100).allow(''),
    status: Joi.string().valid(...statuses).allow(''),
  }),
};

const createValidator = {
  body: Joi.object({
    category: Joi.string().valid(...categories).required(),
    subject: Joi.string().trim().min(3).max(180).required(),
    description: Joi.string().trim().min(10).max(5000).required(),
  }).required(),
};

const updateValidator = {
  params: Joi.object({ id: Joi.string().uuid().required() }),
  body: Joi.object({
    status: Joi.string().valid(...statuses),
    adminResponse: Joi.string().trim().min(2).max(5000),
  }).min(1).required(),
};

const validateJoi = (schemas) => (req, _res, next) => {
  for (const [part, schema] of Object.entries(schemas)) {
    const { error, value } = schema.validate(req[part], {
      abortEarly: false,
      stripUnknown: true,
    });
    if (error) {
      return next(new UnprocessableEntityError(
        'Validation failed',
        error.details.map((detail) => ({
          field: detail.path.join('.'),
          message: detail.message,
        })),
      ));
    }
    if (part !== 'query') req[part] = value;
  }
  return next();
};

const requireCompanyAdmin = (req, _res, next) => {
  if (!req.user?.role?.isCompanyAdmin || !req.user.companyId) {
    return next(new ForbiddenError('Company administrator access required.'));
  }
  return next();
};

const requireRequestViewer = (req, res, next) => {
  if (req.user?.role?.isClientUser && req.user.clientId) return next();
  if (req.user?.role?.isCompanyAdmin && req.user.companyId) {
    return authorize('client.view')(req, res, next);
  }
  return next(new ForbiddenError('Client request access required.'));
};

router.get('/', requireRequestViewer, validateJoi(listValidator), controller.listRequests);
router.post('/', (req, _res, next) => {
  if (!req.user?.role?.isClientUser || !req.user.clientId) {
    return next(new ForbiddenError('Client portal account required.'));
  }
  return next();
}, validateJoi(createValidator), controller.createRequest);
router.patch('/:id', requireCompanyAdmin, authorize('client.view'), validateJoi(updateValidator), controller.updateRequest);

module.exports = router;
