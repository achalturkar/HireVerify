'use strict';

const asyncHandler = require('../../utils/asyncHandler');
const { success, created } = require('../../utils/response');
const { parsePagination, buildMeta } = require('../../utils/pagination');
const { writeAudit } = require('../../utils/audit');
const service = require('./candidate.services');

const createCandidate = asyncHandler(async (req, res) => {
  const data = await service.create({ payload: req.body, companyId: req.user.companyId, currentUser: req.user });
  await writeAudit({ req, action: 'CANDIDATE_CREATED', entity: 'Candidate', entityId: data.id, metadata: { candidateCode: data.candidateCode } });
  return created(res, { message: 'Candidate created successfully.', data });
});

const getCandidate = asyncHandler(async (req, res) => {
  const data = await service.getById({ id: req.params.id, companyId: req.user.companyId });
  return success(res, { message: 'Candidate', data });
});

const listCandidates = asyncHandler(async (req, res) => {
  const pagination = parsePagination(req.query);
  const { items, total } = await service.list({
    companyId: req.user.companyId,
    query: { ...pagination, search: req.query.search, clientId: req.query.clientId, status: req.query.status, includeDeleted: req.query.includeDeleted, sortBy: req.query.sortBy, sortOrder: req.query.sortOrder },
  });
  return success(res, { message: 'Candidates', data: items, meta: buildMeta({ page: pagination.page, limit: pagination.limit, total }) });
});

const updateCandidate = asyncHandler(async (req, res) => {
  const data = await service.update({ id: req.params.id, companyId: req.user.companyId, payload: req.body, currentUser: req.user });
  await writeAudit({ req, action: 'CANDIDATE_UPDATED', entity: 'Candidate', entityId: req.params.id });
  return success(res, { message: 'Candidate updated successfully.', data });
});

const deleteCandidate = asyncHandler(async (req, res) => {
  await service.remove({ id: req.params.id, companyId: req.user.companyId });
  await writeAudit({ req, action: 'CANDIDATE_DELETED', entity: 'Candidate', entityId: req.params.id });
  return success(res, { message: 'Candidate deleted successfully.' });
});

module.exports = { createCandidate, getCandidate, listCandidates, updateCandidate, deleteCandidate };
