'use strict';

const { prisma } = require('../../common/prisma');

const create = (data) => prisma.candidate.create({ data });

const findById = (id, companyId, { includeDeleted = false } = {}) =>
  prisma.candidate.findFirst({
    where: { id, companyId, ...(includeDeleted ? {} : { isDeleted: false }) },
    include: {
      client: { select: { id: true, name: true, clientCode: true, contactEmail: true, contactPhone: true } },
      subclient: { select: { id: true, name: true, clientCode: true, serviceRates: true } },
      _count: { select: { bgvCases: true } },
      documents: true,
      portalInvitation: { select: { activatedAt: true, lastSentAt: true, expiresAt: true, revokedAt: true, reminderCount: true, lastRemindedAt: true } },
    },
  });

const update = (id, data) => prisma.candidate.update({ where: { id }, data });

const softDelete = (id) => prisma.candidate.update({
  where: { id },
  data: { isDeleted: true, deletedAt: new Date() },
});

const list = async ({ companyId, skip, limit, search, clientId, subclientId, status, dateFrom, dateTo, sortBy, sortOrder, includeDeleted }) => {
  const where = {
    companyId,
    ...(includeDeleted ? {} : { isDeleted: false }),
    ...(clientId ? { clientId } : {}),
    ...(subclientId === 'none' ? { subclientId: null } : subclientId ? { subclientId } : {}),
    ...(status ? { status } : {}),
    ...(dateFrom || dateTo ? { createdAt: { ...(dateFrom ? { gte: new Date(dateFrom) } : {}), ...(dateTo ? { lte: new Date(`${String(dateTo).slice(0, 10)}T23:59:59.999Z`) } : {}) } } : {}),
    ...(search ? {
      OR: [
        { candidateCode: { contains: search, mode: 'insensitive' } },
        { fullName: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { middleName: { contains: search, mode: 'insensitive' } },
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
      include: {
        client: { select: { id: true, name: true, clientCode: true, contactEmail: true, contactPhone: true } },
        subclient: { select: { id: true, name: true, clientCode: true, serviceRates: true } },
        _count: { select: { bgvCases: true } },
      },
    }),
    prisma.candidate.count({ where }),
  ]);

  return { items, total };
};

module.exports = { create, findById, update, softDelete, list };
