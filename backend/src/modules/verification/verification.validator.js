'use strict';

const Joi = require('joi');

const TYPES = ['PAN', 'UAN', 'COURT', 'IDENTITY', 'ADDRESS', 'EDUCATION', 'EMPLOYMENT', 'DOCUMENT', 'DOCUMENT_FORGERY'];
const PROVIDERS = ['SUREPASS', 'MANUAL', 'INTERNAL'];
const STATUSES = ['PENDING', 'QUEUED', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'RETRYING', 'CANCELLED'];
const RESULTS = ['PENDING', 'VERIFIED', 'NOT_VERIFIED', 'MATCH', 'MISMATCH', 'NO_RECORD_FOUND', 'RECORD_FOUND', 'REQUIRES_REVIEW', 'UNABLE_TO_VERIFY'];

const idParamValidator = { params: Joi.object({ id: Joi.string().uuid().required() }) };
const listValidator = { query: Joi.object({ caseId: Joi.string().uuid(), status: Joi.string().valid(...STATUSES), type: Joi.string().valid(...TYPES) }) };
const createValidator = { body: Joi.object({ caseId: Joi.string().uuid().required(), type: Joi.string().valid(...TYPES).required(), provider: Joi.string().valid(...PROVIDERS).default('SUREPASS'), priority: Joi.number().integer().min(0).max(100), inputData: Joi.object().unknown(true) }) };
const updateValidator = { params: Joi.object({ id: Joi.string().uuid().required() }), body: Joi.object({ status: Joi.string().valid(...STATUSES).required(), result: Joi.string().valid(...RESULTS), resultData: Joi.object().unknown(true), failureReason: Joi.string().max(2000).allow(null, ''), remarks: Joi.string().max(2000).allow(null, '') }).min(1) };
const executePanValidator = { params: Joi.object({ id: Joi.string().uuid().required() }), body: Joi.object({ pan: Joi.string().pattern(/^[A-Za-z]{5}[0-9]{4}[A-Za-z]$/).required() }) };
const lockValidator = { params: Joi.object({ id: Joi.string().uuid().required() }), body: Joi.object({ locked: Joi.boolean().required() }).required() };
const documentValidator = { params: Joi.object({ id: Joi.string().uuid().required() }), body: Joi.object({ candidateId: Joi.string().uuid().required(), documentType: Joi.string().valid('PAN', 'AADHAAR', 'PASSPORT', 'DRIVING_LICENSE', 'VOTER_ID', 'EDUCATION_CERTIFICATE', 'EXPERIENCE_LETTER', 'SALARY_SLIP', 'ADDRESS_PROOF', 'OTHER').default('OTHER') }).required() };
module.exports = { idParamValidator, listValidator, createValidator, updateValidator, executePanValidator, lockValidator, documentValidator };
