'use strict';

const asyncHandler = require('../../utils/asyncHandler');
const { success } = require('../../utils/response');
const { parsePagination, buildMeta } = require('../../utils/pagination');
const service = require('./audit.service');

const listAuditLogs = asyncHandler(async (req, res) => {
  const parsed = parsePagination(req.query);
  const pagination = { ...parsed, limit: Math.min(parsed.limit, 100) };
  const result = await service.list({
    ...pagination,
    search: String(req.query.search || '').trim(),
    companyId: req.query.companyId,
    action: String(req.query.action || '').trim(),
    entity: String(req.query.entity || '').trim(),
    from: req.query.from,
    to: req.query.to ? new Date(`${req.query.to}T00:00:00.000Z`) : undefined,
  });

  return success(res, {
    message: 'Audit logs',
    data: result.items,
    meta: buildMeta({ total: result.total, page: result.page, limit: result.limit }),
  });
});

module.exports = { listAuditLogs };