'use strict';

const { prisma } = require('../../common/prisma');

const startOfPeriod = (date, period) => period === 'yearly'
  ? new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  : new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));

const shiftPeriod = (date, amount, period) => {
  const shifted = new Date(date);
  if (period === 'yearly') shifted.setUTCFullYear(shifted.getUTCFullYear() + amount);
  else shifted.setUTCMonth(shifted.getUTCMonth() + amount);
  return shifted;
};

const list = async ({ period = 'monthly' } = {}) => {
  const selectedPeriod = period === 'yearly' ? 'yearly' : 'monthly';
  const bucketCount = selectedPeriod === 'yearly' ? 5 : 12;
  const now = new Date();
  const currentStart = startOfPeriod(now, selectedPeriod);
  const trendStart = shiftPeriod(currentStart, -(bucketCount - 1), selectedPeriod);
  const previousStart = shiftPeriod(trendStart, -bucketCount, selectedPeriod);
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const companyWhere = { isDeleted: false };
  const activeUserWhere = { isDeleted: false };

  const [
    companies,
    activeCompanies,
    suspendedCompanies,
    inactiveCompanies,
    users,
    activeUsers,
    roles,
    candidates,
    clients,
    bgvCases,
    auditEvents24h,
    recentCompanies,
    recentActivity,
    trendCompanies,
    trendUsers,
    trendCandidates,
    trendCases,
    trendAudit,
  ] = await Promise.all([
    prisma.company.count({ where: companyWhere }),
    prisma.company.count({ where: { ...companyWhere, status: 'ACTIVE' } }),
    prisma.company.count({ where: { ...companyWhere, status: 'SUSPENDED' } }),
    prisma.company.count({ where: { ...companyWhere, status: 'INACTIVE' } }),
    prisma.user.count({ where: activeUserWhere }),
    prisma.user.count({ where: { ...activeUserWhere, status: 'ACTIVE' } }),
    prisma.role.count(),
    prisma.candidate.count({ where: { isDeleted: false } }),
    prisma.client.count({ where: { isDeleted: false } }),
    prisma.bGVCase.count(),
    prisma.auditLog.count({ where: { createdAt: { gte: since } } }),
    prisma.company.findMany({
      where: companyWhere,
      orderBy: { createdAt: 'desc' },
      take: 6,
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        createdAt: true,
        _count: { select: { users: true, clients: true, candidates: true } },
      },
    }),
    prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 8,
      include: {
        company: { select: { id: true, name: true } },
        user: { select: { firstName: true, lastName: true, email: true } },
      },
    }),
    prisma.company.findMany({ where: { ...companyWhere, createdAt: { gte: previousStart } }, select: { createdAt: true } }),
    prisma.user.findMany({ where: { ...activeUserWhere, createdAt: { gte: previousStart } }, select: { createdAt: true } }),
    prisma.candidate.findMany({ where: { isDeleted: false, createdAt: { gte: previousStart } }, select: { createdAt: true } }),
    prisma.bGVCase.findMany({ where: { createdAt: { gte: previousStart } }, select: { createdAt: true } }),
    prisma.auditLog.findMany({ where: { createdAt: { gte: previousStart } }, select: { createdAt: true } }),
  ]);

  const keyFor = (date) => selectedPeriod === 'yearly'
    ? String(date.getUTCFullYear())
    : `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
  const trend = (records) => {
    const buckets = Array.from({ length: bucketCount }, (_, index) => {
      const start = shiftPeriod(trendStart, index, selectedPeriod);
      return {
        key: keyFor(start),
        label: selectedPeriod === 'yearly' ? String(start.getUTCFullYear()) : start.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }),
        value: 0,
      };
    });
    const byKey = new Map(buckets.map((bucket) => [bucket.key, bucket]));
    records.forEach((record) => byKey.get(keyFor(new Date(record.createdAt))) && (byKey.get(keyFor(new Date(record.createdAt))).value += 1));
    return buckets;
  };
  const periodCount = (records, start, end) => records.filter((record) => {
    const date = new Date(record.createdAt);
    return date >= start && date < end;
  }).length;
  const compare = (records) => {
    const current = periodCount(records, currentStart, now);
    const previous = periodCount(records, previousStart, trendStart);
    return { current, previous, percent: previous ? Math.round(((current - previous) / previous) * 100) : (current ? 100 : 0) };
  };

  return {
    stats: {
      companies,
      activeCompanies,
      suspendedCompanies,
      inactiveCompanies,
      users,
      activeUsers,
      roles,
      candidates,
      clients,
      bgvCases,
      auditEvents24h,
    },
    recentCompanies,
    recentActivity,
    analytics: {
      period: selectedPeriod,
      trends: {
        companies: trend(trendCompanies),
        users: trend(trendUsers),
        candidates: trend(trendCandidates),
        bgvCases: trend(trendCases),
        auditEvents: trend(trendAudit),
      },
      comparison: {
        companies: compare(trendCompanies),
        users: compare(trendUsers),
        candidates: compare(trendCandidates),
        bgvCases: compare(trendCases),
        auditEvents: compare(trendAudit),
      },
    },
  };
};

module.exports = { list };