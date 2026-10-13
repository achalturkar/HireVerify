'use strict';

const asyncHandler = require('../../utils/asyncHandler');
const { success } = require('../../utils/response');
const { parsePagination, buildMeta } = require('../../utils/pagination');
const { writeAudit } = require('../../utils/audit');
const service = require('./platform-candidate.service');

const listCandidates = asyncHandler(async (req, res) => {
  const parsed = parsePagination(req.query);
  const pagination = { ...parsed, limit: Math.min(parsed.limit, 100) };
  const result = await service.list({
    ...pagination,
    search: String(req.query.search || '').trim(),
    companyId: req.query.companyId,
    status: req.query.status,
  });

  return success(res, {
    message: 'Platform candidates',
    data: result.items,
    meta: { ...buildMeta({ total: result.total, page: result.page, limit: result.limit }), summary: result.summary },
  });
});

const getCandidate = asyncHandler(async (req, res) => {
  const data = await service.getById(req.params.id);
  return success(res, { message: 'Platform candidate', data });
});

const updateCandidate = asyncHandler(async (req, res) => {
  const data = await service.update({ id: req.params.id, payload: req.body, currentUser: req.user });
  await writeAudit({ req, action: 'CANDIDATE_UPDATED', entity: 'Candidate', entityId: req.params.id });
  return success(res, { message: 'Candidate updated successfully.', data });
});

module.exports = { listCandidates, getCandidate, updateCandidate };