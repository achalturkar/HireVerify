'use strict';

const asyncHandler = require('../../utils/asyncHandler');
const { success, created } = require('../../utils/response');
const { writeAudit } = require('../../utils/audit');
const service = require('./verification.service');

const list = asyncHandler(async (req, res) => success(res, { message: 'Verification checks', data: (await service.list({ companyId: req.user.companyId, caseId: req.query.caseId, type: req.query.type, status: req.query.status })).items }));
const get = asyncHandler(async (req, res) => success(res, { message: 'Verification check', data: await service.get({ id: req.params.id, companyId: req.user.companyId }) }));
const create = asyncHandler(async (req, res) => { const data = await service.create({ payload: req.body, companyId: req.user.companyId }); await writeAudit({ req, action: 'VERIFICATION_STARTED', entity: 'VerificationCheck', entityId: data.id }); return created(res, { message: 'Verification check created.', data }); });
const update = asyncHandler(async (req, res) => { const data = await service.update({ id: req.params.id, companyId: req.user.companyId, payload: req.body }); await writeAudit({ req, action: 'VERIFICATION_REVIEWED', entity: 'VerificationCheck', entityId: data.id }); return success(res, { message: 'Verification check updated.', data }); });
const retry = asyncHandler(async (req, res) => { const data = await service.retry({ id: req.params.id, companyId: req.user.companyId }); await writeAudit({ req, action: 'VERIFICATION_RETRIED', entity: 'VerificationCheck', entityId: data.id }); return success(res, { message: 'Verification check queued for retry.', data }); });
const executePan = asyncHandler(async (req, res) => { const data = await service.executePan({ id: req.params.id, companyId: req.user.companyId, pan: req.body.pan }); await writeAudit({ req, action: 'VERIFICATION_STARTED', entity: 'VerificationCheck', entityId: data.id }); return success(res, { message: 'PAN verification completed.', data }); });
const downloadPdf = asyncHandler(async (req, res) => { const doc = await service.buildPdf({ id: req.params.id, companyId: req.user.companyId }); res.setHeader('Content-Type', 'application/pdf'); res.setHeader('Content-Disposition', `attachment; filename="verification-${req.params.id}.pdf"`); doc.pipe(res); doc.end(); });
const lock = asyncHandler(async (req, res) => success(res, { message: 'Verification lock updated.', data: await service.lock({ id: req.params.id, companyId: req.user.companyId, locked: req.body.locked, userId: req.user.id }) }));
const uploadDocument = asyncHandler(async (req, res) => {
	if (!req.file) return res.status(400).json({ success: false, message: 'A file is required.' });
	const data = await service.addDocument({ id: req.params.id, companyId: req.user.companyId, documentType: req.body.documentType || 'OTHER', fileName: req.file.originalname, fileUrl: `/uploads/candidate-documents/${req.params.id}/${req.file.filename}`, mimeType: req.file.mimetype, fileSize: req.file.size });
	return success(res, { message: 'Document uploaded.', data });
});
const deleteDocument = asyncHandler(async (req, res) => success(res, { message: 'Document deleted.', data: await service.removeDocument({ id: req.params.id, companyId: req.user.companyId, documentId: req.params.documentId }) }));
module.exports = { list, get, create, update, retry, executePan, downloadPdf, lock, uploadDocument, deleteDocument };
