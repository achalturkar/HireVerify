'use strict';

const express = require('express');
const Joi = require('joi');
const { prisma } = require('../../common/prisma');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorize } = require('../../middleware/authorize.middleware');
const { validate } = require('../../middleware/validate.middleware');
const { ForbiddenError, NotFoundError } = require('../../utils/errors');
const controller = require('./subclient-portal.controller');

const router = express.Router();
router.use(authenticate, async (req, _res, next) => {
  try {
    if (!req.user.role?.isClientUser || !req.user.clientId) throw new ForbiddenError('Subclient portal account required.');
    const subclient = await prisma.client.findFirst({
      where: { id: req.user.clientId, companyId: req.user.companyId, isDeleted: false, status: 'ACTIVE', parentClientId: { not: null } },
      select: { id: true, parentClientId: true, name: true, logoUrl: true, clientCode: true },
    });
    if (!subclient) throw new NotFoundError('Subclient account not found.');
    const parent = await prisma.client.findFirst({
      where: { id: subclient.parentClientId, companyId: req.user.companyId, parentClientId: null, isDeleted: false, status: 'ACTIVE' },
      select: { id: true },
    });
    if (!parent) throw new ForbiddenError('Parent client account is not active.');
    req.user.subclientId = subclient.id;
    req.user.parentClientId = subclient.parentClientId;
    req.user.client = subclient;
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
    status: Joi.string().max(40).allow(''),
  }),
};
const idValidator = { params: Joi.object({ id: Joi.string().uuid().required() }) };

router.get('/dashboard', authorize('clientportal.cases.view'), controller.getDashboard);
router.get('/candidates', authorize('clientportal.candidates.view'), validate(listValidator), controller.listCandidates);
router.get('/cases', authorize('clientportal.cases.view'), validate(listValidator), controller.listCases);
router.get('/cases/:id', authorize('clientportal.cases.view'), validate(idValidator), controller.getCase);
router.get('/reports', authorize('clientportal.reports.view'), validate(listValidator), controller.listReports);
router.get('/reports/:id/download', authorize('clientportal.reports.download'), validate(idValidator), controller.downloadReport);

module.exports = router;
