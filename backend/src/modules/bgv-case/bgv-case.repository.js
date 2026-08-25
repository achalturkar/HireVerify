'use strict';

const { prisma } = require('../../common/prisma');

const create = (data) => prisma.bGVCase.create({ data });

const findById = (id, companyId) => prisma.bGVCase.findFirst({
  where: { id, companyId },
  include: {
    candidate: { select: { id: true, candidateCode: true, firstName: true, lastName: true, email: true, phone: true, gender: true, dateOfBirth: true, currentAddress: true, permanentAddress: true } },
    client: { select: { id: true, name: true, clientCode: true, company: { select: { name: true, shortCode: true, primaryColor: true, logoUrl: true, address: true } } } },
    checks: { include: { documents: true } },
    events: { orderBy: { createdAt: 'desc' }, take: 50 },
    report: { select: { id: true, reportNumber: true, status: true, overallResult: true } },
  },
});

const findByCaseNumber = (caseNumber) => prisma.bGVCase.findUnique({ where: { caseNumber } });
const countByCompany = (companyId) => prisma.bGVCase.count({ where: { companyId } });

const list = async ({ companyId, clientId, candidateId, status, overallResult, search, initiatedFrom, initiatedTo, skip, limit, sortBy, sortOrder }) => {
  const where = {
    companyId,
    ...(clientId ? { clientId } : {}),
    ...(candidateId ? { candidateId } : {}),
    ...(status ? { status } : {}),
    ...(overallResult ? { overallResult } : {}),
    ...((initiatedFrom || initiatedTo) ? { initiatedAt: { ...(initiatedFrom ? { gte: new Date(initiatedFrom) } : {}), ...(initiatedTo ? { lt: new Date(new Date(initiatedTo).getTime() + 24 * 60 * 60 * 1000) } : {}) } } : {}),
    ...(search ? { OR: [
      { caseNumber: { contains: search, mode: 'insensitive' } },
      { clientReference: { contains: search, mode: 'insensitive' } },
      { candidate: { firstName: { contains: search, mode: 'insensitive' } } },
      { candidate: { lastName: { contains: search, mode: 'insensitive' } } },
    ] } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.bGVCase.findMany({
      where, skip, take: limit, orderBy: { [sortBy]: sortOrder },
      include: { candidate: { select: { id: true, candidateCode: true, firstName: true, lastName: true, email: true } }, client: { select: { id: true, name: true, clientCode: true } }, _count: { select: { checks: true } } },
    }),
    prisma.bGVCase.count({ where }),
  ]);
  return { items, total };
};

const update = (id, data) => prisma.bGVCase.update({ where: { id }, data });
const updateMeta = (id, data) => prisma.bGVCase.update({ where: { id }, data });
const remove = (id) => prisma.bGVCase.delete({ where: { id } });

const createEvent = (data) => prisma.verificationEvent.create({ data });

module.exports = { create, findById, findByCaseNumber, countByCompany, list, update, updateMeta, remove, createEvent };
