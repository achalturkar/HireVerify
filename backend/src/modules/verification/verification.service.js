'use strict';

const repo = require('./verification.repository');
const { NotFoundError, BadRequestError } = require('../../utils/errors');
const PDFDocument = require('pdfkit');
const surepass = require('./providers/surepass.provider');

const toDto = (check) => ({
  id: check.id, caseId: check.caseId, type: check.type, provider: check.provider,
  status: check.status, result: check.result, priority: check.priority,
  providerRequestId: check.providerRequestId, providerReferenceId: check.providerReferenceId,
  inputData: check.inputData, resultData: check.resultData, failureReason: check.failureReason,
  remarks: check.remarks, startedAt: check.startedAt, completedAt: check.completedAt,
  retryCount: check.retryCount, createdAt: check.createdAt, updatedAt: check.updatedAt,
  isLocked: check.isLocked, lockedAt: check.lockedAt, documents: check.documents || [],
  case: check.case,
});

const get = async ({ id, companyId }) => {
  const check = await repo.findById(id, companyId);
  if (!check) throw new NotFoundError('Verification check not found');
  return toDto(check);
};

const list = async ({ companyId, caseId, type, status }) => ({ items: (await repo.list(companyId, { caseId, type, status })).map(toDto) });

const create = async ({ payload, companyId }) => {
  if (!(await repo.findCase(payload.caseId, companyId))) throw new NotFoundError('BGV case not found');
  const check = await repo.create({ caseId: payload.caseId, type: payload.type, provider: payload.provider || 'SUREPASS', priority: payload.priority || 0, inputData: payload.inputData || null });
  await repo.event({ caseId: check.caseId, verificationId: check.id, eventType: 'CREATED', message: 'Verification check created' });
  return toDto(check);
};

const update = async ({ id, companyId, payload }) => {
  const current = await repo.findById(id, companyId);
  if (!current) throw new NotFoundError('Verification check not found');
  if (current.isLocked) throw new BadRequestError('This verification is locked');
  if (current.status === 'CANCELLED' && payload.status !== 'CANCELLED') throw new BadRequestError('Cancelled checks cannot be reopened');
  const data = { status: payload.status || current.status, ...(payload.result !== undefined ? { result: payload.result } : {}), ...(payload.resultData !== undefined ? { resultData: payload.resultData } : {}), ...(payload.failureReason !== undefined ? { failureReason: payload.failureReason } : {}), ...(payload.remarks !== undefined ? { remarks: payload.remarks } : {}) };
  if (data.status === 'IN_PROGRESS' && !current.startedAt) data.startedAt = new Date();
  if (data.status === 'COMPLETED' || data.status === 'FAILED') data.completedAt = new Date();
  const updated = await repo.update(id, data);
  await repo.event({ caseId: updated.caseId, verificationId: id, eventType: data.status === 'COMPLETED' ? 'COMPLETED' : data.status === 'FAILED' ? 'FAILED' : 'STATUS_CHANGED', status: updated.status, message: `Verification status changed to ${updated.status}` });
  return toDto(await repo.findById(id, companyId));
};

const lock = async ({ id, companyId, locked, userId }) => {
  const current = await repo.findById(id, companyId);
  if (!current) throw new NotFoundError('Verification check not found');
  await repo.update(id, { isLocked: locked, lockedAt: locked ? new Date() : null, lockedById: locked ? userId : null });
  return toDto(await repo.findById(id, companyId));
};

const addDocument = async ({ id, companyId, documentType, fileName, fileUrl, mimeType, fileSize }) => {
  const current = await repo.findById(id, companyId);
  if (!current) throw new NotFoundError('Verification check not found');
  if (current.isLocked) throw new BadRequestError('This verification is locked');
  await repo.addDocument({ candidateId: current.case.candidateId, verificationId: id, documentType, fileName, fileUrl, mimeType, fileSize });
  return toDto(await repo.findById(id, companyId));
};

const removeDocument = async ({ id, companyId, documentId }) => {
  const current = await repo.findById(id, companyId);
  if (!current) throw new NotFoundError('Verification check not found');
  if (current.isLocked) throw new BadRequestError('This verification is locked');
  await repo.deleteDocument(documentId, id);
  return toDto(await repo.findById(id, companyId));
};

const retry = async ({ id, companyId }) => update({ id, companyId, payload: { status: 'RETRYING' } });

const executePan = async ({ id, companyId, pan: submittedPan }) => {
  const current = await repo.findById(id, companyId);
  if (!current) throw new NotFoundError('Verification check not found');
  if (current.type !== 'PAN') throw new BadRequestError('This verification check is not a PAN check');

  const pan = String(submittedPan || '').trim().toUpperCase();
  if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan)) throw new BadRequestError('A valid PAN number is required');

  await repo.update(id, { status: 'IN_PROGRESS', startedAt: new Date(), inputData: { ...current.inputData, pan: 'REDACTED' } });
  await repo.event({ caseId: current.caseId, verificationId: id, eventType: 'API_REQUEST', message: 'PAN verification request sent' });
  try {
    const result = await surepass.verifyPan({ pan });
    const updated = await repo.update(id, { status: 'COMPLETED', result: result.result, resultData: result.resultData, providerRequestId: result.providerRequestId, providerReferenceId: result.providerReferenceId, rawResponse: result.rawResponse, completedAt: new Date(), failureReason: null });
    await repo.event({ caseId: current.caseId, verificationId: id, eventType: 'COMPLETED', status: 'COMPLETED', message: 'PAN verification completed' });
    return toDto(updated);
  } catch (error) {
    await repo.update(id, { status: 'FAILED', result: 'UNABLE_TO_VERIFY', failureReason: error.message, completedAt: new Date() });
    await repo.event({ caseId: current.caseId, verificationId: id, eventType: 'FAILED', status: 'FAILED', message: 'PAN verification failed' });
    throw error;
  }
};

const buildPdf = async ({ id, companyId }) => {
  const check = await repo.findById(id, companyId);
  if (!check) throw new NotFoundError('Verification check not found');
  const doc = new PDFDocument({ size: 'A4', margin: 48 });
  doc.fillColor('#0B3B66').fontSize(22).font('Helvetica-Bold').text('HireVerify', { continued: true }).fillColor('#0E7C6B').text(' Verification Report');
  doc.moveDown(0.5).fillColor('#667085').fontSize(10).font('Helvetica').text(`Generated ${new Date().toLocaleString()}`);
  doc.moveDown().strokeColor('#D0D5DD').moveTo(48, doc.y).lineTo(547, doc.y).stroke();
  doc.moveDown().fillColor('#101828').fontSize(15).font('Helvetica-Bold').text(`${check.type} Verification`);
  doc.moveDown(0.6).fontSize(10).font('Helvetica');
  const rows = [['Check ID', check.id], ['Case', check.case?.caseNumber || check.caseId], ['Provider', check.provider], ['Status', check.status], ['Result', check.result], ['Started', check.startedAt ? new Date(check.startedAt).toLocaleString() : 'Not started'], ['Completed', check.completedAt ? new Date(check.completedAt).toLocaleString() : 'Not completed']];
  rows.forEach(([label, value]) => { doc.fillColor('#667085').text(`${label}:`, { continued: true, width: 100 }); doc.fillColor('#101828').text(` ${value}`); doc.moveDown(0.25); });
  doc.moveDown().fillColor('#101828').fontSize(13).font('Helvetica-Bold').text('Normalized findings');
  doc.moveDown(0.4).fontSize(10).font('Helvetica');
  const findings = check.resultData || {};
  Object.entries(findings).forEach(([key, value]) => doc.fillColor('#344054').text(`${key}: ${value === null || value === undefined ? 'Not available' : String(value)}`));
  doc.moveDown(2).fillColor('#667085').fontSize(9).text('Confidential verification document. This report contains normalized findings for authorized users only.');
  return doc;
};

module.exports = { get, list, create, update, retry, executePan, lock, addDocument, removeDocument, buildPdf };
