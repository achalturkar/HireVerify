'use strict';

const { prisma } = require('../../common/prisma');

const list = async ({ page, limit, search, companyId, status }) => {
  const clientWhere = {
    isDeleted: false,
    ...(companyId ? { companyId } : {}),
    ...(status ? { status } : {}),
    ...(search ? {
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { clientCode: { contains: search, mode: 'insensitive' } },
        { contactName: { contains: search, mode: 'insensitive' } },
        { contactEmail: { contains: search, mode: 'insensitive' } },
        { company: { name: { contains: search, mode: 'insensitive' } } },
      ],
    } : {}),
  };

  const [items, total, companies, groupedCounts] = await Promise.all([
    prisma.client.findMany({
      where: clientWhere,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        company: { select: { id: true, name: true, shortCode: true } },
        _count: { select: { candidates: true, bgvCases: true } },
      },
    }),
    prisma.client.count({ where: clientWhere }),
    prisma.company.findMany({
      where: { isDeleted: false },
      select: { id: true, name: true, shortCode: true },
      orderBy: { name: 'asc' },
    }),
    prisma.client.groupBy({
      by: ['companyId'],
      where: clientWhere,
      _count: { _all: true },
    }),
  ]);

  const countsByCompany = new Map(groupedCounts.map((entry) => [entry.companyId, entry._count._all]));

  return {
    items,
    total,
    page,
    limit,
    summary: {
      total,
      companies: companies.map((company) => ({
        ...company,
        clientCount: countsByCompany.get(company.id) || 0,
      })),
    },
  };
};

module.exports = { list };