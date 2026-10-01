'use strict';

const { prisma } = require('../../common/prisma');

const includePermissions = {
  rolePermissions: { include: { permission: true } },
  company: { select: { id: true, name: true } },
};

const create = ({ companyId, name, description, isCompanyAdmin = false, permissionIds = [] }) =>
  prisma.$transaction(async (tx) => {
    const role = await tx.role.create({
      data: {
        companyId,
        name,
        description,
        isCompanyAdmin,
        isSuperAdmin: false,
      },
    });
    if (permissionIds.length) {
      await tx.rolePermission.createMany({
        data: permissionIds.map((permissionId) => ({ roleId: role.id, permissionId })),
        skipDuplicates: true,
      });
    }
    return tx.role.findUnique({ where: { id: role.id }, include: includePermissions });
  });

const findById = (id, { companyId } = {}) =>
  prisma.role.findFirst({
    where: { id, ...(companyId !== undefined ? { companyId } : {}) },
    include: includePermissions,
  });

const findByNameInCompany = (name, companyId) =>
  prisma.role.findFirst({ where: { name, companyId }, include: includePermissions });

const list = async ({ companyId, skip, limit, search, sortBy, sortOrder }) => {
  const where = {
    ...(companyId !== undefined ? { companyId } : {}),
    ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.role.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      include: includePermissions,
    }),
    prisma.role.count({ where }),
  ]);
  return { items, total };
};

const update = ({ id, data, permissionIds }) =>
  prisma.$transaction(async (tx) => {
    if (Object.keys(data || {}).length) {
      await tx.role.update({ where: { id }, data });
    }
    if (Array.isArray(permissionIds)) {
      await tx.rolePermission.deleteMany({ where: { roleId: id } });
      if (permissionIds.length) {
        await tx.rolePermission.createMany({
          data: permissionIds.map((permissionId) => ({ roleId: id, permissionId })),
          skipDuplicates: true,
        });
      }
    }
    return tx.role.findUnique({ where: { id }, include: includePermissions });
  });

const deleteById = (id) => prisma.role.delete({ where: { id } });

const countUsersUsingRole = (roleId) => prisma.user.count({ where: { roleId, isDeleted: false } });

module.exports = {
  create,
  findById,
  findByNameInCompany,
  list,
  update,
  deleteById,
  countUsersUsingRole,
};
