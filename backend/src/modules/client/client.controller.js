'use strict';

const asyncHandler = require('../../utils/asyncHandler');
const { success, created } = require('../../utils/response');
const { parsePagination, buildMeta } = require('../../utils/pagination');
const { writeAudit } = require('../../utils/audit');

const service = require('./client.service');

/**
 * Create Client
 */
const createClient = asyncHandler(async (req, res) => {
  const data = await service.create({
    payload: req.body,
    currentUser: req.user,
    req,
  });

  await writeAudit({
    req,
    action: 'client.create',
    entity: 'Client',
    entityId: data.id,
    metadata: {
      clientCode: data.clientCode,
      clientName: data.name,
    },
  });

  return created(res, {
    message: 'Client created successfully.',
    data,
  });
});

/**
 * Get Client By Id
 */
const getClient = asyncHandler(async (req, res) => {
  const data = await service.getById({
    id: req.params.id,
    companyId: req.user.companyId,
  });

  return success(res, {
    message: 'Client',
    data,
  });
});

/**
 * List Clients
 */
const listClients = asyncHandler(async (req, res) => {
  const pagination = parsePagination(req.query);

  const { items, total } = await service.list({
    companyId: req.user.companyId,
    query: {
      ...pagination,
      status: req.query.status,
      includeDeleted: req.query.includeDeleted,
      deletedOnly: req.query.deletedOnly,
    },
  });

  return success(res, {
    message: 'Clients',
    data: items,
    meta: buildMeta({
      page: pagination.page,
      limit: pagination.limit,
      total,
    }),
  });
});

/**
 * Update Client
 */
const updateClient = asyncHandler(async (req, res) => {
  const data = await service.update({
    id: req.params.id,
    companyId: req.user.companyId,
    payload: req.body,
    currentUser: req.user,
    req,
  });

  await writeAudit({
    req,
    action: 'client.update',
    entity: 'Client',
    entityId: req.params.id,
  });

  return success(res, {
    message: 'Client updated successfully.',
    data,
  });
});

/**
 * Soft Delete Client
 */
const deleteClient = asyncHandler(async (req, res) => {
  await service.remove({
    id: req.params.id,
    companyId: req.user.companyId,
  });

  await writeAudit({
    req,
    action: 'client.delete',
    entity: 'Client',
    entityId: req.params.id,
  });

  return success(res, {
    message: 'Client deleted successfully.',
  });
});

/**
 * Activate Client
 */
const activateClient = asyncHandler(async (req, res) => {
  const data = await service.activate({
    id: req.params.id,
    companyId: req.user.companyId,
  });

  await writeAudit({
    req,
    action: 'client.activate',
    entity: 'Client',
    entityId: req.params.id,
  });

  return success(res, {
    message: 'Client activated successfully.',
    data,
  });
});

/**
 * Inactivate Client
 */
const inactivateClient = asyncHandler(async (req, res) => {
  const data = await service.inactivate({
    id: req.params.id,
    companyId: req.user.companyId,
  });

  await writeAudit({
    req,
    action: 'client.inactivate',
    entity: 'Client',
    entityId: req.params.id,
  });

  return success(res, {
    message: 'Client inactivated successfully.',
    data,
  });
});

const restoreClient = asyncHandler(async (req, res) => {
  const data = await service.restore({ id: req.params.id, companyId: req.user.companyId });
  await writeAudit({ req, action: 'client.restore', entity: 'Client', entityId: req.params.id });
  return success(res, { message: 'Client restored successfully.', data });
});

module.exports = {
  createClient,
  getClient,
  listClients,
  updateClient,
  deleteClient,
  activateClient,
  inactivateClient,
  restoreClient,
};