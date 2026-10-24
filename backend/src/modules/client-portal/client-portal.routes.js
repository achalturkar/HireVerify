'use strict';

const express = require('express');
const Joi = require('joi');
const controller = require('./client-portal.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorize } = require('../../middleware/authorize.middleware');
const { validate } = require('../../middleware/validate.middleware');
const { ForbiddenError, BadRequestError } = require('../../utils/errors');
const { prisma } = require('../../common/prisma');
const candidatePortalService = require('../candidate-portal/candidate-portal.service');
const invoiceValidator = require('../invoice/invoice.validator');
const COMPANY_ADMIN_PORTAL_PERMISSIONS = [
  'clientportal.cases.view',
  'clientportal.invoices.view',
  'clientportal.reports.view',
  'clientportal.reports.download',
  'clientportal.candidates.view',
  'clientportal.candidates.pdf.download',
  'clientportal.candidates.create',
  'clientportal.candidates.update',
  'clientportal.candidates.invite',
  'clientportal.candidates.portal.manage',
  'clientportal.subclients.view',
  'clientportal.subclients.manage',
];

const router = express.Router();
router.use(authenticate, async (req, _res, next) => {
  try {
    if (req.user.role?.isCompanyAdmin) {
      const selectedClientId = req.get('x-client-portal-client-id') || req.query.portalClientId;
      if (!selectedClientId) throw new BadRequestError('Select a client to access the client portal.');
      const { error: clientIdError } = Joi.string().uuid().validate(selectedClientId);
      if (clientIdError) throw new BadRequestError('Select a valid client to access the client portal.');
      const client = await prisma.client.findFirst({
        where: { id: selectedClientId, companyId: req.user.companyId, parentClientId: null, isDeleted: false, status: 'ACTIVE' },
        select: { id: true, name: true, logoUrl: true, clientCode: true, industry: true, contactName: true, contactEmail: true, contactPhone: true },
      });
      if (!client) throw new ForbiddenError('The selected client is unavailable in your company.');
      req.user.clientId = client.id;
      req.user.client = client;
      for (const permission of COMPANY_ADMIN_PORTAL_PERMISSIONS) req.permissions.add(permission);
      return next();
    }
    if (!req.user.role?.isClientUser || !req.user.clientId) {
      throw new ForbiddenError('Client portal account required.');
    }
    const client = await prisma.client.findFirst({
      where: { id: req.user.clientId, companyId: req.user.companyId, isDeleted: false, status: 'ACTIVE' },
      select: { parentClientId: true },
    });
    if (!client || client.parentClientId) throw new ForbiddenError('Client portal account required.');
    return next();
  } catch (error) {
    return next(error);
  }
});

const listValidator = {
  query: Joi.object({
    page: Joi.number().integer().min(1),
    limit: Joi.number().integer().min(1).max(100),
    search: Joi.string().max(100).allow(''),
    subclientId: Joi.alternatives().try(Joi.string().uuid(), Joi.string().valid('none')),
    status: Joi.string().valid(
      'PENDING', 'INVITED', 'IN_PROGRESS', 'VERIFICATION_IN_PROGRESS', 'COMPLETED', 'WITHDRAWN', 'ON_HOLD',
      'DRAFT', 'INITIATED', 'CONSENT_PENDING', 'UNDER_REVIEW', 'CANCELLED',
      'CLEAR', 'MINOR_DISCREPANCY', 'MAJOR_DISCREPANCY', 'UNABLE_TO_VERIFY', 'REQUIRES_REVIEW',
      'SENT', 'PARTIALLY_PAID', 'PAID', 'OVERDUE',
    ).allow(''),
    dateFrom: Joi.date().iso(),
    dateTo: Joi.date().iso().min(Joi.ref('dateFrom')),
  }),
};
const candidateFields = {
  subclientId: Joi.string().uuid().allow(null, ''),
  fullName: Joi.string().trim().max(255),
  firstName: Joi.string().trim().min(1).max(100),
  middleName: Joi.string().trim().max(100).allow(null, ''),
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
  body: Joi.object({ expiresInDays: Joi.number().integer().min(1).max(30) }).default({}),
};
const portalAccessValidator = {
  params: Joi.object({ id: Joi.string().uuid().required() }),
  body: Joi.object({ locked: Joi.boolean().required() }).required(),
};
const subclientPayload = Joi.object({
  name: Joi.string().trim().min(2).max(255).required(),
  clientCode: Joi.string().trim().min(2).max(50).required(),
  contactName: Joi.string().max(150).allow(null, ''),
  contactEmail: Joi.string().email().max(255).allow(null, ''),
  contactPhone: Joi.string().max(50).allow(null, ''),
  packageRate: Joi.number().min(0).max(100000000).required(),
  serviceRates: Joi.array().items(Joi.object({
    checkType: Joi.string().pattern(/^[A-Z][A-Z0-9_]{1,59}$/).required(),
    rate: Joi.number().min(0).max(100000000).required(),
  })).required(),
});
const createSubclientValidator = { body: subclientPayload.required() };
const updateSubclientValidator = {
  params: Joi.object({ subclientId: Joi.string().uuid().required() }),
  body: subclientPayload.keys({ status: Joi.string().valid('ACTIVE', 'INACTIVE') }).min(1).required(),
};
const subclientUserValidator = {
  params: Joi.object({ subclientId: Joi.string().uuid().required() }),
  body: Joi.object({
    firstName: Joi.string().trim().min(1).max(100).required(),
    lastName: Joi.string().trim().min(1).max(100).required(),
    email: Joi.string().trim().email().max(255).required(),
    accountMethod: Joi.string().valid('INVITATION', 'PASSWORD').default('INVITATION'),
    password: Joi.when('accountMethod', {
      is: 'PASSWORD',
      then: Joi.string().min(12).max(128).required(),
      otherwise: Joi.forbidden(),
    }),
  }).required(),
};
const updateSubclientUserValidator = {
  params: Joi.object({ subclientId: Joi.string().uuid().required(), userId: Joi.string().uuid().required() }),
  body: Joi.object({ status: Joi.string().valid('ACTIVE', 'INACTIVE').required() }).required(),
};
const subclientUserPathValidator = {
  params: Joi.object({ subclientId: Joi.string().uuid().required(), userId: Joi.string().uuid().required() }),
};

router.get('/candidate-form-config', authorize('clientportal.candidates.view'), controller.getCandidateFormConfig);
router.get('/dashboard', controller.getDashboard);
router.get('/subclients', authorize(['clientportal.subclients.view', 'clientportal.subclients.manage'], { any: true }), controller.listSubclients);
router.post('/subclients', authorize('clientportal.subclients.manage'), validate(createSubclientValidator), controller.createSubclient);
router.put('/subclients/:subclientId', authorize('clientportal.subclients.manage'), validate(updateSubclientValidator), controller.updateSubclient);
router.get('/subclients/:subclientId/users', authorize('clientportal.subclients.manage'), validate({ params: updateSubclientValidator.params }), controller.listSubclientUsers);
router.post('/subclients/:subclientId/users', authorize('clientportal.subclients.manage'), validate(subclientUserValidator), controller.inviteSubclientUser);
router.patch('/subclients/:subclientId/users/:userId', authorize('clientportal.subclients.manage'), validate(updateSubclientUserValidator), controller.updateSubclientUser);
router.delete('/subclients/:subclientId/users/:userId', authorize('clientportal.subclients.manage'), validate(subclientUserPathValidator), controller.removeSubclientUser);
router.get('/candidates', authorize('clientportal.candidates.view'), validate(listValidator), controller.listCandidates);
router.post('/candidates', authorize('clientportal.candidates.create'), validate(createCandidateValidator), controller.createCandidate);
router.put('/candidates/:id', authorize('clientportal.candidates.update'), validate(updateCandidateValidator), controller.updateCandidate);
router.get('/candidates/:id', authorize('clientportal.candidates.view'), validate(candidateValidator), controller.getCandidate);
router.get('/candidates/:id/form-pdf', authorize('clientportal.candidates.pdf.download'), validate(candidateValidator), controller.downloadCandidateFormPdf);
router.post('/candidates/:id/invitation', authorize(['clientportal.candidates.invite', 'clientportal.candidates.create'], { any: true }), validate(invitationValidator), controller.inviteCandidate);
router.post('/candidates/:id/invitation/remind', authorize(['clientportal.candidates.invite', 'clientportal.candidates.create'], { any: true }), validate(candidateValidator), controller.remindCandidate);
router.get('/candidates/:id/portal-access', authorize(['clientportal.candidates.invite', 'clientportal.candidates.create', 'clientportal.candidates.portal.manage'], { any: true }), validate(candidateValidator), controller.getCandidatePortalAccess);
router.patch('/candidates/:id/portal-access', authorize('clientportal.candidates.portal.manage'), validate(portalAccessValidator), controller.updateCandidatePortalAccess);
router.get('/cases', authorize('clientportal.cases.view'), validate(listValidator), controller.listCases);
router.get('/cases/:id', authorize('clientportal.cases.view'), validate(reportValidator), controller.getCase);
router.get('/reports', authorize('clientportal.reports.view'), validate(listValidator), controller.listReports);
router.get('/reports/:id/download', authorize('clientportal.reports.download'), validate(reportValidator), controller.downloadReport);
router.get('/invoices', authorize('clientportal.invoices.view'), validate(listValidator), controller.listInvoices);
router.get('/invoices/:id/pdf', authorize('clientportal.invoices.view'), validate(invoiceValidator.idParamValidator), controller.downloadInvoice);

module.exports = router;
