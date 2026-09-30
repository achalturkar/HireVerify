'use strict';

const express = require('express');
const controller = require('./invoice.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorize, requireRole } = require('../../middleware/authorize.middleware');
const { validate } = require('../../middleware/validate.middleware');
const v = require('./invoice.validator');

const router = express.Router();
router.use(authenticate);
router.get('/platform', requireRole({ superAdmin: true }), authorize('invoice.view'), validate(v.listValidator), controller.listPlatform);
router.get('/profile', authorize('invoice.view'), controller.getProfile);
router.put('/profile', authorize('invoice.update'), validate(v.profileValidator), controller.saveProfile);
router.get('/cases', authorize('invoice.view'), controller.listCases);
router.get('/', authorize('invoice.view'), validate(v.listValidator), controller.list);
router.post('/', authorize('invoice.create'), validate(v.invoiceBody), controller.create);
router.get('/:id/pdf', authorize('invoice.view'), validate(v.idParamValidator), controller.downloadPdf);
router.post('/:id/send', authorize('invoice.send'), validate(v.emailValidator), controller.send);
router.post('/:id/payments', authorize('invoice.payment'), validate(v.paymentValidator), controller.recordPayment);
router.post('/:id/void', authorize('invoice.void'), validate(v.idParamValidator), controller.voidInvoice);
router.patch('/:id/status', authorize('invoice.update'), validate(v.statusValidator), controller.changeStatus);
router.delete('/:id', authorize('invoice.delete'), validate(v.idParamValidator), controller.remove);
router.get('/:id', authorize('invoice.view'), validate(v.idParamValidator), controller.getById);
router.put('/:id', authorize('invoice.update'), validate([...v.idParamValidator, ...v.invoiceBody]), controller.update);

module.exports = router;