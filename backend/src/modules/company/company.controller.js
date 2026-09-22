'use strict';

const asyncHandler = require('../../utils/asyncHandler');
const { success, created } = require('../../utils/response');
const { parsePagination, buildMeta } = require('../../utils/pagination');
const { writeAudit } = require('../../utils/audit');
const service = require('./company.service');

const createCompany = asyncHandler(async (req, res) => {
  const result = await service.create({ payload: req.body, currentUser: req.user, req });
  await writeAudit({
    req,
    action: 'company.create',
    entity: 'Company',
    entityId: result.company.id,
    metadata: { name: result.company.name, adminUserId: result.admin.id },
  });
  return created(res, { message: 'Company created', data: result });
});

const getCompany = asyncHandler(async (req, res) => {
  const data = await service.getById({ id: req.params.id });
  return success(res, { message: 'Company', data });
});

const listCompanies = asyncHandler(async (req, res) => {
  const pagination = parsePagination(req.query);
  const { items, total } = await service.list({
    query: {
      ...pagination,
      status: req.query.status,
      includeDeleted: req.query.includeDeleted,
    },
  });
  return success(res, {
    message: 'Companies',
    data: items,
    meta: buildMeta({ page: pagination.page, limit: pagination.limit, total }),
  });
});

const updateCompany = asyncHandler(async (req, res) => {
  const data = await service.update({ id: req.params.id, payload: req.body, req });
  await writeAudit({ req, action: 'company.update', entity: 'Company', entityId: req.params.id });
  return success(res, { message: 'Company updated', data });
});

const deleteCompany = asyncHandler(async (req, res) => {
  await service.remove({ id: req.params.id });
  await writeAudit({ req, action: 'company.delete', entity: 'Company', entityId: req.params.id });
  return success(res, { message: 'Company deleted (soft)' });
});

const suspendCompany = asyncHandler(async (req, res) => {
  const data = await service.suspend({ id: req.params.id });
  await writeAudit({ req, action: 'company.suspend', entity: 'Company', entityId: req.params.id });
  return success(res, { message: 'Company suspended', data });
});

const activateCompany = asyncHandler(async (req, res) => {
  const data = await service.activate({ id: req.params.id });
  await writeAudit({ req, action: 'company.activate', entity: 'Company', entityId: req.params.id });
  return success(res, { message: 'Company activated', data });
});

const getCompanyStats = asyncHandler(async (req, res) => {
  const data = await service.getStats({ id: req.params.id });
  return success(res, { message: 'Company stats', data });
});
const getCompanyAnalytics = asyncHandler(async (req, res) => {
  const data = await service.getAnalytics({ id: req.user.companyId, period: req.query.period, year: req.query.year });
  return success(res, { message: 'Company analytics', data });
});

const getCompanyDetails = asyncHandler(async (req, res) => {
  const data = await service.getDetails({ id: req.params.id });
  return success(res, { message: 'Company details', data });
});

module.exports = {
  createCompany,
  getCompany,
  listCompanies,
  updateCompany,
  deleteCompany,
  suspendCompany,
  activateCompany,
  getCompanyStats, getCompanyAnalytics,
  getCompanyDetails,
};
