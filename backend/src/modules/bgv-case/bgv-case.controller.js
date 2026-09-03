'use strict';

const asyncHandler = require('../../utils/asyncHandler');
const { success, created } = require('../../utils/response');
const { parsePagination, buildMeta } = require('../../utils/pagination');
const { writeAudit } = require('../../utils/audit');
const XLSX = require('xlsx');
const service = require('./bgv-case.service');
const { buildReport } = require('./bgv-report.generator');
const { sendMail, buildBgvReportsEmail } = require('../../utils/mailer');
const { BadRequestError } = require('../../utils/errors');

const fileNamePart = (value, fallback) => String(value || fallback).trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '') || fallback;

const createCase = asyncHandler(async (req, res) => {
  const data = await service.create({ payload: req.body, companyId: req.user.companyId, currentUser: req.user });
  await writeAudit({ req, action: 'BGV_CASE_CREATED', entity: 'BGVCase', entityId: data.id, metadata: { caseNumber: data.caseNumber } });
  return created(res, { message: 'BGV case created successfully.', data });
});

const getCase = asyncHandler(async (req, res) => success(res, { message: 'BGV case', data: await service.getById({ id: req.params.id, companyId: req.user.companyId }) }));

const listCases = asyncHandler(async (req, res) => {
  const pagination = parsePagination(req.query);
  const { items, total } = await service.list({ companyId: req.user.companyId, query: { ...pagination, search: req.query.search, clientId: req.query.clientId, candidateId: req.query.candidateId, status: req.query.status, overallResult: req.query.overallResult, initiatedFrom: req.query.initiatedFrom, initiatedTo: req.query.initiatedTo, completedFrom: req.query.completedFrom, completedTo: req.query.completedTo, sortBy: req.query.sortBy, sortOrder: req.query.sortOrder } });
  return success(res, { message: 'BGV cases', data: items, meta: buildMeta({ page: pagination.page, limit: pagination.limit, total }) });
});

const exportCases = asyncHandler(async (req, res) => {
  const { items } = await service.list({ companyId: req.user.companyId, query: { skip: 0, limit: 100000, search: req.query.search, clientId: req.query.clientId, candidateId: req.query.candidateId, status: req.query.status, overallResult: req.query.overallResult, initiatedFrom: req.query.initiatedFrom, initiatedTo: req.query.initiatedTo, sortBy: 'initiatedAt', sortOrder: 'asc' } });
  const rows = items.map((item) => ({
    'Case Number': item.caseNumber,
    'Candidate Name': item.candidate ? `${item.candidate.firstName} ${item.candidate.lastName}`.trim() : '',
    'Candidate Code': item.candidate?.candidateCode || '',
    Client: item.client?.name || '',
    'Client Code': item.client?.clientCode || '',
    'Initiated Date': item.initiatedAt ? new Date(item.initiatedAt).toISOString().slice(0, 10) : '',
    Status: item.status.replaceAll('_', ' '),
    Result: item.overallResult.replaceAll('_', ' '),
    'Checks Count': item._count?.checks || 0,
  }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), 'BGV Cases');
  const uniqueCandidates = new Set(items.map((item) => item.candidateId)).size;
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([
    { Metric: 'Total BGV cases', Value: items.length },
    { Metric: 'Unique candidates initiated', Value: uniqueCandidates },
    { Metric: 'Initiated from', Value: req.query.initiatedFrom || 'All dates' },
    { Metric: 'Initiated to', Value: req.query.initiatedTo || 'All dates' },
  ]), 'Summary');
  const file = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="bgv-cases-export.xlsx"');
  res.send(file);
});

const transitionCase = asyncHandler(async (req, res) => {
  const data = await service.transition({ id: req.params.id, companyId: req.user.companyId, status: req.body.status, remarks: req.body.remarks, currentUser: req.user });
  await writeAudit({ req, action: 'BGV_CASE_UPDATED', entity: 'BGVCase', entityId: req.params.id, metadata: { status: req.body.status } });
  return success(res, { message: 'BGV case status updated.', data });
});

const updateCaseMeta = asyncHandler(async (req, res) => {
  const data = await service.updateMeta({ id: req.params.id, companyId: req.user.companyId, payload: req.body, currentUser: req.user });
  await writeAudit({ req, action: 'BGV_CASE_UPDATED', entity: 'BGVCase', entityId: req.params.id });
  return success(res, { message: 'Case updated.', data });
});
const updateChecks = asyncHandler(async (req, res) => {
  const data = await service.updateChecks({ id: req.params.id, companyId: req.user.companyId, checks: req.body.checks, currentUser: req.user });
  await writeAudit({ req, action: 'BGV_CASE_CHECKS_UPDATED', entity: 'BGVCase', entityId: req.params.id, metadata: { checkTypes: req.body.checks.map((check) => check.type) } });
  return success(res, { message: 'Case verification checks updated.', data });
});
const deleteCase = asyncHandler(async (req, res) => {
  await service.remove({ id: req.params.id, companyId: req.user.companyId });
  await writeAudit({ req, action: 'BGV_CASE_DELETED', entity: 'BGVCase', entityId: req.params.id });
  return success(res, { message: 'BGV case deleted.' });
});
const downloadReport = asyncHandler(async (req, res) => {
  const item = await service.getById({ id: req.params.id, companyId: req.user.companyId });
  const doc = await buildReport(item);
  const candidateName = [item.candidate?.firstName, item.candidate?.lastName]
    .filter(Boolean)
    .map((name) => fileNamePart(name, ''))
    .filter(Boolean)
    .join('_') || 'Candidate';
  const reportFileName = `${fileNamePart(item.caseNumber, 'BGV')}_${candidateName}_BGV_FinalReport.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${reportFileName}"`);
  doc.pipe(res);
  doc.end();
});

const sendReportsByEmail = asyncHandler(async (req, res) => {
  const items = await Promise.all(req.body.caseIds.map((id) => service.getById({ id, companyId: req.user.companyId })));
  if (items.some((item) => item.status !== 'COMPLETED')) throw new BadRequestError('Only completed BGV cases can be emailed.');
  const clientIds = new Set(items.map((item) => item.clientId));
  if (clientIds.size !== 1) throw new BadRequestError('Select reports for one client only.');
  const recipient = items[0].client?.contactEmail;
  if (!recipient) throw new BadRequestError('The selected client does not have a contact email.');
  const attachments = await Promise.all(items.map(async (item) => {
    const doc = await buildReport(item);
    const chunks = [];
    const pdf = new Promise((resolve, reject) => { doc.on('data', (chunk) => chunks.push(chunk)); doc.on('end', () => resolve(Buffer.concat(chunks))); doc.on('error', reject); });
    doc.end();
    return { filename: `${item.caseNumber}_BGV_FinalReport.pdf`, content: await pdf, contentType: 'application/pdf' };
  }));
  const companyName = items[0].client?.company?.name || 'HireAssess';
  const mail = buildBgvReportsEmail({ clientName: items[0].client?.name || 'Client', companyName, reports: items.map((item) => ({ candidateName: `${item.candidate?.firstName || ''} ${item.candidate?.lastName || ''}`.trim() || 'Candidate', caseNumber: item.caseNumber, completedDate: item.completedAt ? new Date(item.completedAt).toLocaleDateString('en-GB') : 'Completed' })) });
  await sendMail({ to: recipient, ...mail, attachments, replyTo: items[0].client?.company?.contactEmail || undefined });
  return success(res, { message: `${items.length} report${items.length === 1 ? '' : 's'} sent to ${recipient}.` });
});
 
module.exports = { createCase, getCase, listCases, exportCases, transitionCase, updateCaseMeta, updateChecks, deleteCase, downloadReport, sendReportsByEmail };
