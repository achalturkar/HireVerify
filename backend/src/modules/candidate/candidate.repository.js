'use strict';

const { prisma } = require('../../common/prisma');

const create = (data) => prisma.candidate.create({ data });

const findById = (id, companyId, { includeDeleted = false } = {}) =>
  prisma.candidate.findFirst({
    where: { id, companyId, ...(includeDeleted ? {} : { isDeleted: false }) },
    include: { _count: { select: { bgvCases: true } } },
  });

const findByEmail = (companyId, clientId, email) =>
  prisma.candidate.findFirst({
    where: { companyId, clientId, email: { equals: email, mode: 'insensitive' }, isDeleted: false },
  });

const update = (id, data) => prisma.candidate.update({ where: { id }, data });

const softDelete = (id) => prisma.candidate.update({
  where: { id },
  data: { isDeleted: true, deletedAt: new Date() },
});

const list = async ({ companyId, skip, limit, search, clientId, status, sortBy, sortOrder, includeDeleted }) => {
  const where = {
    companyId,
    ...(includeDeleted ? {} : { isDeleted: false }),
    ...(clientId ? { clientId } : {}),
    ...(status ? { status } : {}),
    ...(search ? {
      OR: [
        { candidateCode: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ],
    } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.candidate.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      include: { _count: { select: { bgvCases: true } } },
    }),
    prisma.candidate.count({ where }),
  ]);

  return { items, total };
};

module.exports = { create, findById, findByEmail, update, softDelete, list };
