'use strict';

const { prisma } = require('../../common/prisma');

const findUserByEmail = (email) =>
  prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    include: {
      role: { include: { rolePermissions: { include: { permission: true } } } },
      company: true,
      client: true,
    },
  });

const findUserById = (id) =>
  prisma.user.findUnique({
    where: { id },
    include: {
      role: { include: { rolePermissions: { include: { permission: true } } } },
      company: true,
      client: true,
    },
  });

const updateUserPassword = (id, passwordHash) =>
  prisma.user.update({
    where: { id },
    data: { passwordHash, mustChangePassword: false, updatedAt: new Date() },
  });

const updateLastLogin = (id) =>
  prisma.user.update({ where: { id }, data: { lastLoginAt: new Date() } });

const createRefreshToken = (data) => prisma.refreshToken.create({ data });

const findRefreshTokenByJti = (jti) => prisma.refreshToken.findUnique({ where: { jti } });

const revokeRefreshToken = (id, replacedById = null) =>
  prisma.refreshToken.update({
    where: { id },
    data: { isRevoked: true, revokedAt: new Date(), replacedById },
  });

const revokeAllUserRefreshTokens = (userId) =>
  prisma.refreshToken.updateMany({
    where: { userId, isRevoked: false },
    data: { isRevoked: true, revokedAt: new Date() },
  });

module.exports = {
  findUserByEmail,
  findUserById,
  updateUserPassword,
  updateLastLogin,
  createRefreshToken,
  findRefreshTokenByJti,
  revokeRefreshToken,
  revokeAllUserRefreshTokens,
};