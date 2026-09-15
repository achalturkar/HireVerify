'use strict';

const asyncHandler = require('../../utils/asyncHandler');
const { success } = require('../../utils/response');
const { parsePagination, buildMeta } = require('../../utils/pagination');
const service = require('./platform-client.service');

const listClients = asyncHandler(async (req, res) => {
  const parsed = parsePagination(req.query);
  const pagination = { ...parsed, limit: Math.min(parsed.limit, 100) };
  const result = await service.list({
    ...pagination,
    search: String(req.query.search || '').trim(),
    companyId: req.query.companyId,
    status: req.query.status,
  });

  return success(res, {
    message: 'Platform clients',
    data: result.items,
    meta: { ...buildMeta({ total: result.total, page: result.page, limit: result.limit }), summary: result.summary },
  });
});

module.exports = { listClients };