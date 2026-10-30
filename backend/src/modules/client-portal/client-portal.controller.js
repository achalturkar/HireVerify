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
const clientAccessService = require('../client/client-access.service');

const SUBCLIENT_PORTAL_PERMISSIONS = [
  'clientportal.candidates.view',
  'clientportal.cases.view',
  'clientportal.reports.view',
  'clientportal.reports.download',
];

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

const assertManagedSubclient = async (req) => {
  const subclient = await prisma.client.findFirst({
    where: {
      id: req.params.subclientId,
      parentClientId: req.user.clientId,
      companyId: req.user.companyId,
      isDeleted: false,
    },
    select: { id: true },
  });
  if (!subclient) throw new NotFoundError('Subclient not found.');
  return subclient;
};

const listSubclientUsers = asyncHandler(async (req, res) => {
  await assertManagedSubclient(req);
  const data = await clientAccessService.list({ clientId: req.params.subclientId, companyId: req.user.companyId });
  return success(res, { message: 'Subclient portal users', data });
});

const inviteSubclientUser = asyncHandler(async (req, res) => {
  await assertManagedSubclient(req);
  const data = await clientAccessService.invite({
    clientId: req.params.subclientId,
    companyId: req.user.companyId,
    payload: { ...req.body, permissions: SUBCLIENT_PORTAL_PERMISSIONS },
  });
  return created(res, { message: 'Subclient portal user created.', data });
});

const updateSubclientUser = asyncHandler(async (req, res) => {
  await assertManagedSubclient(req);
  const data = await clientAccessService.update({
    clientId: req.params.subclientId,
    companyId: req.user.companyId,
    userId: req.params.userId,
    payload: { status: req.body.status },
  });
  return success(res, { message: 'Subclient portal user updated.', data });
});

const removeSubclientUser = asyncHandler(async (req, res) => {
  await assertManagedSubclient(req);
  await clientAccessService.remove({
    clientId: req.params.subclientId,
    companyId: req.user.companyId,
    userId: req.params.userId,
  });
  return success(res, { message: 'Subclient portal user removed.' });
});

const getCandidateFormConfig = asyncHandler(async (req, res) => {
  const client = await prisma.client.findFirst({
    where: { id: req.user.clientId, companyId: req.user.companyId, isDeleted: false },
    select: { candidateFormConfig: true },
  });
  if (!client) throw new NotFoundError('Client not found.');
  return success(res, { message: 'Candidate form configuration', data: normalizeConfig(client.candidateFormConfig) });
});

const getNotifications = asyncHandler(async (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  const scope = { companyId: req.user.companyId, clientId: req.user.clientId };
  const [candidates, cases, completedCases, reports, invoices, payments] = await Promise.all([
    req.permissions.has('clientportal.candidates.view')
      ? prisma.candidate.findMany({
        where: { ...scope, isDeleted: false },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { id: true, candidateCode: true, fullName: true, createdAt: true },
      })
      : [],
    req.permissions.has('clientportal.cases.view')
      ? prisma.bGVCase.findMany({
        where: scope,
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { id: true, caseNumber: true, status: true, createdAt: true, completedAt: true, candidate: { select: { fullName: true } } },
      })
      : [],
    req.permissions.has('clientportal.cases.view')
      ? prisma.bGVCase.findMany({
        where: { ...scope, status: 'COMPLETED', completedAt: { not: null } },
        orderBy: { completedAt: 'desc' },
        take: 10,
        select: { id: true, caseNumber: true, completedAt: true, candidate: { select: { fullName: true } } },
      })
      : [],
    req.permissions.has('clientportal.reports.view')
      ? prisma.bGVCase.findMany({
        where: { ...scope, status: 'COMPLETED', completedAt: { not: null } },
        orderBy: { completedAt: 'desc' },
        take: 10,
        select: { id: true, caseNumber: true, completedAt: true, candidate: { select: { fullName: true } } },
      })
      : [],
    req.permissions.has('clientportal.invoices.view')
      ? prisma.invoice.findMany({
        where: { ...scope, status: { notIn: ['DRAFT', 'VOID'] } },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          invoiceNumber: true,
          total: true,
          currency: true,
          createdAt: true,
          sentAt: true,
        },
      })
      : [],
    req.permissions.has('clientportal.invoices.view')
      ? prisma.invoicePayment.findMany({
        where: {
          invoice: {
            is: {
              companyId: req.user.companyId,
              clientId: req.user.clientId,
              status: { notIn: ['DRAFT', 'VOID'] },
            },
          },
        },
        orderBy: { paymentDate: 'desc' },
        take: 10,
        select: {
          id: true,
          amount: true,
          paymentDate: true,
          invoice: { select: { invoiceNumber: true, currency: true } },
        },
      })
      : [],
  ]);
  const notifications = [
    ...candidates.map((candidate) => ({
      id: `candidate:${candidate.id}`,
      type: 'candidate',
      title: 'New candidate added',
      description: `${candidate.fullName} · ${candidate.candidateCode}`,
      createdAt: candidate.createdAt,
      href: `/client-portal/candidates/${candidate.id}`,
    })),
    ...cases.map((item) => ({
      id: `case:${item.id}`,
      type: 'case',
      title: 'New BGV case created',
      description: `${item.caseNumber} · ${item.candidate.fullName}`,
      createdAt: item.createdAt,
      href: `/client-portal/cases/${item.id}`,
    })),
    ...completedCases.map((item) => ({
      id: `case_completed:${item.id}`,
      type: 'case_completed',
      title: 'BGV case completed',
      description: `${item.caseNumber} · ${item.candidate.fullName}`,
      createdAt: item.completedAt,
      href: `/client-portal/cases/${item.id}`,
    })),
    ...reports.map((item) => ({
      id: `report:${item.id}`,
      type: 'report',
      title: 'Report generated',
      description: `${item.caseNumber} · ${item.candidate.fullName}`,
      createdAt: item.completedAt,
      href: '/client-portal/reports',
    })),
    ...invoices.map((invoice) => ({
      id: `invoice:${invoice.id}`,
      type: 'invoice',
      title: 'New invoice issued',
      description: `${invoice.invoiceNumber} · ${invoice.currency} ${Number(invoice.total).toLocaleString('en-IN')}`,
      createdAt: invoice.sentAt || invoice.createdAt,
      href: '/client-portal/invoices',
    })),
    ...payments.map((payment) => ({
      id: `payment:${payment.id}`,
      type: 'payment',
      title: 'Invoice payment recorded',
      description: `${payment.invoice.invoiceNumber} · ${payment.invoice.currency} ${Number(payment.amount).toLocaleString('en-IN')}`,
      createdAt: payment.paymentDate,
      href: '/client-portal/invoices',
    })),
  ].sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt)).slice(0, 20);
  return success(res, { message: 'Client portal notifications', data: notifications });
});

const getDashboard = asyncHandler(async (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  const canViewCandidates = req.permissions.has('clientportal.candidates.view');
  const canViewCases = req.permissions.has('clientportal.cases.view');
  const canViewReports = req.permissions.has('clientportal.reports.view');
  const canViewInvoices = req.permissions.has('clientportal.invoices.view');
  const canViewSubclients = req.permissions.has('clientportal.subclients.view') || req.permissions.has('clientportal.subclients.manage');
  const scope = { companyId: req.user.companyId, clientId: req.user.clientId };
  const period = req.query.period === 'yearly' ? 'yearly' : 'monthly';
  const requestedYear = Number(req.query.year);
  const selectedYear = Number.isInteger(requestedYear) && requestedYear >= 2000 && requestedYear <= 2200
    ? requestedYear
    : new Date().getUTCFullYear();
  const firstYear = period === 'monthly' ? selectedYear : selectedYear - 4;
  const trendStart = new Date(Date.UTC(firstYear, 0, 1));
  const trendEnd = new Date(Date.UTC(selectedYear + 1, 0, 1));
  const bucketCount = period === 'monthly' ? 12 : 5;
  const invoiceWhere = { ...scope, status: { notIn: ['DRAFT', 'VOID'] } };
  const [supportContact, candidateCount, caseCount, openCaseCount, completedCaseCount, reportCount, invoiceCount, subclientCount, chartCandidates, chartCases, chartReports, recentCandidates, recentCases, recentCompletedCases, recentReports, recentInvoices, invoiceRows] = await Promise.all([
    prisma.client.findFirst({
      where: { id: req.user.clientId, companyId: req.user.companyId, isDeleted: false },
      select: { supportEmail: true, supportPhone: true },
    }),
    canViewCandidates ? prisma.candidate.count({ where: { ...scope, isDeleted: false } }) : null,
    canViewCases ? prisma.bGVCase.count({ where: scope }) : null,
    canViewCases ? prisma.bGVCase.count({ where: { ...scope, status: { notIn: ['COMPLETED', 'CANCELLED'] } } }) : null,
    canViewCases ? prisma.bGVCase.count({ where: { ...scope, status: 'COMPLETED' } }) : null,
    canViewReports ? prisma.bGVCase.count({ where: { ...scope, status: 'COMPLETED' } }) : null,
    canViewInvoices ? prisma.invoice.count({ where: invoiceWhere }) : null,
    canViewSubclients ? prisma.client.count({ where: { companyId: req.user.companyId, parentClientId: req.user.clientId, isDeleted: false } }) : null,
    canViewCandidates ? prisma.candidate.findMany({
      where: { ...scope, isDeleted: false, createdAt: { gte: trendStart, lt: trendEnd } },
      select: { createdAt: true },
    }) : [],
    canViewCases ? prisma.bGVCase.findMany({
      where: { ...scope, createdAt: { gte: trendStart, lt: trendEnd } },
      select: { createdAt: true, status: true },
    }) : [],
    canViewReports ? prisma.bGVCase.findMany({
      where: { ...scope, status: 'COMPLETED', completedAt: { gte: trendStart, lt: trendEnd } },
      select: { completedAt: true },
    }) : [],
    canViewCandidates ? prisma.candidate.findMany({
      where: { ...scope, isDeleted: false },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { id: true, candidateCode: true, fullName: true, createdAt: true },
    }) : [],
    canViewCases ? prisma.bGVCase.findMany({
      where: scope,
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        caseNumber: true,
        status: true,
        createdAt: true,
        completedAt: true,
        candidate: { select: { fullName: true, firstName: true, middleName: true, lastName: true, candidateCode: true } },
      },
    }) : [],
    canViewCases ? prisma.bGVCase.findMany({
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
      take: 10,
      select: {
        id: true,
        invoiceNumber: true,
        status: true,
        invoiceDate: true,
        createdAt: true,
        sentAt: true,
        dueDate: true,
        currency: true,
        total: true,
        payments: { select: { id: true, amount: true, paymentDate: true } },
      },
    }) : [],
    canViewInvoices ? prisma.invoice.findMany({
      where: invoiceWhere,
      select: {
        id: true,
        invoiceNumber: true,
        total: true,
        currency: true,
        status: true,
        dueDate: true,
        invoiceDate: true,
        payments: { select: { id: true, amount: true, paymentDate: true } },
      },
    }) : [],
  ]);
  const months = Array.from({ length: bucketCount }, (_, index) => {
    const date = period === 'monthly'
      ? new Date(Date.UTC(selectedYear, index, 1))
      : new Date(Date.UTC(firstYear + index, 0, 1));
    return {
      key: period === 'monthly'
        ? `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
        : String(date.getUTCFullYear()),
      month: period === 'monthly'
        ? date.toLocaleDateString('en-IN', { month: 'short', timeZone: 'UTC' })
        : String(date.getUTCFullYear()),
      candidates: 0,
      cases: 0,
      reports: 0,
      invoices: 0,
    };
  });
  const bucketIndex = (date) => period === 'monthly'
    ? months.findIndex((month) => month.key === date.toISOString().slice(0, 7))
    : months.findIndex((month) => month.key === String(date.getUTCFullYear()));
  for (const item of chartCandidates) {
    const index = bucketIndex(item.createdAt);
    if (index >= 0) months[index].candidates += 1;
  }
  for (const item of chartCases) {
    const index = bucketIndex(item.createdAt);
    if (index < 0) continue;
    months[index].cases += 1;
  }
  for (const item of chartReports) {
    const index = bucketIndex(item.completedAt);
    if (index >= 0) months[index].reports += 1;
  }
  const financialBuckets = new Map();
  const financialTotals = new Map();
  for (const invoice of invoiceRows) {
    const currency = invoice.currency || 'INR';
    const total = Number(invoice.total);
    const paid = invoice.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
    const outstanding = Math.max(0, total - paid);
    const isOverdue = ['SENT', 'PARTIALLY_PAID', 'OVERDUE'].includes(invoice.status)
      && outstanding > 0
      && invoice.dueDate < new Date(new Date().toDateString());
    const summary = financialTotals.get(currency) || {
      currency, totalInvoiced: 0, totalPaid: 0, outstanding: 0, overdue: 0, invoices: 0, overdueInvoices: 0,
    };
    summary.totalInvoiced += total;
    summary.totalPaid += paid;
    summary.outstanding += outstanding;
    summary.overdue += isOverdue ? outstanding : 0;
    summary.invoices += 1;
    summary.overdueInvoices += isOverdue ? 1 : 0;
    financialTotals.set(currency, summary);

    const invoiceBucket = bucketIndex(invoice.invoiceDate);
    if (invoiceBucket >= 0) {
      months[invoiceBucket].invoices += 1;
      const key = `${months[invoiceBucket].key}:${currency}`;
      const values = financialBuckets.get(key) || { key: months[invoiceBucket].key, label: months[invoiceBucket].month, currency, invoiced: 0, paid: 0 };
      values.invoiced += total;
      financialBuckets.set(key, values);
    }
    for (const payment of invoice.payments) {
      const paymentBucket = bucketIndex(payment.paymentDate);
      if (paymentBucket < 0) continue;
      const key = `${months[paymentBucket].key}:${currency}`;
      const values = financialBuckets.get(key) || { key: months[paymentBucket].key, label: months[paymentBucket].month, currency, invoiced: 0, paid: 0 };
      values.paid += Number(payment.amount);
      financialBuckets.set(key, values);
    }
  }
  const financialActivity = months.map((month) => ({
    key: month.key,
    label: month.month,
    currencies: [...financialBuckets.values()]
      .filter((entry) => entry.key === month.key)
      .map(({ currency, invoiced, paid }) => ({ currency, invoiced, paid })),
  }));
  const notifications = [];
  for (const candidate of recentCandidates) {
    notifications.push({
      id: `candidate:${candidate.id}`,
      type: 'candidate',
      title: 'New candidate added',
      description: `${candidate.fullName} · ${candidate.candidateCode}`,
      createdAt: candidate.createdAt,
      href: `/client-portal/candidates/${candidate.id}`,
    });
  }
  for (const item of recentCases) {
    notifications.push({
      id: `case:${item.id}`,
      type: 'case',
      title: 'New BGV case created',
      description: `${item.caseNumber} · ${item.candidate.fullName}`,
      createdAt: item.createdAt,
      href: `/client-portal/cases/${item.id}`,
    });
  }
  for (const item of recentCompletedCases) {
    notifications.push({
      id: `case_completed:${item.id}`,
      type: 'case_completed',
      title: 'BGV case completed',
      description: `${item.caseNumber} · ${item.candidate.fullName}`,
      createdAt: item.completedAt,
      href: `/client-portal/cases/${item.id}`,
    });
  }
  for (const item of recentReports) {
    notifications.push({
      id: `report:${item.id}`,
      type: 'report',
      title: 'Report generated',
      description: `${item.caseNumber} · ${item.candidate.fullName}`,
      createdAt: item.completedAt,
      href: '/client-portal/reports',
    });
  }
  for (const invoice of recentInvoices) {
    notifications.push({
      id: `invoice:${invoice.id}`,
      type: 'invoice',
      title: 'New invoice issued',
      description: `${invoice.invoiceNumber} · ${invoice.currency} ${Number(invoice.total).toLocaleString('en-IN')}`,
      createdAt: invoice.sentAt || invoice.createdAt,
      href: '/client-portal/invoices',
    });
  }
  for (const invoice of invoiceRows) {
    for (const payment of invoice.payments) {
      notifications.push({
        id: `payment:${payment.id}`,
        type: 'payment',
        title: 'Invoice payment recorded',
        description: `${invoice.invoiceNumber} · ${invoice.currency} ${Number(payment.amount).toLocaleString('en-IN')}`,
        createdAt: payment.paymentDate,
        href: '/client-portal/invoices',
      });
    }
  }
  notifications.sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt));
  return success(res, {
    message: 'Client dashboard summary',
    data: {
      period,
      year: selectedYear,
      supportContact: supportContact ? {
        email: supportContact.supportEmail,
        phone: supportContact.supportPhone,
      } : null,
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
      financialActivity: canViewInvoices ? financialActivity : [],
      invoiceAnalytics: canViewInvoices ? [...financialTotals.values()] : [],
      notifications: notifications.slice(0, 20),
      recentCandidates,
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
      dateOfBirth: true, gender: true, fatherName: true, motherName: true, maritalStatus: true, spouseName: true,
      childrenCount: true, candidateNotes: true, aadhaarNumber: true, panNumber: true,
      uanNumber: true, passportNumber: true, drivingLicenseNumber: true, voterIdNumber: true,
      highestQualification: true, courseName: true, institutionName: true, universityName: true, yearOfPassing: true,
      gradeOrPercentage: true, educationHistory: true, employeeId: true, employeeDesignation: true, employeeDepartment: true,
      employmentType: true, joiningDate: true, workLocation: true, currentEmployer: true, employerHrName: true,
      employerHrPhone: true, employmentHistory: true, currentAddress: true, permanentAddress: true,
      addressVerificationLocations: true, createdAt: true, updatedAt: true,
      documents: { select: { id: true, documentType: true, documentNumber: true, fileName: true, fileUrl: true, verificationStatus: true, uploadedAt: true }, orderBy: { uploadedAt: 'desc' } },
      consents: { where: { consentType: 'BGV_CONSENT' }, select: { consentType: true, consentGiven: true, revokedAt: true, createdAt: true } },
      bgvCases: {
        orderBy: { createdAt: 'desc' },
        include: { checks: { include: { documents: true } }, consents: true },
      },
      portalInvitation: { select: { activatedAt: true, lastSentAt: true, expiresAt: true, revokedAt: true, reminderCount: true } },
      client: { select: { candidateFormConfig: true } },
      subclient: { select: { id: true, name: true, clientCode: true, candidateFormConfig: true } },
    },
  });
  if (!candidate) throw new NotFoundError('Candidate not found.');
  const intakeProgress = candidatePortalService.getCandidateProgress(candidate);
  const candidateData = { ...candidate };
  delete candidateData.consents;
  const bgvCases = candidate.bgvCases.map(({ checks, consents, ...item }) => item);
  return success(res, {
    message: 'Client candidate',
    data: {
      ...candidateData,
      bgvCases,
      intakeProgress,
      client: { candidateFormConfig: normalizeConfig(candidate.client?.candidateFormConfig) },
      subclient: candidate.subclient ? {
        id: candidate.subclient.id,
        name: candidate.subclient.name,
        clientCode: candidate.subclient.clientCode,
        candidateFormConfig: normalizeConfig(candidate.subclient.candidateFormConfig),
      } : null,
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
      label: check.checkType?.label || check.type.replaceAll('_', ' '),
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

const downloadCandidateFormPdf = asyncHandler(async (req, res) => {
  const doc = await candidateService.buildFormPdf({
    id: req.params.id,
    companyId: req.user.companyId,
    clientId: req.user.clientId,
  });
  const safeCode = req.params.id.replace(/[^a-zA-Z0-9_-]/g, '_');
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="candidate-form-${safeCode}.pdf"`);
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
        payments: {
          orderBy: { paymentDate: 'desc' },
          select: { id: true, amount: true, paymentDate: true, method: true },
        },
        activity: {
          orderBy: { createdAt: 'desc' },
          select: { id: true, action: true, createdAt: true },
        },
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
      payments: invoice.payments.map((payment) => ({
        ...payment,
        amount: Number(payment.amount),
      })),
      activity: invoice.activity,
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

module.exports = { getCandidateFormConfig, getNotifications, listSubclients, createSubclient, updateSubclient, listSubclientUsers, inviteSubclientUser, updateSubclientUser, removeSubclientUser, getDashboard, listCandidates, createCandidate, updateCandidate, getCandidate, downloadCandidateFormPdf, inviteCandidate, getCandidatePortalAccess, remindCandidate, updateCandidatePortalAccess, listCases, getCase, listReports, downloadReport, listInvoices, downloadInvoice };
