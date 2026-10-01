'use strict';

const asyncHandler = require('../../utils/asyncHandler');
const { success } = require('../../utils/response');
const service = require('./platform-branding.service');

const getBranding = asyncHandler(async (_req, res) => {
  const data = await service.getBranding();
  return success(res, { message: 'Platform branding', data });
});

const updateBranding = asyncHandler(async (req, res) => {
  const data = await service.updateBranding({ primaryColor: req.body.primaryColor });
  return success(res, { message: 'Platform branding updated', data });
});

module.exports = { getBranding, updateBranding };