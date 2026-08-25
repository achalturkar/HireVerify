'use strict';

/* eslint-disable no-console */
require('tsx/cjs');
const { PrismaClient } = require('../src/generated/prisma');
const bcrypt = require('bcrypt');
require('dotenv').config({ override: true });

const { PERMISSIONS, SYSTEM_ROLES } = require('../src/common/constants/permissions');

const prisma = new PrismaClient();

const seed = async () => {
  console.log('Seed: starting...');

  // 1) Seed permissions (idempotent upsert on unique `key`)
  console.log(`Seed: upserting ${PERMISSIONS.length} permissions...`);
  for (const p of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: p.key },
      update: { module: p.module, action: p.action, description: p.description },
      create: { key: p.key, module: p.module, action: p.action, description: p.description },
    });
  }

  const allPermissions = await prisma.permission.findMany();
  console.log(`Seed: total permissions in DB = ${allPermissions.length}`);

 // ==========================================================
// 2. Seed System Roles
// ==========================================================

// --------------------
// Super Admin
// --------------------
let superAdminRole = await prisma.role.findFirst({
  where: {
    companyId: null,
    isSuperAdmin: true,
  },
});

if (!superAdminRole) {
  superAdminRole = await prisma.role.create({
    data: {
      companyId: null,
      name: SYSTEM_ROLES.SUPER_ADMIN,
      description: "Platform Super Administrator",
      isSystem: true,
      isSuperAdmin: true,
      isCompanyAdmin: false,
    },
  });

  console.log("✓ Super Admin role created");
}

// --------------------
// Company Admin
// --------------------
let companyAdminRole = await prisma.role.findFirst({
  where: {
    companyId: null,
    isCompanyAdmin: true,
  },
});

if (!companyAdminRole) {
  companyAdminRole = await prisma.role.create({
    data: {
      companyId: null,
      name: SYSTEM_ROLES.COMPANY_ADMIN,
      description: "Company Administrator",
      isSystem: true,
      isCompanyAdmin: true,
      isSuperAdmin: false,
    },
  });

  console.log("✓ Company Admin role created");
}

  // Attach all permissions to Super Admin role (idempotent)
 // ==========================================================
// Super Admin gets EVERYTHING
// ==========================================================

await prisma.rolePermission.createMany({
  data: allPermissions.map((permission) => ({
    roleId: superAdminRole.id,
    permissionId: permission.id,
  })),
  skipDuplicates: true,
});

// ==========================================================
// Company Admin Permissions
// ==========================================================

const COMPANY_ADMIN_MODULES = [
  "company",
  "client",
  "candidate",
  "bgv.case",
  "bgv.verification",
  "bgv.document",
  "bgv.consent",
  "bgv.report",
  "users",
  "roles",
  "permissions",
  "audit",
];

const COMPANY_ADMIN_REQUIRED_PERMISSIONS = [
  'company.view',
  'company.update',
];

const COMPANY_ADMIN_EXCLUDED_PERMISSIONS = [
  'company.create',
];

const companyPermissions = allPermissions.filter(
  (permission) =>
    (COMPANY_ADMIN_MODULES.includes(permission.module) || COMPANY_ADMIN_REQUIRED_PERMISSIONS.includes(permission.key)) &&
    !COMPANY_ADMIN_EXCLUDED_PERMISSIONS.includes(permission.key)
);

await prisma.rolePermission.createMany({
  data: companyPermissions.map((permission) => ({
    roleId: companyAdminRole.id,
    permissionId: permission.id,
  })),
  skipDuplicates: true,
});

console.log(
  `✓ Assigned ${companyPermissions.length} permissions to Company Admin`
);

// ==========================================================
// Sync permissions to ALL existing Company Admin roles
// ==========================================================

const globalCompanyAdminRole = await prisma.role.findFirst({
  where: {
    companyId: null,
    isCompanyAdmin: true,
  },
  include: {
    rolePermissions: true,
  },
});

const companyRoles = await prisma.role.findMany({
  where: {
    isCompanyAdmin: true,
    NOT: {
      companyId: null,
    },
  },
});

for (const role of companyRoles) {
  await prisma.rolePermission.createMany({
    data: globalCompanyAdminRole.rolePermissions.map((rp) => ({
      roleId: role.id,
      permissionId: rp.permissionId,
    })),
    skipDuplicates: true,
  });
}

console.log(`✓ Synced Company Admin permissions to ${companyRoles.length} companies`);

  // 3) Seed Super Admin user
  const superAdminEmail = (process.env.SUPER_ADMIN_EMAIL || 'superadmin@portal.com').toLowerCase();
  const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD || 'Admin@123';
  const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '10', 10);

  const existing = await prisma.user.findUnique({ where: { email: superAdminEmail } });
  if (!existing) {
    const passwordHash = await bcrypt.hash(superAdminPassword, saltRounds);
    await prisma.user.create({
      data: {
        companyId: null,
        roleId: superAdminRole.id,
        firstName: 'Super',
        lastName: 'Admin',
        email: superAdminEmail,
        passwordHash,
        status: 'ACTIVE',
        mustChangePassword: false,
      },
    });
    console.log(`Seed: Super Admin user created (${superAdminEmail})`);
  } else {
    // Ensure it's linked to Super Admin role & active
    await prisma.user.update({
      where: { id: existing.id },
      data: { roleId: superAdminRole.id, status: 'ACTIVE', isDeleted: false },
    });
    console.log(`Seed: Super Admin user already exists (${superAdminEmail})`);
  }

  console.log('Seed: done.');
};

seed()
  .catch(async (err) => {
    console.error('Seed failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
