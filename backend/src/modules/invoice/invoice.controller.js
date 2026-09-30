'use strict';

const asyncHandler = require('../../utils/asyncHandler');
const { success, created } = require('../../utils/response');
const { parsePagination, buildMeta } = require('../../utils/pagination');
const { writeAudit } = require('../../utils/audit');
const { sendMail } = require('../../utils/mailer');
const { BadRequestError } = require('../../utils/errors');
const service = require('./invoice.service');
const { buildInvoicePdf } = require('./invoice.pdf');

const escapeHtml = (value) => String(value || '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);

const getProfile = asyncHandler(async (req, res) => success(res, { message: 'Invoice profile', data: await service.getProfile(req.user.companyId) }));
const saveProfile = asyncHandler(async (req, res) => success(res, { message: 'Invoice profile saved.', data: await service.saveProfile({ companyId: req.user.companyId, payload: req.body }) }));
const listCases = asyncHandler(async (req, res) => {
  if (!req.query.clientId) throw new BadRequestError('Select a client first.');
  return success(res, { message: 'Cases for client', data: await service.listCases({ companyId: req.user.companyId, clientId: req.query.clientId }) });
});
const list = asyncHandler(async (req, res) => {
  const pagination = parsePagination(req.query);
  const result = await service.list({ companyId: req.user.companyId, query: { ...pagination, search: req.query.search, clientId: req.query.clientId, status: req.query.status, currency: req.query.currency, invoiceDateFrom: req.query.invoiceDateFrom, invoiceDateTo: req.query.invoiceDateTo, dueDateFrom: req.query.dueDateFrom, dueDateTo: req.query.dueDateTo } });
  return success(res, { message: 'Invoices', data: result.items, meta: buildMeta({ page: pagination.page, limit: pagination.limit, total: result.total }), summary: result.summary, analytics: result.analytics });
});
const listPlatform = asyncHandler(async (req, res) => {
  const pagination = parsePagination(req.query);
  const result = await service.list({
    companyId: req.query.companyId || undefined,
    query: { ...pagination, search: req.query.search, clientId: req.query.clientId, status: req.query.status, currency: req.query.currency, invoiceDateFrom: req.query.invoiceDateFrom, invoiceDateTo: req.query.invoiceDateTo, dueDateFrom: req.query.dueDateFrom, dueDateTo: req.query.dueDateTo },
  });
  return success(res, { message: 'Platform invoices', data: result.items, meta: buildMeta({ page: pagination.page, limit: pagination.limit, total: result.total }), summary: result.summary, analytics: result.analytics });
});
const getById = asyncHandler(async (req, res) => success(res, { message: 'Invoice', data: await service.getById({ id: req.params.id, companyId: req.user.role?.isSuperAdmin ? undefined : req.user.companyId }) }));
const create = asyncHandler(async (req, res) => {
  const invoice = await service.create({ payload: req.body, companyId: req.user.companyId, currentUser: req.user });
  await writeAudit({ req, action: 'INVOICE_CREATED', entity: 'Invoice', entityId: invoice.id, metadata: { invoiceNumber: invoice.invoiceNumber, total: invoice.total } });
  return created(res, { message: 'Invoice created.', data: invoice });
});
const update = asyncHandler(async (req, res) => {
  const invoice = await service.update({ id: req.params.id, payload: req.body, companyId: req.user.companyId, currentUser: req.user });
  await writeAudit({ req, action: 'INVOICE_UPDATED', entity: 'Invoice', entityId: invoice.id });
  return success(res, { message: 'Draft invoice updated.', data: invoice });
});
const remove = asyncHandler(async (req, res) => {
  const invoice = await service.remove({ id: req.params.id, companyId: req.user.companyId });
  await writeAudit({ req, action: 'INVOICE_DRAFT_DELETED', entity: 'Invoice', entityId: invoice.id, metadata: { invoiceNumber: invoice.invoiceNumber } });
  return success(res, { message: 'Draft invoice deleted.' });
});
const downloadPdf = asyncHandler(async (req, res) => {
  const invoice = await service.getById({ id: req.params.id, companyId: req.user.role?.isSuperAdmin ? undefined : req.user.companyId });
  const pdf = await buildInvoicePdf(invoice);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${invoice.invoiceNumber.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf"`);
  res.send(pdf);
});
const send = asyncHandler(async (req, res) => {
  const invoice = await service.getById({ id: req.params.id, companyId: req.user.companyId });
  const recipient = req.body.email || invoice.clientEmail;
  if (!recipient) throw new BadRequestError('Add a billing email to the client or enter a recipient email.');
  const pdf = await buildInvoicePdf(invoice);
  const due = new Date(invoice.dueDate).toLocaleDateString('en-IN');
  await sendMail({
    to: recipient,
    replyTo: invoice.supplierEmail || undefined,
    subject: `Invoice ${invoice.invoiceNumber} from ${invoice.supplierName}`,
    text: `Hello ${invoice.clientName}, please find invoice ${invoice.invoiceNumber} attached. Total: ${invoice.currency} ${Number(invoice.total).toFixed(2)}. Due date: ${due}.`,
    html: `<p>Hello ${escapeHtml(invoice.clientName)},</p><p>Please find invoice <strong>${escapeHtml(invoice.invoiceNumber)}</strong> attached.</p><p><strong>Total:</strong> ${escapeHtml(invoice.currency)} ${Number(invoice.total).toFixed(2)}<br><strong>Due date:</strong> ${escapeHtml(due)}</p><p>Regards,<br>${escapeHtml(invoice.supplierName)}</p>`,
    attachments: [{ filename: `${invoice.invoiceNumber}.pdf`, content: pdf, contentType: 'application/pdf' }],
  });
  const updated = await service.markSent({ id: invoice.id, companyId: req.user.companyId, email: recipient, currentUser: req.user });
  await writeAudit({ req, action: 'INVOICE_SENT', entity: 'Invoice', entityId: invoice.id, metadata: { email: recipient } });
  return success(res, { message: `Invoice emailed to ${recipient}.`, data: updated });
});
const recordPayment = asyncHandler(async (req, res) => {
  const invoice = await service.recordPayment({ id: req.params.id, payload: req.body, companyId: req.user.companyId, currentUser: req.user });
  await writeAudit({ req, action: 'INVOICE_PAYMENT_RECORDED', entity: 'Invoice', entityId: invoice.id, metadata: { amount: req.body.amount } });
  return success(res, { message: 'Payment recorded.', data: invoice });
});
const voidInvoice = asyncHandler(async (req, res) => {
  const invoice = await service.voidInvoice({ id: req.params.id, companyId: req.user.companyId, currentUser: req.user });
  await writeAudit({ req, action: 'INVOICE_VOIDED', entity: 'Invoice', entityId: invoice.id });
  return success(res, { message: 'Invoice voided.', data: invoice });
});
const changeStatus = asyncHandler(async (req, res) => {
  const invoice = await service.changeStatus({ id: req.params.id, status: req.body.status, companyId: req.user.companyId, currentUser: req.user });
  await writeAudit({ req, action: 'INVOICE_STATUS_CHANGED', entity: 'Invoice', entityId: invoice.id, metadata: { status: invoice.status } });
  return success(res, { message: `Invoice status changed to ${invoice.status}.`, data: invoice });
});

module.exports = { getProfile, saveProfile, listCases, list, listPlatform, getById, create, update, remove, downloadPdf, send, recordPayment, voidInvoice, changeStatus };