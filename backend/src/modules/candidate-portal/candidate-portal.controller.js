'use strict';

const asyncHandler = require('../../utils/asyncHandler');
const { success, created } = require('../../utils/response');
const { writeAudit } = require('../../utils/audit');
const service = require('./candidate-portal.service');

const issue = asyncHandler(async (req, res) => {
	const data = await service.issue({ candidateId: req.params.candidateId, companyId: req.user.companyId, expiresInDays: req.body.expiresInDays });
	return created(res, { message: 'Portal link activated.', data }, 'Portal link activated.');
});
const extend = asyncHandler(async (req, res) => {
	const data = await service.extend({ candidateId: req.params.candidateId, companyId: req.user.companyId, expiresInDays: req.body.expiresInDays, sendEmail: req.body.sendEmail === true });
	const message = data.emailSent ? 'Portal link extended and emailed.' : req.body.sendEmail === true ? 'Portal link extended, but the email could not be delivered.' : 'Portal link extended without sending an email.';
	return success(res, { message, data }, message);
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
const unlockForCorrections = asyncHandler(async (req, res) => {
	const data = await service.unlockForCorrections({
		candidateId: req.params.candidateId,
		companyId: req.user.companyId,
		clientId: req.user.clientId,
		expiresInDays: req.body.expiresInDays,
	});
	await writeAudit({
		req,
		action: 'CANDIDATE_PORTAL_CORRECTIONS_UNLOCKED',
		entity: 'Candidate',
		entityId: req.params.candidateId,
		metadata: { emailSent: data.emailSent, expiresAt: data.expiresAt },
	});
	const message = data.emailSent
		? 'Candidate portal unlocked for corrections and a new link was emailed.'
		: 'Candidate portal unlocked for corrections, but the email could not be delivered.';
	return success(res, { message, data }, message);
});
const validateUpload = asyncHandler(async (req, _res, next) => {
	await service.assertPortalEditable(req.params.token);
	next();
});
const getPortal = asyncHandler(async (req, res) => success(res, await service.getPortal(req.params.token), 'Candidate portal'));
const downloadFormTemplate = asyncHandler(async (req, res, next) => {
	const { filePath, fileName } = await service.getCandidateFormTemplate(req.params.token, req.params.formId);
	res.set({
		'Cache-Control': 'private, no-store',
		'X-Content-Type-Options': 'nosniff',
	});
	res.download(filePath, fileName, (error) => {
		if (error) next(error);
	});
});
const updateProfile = asyncHandler(async (req, res) => success(res, await service.updateProfile(req.params.token, req.body), 'Details updated.'));
const consent = asyncHandler(async (req, res) => success(res, await service.recordConsent(req.params.token, req.body, req), 'Consent recorded.'));
const uploadDocument = asyncHandler(async (req, res) => created(res, await service.addDocument(req.params.token, req.file, req.body.documentType || 'OTHER', req.body.documentNumber, req.body.customFormId, req.body.documentCategory), 'Document uploaded.'));
const deletePortalDocument = asyncHandler(async (req, res) => success(res, await service.deletePortalDocument(req.params.token, req.params.documentId), 'Uploaded document deleted.'));

module.exports = { issue, extend, remind, status, lock, unlockForCorrections, validateUpload, getPortal, downloadFormTemplate, updateProfile, consent, uploadDocument, deletePortalDocument };
