'use strict';

const { prisma } = require('../../common/prisma');

const include = {
  role: true,
  company: true,
  client: { select: { id: true, name: true } },
};

const create = (data) => prisma.user.create({ data, include });

const findById = (id) => prisma.user.findFirst({ where: { id, isDeleted: false }, include });

const findByEmail = (email) => prisma.user.findUnique({ where: { email: email.toLowerCase() }, include });

const list = async ({ companyId, skip, limit, search, status, sortBy, sortOrder }) => {
  const where = {
    isDeleted: false,
    ...(companyId !== undefined ? { companyId } : {}),
    ...(status ? { status } : {}),
    ...(search
      ? {
          OR: [
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };
  const [items, total] = await Promise.all([
    prisma.user.findMany({ where, skip, take: limit, orderBy: { [sortBy]: sortOrder }, include }),
    prisma.user.count({ where }),
  ]);
  return { items, total };
};

const listDeleted = async ({ skip, limit, search, companyId, sortBy, sortOrder }) => {
  const where = {
    isDeleted: true,
    ...(companyId ? { companyId } : {}),
    ...(search
      ? {
          OR: [
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };
  const [items, total] = await Promise.all([
    prisma.user.findMany({ where, skip, take: limit, orderBy: { [sortBy]: sortOrder }, include }),
    prisma.user.count({ where }),
  ]);
  return { items, total };
};

const findDeletedById = (id) => prisma.user.findFirst({ where: { id, isDeleted: true }, include });

const permanentlyDelete = (id) => prisma.$transaction(async (tx) => {
  await tx.auditLog.updateMany({ where: { userId: id }, data: { userId: null } });
  await tx.user.delete({ where: { id } });
});

const update = (id, data) => prisma.user.update({ where: { id }, data, include });

const softDelete = (id) =>
  prisma.user.update({
    where: { id },
    data: { isDeleted: true, deletedAt: new Date(), status: 'INACTIVE' },
  });

module.exports = { create, findById, findByEmail, list, listDeleted, findDeletedById, permanentlyDelete, update, softDelete };
