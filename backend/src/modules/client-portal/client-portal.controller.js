'use strict';

const { prisma } = require('../../common/prisma');
const asyncHandler = require('../../utils/asyncHandler');
const { success, created } = require('../../utils/response');
const { parsePagination, buildMeta } = require('../../utils/pagination');
const { NotFoundError, BadRequestError, ConflictError } = require('../../utils/errors');
const candidateService = require('../candidate/candidate.services');
const clientService = require('../client/client.service');
const caseService = require('../bgv-case/bgv-case.service');
const { buildReport, getOverallVerificationStatus } = require('../bgv-case/bgv-report.generator');
const candidatePortalService = require('../candidate-portal/candidate-portal.service');
const { IDENTITY_FIELDS, normalizeConfig } = require('../client/candidate-intake-config');
const { buildInvoicePdf } = require('../invoice/invoice.pdf');
const invoiceService = require('../invoice/invoice.service');

const subclientDto = (item) => ({
  id: item.id,
  parentClientId: item.parentClientId,
  name: item.name,
  clientCode: item.clientCode,
  contactName: item.contactName,
  contactEmail: item.contactEmail,
  contactPhone: item.contactPhone,
  serviceRates: item.serviceRates || [],
  packageRate: item.packageRate,
  status: item.status,
  candidateCount: item.candidateCount ?? 0,
  bgvCaseCount: item.bgvCaseCount ?? 0,
});

const listSubclients = asyncHandler(async (req, res) => {
  const items = await clientService.getSubclients({
    parentClientId: req.user.clientId,
    companyId: req.user.companyId,
  });
  return success(res, { message: 'Client subclients', data: items.map(subclientDto) });
});

const createSubclient = asyncHandler(async (req, res) => {
  const item = await clientService.createSubclient({
    parentClientId: req.user.clientId,
    companyId: req.user.companyId,
    payload: req.body,
    currentUser: req.user,
  });
  return created(res, { message: 'Subclient created successfully.', data: subclientDto(item) });
});

const updateSubclient = asyncHandler(async (req, res) => {
  const item = await clientService.updateSubclient({
    parentClientId: req.user.clientId,
    subclientId: req.params.subclientId,
    companyId: req.user.companyId,
    payload: req.body,
  });
  return success(res, { message: 'Subclient updated successfully.', data: subclientDto(item) });
});

const getCandidateFormConfig = asyncHandler(async (req, res) => {
  const client = await prisma.client.findFirst({
    where: { id: req.user.clientId, companyId: req.user.companyId, isDeleted: false },
    select: { candidateFormConfig: true },
  });
  if (!client) throw new NotFoundError('Client not found.');
  return success(res, { message: 'Candidate form configuration', data: normalizeConfig(client.candidateFormConfig) });
});

const getDashboard = asyncHandler(async (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  const canViewCandidates = req.permissions.has('clientportal.candidates.view');
  const canViewCases = req.permissions.has('clientportal.cases.view');
  const canViewReports = req.permissions.has('clientportal.reports.view');
  const canViewInvoices = req.permissions.has('clientportal.invoices.view');
  const canViewSubclients = req.permissions.has('clientportal.subclients.view') || req.permissions.has('clientportal.subclients.manage');
  const scope = { companyId: req.user.companyId, clientId: req.user.clientId };
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  monthStart.setUTCMonth(monthStart.getUTCMonth() - 11);
  const invoiceWhere = { ...scope, status: { notIn: ['DRAFT', 'VOID'] } };
  const [candidateCount, caseCount, openCaseCount, completedCaseCount, reportCount, invoiceCount, subclientCount, chartCandidates, chartCases, chartReports, chartInvoices, recentCases, recentReports, recentInvoices] = await Promise.all([
    canViewCandidates ? prisma.candidate.count({ where: { ...scope, isDeleted: false } }) : null,
    canViewCases ? prisma.bGVCase.count({ where: scope }) : null,
    canViewCases ? prisma.bGVCase.count({ where: { ...scope, status: { notIn: ['COMPLETED', 'CANCELLED'] } } }) : null,
    canViewCases ? prisma.bGVCase.count({ where: { ...scope, status: 'COMPLETED' } }) : null,
    canViewReports ? prisma.bGVCase.count({ where: { ...scope, status: 'COMPLETED' } }) : null,
    canViewInvoices ? prisma.invoice.count({ where: invoiceWhere }) : null,
    canViewSubclients ? prisma.client.count({ where: { companyId: req.user.companyId, parentClientId: req.user.clientId, isDeleted: false } }) : null,
    canViewCandidates ? prisma.candidate.findMany({
      where: { ...scope, isDeleted: false, createdAt: { gte: monthStart } },
      select: { createdAt: true },
    }) : [],
    canViewCases ? prisma.bGVCase.findMany({
      where: { ...scope, createdAt: { gte: monthStart } },
      select: { createdAt: true, status: true },
    }) : [],
    canViewReports ? prisma.bGVCase.findMany({
      where: { ...scope, status: 'COMPLETED', completedAt: { gte: monthStart } },
      select: { completedAt: true },
    }) : [],
    canViewInvoices ? prisma.invoice.findMany({
      where: { ...invoiceWhere, invoiceDate: { gte: monthStart } },
      select: { invoiceDate: true },
    }) : [],
    canViewCases ? prisma.bGVCase.findMany({
      where: scope,
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        caseNumber: true,
        status: true,
        createdAt: true,
        candidate: { select: { fullName: true, firstName: true, middleName: true, lastName: true, candidateCode: true } },
      },
    }) : [],
    canViewReports ? prisma.bGVCase.findMany({
      where: { ...scope, status: 'COMPLETED', completedAt: { not: null } },
      orderBy: { completedAt: 'desc' },
      take: 5,
      select: {
        id: true,
        caseNumber: true,
        completedAt: true,
        candidate: { select: { fullName: true, firstName: true, middleName: true, lastName: true, candidateCode: true } },
      },
    }) : [],
    canViewInvoices ? prisma.invoice.findMany({
      where: invoiceWhere,
      orderBy: [{ invoiceDate: 'desc' }, { createdAt: 'desc' }],
      take: 5,
      select: { id: true, invoiceNumber: true, status: true, invoiceDate: true, dueDate: true, currency: true, total: true, payments: { select: { amount: true } } },
    }) : [],
  ]);
  const months = Array.from({ length: 12 }, (_, index) => {
    const date = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + index, 1));
    return {
      key: `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`,
      month: date.toLocaleDateString('en-IN', { month: 'short', year: '2-digit', timeZone: 'UTC' }),
      candidates: 0,
      cases: 0,
      reports: 0,
      invoices: 0,
    };
  });
  const monthIndex = new Map(months.map((month, index) => [month.key, index]));
  for (const item of chartCandidates) {
    const index = monthIndex.get(item.createdAt.toISOString().slice(0, 7));
    if (index !== undefined) months[index].candidates += 1;
  }
  for (const item of chartCases) {
    const index = monthIndex.get(item.createdAt.toISOString().slice(0, 7));
    if (index === undefined) continue;
    months[index].cases += 1;
  }
  for (const item of chartReports) {
    const index = monthIndex.get(item.completedAt.toISOString().slice(0, 7));
    if (index !== undefined) months[index].reports += 1;
  }
  for (const item of chartInvoices) {
    const index = monthIndex.get(item.invoiceDate.toISOString().slice(0, 7));
    if (index !== undefined) months[index].invoices += 1;
  }
  return success(res, {
    message: 'Client dashboard summary',
    data: {
      permissions: { candidates: canViewCandidates, cases: canViewCases, reports: canViewReports, invoices: canViewInvoices, subclients: canViewSubclients },
      counts: {
        candidates: candidateCount,
        cases: caseCount,
        openCases: openCaseCount,
        completedCases: completedCaseCount,
        reports: reportCount,
        invoices: invoiceCount,
        subclients: subclientCount,
      },
      monthlyActivity: canViewCandidates || canViewCases || canViewReports || canViewInvoices ? months.map(({ key, month, candidates, cases, reports, invoices }) => ({
        key,
        month,
        ...(canViewCandidates ? { candidates } : {}),
        ...(canViewCases ? { cases } : {}),
        ...(canViewReports ? { reports } : {}),
        ...(canViewInvoices ? { invoices } : {}),
      })) : [],
      recentCases,
      recentReports,
      recentInvoices: canViewInvoices ? recentInvoices.map((invoice) => {
        const amountPaid = invoice.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
        const balanceDue = Math.max(0, Number(invoice.total) - amountPaid);
        const overdue = ['SENT', 'PARTIALLY_PAID', 'OVERDUE'].includes(invoice.status) && balanceDue > 0 && invoice.dueDate < new Date(new Date().toDateString());
        return {
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          status: overdue ? 'OVERDUE' : invoice.status,
          invoiceDate: invoice.invoiceDate,
          currency: invoice.currency,
          total: Number(invoice.total),
        };
      }) : [],
    },
  });
});

const candidateSummary = (candidate) => ({
  id: candidate.id,
  candidateCode: candidate.candidateCode,
  fullName: candidate.fullName,
  firstName: candidate.firstName,
  middleName: candidate.middleName,
  lastName: candidate.lastName,
  email: candidate.email,
  phone: candidate.phone,
  status: candidate.status,
  createdAt: candidate.createdAt,
  subclient: candidate.subclient
    ? { id: candidate.subclient.id, name: candidate.subclient.name, clientCode: candidate.subclient.clientCode }
    : null,
});

const listCandidates = asyncHandler(async (req, res) => {
  const pagination = parsePagination(req.query);
  const { items, total } = await candidateService.list({
    companyId: req.user.companyId,
    query: { ...pagination, clientId: req.user.clientId, subclientId: req.query.subclientId, search: req.query.search, status: req.query.status, dateFrom: req.query.dateFrom, dateTo: req.query.dateTo, sortBy: 'createdAt', sortOrder: 'desc' },
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
      id: true, candidateCode: true, fullName: true, firstName: true, middleName: true, lastName: true, email: true, phone: true, status: true,
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
  const search = req.query.search?.trim();
  const where = {
    companyId: req.user.companyId,
    clientId: req.user.clientId,
    ...(req.query.subclientId === 'none' ? { subclientId: null } : req.query.subclientId ? { subclientId: req.query.subclientId } : {}),
    ...(req.query.status ? { status: req.query.status } : {}),
    ...(req.query.dateFrom || req.query.dateTo ? { createdAt: { ...(req.query.dateFrom ? { gte: new Date(req.query.dateFrom) } : {}), ...(req.query.dateTo ? { lte: new Date(`${req.query.dateTo.slice(0, 10)}T23:59:59.999Z`) } : {}) } } : {}),
    ...(search ? { OR: [
      { caseNumber: { contains: search, mode: 'insensitive' } },
      { candidate: { fullName: { contains: search, mode: 'insensitive' } } },
      { candidate: { firstName: { contains: search, mode: 'insensitive' } } },
      { candidate: { middleName: { contains: search, mode: 'insensitive' } } },
      { candidate: { lastName: { contains: search, mode: 'insensitive' } } },
      { candidate: { candidateCode: { contains: search, mode: 'insensitive' } } },
    ] } : {}),
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
  const search = req.query.search?.trim();
  const where = {
    companyId: req.user.companyId,
    clientId: req.user.clientId,
    status: 'COMPLETED',
    ...(req.query.subclientId === 'none' ? { subclientId: null } : req.query.subclientId ? { subclientId: req.query.subclientId } : {}),
    ...(req.query.status ? { overallResult: req.query.status } : {}),
    ...(req.query.dateFrom || req.query.dateTo ? { completedAt: { ...(req.query.dateFrom ? { gte: new Date(req.query.dateFrom) } : {}), ...(req.query.dateTo ? { lte: new Date(`${req.query.dateTo.slice(0, 10)}T23:59:59.999Z`) } : {}) } } : {}),
    ...(search ? { OR: [
      { caseNumber: { contains: search, mode: 'insensitive' } },
      { candidate: { fullName: { contains: search, mode: 'insensitive' } } },
      { candidate: { firstName: { contains: search, mode: 'insensitive' } } },
      { candidate: { middleName: { contains: search, mode: 'insensitive' } } },
      { candidate: { lastName: { contains: search, mode: 'insensitive' } } },
      { candidate: { candidateCode: { contains: search, mode: 'insensitive' } } },
    ] } : {}),
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
        checks: { select: { type: true, status: true, result: true, resultData: true, remarks: true, documents: { select: { id: true } } } },
        candidate: { select: { fullName: true, firstName: true, middleName: true, lastName: true, candidateCode: true } },
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
      fullName: item.candidate.fullName,
      firstName: item.candidate.firstName,
      middleName: item.candidate.middleName,
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

const listInvoices = asyncHandler(async (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  const pagination = parsePagination(req.query);
  const search = req.query.search?.trim();
  const where = {
    companyId: req.user.companyId,
    clientId: req.user.clientId,
    status: { notIn: ['DRAFT', 'VOID'] },
    ...(req.query.status === 'OVERDUE'
      ? { status: { in: ['SENT', 'PARTIALLY_PAID', 'OVERDUE'] }, dueDate: { lt: new Date(new Date().toDateString()) } }
      : req.query.status ? { status: req.query.status } : {}),
    ...(req.query.dateFrom || req.query.dateTo ? { invoiceDate: { ...(req.query.dateFrom ? { gte: new Date(req.query.dateFrom) } : {}), ...(req.query.dateTo ? { lte: new Date(`${req.query.dateTo.slice(0, 10)}T23:59:59.999Z`) } : {}) } } : {}),
    ...(search ? { OR: [
      { invoiceNumber: { contains: search, mode: 'insensitive' } },
      { purchaseOrderNumber: { contains: search, mode: 'insensitive' } },
    ] } : {}),
  };
  const [invoices, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      ...(!req.query.status || req.query.status !== 'OVERDUE' ? { skip: pagination.skip, take: pagination.limit } : {}),
      orderBy: [{ invoiceDate: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        invoiceNumber: true,
        status: true,
        invoiceDate: true,
        dueDate: true,
        currency: true,
        total: true,
        payments: { select: { amount: true } },
      },
    }),
    prisma.invoice.count({ where }),
  ]);
  const today = new Date(new Date().toDateString());
  const matchingItems = invoices.map((invoice) => {
    const amountPaid = invoice.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
    const balanceDue = Math.max(0, Number(invoice.total) - amountPaid);
    const status = ['SENT', 'PARTIALLY_PAID', 'OVERDUE'].includes(invoice.status) && balanceDue > 0 && invoice.dueDate < today
      ? 'OVERDUE'
      : invoice.status;
    return {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      status,
      invoiceDate: invoice.invoiceDate,
      dueDate: invoice.dueDate,
      currency: invoice.currency,
      total: Number(invoice.total),
      amountPaid,
      balanceDue,
    };
  }).filter((invoice) => !req.query.status || invoice.status === req.query.status);
  const items = req.query.status === 'OVERDUE'
    ? matchingItems.slice(pagination.skip, pagination.skip + pagination.limit)
    : matchingItems;
  const resultTotal = req.query.status === 'OVERDUE' ? matchingItems.length : total;
  return success(res, {
    message: 'Client invoices',
    data: items,
    meta: buildMeta({ page: pagination.page, limit: pagination.limit, total: resultTotal }),
  });
});

const downloadInvoice = asyncHandler(async (req, res) => {
  const invoice = await invoiceService.getById({ id: req.params.id, companyId: req.user.companyId });
  if (invoice.clientId !== req.user.clientId) throw new NotFoundError('Invoice not found.');
  const pdf = await buildInvoicePdf(invoice);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${invoice.invoiceNumber.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf"`);
  res.send(pdf);
});

module.exports = { getCandidateFormConfig, listSubclients, createSubclient, updateSubclient, getDashboard, listCandidates, createCandidate, updateCandidate, getCandidate, inviteCandidate, getCandidatePortalAccess, remindCandidate, updateCandidatePortalAccess, listCases, getCase, listReports, downloadReport, listInvoices, downloadInvoice };
