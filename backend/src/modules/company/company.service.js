'use strict';

const { prisma } = require('../../common/prisma');
const { slugify } = require('../../utils/slug');
const { hashPassword, generateRandomPassword } = require('../../utils/password');
const { sendMail, buildCompanyAdminWelcomeEmail } = require('../../utils/mailer');
const { PERMISSION_KEYS, SYSTEM_ROLES } = require('../../common/constants/permissions');
const config = require('../../config');
const logger = require('../../common/logger');
const {
  NotFoundError,
  BadRequestError,
  ConflictError,
  ForbiddenError,
} = require('../../utils/errors');
const repo = require('./company.repository');

const toDto = (company) => ({
  id: company.id,
  name: company.name,
  slug: company.slug,
  shortCode: company.shortCode,
  contactEmail: company.contactEmail,
  contactPhone: company.contactPhone,
  logoUrl: company.logoUrl,
  signatureUrl: company.signatureUrl,
  stampUrl: company.stampUrl,
  primaryColor: company.primaryColor,
  address: company.address,
  settings: company.settings,
  status: company.status,
  isDeleted: company.isDeleted,
  createdAt: company.createdAt,
  updatedAt: company.updatedAt,
});

const ensureUniqueSlug = async (base) => {
  let slug = slugify(base);
  if (!slug) slug = `company-${Date.now()}`;
  let candidate = slug;
  let i = 1;
  while (await repo.findBySlug(candidate)) {
    i += 1;
    candidate = `${slug}-${i}`;
  }
  return candidate;
};

// Resolve an uploaded file (from multer .fields()) for a given field name,
// falling back to a plain URL string sent in the body, or null.
const resolveImageUrl = (req, fieldName, fallbackUrl) => {
  const uploadedFile = req?.files?.[fieldName]?.[0];
  if (uploadedFile) return `/uploads/companies/${uploadedFile.filename}`;
  if (typeof fallbackUrl === 'string' && fallbackUrl.trim()) return fallbackUrl.trim();
  return null;
};

/**
 * Create a company and, in one transaction:
 *  - Create a "Company Admin" role scoped to this company, with ALL permissions
 *  - Create the initial Company Admin user with a generated password
 *  - Send welcome email
 */
const create = async ({ payload, currentUser, req }) => {
  const {
    name,
    contactEmail,
    contactPhone,
    logoUrl,
    signatureUrl,
    stampUrl,
    primaryColor,
    address,
    settings,
    adminFirstName,
    adminLastName,
    adminEmail,
    adminPassword,
  } = payload;

  const resolvedLogoUrl = resolveImageUrl(req, 'logo', logoUrl);
  const resolvedSignatureUrl = resolveImageUrl(req, 'signature', signatureUrl);
  const resolvedStampUrl = resolveImageUrl(req, 'stamp', stampUrl);

  if (!name) throw new BadRequestError('Company name is required');
  if (!adminEmail) throw new BadRequestError('Admin email is required');

  const existingUser = await prisma.user.findUnique({ where: { email: adminEmail.toLowerCase() } });
  if (existingUser) throw new ConflictError('A user with the admin email already exists');

  const slug = payload.slug ? await ensureUniqueSlug(payload.slug) : await ensureUniqueSlug(name);

  const generatedPassword = adminPassword || generateRandomPassword(12);
  const passwordHash = await hashPassword(generatedPassword);

  // Load Global Company Admin role with permissions
  const globalCompanyAdminRole = await prisma.role.findFirst({
    where: {
      companyId: null,
      isCompanyAdmin: true,
    },
    include: {
      rolePermissions: true,
    },
  });

  if (!globalCompanyAdminRole) {
    throw new Error("Global Company Admin role not found. Run the seed first.");
  }

  const result = await prisma.$transaction(async (tx) => {
    const company = await tx.company.create({
      data: {
        name,
        slug,
        contactEmail: contactEmail || adminEmail,
        contactPhone: contactPhone || null,
        logoUrl: resolvedLogoUrl,
        signatureUrl: resolvedSignatureUrl,
        stampUrl: resolvedStampUrl,
        primaryColor: primaryColor || null,
        address: address || null,
        settings: settings || {},
        status: 'ACTIVE',
        createdById: currentUser?.id || null,
      },
    });

    // Default Company Admin role with ALL permissions
    const adminRole = await tx.role.create({
      data: {
        companyId: company.id,
        name: SYSTEM_ROLES.COMPANY_ADMIN,
        description: 'Default Company Admin role with all permissions',
        isCompanyAdmin: true,
        isSystem: true,
      },
    });

    await tx.rolePermission.createMany({
      data: globalCompanyAdminRole.rolePermissions.map((rp) => ({
        roleId: adminRole.id,
        permissionId: rp.permissionId,
      })),
      skipDuplicates: true,
    });

    const adminUser = await tx.user.create({
      data: {
        companyId: company.id,
        roleId: adminRole.id,
        firstName: adminFirstName || 'Company',
        lastName: adminLastName || 'Admin',
        email: adminEmail.toLowerCase(),
        passwordHash,
        mustChangePassword: true,
        status: 'ACTIVE',
      },
    });

    return { company, adminRole, adminUser };
  });

  // Send email — best effort, outside transaction
  try {
    const loginUrl = `${config.frontendUrl}/login`;
    const mail = buildCompanyAdminWelcomeEmail({
      companyName: result.company.name,
      adminName: `${result.adminUser.firstName} ${result.adminUser.lastName}`.trim(),
      email: result.adminUser.email,
      password: generatedPassword,
      loginUrl,
    });
    await sendMail({ to: result.adminUser.email, ...mail });
  } catch (err) {
    logger.error(`Failed to send welcome email to ${result.adminUser.email}: ${err.message}`);
  }

  return {
    company: toDto(result.company),
    admin: {
      id: result.adminUser.id,
      firstName: result.adminUser.firstName,
      lastName: result.adminUser.lastName,
      email: result.adminUser.email,
      roleId: result.adminRole.id,
      mustChangePassword: true,
      generatedPassword,
    },
  };
};

const getById = async ({ id }) => {
  const company = await repo.findById(id);
  if (!company) throw new NotFoundError('Company not found');
  return toDto(company);
};

const list = async ({ query }) => {
  const result = await repo.list({
    skip: query.skip,
    limit: query.limit,
    search: query.search,
    status: query.status,
    sortBy: ['name', 'createdAt', 'status'].includes(query.sortBy) ? query.sortBy : 'createdAt',
    sortOrder: query.sortOrder,
    includeDeleted: query.includeDeleted === 'true',
  });
  return { items: result.items.map(toDto), total: result.total };
};

const update = async ({ id, payload, req }) => {
  const existing = await repo.findById(id);
  if (!existing) throw new NotFoundError('Company not found');
  const data = {};
  ['name', 'shortCode', 'contactEmail', 'contactPhone', 'primaryColor', 'address', 'settings'].forEach((k) => {
    if (payload[k] !== undefined) data[k] = payload[k];
  });
  if (data.shortCode !== undefined) data.shortCode = data.shortCode ? String(data.shortCode).trim().toUpperCase() : null;

  // Each image field follows: new file wins > explicit removal clears it >
  // plain URL string in body sets it > otherwise leave untouched.
  const applyImageField = (fieldName, urlKey, removeKey) => {
    const uploadedFile = req?.files?.[fieldName]?.[0];
    if (uploadedFile) {
      data[urlKey] = `/uploads/companies/${uploadedFile.filename}`;
      return;
    }
    if (payload[removeKey] === 'true' || payload[removeKey] === true) {
      data[urlKey] = null;
      return;
    }
    if (payload[urlKey] !== undefined) {
      data[urlKey] = payload[urlKey];
    }
  };

  applyImageField('logo', 'logoUrl', 'removeLogo');
  applyImageField('signature', 'signatureUrl', 'removeSignature');
  applyImageField('stamp', 'stampUrl', 'removeStamp');

  if (payload.slug && payload.slug !== existing.slug) {
    data.slug = await ensureUniqueSlug(payload.slug);
  }
  const updated = await repo.update(id, data);
  return toDto(updated);
};

const remove = async ({ id }) => {
  const existing = await repo.findById(id);
  if (!existing) throw new NotFoundError('Company not found');
  await repo.softDelete(id);
};

const suspend = async ({ id }) => {
  const existing = await repo.findById(id);
  if (!existing) throw new NotFoundError('Company not found');
  if (existing.status === 'SUSPENDED') throw new BadRequestError('Company is already suspended');
  const updated = await repo.setStatus(id, 'SUSPENDED');
  return toDto(updated);
};

const activate = async ({ id }) => {
  const existing = await repo.findById(id);
  if (!existing) throw new NotFoundError('Company not found');
  if (existing.status === 'ACTIVE') throw new BadRequestError('Company is already active');
  const updated = await repo.setStatus(id, 'ACTIVE');
  return toDto(updated);
};

const getStats = async ({ id }) => {
  const company = await repo.findById(id);
  if (!company) throw new NotFoundError('Company not found');

  const [users, clients, candidates, bgvCases, pendingCases, inProgressCases, completedCases, reports] = await Promise.all([
    prisma.user.count({ where: { companyId: id, isDeleted: false } }),
    prisma.client.count({ where: { companyId: id, isDeleted: false } }),
    prisma.candidate.count({ where: { companyId: id, isDeleted: false } }),
    prisma.bGVCase.count({ where: { companyId: id } }),
    prisma.bGVCase.count({ where: { companyId: id, status: { in: ['DRAFT', 'INITIATED', 'CONSENT_PENDING'] } } }),
    prisma.bGVCase.count({ where: { companyId: id, status: { in: ['IN_PROGRESS', 'UNDER_REVIEW', 'ON_HOLD'] } } }),
    prisma.bGVCase.count({ where: { companyId: id, status: 'COMPLETED' } }),
    prisma.bGVReport.count({ where: { companyId: id } }),
  ]);

  return {
    users,
    clients,
    candidates,
    bgvCases,
    pendingCases,
    inProgressCases,
    completedCases,
    reports,
  };
};

const getAnalytics = async ({ id, period = 'monthly', year }) => {
  const company = await repo.findById(id);
  if (!company) throw new NotFoundError('Company not found');

  const yearly = period === 'yearly';
  const bucketCount = yearly ? 5 : 12;
  const now = new Date();
  const selectedYear = Number.isInteger(Number(year)) ? Math.min(Number(year), now.getUTCFullYear()) : now.getUTCFullYear();
  const start = yearly
    ? new Date(Date.UTC(now.getUTCFullYear() - bucketCount + 1, 0, 1))
    : new Date(Date.UTC(selectedYear, 0, 1));
  const buckets = Array.from({ length: bucketCount }, (_, index) => {
    const date = new Date(start);
    if (yearly) date.setUTCFullYear(start.getUTCFullYear() + index);
    else date.setUTCMonth(start.getUTCMonth() + index);
    return { key: yearly ? String(date.getUTCFullYear()) : `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`, label: yearly ? String(date.getUTCFullYear()) : date.toLocaleString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' }) };
  }).filter((bucket) => yearly || Number(bucket.key.slice(0, 4)) < now.getUTCFullYear() || (Number(bucket.key.slice(0, 4)) === now.getUTCFullYear() && Number(bucket.key.slice(5)) <= now.getUTCMonth() + 1));
  const bucketKey = (date) => {
    const value = new Date(date);
    return yearly ? String(value.getUTCFullYear()) : `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}`;
  };
  const trend = () => buckets.map((bucket) => ({ ...bucket, cases: 0, clients: 0, candidates: 0, checks: 0, completed: 0, reports: 0, auditEvents: 0 }));
  const [cases, candidates, checks, reports, auditEvents, clients, users] = await Promise.all([
    prisma.bGVCase.findMany({ where: { companyId: id }, select: { id: true, status: true, overallResult: true, createdAt: true, completedAt: true, initiatedAt: true, clientId: true, candidateId: true, client: { select: { name: true } } } }),
    prisma.candidate.findMany({ where: { companyId: id, isDeleted: false }, select: { id: true, createdAt: true } }),
    prisma.verificationCheck.findMany({ where: { case: { companyId: id } }, select: { type: true, status: true, result: true, createdAt: true, completedAt: true } }),
    prisma.bGVReport.findMany({ where: { companyId: id }, select: { createdAt: true, generatedAt: true, status: true } }),
    prisma.auditLog.findMany({ where: { companyId: id, createdAt: { gte: start } }, select: { createdAt: true } }),
    prisma.client.findMany({ where: { companyId: id, isDeleted: false }, select: { id: true, name: true, createdAt: true } }),
    prisma.user.findMany({ where: { companyId: id, isDeleted: false }, select: { id: true, createdAt: true } }),
  ]);
  const caseTrend = trend(); const clientTrend = trend(); const candidateTrend = trend(); const checkTrend = trend(); const reportTrend = trend(); const auditTrend = trend();
  const increment = (rows, date, key) => { const row = rows.find((item) => item.key === bucketKey(date)); if (row) row[key] += 1; };
  cases.forEach((item) => { increment(caseTrend, item.createdAt, 'cases'); if (item.completedAt) increment(caseTrend, item.completedAt, 'completed'); });
  clients.forEach((item) => increment(clientTrend, item.createdAt, 'clients'));
  candidates.forEach((item) => increment(candidateTrend, item.createdAt, 'candidates'));
  checks.forEach((item) => { increment(checkTrend, item.createdAt, 'checks'); if (item.completedAt) increment(checkTrend, item.completedAt, 'completed'); });
  reports.forEach((item) => increment(reportTrend, item.generatedAt || item.createdAt, 'reports'));
  auditEvents.forEach((item) => increment(auditTrend, item.createdAt, 'auditEvents'));
  const statusMix = cases.reduce((result, item) => { result[item.status] = (result[item.status] || 0) + 1; return result; }, {});
  const checkTypes = checks.reduce((result, item) => { const current = result[item.type] || { type: item.type, total: 0, completed: 0, failed: 0 }; current.total += 1; if (item.status === 'COMPLETED') current.completed += 1; if (item.status === 'FAILED') current.failed += 1; result[item.type] = current; return result; }, {});
  const clientMix = cases.reduce((result, item) => { const key = item.clientId; const current = result[key] || { name: item.client?.name || 'Unknown client', cases: 0, completed: 0 }; current.cases += 1; if (item.status === 'COMPLETED') current.completed += 1; result[key] = current; return result; }, {});
  const completedCases = cases.filter((item) => item.status === 'COMPLETED');
  const turnaround = completedCases.map((item) => item.initiatedAt && item.completedAt ? (new Date(item.completedAt).getTime() - new Date(item.initiatedAt).getTime()) / 86400000 : null).filter((value) => value !== null);
  const totalChecks = checks.length;
  const completedChecks = checks.filter((item) => item.completedAt || item.status === 'COMPLETED').length;
  const failedChecks = checks.filter((item) => item.status === 'FAILED').length;
  return { period: yearly ? 'yearly' : 'monthly', year: yearly ? null : selectedYear, generatedAt: new Date().toISOString(), summary: { users: users.length, clients: clients.length, candidates: candidates.length, cases: cases.length, checks: totalChecks, completedChecks, failedChecks, pendingChecks: Math.max(totalChecks - completedChecks - failedChecks, 0), completedCases: completedCases.length, reports: reports.length, auditEvents: auditEvents.length, completionRate: cases.length ? Math.round((completedCases.length / cases.length) * 100) : 0, averageTurnaroundDays: turnaround.length ? Math.round((turnaround.reduce((sum, value) => sum + value, 0) / turnaround.length) * 10) / 10 : 0 }, trends: { cases: caseTrend, clients: clientTrend, candidates: candidateTrend, checks: checkTrend, reports: reportTrend, auditEvents: auditTrend }, statusMix: Object.entries(statusMix).map(([status, value]) => ({ status, value })), checkTypes: Object.values(checkTypes).sort((a, b) => b.total - a.total), clients: Object.values(clientMix).sort((a, b) => b.cases - a.cases).slice(0, 10), growth: { clients: clients.filter((item) => item.createdAt >= start).length, users: users.filter((item) => item.createdAt >= start).length, candidates: candidates.filter((item) => item.createdAt >= start).length } };
};

const getDetails = async ({ id }) => {
  const company = await repo.findById(id);
  if (!company) throw new NotFoundError('Company not found');

  const [admin, stats, auditLogs] = await Promise.all([
    prisma.user.findFirst({
      where: { companyId: id, isDeleted: false, role: { isCompanyAdmin: true } },
      include: { role: true },
    }),
    getStats({ id }),
    prisma.auditLog.findMany({
      where: { companyId: id },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    }),
  ]);

  return {
    company: toDto(company),
    admin: admin
      ? {
          id: admin.id,
          firstName: admin.firstName,
          lastName: admin.lastName,
          email: admin.email,
          status: admin.status,
          roleName: admin.role?.name || null,
        }
      : null,
    stats,
    auditLogs: auditLogs.map((log) => ({
      id: log.id,
      action: log.action,
      entity: log.entity,
      entityId: log.entityId,
      metadata: log.metadata,
      createdAt: log.createdAt,
      user: log.user
        ? {
            id: log.user.id,
            firstName: log.user.firstName,
            lastName: log.user.lastName,
            email: log.user.email,
          }
        : null,
    })),
  };
};

module.exports = { create, getById, list, update, remove, suspend, activate, getStats, getAnalytics, getDetails };