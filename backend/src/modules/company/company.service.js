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

module.exports = { create, getById, list, update, remove, suspend, activate, getStats, getDetails };