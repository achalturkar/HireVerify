'use strict';

const { prisma } = require('../../common/prisma');
const asyncHandler = require('../../utils/asyncHandler');
const { success } = require('../../utils/response');
const { parsePagination, buildMeta } = require('../../utils/pagination');
const { NotFoundError, BadRequestError } = require('../../utils/errors');
const caseService = require('../bgv-case/bgv-case.service');
const { buildReport, getOverallVerificationStatus } = require('../bgv-case/bgv-report.generator');

const candidateSelect = {
  id: true,
  candidateCode: true,
  fullName: true,
  firstName: true,
  middleName: true,
  lastName: true,
  email: true,
  status: true,
  createdAt: true,
};

const candidateNameSearch = (search) => ({
  OR: [
    { fullName: { contains: search, mode: 'insensitive' } },
    { firstName: { contains: search, mode: 'insensitive' } },
    { middleName: { contains: search, mode: 'insensitive' } },
    { lastName: { contains: search, mode: 'insensitive' } },
    { candidateCode: { contains: search, mode: 'insensitive' } },
  ],
});

const scope = (req) => ({
  companyId: req.user.companyId,
  clientId: req.user.parentClientId,
  subclientId: req.user.subclientId,
});

const getDashboard = asyncHandler(async (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  const where = scope(req);
  const [candidateCount, caseCount, openCaseCount, completedCaseCount, recentCases] = await Promise.all([
    prisma.candidate.count({ where: { ...where, isDeleted: false } }),
    prisma.bGVCase.count({ where }),
    prisma.bGVCase.count({ where: { ...where, status: { notIn: ['COMPLETED', 'CANCELLED'] } } }),
    prisma.bGVCase.count({ where: { ...where, status: 'COMPLETED' } }),
    prisma.bGVCase.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 6,
      select: {
        id: true,
        caseNumber: true,
        status: true,
        overallResult: true,
        createdAt: true,
        candidate: { select: { fullName: true, firstName: true, middleName: true, lastName: true, candidateCode: true } },
      },
    }),
  ]);
  return success(res, {
    message: 'Subclient dashboard',
    data: { counts: { candidates: candidateCount, cases: caseCount, openCases: openCaseCount, completedCases: completedCaseCount }, recentCases },
  });
});

const listCandidates = asyncHandler(async (req, res) => {
  const pagination = parsePagination(req.query);
  const search = req.query.search?.trim();
  const where = {
    ...scope(req),
    isDeleted: false,
    ...(req.query.status ? { status: req.query.status } : {}),
    ...(search ? candidateNameSearch(search) : {}),
  };
  const [items, total] = await Promise.all([
    prisma.candidate.findMany({
      where,
      skip: pagination.skip,
      take: pagination.limit,
      orderBy: { createdAt: 'desc' },
      select: candidateSelect,
    }),
    prisma.candidate.count({ where }),
  ]);
  return success(res, { message: 'Subclient candidates', data: items, meta: buildMeta({ page: pagination.page, limit: pagination.limit, total }) });
});

const listCases = asyncHandler(async (req, res) => {
  const pagination = parsePagination(req.query);
  const search = req.query.search?.trim();
  const where = {
    ...scope(req),
    ...(req.query.status ? { status: req.query.status } : {}),
    ...(search ? { OR: [{ caseNumber: { contains: search, mode: 'insensitive' } }, { candidate: candidateNameSearch(search) }] } : {}),
  };
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
        candidate: { select: { fullName: true, firstName: true, middleName: true, lastName: true, candidateCode: true } },
      },
    }),
    prisma.bGVCase.count({ where }),
  ]);
  const data = items.map(({ checks, ...item }) => ({ ...item, verificationStatuses: checks.map((check) => check.status) }));
  return success(res, { message: 'Subclient cases', data, meta: buildMeta({ page: pagination.page, limit: pagination.limit, total }) });
});

const getCase = asyncHandler(async (req, res) => {
  const item = await prisma.bGVCase.findFirst({
    where: { id: req.params.id, ...scope(req) },
    select: {
      id: true,
      caseNumber: true,
      status: true,
      overallResult: true,
      initiatedAt: true,
      completedAt: true,
      createdAt: true,
      updatedAt: true,
      candidate: { select: { id: true, candidateCode: true, fullName: true, firstName: true, middleName: true, lastName: true } },
      checks: {
        select: {
          id: true,
          type: true,
          checkType: { select: { label: true } },
          status: true,
          result: true,
          completedAt: true,
          remarks: true,
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  });
  if (!item) throw new NotFoundError('BGV case not found.');
  return success(res, {
    message: 'Subclient BGV case',
    data: {
      ...item,
      checks: item.checks.map((check) => ({ ...check, label: check.checkType?.label || check.type.replaceAll('_', ' ') })),
    },
  });
});

const listReports = asyncHandler(async (req, res) => {
  const pagination = parsePagination(req.query);
  const search = req.query.search?.trim();
  const where = {
    ...scope(req),
    status: 'COMPLETED',
    ...(req.query.status ? { overallResult: req.query.status } : {}),
    ...(search ? { OR: [{ caseNumber: { contains: search, mode: 'insensitive' } }, { candidate: candidateNameSearch(search) }] } : {}),
  };
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
        checks: { select: { status: true } },
        candidate: { select: { fullName: true, firstName: true, middleName: true, lastName: true, candidateCode: true } },
      },
    }),
    prisma.bGVCase.count({ where }),
  ]);
  const data = items.map(({ checks, overallResult, ...item }) => ({
    ...item,
    verificationStatuses: checks.map((check) => check.status),
    reportVerificationStatus: getOverallVerificationStatus(checks, overallResult),
  }));
  return success(res, { message: 'Subclient reports', data, meta: buildMeta({ page: pagination.page, limit: pagination.limit, total }) });
});

const downloadReport = asyncHandler(async (req, res) => {
  const item = await caseService.getById({ id: req.params.id, companyId: req.user.companyId });
  if (item.clientId !== req.user.parentClientId || item.subclientId !== req.user.subclientId) {
    throw new NotFoundError('Report not found.');
  }
  if (item.status !== 'COMPLETED') throw new BadRequestError('This report is not ready yet.');
  const doc = await buildReport(item);
  await caseService.recordReportGenerated(item);
  const safeName = `${item.caseNumber}_BGV_FinalReport.pdf`.replace(/[^a-zA-Z0-9._-]/g, '_');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
  doc.pipe(res);
  doc.end();
});

module.exports = { getDashboard, listCandidates, listCases, getCase, listReports, downloadReport };
