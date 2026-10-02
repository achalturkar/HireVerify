'use strict';

const XLSX = require('xlsx');
const asyncHandler = require('../../utils/asyncHandler');
const { BadRequestError } = require('../../utils/errors');
const { success, created } = require('../../utils/response');
const service = require('./marketing.service');

const getSettings = asyncHandler(async (req, res) => success(res, await service.getSettings(req.user)));

const saveSettings = asyncHandler(async (req, res) => success(res, await service.saveSettings(req.user, req.body), 'Gmail sender verified and saved.'));

const listLeads = asyncHandler(async (req, res) => success(res, await service.listLeads(req.user)));

const addLead = asyncHandler(async (req, res) => created(res, await service.addLead(req.user, req.body), 'Consented lead added.'));

const importLeads = asyncHandler(async (req, res) => {
  if (!req.file) throw new BadRequestError('Choose a CSV file to import.');
  const workbook = XLSX.read(req.file.buffer, { type: 'buffer', raw: false });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = sheet ? XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false }) : [];
  return success(res, await service.importLeads(req.user, rows), 'Lead import processed.');
});

const previewDirectMailRecipients = asyncHandler(async (req, res) => {
  let rawEmails = req.body.emails;
  if (req.file) {
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer', raw: false });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = sheet ? XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false }) : [];
    if (rows.length < 2) throw new BadRequestError('The CSV must include an email header and at least one address.');
    const emailColumn = rows[0].findIndex((value) => String(value || '').trim().toLowerCase() === 'email');
    if (emailColumn < 0) throw new BadRequestError('The recipient CSV must contain an email column.');
    rawEmails = rows.slice(1).map((row) => row[emailColumn]).filter((value) => String(value || '').trim());
  } else if (typeof rawEmails === 'string') {
    rawEmails = rawEmails.split(/[,\n;\r]+/);
  }
  return success(res, await service.previewDirectMailRecipients(req.user, rawEmails, {
    consentConfirmed: req.body.consentConfirmed,
    consentSource: req.body.consentSource,
  }), 'Recipient list checked against existing opt-in records and consent confirmation.');
});

const listCampaigns = asyncHandler(async (req, res) => success(res, await service.listCampaigns(req.user)));

const listCampaignRecipients = asyncHandler(async (req, res) => success(res, await service.listCampaignRecipients(req.user, req.params.id)));

const sendTest = asyncHandler(async (req, res) => success(res, await service.sendTest(req.user, req.body, req.files || []), 'Test email sent.'));

const sendCampaign = asyncHandler(async (req, res) => success(res, await service.sendCampaign(req.user, req.body, req.files || []), 'Campaign queued. Email delivery will run in batches of 50 per minute.'));

const sendDirectMail = asyncHandler(async (req, res) => {
  let recipientEmails;
  try {
    recipientEmails = JSON.parse(req.body.recipientEmails || '[]');
  } catch {
    throw new BadRequestError('Recipient selection is invalid. Preview the list again.');
  }
  if (!Array.isArray(recipientEmails)) throw new BadRequestError('Recipient selection is invalid. Preview the list again.');
  return success(res, await service.sendDirectMail(req.user, {
    ...req.body,
    recipientEmails,
  }, req.files || []), 'Direct email queued. Delivery will run in batches of 50 per minute.');
});

const unsubscribe = asyncHandler(async (req, res) => success(res, await service.unsubscribe(req.body.token), 'You have been unsubscribed.'));

module.exports = {
  getSettings, saveSettings, listLeads, addLead, importLeads, listCampaigns,
  listCampaignRecipients, previewDirectMailRecipients, sendTest, sendCampaign,
  sendDirectMail, unsubscribe,
};
