'use strict';

const asyncHandler = require('../../utils/asyncHandler');
const { success, created } = require('../../utils/response');
const service = require('./verification-check-type.service');

const list = asyncHandler(async (req, res) => {
  const includeInactive = req.query.includeInactive === 'true' && req.user?.role?.isSuperAdmin;
  const data = await service.list({ includeInactive });
  return success(res, { data }, 'Verification check types');
});

const create = asyncHandler(async (req, res) => {
  const data = await service.create(req.body);
  return created(res, { data }, 'Verification check type created');
});

const update = asyncHandler(async (req, res) => {
  const data = await service.update({ type: req.params.id, payload: req.body });
  return success(res, { data }, 'Verification check type updated');
});

module.exports = { list, create, update };
