'use strict';

const { BadRequestError, NotFoundError, ConflictError, ForbiddenError } = require('../../utils/errors');
const permissionRepo = require('../permission/permission.repository');
const repo = require('./role.repository');

const toDto = (role) => ({
  id: role.id,
  name: role.name,
  description: role.description,
  companyId: role.companyId,
  isCompanyAdmin: role.isCompanyAdmin,
  isSuperAdmin: role.isSuperAdmin,
  isSystem: role.isSystem,
  permissions: (role.rolePermissions || []).map((rp) => ({
    id: rp.permission.id,
    key: rp.permission.key,
    module: rp.permission.module,
    action: rp.permission.action,
  })),
  createdAt: role.createdAt,
  updatedAt: role.updatedAt,
});

/**
 * Resolve scope: super admin can pass companyId; company users are locked to their company.
 */
const resolveCompanyScope = (currentUser, requestedCompanyId) => {
  if (currentUser.role.isSuperAdmin) {
    return requestedCompanyId !== undefined ? requestedCompanyId : undefined; // undefined = all
  }
  return currentUser.companyId;
};

const validatePermissionIds = async (permissionIds) => {
  if (!Array.isArray(permissionIds) || !permissionIds.length) return [];
  const perms = await permissionRepo.listPermissions();
  const idSet = new Set(perms.map((p) => p.id));
  const invalid = permissionIds.filter((id) => !idSet.has(id));
  if (invalid.length) throw new BadRequestError(`Invalid permissionIds: ${invalid.join(', ')}`);
  return permissionIds;
};

const create = async ({ currentUser, payload }) => {
  const companyId = resolveCompanyScope(currentUser, payload.companyId);
  if (!companyId) throw new BadRequestError('companyId is required');

  const existing = await repo.findByNameInCompany(payload.name, companyId);
  if (existing) throw new ConflictError(`Role "${payload.name}" already exists in this company`);

  const permissionIds = await validatePermissionIds(payload.permissionIds || []);
  const role = await repo.create({
    companyId,
    name: payload.name,
    description: payload.description || null,
    isCompanyAdmin: false, // Only the seeded default one is Company Admin
    permissionIds,
  });
  return toDto(role);
};

const getById = async ({ currentUser, id }) => {
  const scope = currentUser.role.isSuperAdmin ? undefined : currentUser.companyId;
  const role = await repo.findById(id, { companyId: scope });
  if (!role) throw new NotFoundError('Role not found');
  return toDto(role);
};

const list = async ({ currentUser, query }) => {
  const companyId = currentUser.role.isSuperAdmin
    ? (query.companyId || undefined)
    : currentUser.companyId;
  const result = await repo.list({
    companyId,
    skip: query.skip,
    limit: query.limit,
    search: query.search,
    sortBy: ['name', 'createdAt'].includes(query.sortBy) ? query.sortBy : 'createdAt',
    sortOrder: query.sortOrder,
  });
  return { items: result.items.map(toDto), total: result.total };
};

const update = async ({ currentUser, id, payload }) => {
  const scope = currentUser.role.isSuperAdmin ? undefined : currentUser.companyId;
  const existing = await repo.findById(id, { companyId: scope });
  if (!existing) throw new NotFoundError('Role not found');
  if (existing.isSuperAdmin) throw new ForbiddenError('Super Admin role is protected');
  if (existing.isCompanyAdmin && !currentUser.role.isSuperAdmin) {
    throw new ForbiddenError('Only Super Admins can edit Company Admin permissions');
  }

  const data = {};
  if (!existing.isCompanyAdmin && payload.name !== undefined && payload.name !== existing.name) {
    const conflict = await repo.findByNameInCompany(payload.name, existing.companyId);
    if (conflict && conflict.id !== id) throw new ConflictError('Role name already exists');
    data.name = payload.name;
  }
  if (!existing.isCompanyAdmin && payload.description !== undefined) data.description = payload.description;

  let permissionIds;
  if (Array.isArray(payload.permissionIds)) {
    permissionIds = await validatePermissionIds(payload.permissionIds);
  }

  const role = await repo.update({ id, data, permissionIds });
  return toDto(role);
};

const remove = async ({ currentUser, id }) => {
  const scope = currentUser.role.isSuperAdmin ? undefined : currentUser.companyId;
  const existing = await repo.findById(id, { companyId: scope });
  if (!existing) throw new NotFoundError('Role not found');
  if (existing.isSuperAdmin || existing.isCompanyAdmin) {
    throw new ForbiddenError('System roles cannot be deleted');
  }
  const usage = await repo.countUsersUsingRole(id);
  if (usage > 0) {
    throw new ConflictError(`Cannot delete role: ${usage} user(s) are assigned to it`);
  }
  await repo.deleteById(id);
};

module.exports = { create, getById, list, update, remove, toDto };
