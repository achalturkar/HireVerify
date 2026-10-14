'use strict';

const { prisma } = require('../../common/prisma');
const asyncHandler = require('../../utils/asyncHandler');
const { success, created } = require('../../utils/response');
const { parsePagination, buildMeta } = require('../../utils/pagination');
const { NotFoundError, BadRequestError, ConflictError } = require('../../utils/errors');
const candidateService = require('../candidate/candidate.services');
const caseService = require('../bgv-case/bgv-case.service');
const { buildReport, getOverallVerificationStatus } = require('../bgv-case/bgv-report.generator');
const candidatePortalService = require('../candidate-portal/candidate-portal.service');
const { IDENTITY_FIELDS, normalizeConfig } = require('../client/candidate-intake-config');

const getCandidateFormConfig = asyncHandler(async (req, res) => {
  const client = await prisma.client.findFirst({
    where: { id: req.user.clientId, companyId: req.user.companyId, isDeleted: false },
    select: { candidateFormConfig: true },
  });
  if (!client) throw new NotFoundError('Client not found.');
  return success(res, { message: 'Candidate form configuration', data: normalizeConfig(client.candidateFormConfig) });
});

const candidateSummary = (candidate) => ({
  id: candidate.id,
  candidateCode: candidate.candidateCode,
  firstName: candidate.firstName,
  lastName: candidate.lastName,
  email: candidate.email,
  phone: candidate.phone,
  status: candidate.status,
  createdAt: candidate.createdAt,
});

const listCandidates = asyncHandler(async (req, res) => {
  const pagination = parsePagination(req.query);
  const { items, total } = await candidateService.list({
    companyId: req.user.companyId,
    query: { ...pagination, clientId: req.user.clientId, search: req.query.search, sortBy: 'createdAt', sortOrder: 'desc' },
  });
  return success(res, {
    message: 'Client candidates',
    data: items.map(candidateSummary),
    meta: buildMeta({ page: pagination.page, limit: pagination.limit, total }),
  });
});

const createCandidate = asyncHandler(async (req, res) => {
  const data = await candidateService.create({
    companyId: req.user.companyId,
    currentUser: req.user,
    payload: { ...req.body, clientId: req.user.clientId },
  });
  return created(res, { message: 'Candidate created.', data: candidateSummary(data) });
});

const updateCandidate = asyncHandler(async (req, res) => {
  const existing = await prisma.candidate.findFirst({
    where: { id: req.params.id, clientId: req.user.clientId, companyId: req.user.companyId, isDeleted: false },
    select: { id: true, status: true, bgvCases: { select: { id: true }, take: 1 } },
  });
  if (!existing) throw new NotFoundError('Candidate not found.');
  if (existing.bgvCases.length > 0 || ['COMPLETED', 'VERIFICATION_IN_PROGRESS'].includes(existing.status)) {
    throw new ConflictError('Candidate details cannot be changed after verification has started or completed.');
  }
  const client = await prisma.client.findFirst({
    where: { id: req.user.clientId, companyId: req.user.companyId, isDeleted: false },
    select: { candidateFormConfig: true },
  });
  const intakeConfig = normalizeConfig(client?.candidateFormConfig);
  for (const field of IDENTITY_FIELDS) {
    if (req.body[field.key] && !intakeConfig[field.key].enabled) {
      throw new BadRequestError(`${field.label} is not enabled for this client’s candidate form.`);
    }
  }
  const data = await candidateService.update({
    id: existing.id,
    companyId: req.user.companyId,
    currentUser: req.user,
    payload: req.body,
  });
  return success(res, { message: 'Candidate updated.', data: candidateSummary(data) });
});

const getCandidate = asyncHandler(async (req, res) => {
  const candidate = await prisma.candidate.findFirst({
    where: { id: req.params.id, companyId: req.user.companyId, clientId: req.user.clientId, isDeleted: false },
    select: {
      id: true, candidateCode: true, firstName: true, lastName: true, email: true, phone: true, status: true,
      dateOfBirth: true, gender: true, fatherName: true, motherName: true, aadhaarNumber: true, panNumber: true,
      uanNumber: true, passportNumber: true, drivingLicenseNumber: true, voterIdNumber: true,
      highestQualification: true, courseName: true, institutionName: true, universityName: true, yearOfPassing: true,
      gradeOrPercentage: true, employeeId: true, employeeDesignation: true, employeeDepartment: true,
      employmentType: true, joiningDate: true, workLocation: true, currentEmployer: true, currentAddress: true,
      permanentAddress: true, createdAt: true, updatedAt: true,
      documents: { select: { id: true, documentType: true, documentNumber: true, fileName: true, fileUrl: true, verificationStatus: true, uploadedAt: true }, orderBy: { uploadedAt: 'desc' } },
      bgvCases: { select: { id: true, caseNumber: true, status: true, overallResult: true, initiatedAt: true, completedAt: true, createdAt: true }, orderBy: { createdAt: 'desc' } },
      portalInvitation: { select: { activatedAt: true, lastSentAt: true, expiresAt: true, revokedAt: true, reminderCount: true } },
      client: { select: { candidateFormConfig: true } },
    },
  });
  if (!candidate) throw new NotFoundError('Candidate not found.');
  return success(res, {
    message: 'Client candidate',
    data: {
      ...candidate,
      client: { candidateFormConfig: normalizeConfig(candidate.client?.candidateFormConfig) },
    },
  });
});

const inviteCandidate = asyncHandler(async (req, res) => {
  const candidate = await prisma.candidate.findFirst({
    where: { id: req.params.id, companyId: req.user.companyId, clientId: req.user.clientId, isDeleted: false },
    select: { id: true },
  });
  if (!candidate) throw new NotFoundError('Candidate not found.');
  const invitation = await candidatePortalService.issue({
    candidateId: candidate.id,
    companyId: req.user.companyId,
    expiresInDays: req.body.expiresInDays,
  });
  const data = { emailSent: invitation.emailSent, expiresAt: invitation.expiresAt, lastSentAt: invitation.lastSentAt, url: invitation.url };
  return success(res, { message: data.emailSent ? 'Candidate invitation sent.' : 'Invitation could not be delivered by email.', data });
});

const getCandidatePortalAccess = asyncHandler(async (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  const data = await candidatePortalService.getStaffStatus({
    candidateId: req.params.id,
    companyId: req.user.companyId,
    clientId: req.user.clientId,
  });
  return success(res, { message: 'Candidate portal access status', data });
});

const remindCandidate = asyncHandler(async (req, res) => {
  const result = await candidatePortalService.remind({
    candidateId: req.params.id,
    companyId: req.user.companyId,
    clientId: req.user.clientId,
  });
  return success(res, {
    message: result.emailSent ? 'Candidate portal reminder sent.' : 'Candidate portal reminder email could not be delivered.',
    data: { emailSent: result.emailSent, lastSentAt: result.lastSentAt, expiresAt: result.expiresAt },
  });
});

const updateCandidatePortalAccess = asyncHandler(async (req, res) => {
  const data = await candidatePortalService.lock({
    candidateId: req.params.id,
    companyId: req.user.companyId,
    clientId: req.user.clientId,
    locked: req.body.locked,
  });
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  return success(res, { message: 'Candidate portal access updated.', data });
});

const listCases = asyncHandler(async (req, res) => {
  const pagination = parsePagination(req.query);
  const where = { companyId: req.user.companyId, clientId: req.user.clientId };
  const [items, total] = await Promise.all([
    prisma.bGVCase.findMany({
      where,
      skip: pagination.skip,
      take: pagination.limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        caseNumber: true,
        status: true,
        overallResult: true,
        initiatedAt: true,
        completedAt: true,
        createdAt: true,
        checks: { select: { status: true } },
        candidate: { select: { firstName: true, lastName: true, candidateCode: true } },
      },
    }),
    prisma.bGVCase.count({ where }),
  ]);
  return success(res, {
    message: 'Client cases',
    data: items.map(({ checks, ...item }) => ({
      ...item,
      verificationStatuses: checks.map((check) => check.status),
    })),
    meta: buildMeta({ page: pagination.page, limit: pagination.limit, total }),
  });
});

const listReports = asyncHandler(async (req, res) => {
  const pagination = parsePagination(req.query);
  const where = { companyId: req.user.companyId, clientId: req.user.clientId, status: 'COMPLETED' };
  const [items, total] = await Promise.all([
    prisma.bGVCase.findMany({
      where,
      skip: pagination.skip,
      take: pagination.limit,
      orderBy: { completedAt: 'desc' },
      select: {
        id: true,
        caseNumber: true,
        completedAt: true,
        overallResult: true,
        checks: { select: { type: true, status: true, result: true, resultData: true, remarks: true, documents: { select: { id: true } } } },
        candidate: { select: { firstName: true, lastName: true, candidateCode: true } },
      },
    }),
    prisma.bGVCase.count({ where }),
  ]);
  return success(res, {
    message: 'Completed client reports',
    data: items.map(({ checks, ...item }) => ({
      ...item,
      verificationStatuses: checks.map((check) => check.status),
      reportVerificationStatus: getOverallVerificationStatus(checks, item.overallResult),
    })),
    meta: buildMeta({ page: pagination.page, limit: pagination.limit, total }),
  });
});

const getCase = asyncHandler(async (req, res) => {
  const item = await caseService.getById({ id: req.params.id, companyId: req.user.companyId });
  if (item.clientId !== req.user.clientId) throw new NotFoundError('BGV case not found.');
  const data = {
    id: item.id,
    caseNumber: item.caseNumber,
    status: item.status,
    overallResult: item.overallResult,
    initiatedAt: item.initiatedAt,
    completedAt: item.completedAt,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    candidate: item.candidate ? {
      id: item.candidate.id,
      candidateCode: item.candidate.candidateCode,
      firstName: item.candidate.firstName,
      lastName: item.candidate.lastName,
      email: item.candidate.email,
      phone: item.candidate.phone,
    } : null,
    checks: (item.checks || []).map((check) => ({
      id: check.id,
      type: check.type,
      status: check.status,
      result: check.result,
      startedAt: check.startedAt,
      completedAt: check.completedAt,
      remarks: check.remarks,
    })),
  };
  return success(res, { message: 'Client BGV case', data });
});

const downloadReport = asyncHandler(async (req, res) => {
  const item = await caseService.getById({ id: req.params.id, companyId: req.user.companyId });
  if (item.clientId !== req.user.clientId) throw new NotFoundError('Report not found.');
  if (item.status !== 'COMPLETED') throw new BadRequestError('This report is not ready yet.');

  const doc = await buildReport(item);
  await caseService.recordReportGenerated(item);
  const safeName = `${item.caseNumber}_BGV_FinalReport.pdf`.replace(/[^a-zA-Z0-9._-]/g, '_');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
  doc.pipe(res);
  doc.end();
});

module.exports = { getCandidateFormConfig, listCandidates, createCandidate, updateCandidate, getCandidate, inviteCandidate, getCandidatePortalAccess, remindCandidate, updateCandidatePortalAccess, listCases, getCase, listReports, downloadReport };
