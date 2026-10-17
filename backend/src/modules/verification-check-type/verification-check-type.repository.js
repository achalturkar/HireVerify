'use strict';

const { prisma } = require('../../common/prisma');

const list = ({ includeInactive = false } = {}) => prisma.verificationCheckType.findMany({
  where: includeInactive ? {} : { isActive: true },
  orderBy: { createdAt: 'asc' },
});

const findByType = (type) => prisma.verificationCheckType.findUnique({ where: { type } });
const create = (data) => prisma.verificationCheckType.create({ data });
const update = (type, data) => prisma.verificationCheckType.update({ where: { type }, data });

module.exports = { list, findByType, create, update };
