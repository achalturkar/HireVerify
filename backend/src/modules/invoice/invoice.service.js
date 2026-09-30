'use strict';

const { prisma } = require('../../common/prisma');
const { BadRequestError, ConflictError, NotFoundError } = require('../../utils/errors');

const roundMoney = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
const amount = (value) => Number(value || 0);
const toDate = (value) => new Date(`${value}T00:00:00.000Z`);
const addressWithoutCountry = (address, country) => {
  if (!address || !country) return address || '';
  const parts = address.split(',').map((part) => part.trim());
  if (parts.at(-1)?.toLocaleLowerCase() === country.trim().toLocaleLowerCase()) parts.pop();
  return parts.join(', ');
};
const dateRange = (from, to) => ({
  ...(from ? { gte: toDate(from) } : {}),
  ...(to ? { lte: new Date(`${to}T23:59:59.999Z`) } : {}),
});
const composeAddress = (...parts) => parts.flat().map((part) => String(part || '').trim()).filter(Boolean).join(', ');

const includeInvoice = {
  items: { orderBy: { id: 'asc' } },
  payments: { orderBy: { paymentDate: 'desc' } },
  activity: { orderBy: { createdAt: 'desc' } },
};

const getProfile = async (companyId) => {
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) throw new NotFoundError('Company not found');
  return {
    id: company.id,
    name: company.name,
    logoUrl: company.logoUrl,
    email: company.contactEmail,
    phone: company.contactPhone,
    address: company.address || '',
    gstNumber: company.gstNumber || '',
    panNumber: company.panNumber || '',
    city: company.city || '',
    state: company.state || '',
    postalCode: company.postalCode || '',
    bankAccountName: company.bankAccountName || '',
    bankName: company.bankName || '',
    bankAccountNumber: company.bankAccountNumber || '',
    bankIfscCode: company.bankIfscCode || '',
    bankSwiftCode: company.bankSwiftCode || '',
    bankBranch: company.bankBranch || '',
    upiId: company.upiId || '',
  };
};

const saveProfile = async ({ companyId, payload }) => {
  const data = Object.fromEntries(['gstNumber', 'panNumber', 'state', 'city', 'postalCode', 'address', 'bankAccountName', 'bankName', 'bankAccountNumber', 'bankIfscCode', 'bankSwiftCode', 'bankBranch', 'upiId']
    .filter((key) => payload[key] !== undefined)
    .map((key) => [key, payload[key]?.trim() || null]));
  const company = await prisma.company.update({ where: { id: companyId }, data });
  return {
    id: company.id,
    name: company.name,
    logoUrl: company.logoUrl,
    email: company.contactEmail,
    phone: company.contactPhone,
    address: company.address || '',
    gstNumber: company.gstNumber || '',
    panNumber: company.panNumber || '',
    city: company.city || '',
    state: company.state || '',
    postalCode: company.postalCode || '',
    bankAccountName: company.bankAccountName || '',
    bankName: company.bankName || '',
    bankAccountNumber: company.bankAccountNumber || '',
    bankIfscCode: company.bankIfscCode || '',
    bankSwiftCode: company.bankSwiftCode || '',
    bankBranch: company.bankBranch || '',
    upiId: company.upiId || '',
  };
};

const listCases = async ({ companyId, clientId }) => {
  const client = await prisma.client.findFirst({ where: { id: clientId, companyId, isDeleted: false }, select: { id: true } });
  if (!client) throw new NotFoundError('Client not found');
  const cases = await prisma.bGVCase.findMany({
    where: { companyId, clientId },
    select: { id: true, caseNumber: true, status: true, packageName: true, candidate: { select: { firstName: true, lastName: true, candidateCode: true } } },
    orderBy: { createdAt: 'desc' },
    take: 250,
  });
  return cases.map((item) => ({ ...item, candidateName: `${item.candidate.firstName} ${item.candidate.lastName}`.trim() }));
};

const calculateItems = (items) => {
  const totals = { subtotal: 0, discountTotal: 0, taxTotal: 0, total: 0 };
  const calculated = items.map((item) => {
    const quantity = Number(item.quantity);
    const unitPrice = Number(item.unitPrice);
    const discountPercent = Number(item.discountPercent || 0);
    const taxPercent = Number(item.taxPercent || 0);
    const subtotal = roundMoney(quantity * unitPrice);
    const discountAmount = roundMoney(subtotal * discountPercent / 100);
    const taxableAmount = roundMoney(subtotal - discountAmount);
    const taxAmount = roundMoney(taxableAmount * taxPercent / 100);
    const total = roundMoney(taxableAmount + taxAmount);
    totals.subtotal = roundMoney(totals.subtotal + subtotal);
    totals.discountTotal = roundMoney(totals.discountTotal + discountAmount);
    totals.taxTotal = roundMoney(totals.taxTotal + taxAmount);
    totals.total = roundMoney(totals.total + total);
    return {
      caseId: item.caseId || null,
      description: item.description.trim(),
      candidateName: item.candidateName?.trim() || null,
      serviceCode: item.serviceCode?.trim() || null,
      quantity,
      unitPrice,
      discountPercent,
      taxPercent,
      subtotal,
      discountAmount,
      taxableAmount,
      taxAmount,
      total,
    };
  });
  return { items: calculated, totals };
};

const getParties = async ({ companyId, clientId }) => {
  const [company, client, admin] = await Promise.all([
    prisma.company.findUnique({ where: { id: companyId } }),
    prisma.client.findFirst({ where: { id: clientId, companyId, isDeleted: false, status: 'ACTIVE' } }),
    prisma.user.findFirst({
      where: { companyId, isDeleted: false, status: 'ACTIVE', role: { isCompanyAdmin: true } },
      select: { firstName: true, lastName: true },
      orderBy: { createdAt: 'asc' },
    }),
  ]);
  if (!company) throw new NotFoundError('Company not found');
  if (!client) throw new NotFoundError('Active client not found');
  return { company, client, admin };
};

const buildInvoiceData = async ({ payload, companyId, clientId }) => {
  const { company, client, admin } = await getParties({ companyId, clientId });
  if (toDate(payload.dueDate) < toDate(payload.invoiceDate)) throw new BadRequestError('Due date cannot be before invoice date.');
  const itemCaseIds = [...new Set(payload.items.map((item) => item.caseId).filter(Boolean))];
  if (itemCaseIds.length) {
    const ownedCases = await prisma.bGVCase.findMany({ where: { id: { in: itemCaseIds }, companyId, clientId }, select: { id: true } });
    if (ownedCases.length !== itemCaseIds.length) throw new BadRequestError('Every linked BGV case must belong to the selected client.');
  }
  const { items, totals } = calculateItems(payload.items);
  const anyTaxable = items.some((item) => item.taxAmount > 0);
  const supplierState = company.state?.trim() || '';
  const clientAddress = addressWithoutCountry(payload.clientAddress?.trim(), client.country)
    || composeAddress(client.addressLine1, client.addressLine2, client.city, client.state, client.postalCode);
  const clientGst = payload.clientGst?.trim() || client.gstNumber;
  const clientPan = payload.clientPan?.trim() || client.panNumber;
  const clientState = payload.clientState?.trim() || client.state;
  const clientEmail = payload.clientEmail?.trim() || client.contactEmail;
  const clientContactName = payload.clientContactName?.trim() || client.contactName;
  const clientPhone = payload.clientPhone?.trim() || client.contactPhone;
  const placeOfSupply = payload.placeOfSupply?.trim() || clientState || '';
  const taxType = !anyTaxable || !company.gstNumber ? 'NONE' : supplierState.localeCompare(placeOfSupply, undefined, { sensitivity: 'accent' }) === 0 ? 'CGST_SGST' : 'IGST';
  const supplierAddress = composeAddress(company.address, company.city, company.state, company.postalCode);
  return {
    company,
    items,
    invoice: {
      clientId,
      invoiceDate: toDate(payload.invoiceDate),
      dueDate: toDate(payload.dueDate),
      supplierName: company.name,
      supplierAddress: supplierAddress || null,
      supplierGst: company.gstNumber,
      supplierPan: company.panNumber,
      supplierState: supplierState || null,
      supplierCity: company.city,
      supplierPostalCode: company.postalCode,
      supplierEmail: company.contactEmail,
      supplierPhone: company.contactPhone,
      supplierLogoUrl: company.logoUrl,
      supplierPrimaryColor: company.primaryColor,
      supplierSignatureUrl: company.signatureUrl,
      supplierAdminName: admin ? `${admin.firstName} ${admin.lastName}`.trim() : null,
      supplierBankAccountName: company.bankAccountName,
      supplierBankName: company.bankName,
      supplierBankAccountNumber: company.bankAccountNumber,
      supplierBankIfscCode: company.bankIfscCode,
      supplierBankSwiftCode: company.bankSwiftCode,
      supplierBankBranch: company.bankBranch,
      supplierUpiId: company.upiId,
      clientName: client.name,
      clientAddress: clientAddress || null,
      clientGst,
      clientPan,
      clientState,
      clientEmail,
      clientContactName,
      clientPhone,
      placeOfSupply: placeOfSupply || null,
      taxType,
      currency: payload.currency || 'INR',
      purchaseOrderNumber: payload.purchaseOrderNumber?.trim() || null,
      ...totals,
      notes: payload.notes?.trim() || null,
      terms: payload.terms?.trim() || null,
    },
  };
};

const withBalance = (invoice) => {
  const paid = roundMoney(invoice.payments.reduce((sum, payment) => sum + amount(payment.amount), 0));
  const balance = roundMoney(Math.max(0, amount(invoice.total) - paid));
  const isOverdue = ['SENT', 'PARTIALLY_PAID'].includes(invoice.status) && balance > 0 && new Date(invoice.dueDate) < new Date(new Date().toDateString());
  return { ...invoice, amountPaid: paid, balanceDue: balance, status: isOverdue ? 'OVERDUE' : invoice.status };
};

const getById = async ({ id, companyId }) => {
  const invoice = await prisma.invoice.findFirst({
    where: { id, companyId },
    include: {
      ...includeInvoice,
      client: { select: { addressLine1: true, addressLine2: true, city: true, state: true, postalCode: true, country: true } },
      company: {
        select: {
          signatureUrl: true,
          users: {
            where: { isDeleted: false, status: 'ACTIVE', role: { isCompanyAdmin: true } },
            orderBy: { createdAt: 'asc' },
            take: 1,
            select: { firstName: true, lastName: true },
          },
        },
      },
    },
  });
  if (!invoice) throw new NotFoundError('Invoice not found');
  const { client, company, ...snapshot } = invoice;
  const admin = company.users[0];
  return withBalance({
    ...snapshot,
    clientAddress: addressWithoutCountry(snapshot.clientAddress, client.country)
      || composeAddress(client.addressLine1, client.addressLine2, client.city, client.state, client.postalCode)
      || null,
    supplierSignatureUrl: snapshot.supplierSignatureUrl || company.signatureUrl,
    supplierAdminName: snapshot.supplierAdminName || (admin ? `${admin.firstName} ${admin.lastName}`.trim() : null),
  });
};

const list = async ({ companyId, query }) => {
  const hasInvoiceDateRange = query.invoiceDateFrom || query.invoiceDateTo;
  const hasDueDateRange = query.dueDateFrom || query.dueDateTo || query.status === 'OVERDUE';
  const where = {
    companyId,
    ...(query.clientId ? { clientId: query.clientId } : {}),
    ...(query.currency ? { currency: query.currency } : {}),
    ...(query.status && query.status !== 'OVERDUE' ? { status: query.status } : {}),
    ...(query.status === 'OVERDUE' ? { status: { in: ['SENT', 'PARTIALLY_PAID'] } } : {}),
    ...(hasInvoiceDateRange ? { invoiceDate: dateRange(query.invoiceDateFrom, query.invoiceDateTo) } : {}),
    ...(hasDueDateRange ? { dueDate: { ...(query.status === 'OVERDUE' ? { lt: new Date(new Date().toDateString()) } : {}), ...dateRange(query.dueDateFrom, query.dueDateTo) } } : {}),
    ...(query.search ? { OR: [{ invoiceNumber: { contains: query.search, mode: 'insensitive' } }, { clientName: { contains: query.search, mode: 'insensitive' } }, { purchaseOrderNumber: { contains: query.search, mode: 'insensitive' } }] } : {}),
  };
  const [invoices, total, summaryItems] = await Promise.all([
    prisma.invoice.findMany({ where, include: includeInvoice, orderBy: { invoiceDate: 'desc' }, skip: query.skip, take: query.limit }),
    prisma.invoice.count({ where }),
    prisma.invoice.findMany({ where: { companyId, status: { not: 'VOID' } }, select: { status: true, total: true, dueDate: true, invoiceDate: true, currency: true, clientName: true, payments: { select: { amount: true, paymentDate: true } } } }),
  ]);
  const items = invoices.map(withBalance);
  const currentMonth = new Date();
  const monthRows = Array.from({ length: 12 }, (_, index) => {
    const date = new Date(Date.UTC(currentMonth.getUTCFullYear(), currentMonth.getUTCMonth() - 11 + index, 1));
    return {
      key: `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`,
      label: date.toLocaleDateString('en-IN', { month: 'short', year: '2-digit', timeZone: 'UTC' }),
      billed: 0,
      collected: 0,
    };
  });
  const monthIndexes = new Map(monthRows.map((month, index) => [month.key, index]));
  const currencies = new Map();
  const statusMix = new Map();
  const clientTotals = new Map();
  const analyticsForCurrency = (currency) => {
    if (!currencies.has(currency)) currencies.set(currency, { currency, billed: 0, collected: 0, outstanding: 0, monthly: monthRows.map((month) => ({ ...month })) });
    return currencies.get(currency);
  };
  const summary = summaryItems.reduce((result, invoice) => {
    const paid = invoice.payments.reduce((sum, payment) => sum + amount(payment.amount), 0);
    const balance = Math.max(0, amount(invoice.total) - paid);
    const currencyAnalytics = analyticsForCurrency(invoice.currency || 'INR');
    const isOverdue = ['SENT', 'PARTIALLY_PAID'].includes(invoice.status) && balance > 0 && new Date(invoice.dueDate) < new Date(new Date().toDateString());
    const analyticsStatus = isOverdue ? 'OVERDUE' : invoice.status;
    statusMix.set(analyticsStatus, (statusMix.get(analyticsStatus) || 0) + 1);
    result.total += 1;
    if (invoice.status === 'DRAFT') result.drafts += 1;
    if (invoice.status === 'PAID') result.paid += 1;
    if (['SENT', 'PARTIALLY_PAID'].includes(invoice.status) && balance > 0) {
      result.outstanding = roundMoney(result.outstanding + balance);
      currencyAnalytics.outstanding = roundMoney(currencyAnalytics.outstanding + balance);
      if (new Date(invoice.dueDate) < new Date(new Date().toDateString())) result.overdue += 1;
    }
    if (invoice.status !== 'DRAFT') {
      currencyAnalytics.billed = roundMoney(currencyAnalytics.billed + amount(invoice.total));
      const clientKey = `${invoice.currency || 'INR'}:${invoice.clientName}`;
      const client = clientTotals.get(clientKey) || { currency: invoice.currency || 'INR', name: invoice.clientName, billed: 0, invoices: 0 };
      client.billed = roundMoney(client.billed + amount(invoice.total));
      client.invoices += 1;
      clientTotals.set(clientKey, client);
      const issueMonth = monthIndexes.get(new Date(invoice.invoiceDate).toISOString().slice(0, 7));
      if (issueMonth !== undefined) currencyAnalytics.monthly[issueMonth].billed = roundMoney(currencyAnalytics.monthly[issueMonth].billed + amount(invoice.total));
    }
    invoice.payments.forEach((payment) => {
      currencyAnalytics.collected = roundMoney(currencyAnalytics.collected + amount(payment.amount));
      const paymentMonth = monthIndexes.get(new Date(payment.paymentDate).toISOString().slice(0, 7));
      if (paymentMonth === undefined) return;
      currencyAnalytics.monthly[paymentMonth].collected = roundMoney(currencyAnalytics.monthly[paymentMonth].collected + amount(payment.amount));
    });
    return result;
  }, { total: 0, drafts: 0, paid: 0, overdue: 0, outstanding: 0 });
  const analytics = {
    currencies: [...currencies.values()],
    statusMix: [...statusMix].map(([status, count]) => ({ status, count })),
    topClients: [...clientTotals.values()].sort((left, right) => right.billed - left.billed),
  };
  return { items, total, summary, analytics };
};

const create = async ({ payload, companyId, currentUser }) => {
  const prepared = await buildInvoiceData({ payload, companyId, clientId: payload.clientId });
  const year = new Date(payload.invoiceDate).getUTCFullYear();
  const invoice = await prisma.$transaction(async (tx) => {
    const sequence = await tx.invoiceSequence.upsert({
      where: { companyId_year: { companyId, year } },
      create: { companyId, year, value: 1 },
      update: { value: { increment: 1 } },
    });
    const invoiceNumber = `${prepared.company.shortCode || 'INV'}-INV-${year}-${String(sequence.value).padStart(5, '0')}`;
    return tx.invoice.create({
      data: {
        ...prepared.invoice,
        companyId,
        invoiceNumber,
        createdById: currentUser?.id || null,
        updatedById: currentUser?.id || null,
        items: { create: prepared.items },
        activity: { create: { action: 'CREATED', actorId: currentUser?.id || null, details: { invoiceNumber } } },
      },
      include: includeInvoice,
    });
  });
  return withBalance(invoice);
};

const update = async ({ id, payload, companyId, currentUser }) => {
  const existing = await prisma.invoice.findFirst({ where: { id, companyId } });
  if (!existing) throw new NotFoundError('Invoice not found');
  if (existing.status !== 'DRAFT') throw new ConflictError('Only draft invoices can be edited.');
  const prepared = await buildInvoiceData({ payload, companyId, clientId: payload.clientId });
  await prisma.$transaction(async (tx) => {
    await tx.invoiceItem.deleteMany({ where: { invoiceId: id } });
    await tx.invoice.update({
      where: { id },
      data: {
        ...prepared.invoice,
        updatedById: currentUser?.id || null,
        items: { create: prepared.items },
        activity: { create: { action: 'UPDATED', actorId: currentUser?.id || null, details: {} } },
      },
    });
  });
  return getById({ id, companyId });
};

const remove = async ({ id, companyId }) => {
  return prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findFirst({ where: { id, companyId }, select: { id: true, status: true, invoiceNumber: true } });
    if (!invoice) throw new NotFoundError('Invoice not found');
    if (invoice.status !== 'DRAFT') throw new ConflictError('Only draft invoices can be deleted. Void issued invoices to preserve the audit trail.');
    const result = await tx.invoice.deleteMany({ where: { id, companyId, status: 'DRAFT' } });
    if (!result.count) throw new ConflictError('This invoice was issued before deletion. Refresh and void it instead.');
    return invoice;
  });
};

const recordPayment = async ({ id, payload, companyId, currentUser }) => {
  try {
    await prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findFirst({ where: { id, companyId }, include: { payments: { select: { amount: true } } } });
      if (!invoice) throw new NotFoundError('Invoice not found');
      if (['DRAFT', 'VOID', 'PAID'].includes(invoice.status)) throw new ConflictError('Payments can only be recorded for outstanding invoices.');
      const paid = roundMoney(invoice.payments.reduce((sum, payment) => sum + amount(payment.amount), 0));
      const balanceDue = roundMoney(Math.max(0, amount(invoice.total) - paid));
      if (Number(payload.amount) > balanceDue) throw new BadRequestError(`Payment exceeds the outstanding balance of ${balanceDue}.`);
      const updatedPaid = roundMoney(paid + Number(payload.amount));
      await tx.invoicePayment.create({ data: { invoiceId: id, amount: payload.amount, paymentDate: toDate(payload.paymentDate), method: payload.method || null, reference: payload.reference || null, notes: payload.notes || null, createdById: currentUser?.id || null } });
      await tx.invoice.update({ where: { id }, data: { status: updatedPaid >= amount(invoice.total) ? 'PAID' : 'PARTIALLY_PAID', updatedById: currentUser?.id || null } });
      await tx.invoiceActivity.create({ data: { invoiceId: id, action: 'PAYMENT_RECORDED', actorId: currentUser?.id || null, details: { amount: Number(payload.amount), method: payload.method || null, reference: payload.reference || null } } });
    }, { isolationLevel: 'Serializable' });
  } catch (error) {
    if (error.code === 'P2034') throw new ConflictError('The invoice changed while recording payment. Refresh and try again.');
    throw error;
  }
  return getById({ id, companyId });
};

const markSent = async ({ id, companyId, email, currentUser }) => {
  const invoice = await getById({ id, companyId });
  if (!['DRAFT', 'SENT', 'PARTIALLY_PAID', 'OVERDUE'].includes(invoice.status)) throw new ConflictError('This invoice cannot be emailed in its current state.');
  await prisma.invoice.update({ where: { id }, data: { status: invoice.amountPaid ? 'PARTIALLY_PAID' : 'SENT', sentAt: new Date(), updatedById: currentUser?.id || null } });
  await prisma.invoiceActivity.create({ data: { invoiceId: id, action: 'EMAILED', actorId: currentUser?.id || null, details: { email } } });
  return getById({ id, companyId });
};

const voidInvoice = async ({ id, companyId, currentUser }) => {
  const invoice = await getById({ id, companyId });
  if (invoice.status === 'VOID' || invoice.status === 'PAID' || invoice.amountPaid > 0) throw new ConflictError('Paid or already void invoices cannot be voided.');
  await prisma.$transaction([
    prisma.invoice.update({ where: { id }, data: { status: 'VOID', updatedById: currentUser?.id || null } }),
    prisma.invoiceActivity.create({ data: { invoiceId: id, action: 'VOIDED', actorId: currentUser?.id || null, details: {} } }),
  ]);
  return getById({ id, companyId });
};

const changeStatus = async ({ id, status, companyId, currentUser }) => {
  const invoice = await prisma.invoice.findFirst({ where: { id, companyId }, include: { payments: { select: { amount: true } } } });
  if (!invoice) throw new NotFoundError('Invoice not found');
  const amountPaid = invoice.payments.reduce((sum, payment) => sum + amount(payment.amount), 0);
  const allowed = status === 'SENT' && invoice.status === 'DRAFT'
    || status === 'VOID' && !['VOID', 'PAID'].includes(invoice.status) && amountPaid === 0;
  if (!allowed) throw new ConflictError('This invoice status cannot be changed that way. Record payments to update payment status; overdue is calculated from the due date.');
  await prisma.$transaction(async (tx) => {
    await tx.invoice.update({ where: { id }, data: { status, ...(status === 'SENT' ? { sentAt: new Date() } : {}), updatedById: currentUser?.id || null } });
    await tx.invoiceActivity.create({ data: { invoiceId: id, action: 'STATUS_CHANGED', actorId: currentUser?.id || null, details: { from: invoice.status, to: status } } });
  });
  return getById({ id, companyId });
};

module.exports = { getProfile, saveProfile, listCases, list, getById, create, update, remove, recordPayment, markSent, voidInvoice, changeStatus };