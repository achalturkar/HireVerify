'use strict';

const asyncHandler = require('../../utils/asyncHandler');
const { success, created } = require('../../utils/response');
const { parsePagination, buildMeta } = require('../../utils/pagination');
const { writeAudit } = require('../../utils/audit');
const service = require('./user.service');

const createUser = asyncHandler(async (req, res) => {
  const data = await service.create({ currentUser: req.user, payload: req.body });
  await writeAudit({ req, action: 'users.create', entity: 'User', entityId: data.id });
  return created(res, { message: 'User created', data });
});

const getUser = asyncHandler(async (req, res) => {
  const data = await service.getById({ currentUser: req.user, id: req.params.id });
  return success(res, { message: 'User', data });
});

const listUsers = asyncHandler(async (req, res) => {
  const pagination = parsePagination(req.query);
  const { items, total } = await service.list({
    currentUser: req.user,
    query: { ...pagination, companyId: req.query.companyId, status: req.query.status },
  });
  return success(res, {
    message: 'Users',
    data: items,
    meta: buildMeta({ page: pagination.page, limit: pagination.limit, total }),
  });
});

const updateUser = asyncHandler(async (req, res) => {
  const data = await service.update({ currentUser: req.user, id: req.params.id, payload: req.body });
  await writeAudit({ req, action: 'users.update', entity: 'User', entityId: req.params.id });
  return success(res, { message: 'User updated', data });
});

const updateCompanyAdminEmail = asyncHandler(async (req, res) => {
  const data = await service.updateCompanyAdminEmail({
    currentUser: req.user,
    id: req.params.id,
    email: req.body.email,
  });
  await writeAudit({ req, action: 'users.updateCompanyAdminEmail', entity: 'User', entityId: req.params.id });
  return success(res, { message: 'Company Admin login email updated', data });
});

const deleteUser = asyncHandler(async (req, res) => {
  await service.remove({ currentUser: req.user, id: req.params.id });
  await writeAudit({ req, action: 'users.delete', entity: 'User', entityId: req.params.id });
  return success(res, { message: 'User deleted (soft)' });
});

/* ------------------------------------------------------------------
   Self-service: /users/me/*
------------------------------------------------------------------- */

const getMyProfile = asyncHandler(async (req, res) => {
  const data = await service.getMyProfile({ currentUser: req.user });
  return success(res, { message: 'Profile', data });
});

const updateMyProfile = asyncHandler(async (req, res) => {
  const data = await service.updateProfile({ currentUser: req.user, payload: req.body });
  await writeAudit({ req, action: 'users.updateProfile', entity: 'User', entityId: req.user.id });
  return success(res, { message: 'Profile updated', data });
});

const changeMyPassword = asyncHandler(async (req, res) => {
  await service.changePassword({ currentUser: req.user, payload: req.body });
  await writeAudit({ req, action: 'users.changePassword', entity: 'User', entityId: req.user.id });
  return success(res, { message: 'Password changed successfully' });
});

module.exports = {
  createUser,
  getUser,
  listUsers,
  updateUser,
  updateCompanyAdminEmail,
  deleteUser,
  getMyProfile,
  updateMyProfile,
  changeMyPassword,
};