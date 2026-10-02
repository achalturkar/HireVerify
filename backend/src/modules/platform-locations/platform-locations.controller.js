'use strict';

const XLSX = require('xlsx');
const asyncHandler = require('../../utils/asyncHandler');
const { BadRequestError } = require('../../utils/errors');
const { success, created } = require('../../utils/response');
const service = require('./platform-locations.service');

const list = asyncHandler(async (req, res) => success(res, {
  message: 'Location catalog',
  data: await service.list(false),
}));

const listAdmin = asyncHandler(async (_req, res) => success(res, {
  message: 'Location catalog administration',
  data: await service.list(true),
}));

const createCountry = asyncHandler(async (req, res) => created(res, {
  message: 'Country added.',
  data: await service.createCountry(req.body.name),
}));

const updateCountry = asyncHandler(async (req, res) => success(res, {
  message: 'Country updated.',
  data: await service.updateCountry(req.params.id, req.body),
}));

const createState = asyncHandler(async (req, res) => created(res, {
  message: 'State added.',
  data: await service.createState(req.body),
}));

const updateState = asyncHandler(async (req, res) => success(res, {
  message: 'State updated.',
  data: await service.updateState(req.params.id, req.body),
}));

const importCsv = asyncHandler(async (req, res) => {
  if (!req.file) throw new BadRequestError('Choose a CSV file to import.');
  const workbook = XLSX.read(req.file.buffer, { type: 'buffer', raw: false });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = sheet ? XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false }) : [];
  const header = (rows[0] || []).map((value) => String(value).trim().toLowerCase());
  const countryIndex = header.indexOf('country');
  const stateIndex = ['state', 'province', 'region'].map((name) => header.indexOf(name)).find((index) => index >= 0) ?? -1;
  if (countryIndex < 0) throw new BadRequestError('CSV must contain a Country header and an optional State header.');
  const locations = rows.slice(1).filter((row) => row.some((value) => String(value).trim())).map((row) => ({
    country: String(row[countryIndex] ?? '').trim(),
    state: stateIndex < 0 ? '' : String(row[stateIndex] ?? '').trim(),
  }));
  return success(res, { message: 'Location CSV imported.', data: await service.importRows(locations) });
});

module.exports = { list, listAdmin, createCountry, updateCountry, createState, updateState, importCsv };