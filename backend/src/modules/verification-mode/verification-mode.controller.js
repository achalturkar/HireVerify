'use strict';

const asyncHandler = require('../../utils/asyncHandler');
const { success, created } = require('../../utils/response');
const service = require('./verification-mode.service');

const list = asyncHandler(async (req, res) => success(res, {
  message: 'Company verification modes',
  data: await service.list({ companyId: req.user.companyId, includeInactive: req.query.includeInactive }),
}));

const create = asyncHandler(async (req, res) => created(res, {
  message: 'Verification mode created.',
  data: await service.create({ companyId: req.user.companyId, name: req.body.name }),
}));

const update = asyncHandler(async (req, res) => success(res, {
  message: 'Verification mode updated.',
  data: await service.update({ companyId: req.user.companyId, id: req.params.id, payload: req.body }),
}));

module.exports = { list, create, update };
