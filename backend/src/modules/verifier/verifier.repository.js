'use strict';

const { prisma } = require('../../common/prisma');

const list = (companyId, includeInactive) => prisma.verifier.findMany({
  where: { companyId, ...(includeInactive ? {} : { isActive: true }) },
  orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
});

const findByName = (companyId, name, excludeId) => prisma.verifier.findFirst({
  where: {
    companyId,
    name: { equals: name, mode: 'insensitive' },
    ...(excludeId ? { id: { not: excludeId } } : {}),
  },
});

const findById = (companyId, id) => prisma.verifier.findFirst({ where: { companyId, id } });
const create = (data) => prisma.verifier.create({ data });
const update = (id, data) => prisma.verifier.update({ where: { id }, data });

module.exports = { list, findByName, findById, create, update };