'use strict';

const { prisma } = require('../../common/prisma');

const list = async ({ page, limit, search, companyId, status }) => {
  const candidateWhere = {
    isDeleted: false,
    ...(companyId ? { companyId } : {}),
    ...(status ? { status } : {}),
    ...(search ? {
      OR: [
        { candidateCode: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { company: { name: { contains: search, mode: 'insensitive' } } },
      ],
    } : {}),
  };

  const [items, total, companies, groupedCounts] = await Promise.all([
    prisma.candidate.findMany({
      where: candidateWhere,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        company: { select: { id: true, name: true, shortCode: true } },
        client: { select: { id: true, name: true } },
      },
    }),
    prisma.candidate.count({ where: candidateWhere }),
    prisma.company.findMany({
      where: { isDeleted: false },
      select: { id: true, name: true, shortCode: true },
      orderBy: { name: 'asc' },
    }),
    prisma.candidate.groupBy({
      by: ['companyId'],
      where: candidateWhere,
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
        candidateCount: countsByCompany.get(company.id) || 0,
      })),
    },
  };
};

module.exports = { list };