'use strict';

const { prisma } = require('../../common/prisma');

const list = (companyId, includeInactive) => prisma.verificationMode.findMany({
  where: { companyId, ...(includeInactive ? {} : { isActive: true }) },
  orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
});

const findByName = (companyId, name, excludeId) => prisma.verificationMode.findFirst({
  where: {
    companyId,
    name: { equals: name, mode: 'insensitive' },
    ...(excludeId ? { id: { not: excludeId } } : {}),
  },
});

const findById = (companyId, id) => prisma.verificationMode.findFirst({ where: { companyId, id } });
const create = (data) => prisma.verificationMode.create({ data });
const update = (id, data) => prisma.verificationMode.update({ where: { id }, data });

module.exports = { list, findByName, findById, create, update };
