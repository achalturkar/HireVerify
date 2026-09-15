'use strict';

const asyncHandler = require('../../utils/asyncHandler');
const { success } = require('../../utils/response');
const service = require('./platform-dashboard.service');

const getDashboard = asyncHandler(async (req, res) => {
  const data = await service.list({ period: req.query.period });
  return success(res, { message: 'Platform dashboard', data });
});

module.exports = { getDashboard };