// const express = require("express");

// const app = express();

// app.use(express.json());

// app.get("/", (req, res) => {
//     res.send("API Running");
// });

// app.listen(5000, () => {
//     console.log("Server Started");
// });

'use strict';

const path = require('path');
const app = require('./app');
const config = require('./config');
const logger = require('./common/logger');
const { connectPrisma, disconnectPrisma, prisma } = require('./common/prisma');

const ensureDefaultSuperAdmin = async () => {
  try {
    const { PERMISSIONS, SYSTEM_ROLES } = require('./common/constants/permissions');
    const bcrypt = require('bcrypt');

    for (const permission of PERMISSIONS) {
      await prisma.permission.upsert({
        where: { key: permission.key },
        update: { module: permission.module, action: permission.action, description: permission.description },
        create: { key: permission.key, module: permission.module, action: permission.action, description: permission.description },
      });
    }

    let superAdminRole = await prisma.role.findFirst({ where: { companyId: null, isSuperAdmin: true } });
    if (!superAdminRole) {
      superAdminRole = await prisma.role.create({
        data: {
          companyId: null,
          name: SYSTEM_ROLES.SUPER_ADMIN,
          description: 'Platform-level Super Administrator with full access',
          isSystem: true,
          isSuperAdmin: true,
        },
      });
    }

    const allPermissions = await prisma.permission.findMany();
    await prisma.rolePermission.createMany({
      data: allPermissions.map((permission) => ({ roleId: superAdminRole.id, permissionId: permission.id })),
      skipDuplicates: true,
    });

    const email = (process.env.SUPER_ADMIN_EMAIL || 'superadmin@portal.com').toLowerCase();
    const password = process.env.SUPER_ADMIN_PASSWORD || 'Admin@123';
    const existing = await prisma.user.findUnique({ where: { email } });

    if (!existing) {
      const passwordHash = await bcrypt.hash(password, 10);
      await prisma.user.create({
        data: {
          companyId: null,
          roleId: superAdminRole.id,
          firstName: 'Super',
          lastName: 'Admin',
          email,
          passwordHash,
          status: 'ACTIVE',
          mustChangePassword: false,
        },
      });
      logger.info(`Seeded default super admin user: ${email}`);
    } else {
      await prisma.user.update({
        where: { id: existing.id },
        data: { roleId: superAdminRole.id, status: 'ACTIVE', isDeleted: false },
      });
    }
  } catch (error) {
    logger.warn(`Failed to ensure default super admin: ${error && error.message ? error.message : error}`);
  }
};

const start = async () => {
  try {
    await connectPrisma();
    await ensureDefaultSuperAdmin();

    const server = app.listen(config.port, '0.0.0.0', () => {
      logger.info(`API listening on http://0.0.0.0:${config.port} (env=${config.env})`);
      logger.info(`Swagger UI:      http://0.0.0.0:${config.port}/api/docs`);
    });

    const shutdown = async (signal) => {
      logger.info(`Received ${signal}. Shutting down gracefully...`);
      server.close(async () => {
        try {
          await disconnectPrisma();
        } finally {
          process.exit(0);
        }
      });
      // Force exit after 10s
      setTimeout(() => process.exit(1), 10000).unref();
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    process.on('unhandledRejection', (err) => {
      logger.error(`Unhandled Rejection: ${err && err.stack ? err.stack : err}`);
    });
    process.on('uncaughtException', (err) => {
      logger.error(`Uncaught Exception: ${err && err.stack ? err.stack : err}`);
      shutdown('uncaughtException');
    });
  } catch (err) {
    logger.error(`Failed to start server: ${err && err.stack ? err.stack : err}`);
    process.exit(1);
  }
};

start();
