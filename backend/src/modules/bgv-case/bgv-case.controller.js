'use strict';

const asyncHandler = require('../../utils/asyncHandler');
const { success, created } = require('../../utils/response');
const { parsePagination, buildMeta } = require('../../utils/pagination');
const { writeAudit } = require('../../utils/audit');
const XLSX = require('xlsx');
const service = require('./bgv-case.service');
const { buildReport } = require('./bgv-report.generator');

const fileNamePart = (value, fallback) => String(value || fallback).trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '') || fallback;

const createCase = asyncHandler(async (req, res) => {
  const data = await service.create({ payload: req.body, companyId: req.user.companyId, currentUser: req.user });
  await writeAudit({ req, action: 'BGV_CASE_CREATED', entity: 'BGVCase', entityId: data.id, metadata: { caseNumber: data.caseNumber } });
  return created(res, { message: 'BGV case created successfully.', data });
});

const getCase = asyncHandler(async (req, res) => success(res, { message: 'BGV case', data: await service.getById({ id: req.params.id, companyId: req.user.companyId }) }));

const listCases = asyncHandler(async (req, res) => {
  const pagination = parsePagination(req.query);
  const { items, total } = await service.list({ companyId: req.user.companyId, query: { ...pagination, search: req.query.search, clientId: req.query.clientId, candidateId: req.query.candidateId, status: req.query.status, overallResult: req.query.overallResult, initiatedFrom: req.query.initiatedFrom, initiatedTo: req.query.initiatedTo, sortBy: req.query.sortBy, sortOrder: req.query.sortOrder } });
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
 
module.exports = { createCase, getCase, listCases, exportCases, transitionCase, updateCaseMeta, updateChecks, deleteCase, downloadReport };
