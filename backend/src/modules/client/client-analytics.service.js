'use strict';

const { prisma } = require('../../common/prisma');
const { BadRequestError, NotFoundError } = require('../../utils/errors');

const monthKey = (date) => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
const yearKey = (date) => String(date.getUTCFullYear());
const nextMonth = (date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
const monthDate = (value) => {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value || '')) throw new BadRequestError('Choose a valid month range.');
  return new Date(`${value}-01T00:00:00.000Z`);
};

const getRange = ({ from, to }) => {
  const start = monthDate(from);
  const lastMonth = monthDate(to);
  if (start > lastMonth) throw new BadRequestError('The start month must be before or equal to the end month.');
  if ((lastMonth.getUTCFullYear() - start.getUTCFullYear()) * 12 + lastMonth.getUTCMonth() - start.getUTCMonth() > 59) {
    throw new BadRequestError('Choose a date range of five years or less.');
  }
  return { from: start, to: nextMonth(lastMonth), fromMonth: from, toMonth: to };
};

const monthLabel = (date) => new Intl.DateTimeFormat('en-IN', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(date);

const buildBuckets = (from, to, groupBy) => {
  const buckets = [];
  let cursor = new Date(from);
  if (groupBy === 'year') cursor = new Date(Date.UTC(cursor.getUTCFullYear(), 0, 1));
  const lastIncludedMonth = new Date(to.getTime() - 1);
  const end = groupBy === 'year' ? new Date(Date.UTC(lastIncludedMonth.getUTCFullYear() + 1, 0, 1)) : to;
  while (cursor < end) {
    const key = groupBy === 'year' ? yearKey(cursor) : monthKey(cursor);
    buckets.push({
      key,
      label: groupBy === 'year' ? key : monthLabel(cursor),
      candidates: 0,
      cases: 0,
      completedCases: 0,
      reports: 0,
      invoices: 0,
      invoicedAmount: 0,
      collectedAmount: 0,
    });
    cursor = groupBy === 'year'
      ? new Date(Date.UTC(cursor.getUTCFullYear() + 1, 0, 1))
      : nextMonth(cursor);
  }
  return buckets;
};

const addToBucket = (buckets, groupBy, date, field, amount = 1) => {
  if (!date) return;
  const key = groupBy === 'year' ? yearKey(date) : monthKey(date);
  const bucket = buckets.find((item) => item.key === key);
  if (bucket) bucket[field] += amount;
};

const countBy = (items, key) => {
  const counts = new Map();
  for (const item of items) counts.set(item[key], (counts.get(item[key]) || 0) + 1);
  return [...counts.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
};

const quoteCsv = (value) => {
  const text = String(value ?? '');
  const safeText = /^[\s]*[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safeText.replaceAll('"', '""')}"`;
};

const getClientAnalytics = async ({ clientId, companyId, from, to, groupBy = 'month' }) => {
  const client = await prisma.client.findFirst({
    where: { id: clientId, companyId, parentClientId: null, isDeleted: false },
    select: { id: true },
  });
  if (!client) throw new NotFoundError('Client not found.');
  if (!['month', 'year'].includes(groupBy)) throw new BadRequestError('Choose monthly or yearly analytics.');
  const range = getRange({ from, to });
  const base = { companyId, clientId };
  const invoiceBase = { ...base, status: { notIn: ['DRAFT', 'VOID'] } };

  const [candidateRows, caseRows, completedCaseRows, invoiceRows, paymentRows, recentCases, recentInvoices] = await Promise.all([
    prisma.candidate.findMany({
      where: { ...base, isDeleted: false, createdAt: { gte: range.from, lt: range.to } },
      select: { createdAt: true, status: true },
    }),
    prisma.bGVCase.findMany({
      where: { ...base, createdAt: { gte: range.from, lt: range.to } },
      select: {
        id: true, caseNumber: true, status: true, overallResult: true, createdAt: true, completedAt: true,
        candidate: { select: { fullName: true, firstName: true, middleName: true, lastName: true, candidateCode: true } },
        checks: { select: { type: true, status: true } },
      },
    }),
    prisma.bGVCase.findMany({
      where: { ...base, status: 'COMPLETED', completedAt: { gte: range.from, lt: range.to } },
      select: { completedAt: true },
    }),
    prisma.invoice.findMany({
      where: { ...invoiceBase, invoiceDate: { gte: range.from, lt: range.to } },
      select: {
        id: true, invoiceNumber: true, status: true, invoiceDate: true, dueDate: true, currency: true,
        subtotal: true, taxTotal: true, total: true, payments: { select: { amount: true } },
      },
    }),
    prisma.invoicePayment.findMany({
      where: {
        paymentDate: { gte: range.from, lt: range.to },
        invoice: { is: invoiceBase },
      },
      select: { amount: true, paymentDate: true },
    }),
    prisma.bGVCase.findMany({
      where: base,
      orderBy: { createdAt: 'desc' },
      take: 6,
      select: {
        id: true, caseNumber: true, status: true, overallResult: true, createdAt: true, completedAt: true,
        candidate: { select: { fullName: true, firstName: true, lastName: true, candidateCode: true } },
      },
    }),
    prisma.invoice.findMany({
      where: invoiceBase,
      orderBy: [{ invoiceDate: 'desc' }, { createdAt: 'desc' }],
      take: 6,
      select: { id: true, invoiceNumber: true, status: true, invoiceDate: true, dueDate: true, currency: true, total: true, payments: { select: { amount: true } } },
    }),
  ]);

  const trend = buildBuckets(range.from, range.to, groupBy);
  for (const candidate of candidateRows) addToBucket(trend, groupBy, candidate.createdAt, 'candidates');
  for (const item of caseRows) {
    addToBucket(trend, groupBy, item.createdAt, 'cases');
  }
  for (const item of completedCaseRows) {
    addToBucket(trend, groupBy, item.completedAt, 'completedCases');
    addToBucket(trend, groupBy, item.completedAt, 'reports');
  }
  for (const invoice of invoiceRows) {
    addToBucket(trend, groupBy, invoice.invoiceDate, 'invoices');
    addToBucket(trend, groupBy, invoice.invoiceDate, 'invoicedAmount', Number(invoice.total));
  }
  for (const payment of paymentRows) addToBucket(trend, groupBy, payment.paymentDate, 'collectedAmount', Number(payment.amount));

  const candidatesByStatus = countBy(candidateRows, 'status');
  const casesByStatus = countBy(caseRows, 'status');
  const casesByResult = countBy(caseRows, 'overallResult');
  const checkRows = caseRows.flatMap((item) => item.checks);
  const checksByType = new Map();
  for (const check of checkRows) {
    const current = checksByType.get(check.type) || { type: check.type, total: 0, completed: 0, failed: 0, pending: 0 };
    current.total += 1;
    if (check.status === 'COMPLETED') current.completed += 1;
    if (check.status === 'FAILED') current.failed += 1;
    if (['PENDING', 'QUEUED', 'IN_PROGRESS', 'RETRYING'].includes(check.status)) current.pending += 1;
    checksByType.set(check.type, current);
  }
  const invoiceStatusRows = countBy(invoiceRows, 'status');
  const invoiceTotals = invoiceRows.reduce((summary, invoice) => {
    const paid = invoice.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
    summary.invoiced += Number(invoice.total);
    summary.tax += Number(invoice.taxTotal);
    summary.paidAgainstInvoices += paid;
    summary.outstanding += Math.max(0, Number(invoice.total) - paid);
    return summary;
  }, { invoiced: 0, tax: 0, paidAgainstInvoices: 0, outstanding: 0 });
  const collected = paymentRows.reduce((sum, payment) => sum + Number(payment.amount), 0);
  const completedCases = completedCaseRows.length;
  const openCases = caseRows.filter((item) => !['COMPLETED', 'CANCELLED'].includes(item.status)).length;
  const activeCaseCohort = caseRows.filter((item) => item.status !== 'CANCELLED');
  const cohortCompletionRate = activeCaseCohort.length
    ? Math.round((activeCaseCohort.filter((item) => item.status === 'COMPLETED').length / activeCaseCohort.length) * 100)
    : 0;

  return {
    range: { from: range.fromMonth, to: range.toMonth, groupBy },
    summary: {
      candidates: candidateRows.length,
      cases: caseRows.length,
      completedCases,
      openCases,
      reports: completedCases,
      invoices: invoiceRows.length,
      invoicedAmount: invoiceTotals.invoiced,
      taxAmount: invoiceTotals.tax,
      collectedAmount: collected,
      outstandingAmount: invoiceTotals.outstanding,
      completionRate: cohortCompletionRate,
    },
    trend,
    distributions: {
      candidatesByStatus,
      casesByStatus,
      casesByResult,
      invoicesByStatus: invoiceStatusRows,
      checksByType: [...checksByType.values()].sort((a, b) => b.total - a.total),
    },
    recentCases: recentCases.map((item) => ({
      ...item,
      candidateName: item.candidate.fullName || [item.candidate.firstName, item.candidate.lastName].filter(Boolean).join(' '),
    })),
    recentInvoices: recentInvoices.map((invoice) => {
      const paid = invoice.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
      return {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        status: invoice.status,
        invoiceDate: invoice.invoiceDate,
        dueDate: invoice.dueDate,
        currency: invoice.currency,
        total: Number(invoice.total),
        paid,
        balance: Math.max(0, Number(invoice.total) - paid),
      };
    }),
  };
};

const exportClientAnalytics = async ({ clientId, companyId, from, to }) => {
  const analytics = await getClientAnalytics({ clientId, companyId, from, to, groupBy: 'month' });
  const range = getRange({ from, to });
  const [client, candidates, cases, invoices] = await Promise.all([
    prisma.client.findFirst({ where: { id: clientId, companyId }, select: { name: true, clientCode: true } }),
    prisma.candidate.findMany({
      where: { companyId, clientId, isDeleted: false, createdAt: { gte: range.from, lt: range.to } },
      orderBy: { createdAt: 'asc' },
      select: { candidateCode: true, fullName: true, status: true, createdAt: true },
    }),
    prisma.bGVCase.findMany({
      where: { companyId, clientId, createdAt: { gte: range.from, lt: range.to } },
      orderBy: { createdAt: 'asc' },
      select: {
        caseNumber: true, status: true, overallResult: true, createdAt: true, completedAt: true,
        candidate: { select: { candidateCode: true, fullName: true } },
      },
    }),
    prisma.invoice.findMany({
      where: { companyId, clientId, status: { notIn: ['DRAFT', 'VOID'] }, invoiceDate: { gte: range.from, lt: range.to } },
      orderBy: { invoiceDate: 'asc' },
      select: { invoiceNumber: true, status: true, invoiceDate: true, dueDate: true, currency: true, total: true, payments: { select: { amount: true } } },
    }),
  ]);
  const rows = [
    ['Client analytics report', client?.name, client?.clientCode],
    ['Reporting period', from, to],
    [],
    ['Summary metric', 'Value'],
    ['Candidates added', analytics.summary.candidates],
    ['Cases created', analytics.summary.cases],
    ['Cases completed', analytics.summary.completedCases],
    ['Open cases', analytics.summary.openCases],
    ['Invoices issued', analytics.summary.invoices],
    ['Invoiced amount', analytics.summary.invoicedAmount],
    ['Payments received during period', analytics.summary.collectedAmount],
    ['Outstanding on period invoices', analytics.summary.outstandingAmount],
    [],
    ['Monthly activity'],
    ['Month', 'Candidates added', 'Cases created', 'Cases completed', 'Invoices issued', 'Invoiced amount', 'Payments received'],
    ...analytics.trend.map((item) => [item.label, item.candidates, item.cases, item.completedCases, item.invoices, item.invoicedAmount, item.collectedAmount]),
    [],
    ['Candidate records'],
    ['Candidate code', 'Candidate name', 'Status', 'Created at'],
    ...candidates.map((item) => [item.candidateCode, item.fullName, item.status, item.createdAt.toISOString()]),
    [],
    ['BGV case records'],
    ['Case number', 'Candidate code', 'Candidate name', 'Status', 'Overall result', 'Created at', 'Completed at'],
    ...cases.map((item) => [item.caseNumber, item.candidate.candidateCode, item.candidate.fullName, item.status, item.overallResult, item.createdAt.toISOString(), item.completedAt?.toISOString() || '']),
    [],
    ['Invoice records'],
    ['Invoice number', 'Status', 'Invoice date', 'Due date', 'Currency', 'Total', 'Paid', 'Balance'],
    ...invoices.map((item) => {
      const paid = item.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
      return [item.invoiceNumber, item.status, item.invoiceDate.toISOString().slice(0, 10), item.dueDate.toISOString().slice(0, 10), item.currency, Number(item.total), paid, Math.max(0, Number(item.total) - paid)];
    }),
  ];
  return rows.map((row) => row.map(quoteCsv).join(',')).join('\r\n');
};

module.exports = { getClientAnalytics, exportClientAnalytics };
