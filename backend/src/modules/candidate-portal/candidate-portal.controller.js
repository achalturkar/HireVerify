'use strict';

const asyncHandler = require('../../utils/asyncHandler');
const { success, created } = require('../../utils/response');
const service = require('./candidate-portal.service');

const issue = asyncHandler(async (req, res) => {
	const data = await service.issue({ candidateId: req.params.candidateId, companyId: req.user.companyId, expiresInDays: req.body.expiresInDays });
	return created(res, { message: 'Portal link activated.', data }, 'Portal link activated.');
});
const remind = asyncHandler(async (req, res) => {
	const result = await service.remind({ candidateId: req.params.candidateId, companyId: req.user.companyId });
	const message = result.emailSent ? 'Reminder sent.' : 'Reminder email could not be delivered.';
	return success(res, { message, data: result }, message);
});
const status = asyncHandler(async (req, res) => {
	res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
	const data = await service.getStaffStatus({ candidateId: req.params.candidateId, companyId: req.user.companyId });
	return success(res, { message: 'Portal status', data }, 'Portal status');
});
const lock = asyncHandler(async (req, res) => {
	const data = await service.lock({ candidateId: req.params.candidateId, companyId: req.user.companyId, locked: req.body.locked !== false });
	return success(res, { message: 'Portal access updated.', data }, 'Portal access updated.');
});
const getPortal = asyncHandler(async (req, res) => success(res, await service.getPortal(req.params.token), 'Candidate portal'));
const updateProfile = asyncHandler(async (req, res) => success(res, await service.updateProfile(req.params.token, req.body), 'Details updated.'));
const consent = asyncHandler(async (req, res) => success(res, await service.recordConsent(req.params.token, req.body, req), 'Consent recorded.'));
const uploadDocument = asyncHandler(async (req, res) => created(res, await service.addDocument(req.params.token, req.file, req.body.documentType || 'OTHER', req.body.documentNumber), 'Document uploaded.'));

module.exports = { issue, remind, status, lock, getPortal, updateProfile, consent, uploadDocument };
