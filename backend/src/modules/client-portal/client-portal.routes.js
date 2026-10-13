'use strict';

const express = require('express');
const Joi = require('joi');
const controller = require('./client-portal.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorize } = require('../../middleware/authorize.middleware');
const { validate } = require('../../middleware/validate.middleware');
const { ForbiddenError } = require('../../utils/errors');
const candidatePortalService = require('../candidate-portal/candidate-portal.service');

const router = express.Router();
router.use(authenticate, (req, _res, next) => {
  if (!req.user.role?.isClientUser || !req.user.clientId) {
    return next(new ForbiddenError('Client portal account required.'));
  }
  return next();
});

const listValidator = {
  query: Joi.object({
    page: Joi.number().integer().min(1),
    limit: Joi.number().integer().min(1).max(100),
    search: Joi.string().max(100).allow(''),
  }),
};
const candidateFields = {
  firstName: Joi.string().trim().min(1).max(100),
  lastName: Joi.string().trim().min(1).max(100),
  email: Joi.string().email().allow(null, ''),
  phone: Joi.string().max(50).allow(null, ''),
  dateOfBirth: Joi.date().iso().allow(null, ''),
  gender: Joi.string().max(30).allow(null, ''),
  fatherName: Joi.string().max(150).allow(null, ''),
  motherName: Joi.string().max(150).allow(null, ''),
  aadhaarNumber: Joi.string().max(50).allow(null, ''),
  panNumber: Joi.string().max(50).allow(null, ''),
  uanNumber: Joi.string().max(50).allow(null, ''),
  passportNumber: Joi.string().max(50).allow(null, ''),
  drivingLicenseNumber: Joi.string().max(50).allow(null, ''),
  voterIdNumber: Joi.string().max(50).allow(null, ''),
  highestQualification: Joi.string().max(150).allow(null, ''),
  courseName: Joi.string().max(150).allow(null, ''),
  institutionName: Joi.string().max(200).allow(null, ''),
  universityName: Joi.string().max(200).allow(null, ''),
  yearOfPassing: Joi.number().integer().min(1900).max(2200).allow(null, ''),
  gradeOrPercentage: Joi.string().max(50).allow(null, ''),
  employeeId: Joi.string().max(100).allow(null, ''),
  employeeDesignation: Joi.string().max(150).allow(null, ''),
  employeeDepartment: Joi.string().max(150).allow(null, ''),
  employmentType: Joi.string().max(100).allow(null, ''),
  joiningDate: Joi.date().iso().allow(null, ''),
  workLocation: Joi.string().max(200).allow(null, ''),
  currentEmployer: Joi.string().max(200).allow(null, ''),
  currentAddress: Joi.string().max(2000).allow(null, ''),
  permanentAddress: Joi.string().max(2000).allow(null, ''),
};
const createCandidateValidator = {
  body: Joi.object({
    ...candidateFields,
    firstName: candidateFields.firstName.required(),
    lastName: candidateFields.lastName.required(),
  }).required(),
};
const updateCandidateValidator = {
  params: Joi.object({ id: Joi.string().uuid().required() }),
  body: Joi.object(candidateFields).min(1).required(),
};
const reportValidator = { params: Joi.object({ id: Joi.string().uuid().required() }) };
const candidateValidator = { params: Joi.object({ id: Joi.string().uuid().required() }) };
const invitationValidator = {
  params: Joi.object({ id: Joi.string().uuid().required() }),
  body: Joi.object({ expiresInDays: Joi.number().integer().min(1).max(30).default(30) }).default({}),
};
const portalAccessValidator = {
  params: Joi.object({ id: Joi.string().uuid().required() }),
  body: Joi.object({ locked: Joi.boolean().required() }).required(),
};

router.get('/candidate-form-config', authorize('clientportal.candidates.view'), controller.getCandidateFormConfig);
router.get('/candidates', authorize('clientportal.candidates.view'), validate(listValidator), controller.listCandidates);
router.post('/candidates', authorize('clientportal.candidates.create'), validate(createCandidateValidator), controller.createCandidate);
router.put('/candidates/:id', authorize('clientportal.candidates.update'), validate(updateCandidateValidator), controller.updateCandidate);
router.get('/candidates/:id', authorize('clientportal.candidates.view'), validate(candidateValidator), controller.getCandidate);
router.post('/candidates/:id/invitation', authorize(['clientportal.candidates.invite', 'clientportal.candidates.create'], { any: true }), validate(invitationValidator), controller.inviteCandidate);
router.post('/candidates/:id/invitation/remind', authorize(['clientportal.candidates.invite', 'clientportal.candidates.create'], { any: true }), validate(candidateValidator), controller.remindCandidate);
router.get('/candidates/:id/portal-access', authorize(['clientportal.candidates.invite', 'clientportal.candidates.create', 'clientportal.candidates.portal.manage'], { any: true }), validate(candidateValidator), controller.getCandidatePortalAccess);
router.patch('/candidates/:id/portal-access', authorize('clientportal.candidates.portal.manage'), validate(portalAccessValidator), controller.updateCandidatePortalAccess);
router.get('/cases', authorize('clientportal.cases.view'), validate(listValidator), controller.listCases);
router.get('/cases/:id', authorize('clientportal.cases.view'), validate(reportValidator), controller.getCase);
router.get('/reports', authorize('clientportal.reports.view'), validate(listValidator), controller.listReports);
router.get('/reports/:id/download', authorize('clientportal.reports.download'), validate(reportValidator), controller.downloadReport);

module.exports = router;
