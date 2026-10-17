'use strict';

const Joi = require('joi');

const PROVIDERS = ['SUREPASS', 'MANUAL', 'INTERNAL'];
const CHECK_TYPE = Joi.string().pattern(/^[A-Z][A-Z0-9_]{1,59}$/);
const STATUSES = ['DRAFT', 'INITIATED', 'CONSENT_PENDING', 'IN_PROGRESS', 'UNDER_REVIEW', 'COMPLETED', 'ON_HOLD', 'CANCELLED'];
const RESULTS = ['PENDING', 'CLEAR', 'MINOR_DISCREPANCY', 'MAJOR_DISCREPANCY', 'UNABLE_TO_VERIFY', 'REQUIRES_REVIEW'];

const idParamValidator = { params: Joi.object({ id: Joi.string().uuid().required() }) };
const emailReportsValidator = { body: Joi.object({ caseIds: Joi.array().items(Joi.string().uuid()).min(1).max(10).unique().required() }).required() };

const createValidator = { body: Joi.object({
  clientId: Joi.string().uuid().required(),
  candidateId: Joi.string().uuid().required(),
  status: Joi.string().valid('DRAFT', 'INITIATED').default('DRAFT'),
  clientReference: Joi.string().max(100).allow(null, ''),
  packageName: Joi.string().max(150).allow(null, ''),
  priority: Joi.number().integer().min(0).max(100),
  remarks: Joi.string().allow(null, ''),
  checks: Joi.array().items(Joi.object({ type: CHECK_TYPE.required(), provider: Joi.string().valid(...PROVIDERS), priority: Joi.number().integer().min(0).max(100) })).unique('type'),
}) };

const listValidator = { query: Joi.object({
  page: Joi.number().integer().min(1), limit: Joi.number().integer().min(1).max(200), search: Joi.string().allow(''), clientId: Joi.string().uuid(), subclientId: Joi.alternatives().try(Joi.string().uuid(), Joi.string().valid('none')), candidateId: Joi.string().uuid(), status: Joi.string().valid(...STATUSES), overallResult: Joi.string().valid(...RESULTS), initiatedFrom: Joi.string().isoDate(), initiatedTo: Joi.string().isoDate(), completedFrom: Joi.string().isoDate(), completedTo: Joi.string().isoDate(), sortBy: Joi.string().valid('caseNumber', 'status', 'overallResult', 'createdAt', 'updatedAt'), sortOrder: Joi.string().valid('asc', 'desc'),
}) };

const transitionValidator = { params: Joi.object({ id: Joi.string().uuid().required() }), body: Joi.object({ status: Joi.string().valid(...STATUSES).required(), remarks: Joi.string().max(2000).allow(null, '') }).required() };
const updateMetaValidator = { params: Joi.object({ id: Joi.string().uuid().required() }), body: Joi.object({
  clientReference: Joi.string().max(100).allow(null, ''),
  packageName: Joi.string().max(150).allow(null, ''),
  initiatedAt: Joi.string().isoDate().allow(null, ''),
  completedAt: Joi.string().isoDate().allow(null, ''),
  remarks: Joi.string().allow(null, ''),
}).min(1).required() };

const updateChecksValidator = { params: Joi.object({ id: Joi.string().uuid().required() }), body: Joi.object({
  checks: Joi.array().items(Joi.object({
    type: CHECK_TYPE.required(),
    provider: Joi.string().valid(...PROVIDERS).default('MANUAL'),
    priority: Joi.number().integer().min(0).max(100).default(0),
  })).unique('type').required(),
}).required() };

module.exports = { idParamValidator, emailReportsValidator, createValidator, listValidator, transitionValidator, updateMetaValidator, updateChecksValidator };
