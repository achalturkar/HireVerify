'use strict';

const config = require('../../config');
const { prisma } = require('../../common/prisma');
const { redis } = require('../../common/redis');
const {
  signAccessToken,
  signRefreshToken,
  signResetToken,
  verifyRefreshToken,
  verifyResetToken,
  hashToken,
  generateJti,
  parseDurationToMs,
} = require('../../utils/jwt');
const { hashPassword, comparePassword } = require('../../utils/password');
const {
  UnauthorizedError,
  BadRequestError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
} = require('../../utils/errors');
const authRepo = require('./auth.repository');
const { invalidateUserAuthCache } = require('../../middleware/auth.middleware');
const { sendMail, buildPasswordResetEmail } = require('../../utils/mailer');

const buildUserPayload = (user) => ({
  sub: user.id,
  email: user.email,
  companyId: user.companyId,
  roleId: user.roleId,
});

const toUserDto = (user) => ({
  id: user.id,
  email: user.email,
  firstName: user.firstName,
  lastName: user.lastName,
  phone: user.phone,
  companyId: user.companyId,
  company: user.company
    ? { id: user.company.id, name: user.company.name, slug: user.company.slug, status: user.company.status, primaryColor: user.company.primaryColor, logoUrl: user.company.logoUrl }
    : null,
  clientId: user.clientId || null,
  client: user.client ? {
    id: user.client.id,
    name: user.client.name,
    logoUrl: user.client.logoUrl,
    parentClientId: user.client.parentClientId || null,
    clientCode: user.client.clientCode,
    website: user.client.website,
    industry: user.client.industry,
    contactName: user.client.contactName,
    contactEmail: user.client.contactEmail,
    contactPhone: user.client.contactPhone,
    supportEmail: user.client.supportEmail,
    supportPhone: user.client.supportPhone,
    addressLine1: user.client.addressLine1,
    addressLine2: user.client.addressLine2,
    city: user.client.city,
    state: user.client.state,
    country: user.client.country,
    postalCode: user.client.postalCode,
  } : null,
  role: {
    id: user.role.id,
    name: user.role.name,
    isSuperAdmin: user.role.isSuperAdmin,
    isCompanyAdmin: user.role.isCompanyAdmin,
    isClientUser: user.role.isClientUser,
  },
  permissions: user.role.isClientUser
    ? (user.clientPermissions || [])
    : user.role.rolePermissions.map((rp) => rp.permission.key),
  status: user.status,
  mustChangePassword: user.mustChangePassword,
  lastLoginAt: user.lastLoginAt,
});

/**
 * Issue an access + refresh token pair for a user.
 * Stores refresh token hash in DB and Redis (for fast revocation lookup).
 */
const issueTokenPair = async ({ user, req }) => {
  const jti = generateJti();
  const accessToken = signAccessToken({ ...buildUserPayload(user), jti: generateJti() });
  const refreshToken = signRefreshToken(buildUserPayload(user), jti);
  const tokenHash = hashToken(refreshToken);
  const expiresAt = new Date(Date.now() + parseDurationToMs(config.jwt.refreshExpiresIn));

  const stored = await authRepo.createRefreshToken({
    userId: user.id,
    tokenHash,
    jti,
    userAgent: (req?.headers?.['user-agent'] || '').toString().slice(0, 500),
    ipAddress: (req?.headers?.['x-forwarded-for'] || req?.socket?.remoteAddress || '').toString().slice(0, 50),
    expiresAt,
  });

  // mirror in Redis with TTL for fast validation
  const ttlSec = Math.floor((expiresAt.getTime() - Date.now()) / 1000);
  await redis.set(`rt:${jti}`, stored.id, 'EX', ttlSec);

  return { accessToken, refreshToken, refreshExpiresAt: expiresAt };
};

const login = async ({ email, password, req }) => {
  const user = await authRepo.findUserByEmail(email);
  if (!user || user.isDeleted) throw new UnauthorizedError('Invalid email or password');
  if (user.status !== 'ACTIVE') throw new ForbiddenError('Account is not active');
  if (user.company && !user.role.isSuperAdmin) {
    if (user.company.isDeleted || user.company.status !== 'ACTIVE') {
      throw new ForbiddenError('Company is not active');
    }
    if (user.role.isClientUser && (!user.client || user.client.isDeleted || user.client.status !== 'ACTIVE' || user.client.companyId !== user.companyId)) {
      throw new ForbiddenError('Client account is not active');
    }
    if (user.role.isClientUser && user.client.parentClientId) {
      const parent = await prisma.client.findFirst({
        where: { id: user.client.parentClientId, companyId: user.companyId, parentClientId: null, isDeleted: false, status: 'ACTIVE' },
        select: { id: true },
      });
      if (!parent) throw new ForbiddenError('Parent client account is not active');
    }
  }

  const ok = await comparePassword(password, user.passwordHash);
  if (!ok) throw new UnauthorizedError('Invalid email or password');

  await authRepo.updateLastLogin(user.id);
  const tokens = await issueTokenPair({ user, req });

  return { user: toUserDto(user), ...tokens };
};

const forgotPassword = async ({ email, req }) => {
  const user = await authRepo.findUserByEmail(email);
  if (!user || user.isDeleted || user.status !== 'ACTIVE') {
    return;
  }

  const token = signResetToken({ sub: user.id, email: user.email });
  const resetUrl = `${config.frontendUrl.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(token)}`;
  const emailData = buildPasswordResetEmail({
    name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
    resetUrl,
    expiresIn: config.jwt.resetExpiresIn,
  });

  await sendMail({
    to: user.email,
    subject: emailData.subject,
    html: emailData.html,
    text: emailData.text,
  });
};

const resetPassword = async ({ token, newPassword }) => {
  let decoded;
  try {
    decoded = verifyResetToken(token);
  } catch (err) {
    throw new UnauthorizedError('Invalid or expired reset token');
  }

  const userId = decoded.sub;
  const user = await authRepo.findUserById(userId);
  if (!user || user.isDeleted) {
    throw new NotFoundError('User not found');
  }
  if (user.status !== 'ACTIVE') {
    throw new ForbiddenError('Account is not active');
  }

  const passwordHash = await hashPassword(newPassword);
  await authRepo.updateUserPassword(user.id, passwordHash);
  await authRepo.revokeAllUserRefreshTokens(user.id);
  await invalidateUserAuthCache(user.id);
};

/**
 * Refresh with rotation:
 *  - Verify current refresh token
 *  - Ensure it exists, not revoked, not expired
 *  - Revoke current, issue new pair, link replacedById
 */
const refresh = async ({ refreshToken, req }) => {
  if (!refreshToken) throw new BadRequestError('Refresh token is required');
  let decoded;
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch (err) {
    if (err.name === 'TokenExpiredError') throw new UnauthorizedError('Refresh token expired');
    throw new UnauthorizedError('Invalid refresh token');
  }

  const { jti, sub } = decoded;
  const stored = await authRepo.findRefreshTokenByJti(jti);
  if (!stored) throw new UnauthorizedError('Refresh token not recognized');
  if (stored.userId !== sub) throw new UnauthorizedError('Refresh token user mismatch');

  if (stored.isRevoked) {
    // Reuse detected — revoke all user tokens as security measure
    await authRepo.revokeAllUserRefreshTokens(stored.userId);
    throw new UnauthorizedError('Refresh token reuse detected. All sessions revoked.');
  }
  if (stored.expiresAt.getTime() < Date.now()) throw new UnauthorizedError('Refresh token expired');
  if (hashToken(refreshToken) !== stored.tokenHash) throw new UnauthorizedError('Refresh token mismatch');

  const user = await authRepo.findUserById(sub);
  if (!user || user.isDeleted) throw new UnauthorizedError('User not found');
  if (user.status !== 'ACTIVE') throw new ForbiddenError('Account is not active');

  const newPair = await issueTokenPair({ user, req });
  // Revoke old and link replacedById; also remove from redis
  const newStored = await authRepo.findRefreshTokenByJti(
    // Retrieve the newly created stored token by finding it via known unique jti
    // We can inspect the newly issued refresh token
    require('jsonwebtoken').decode(newPair.refreshToken).jti
  );
  await authRepo.revokeRefreshToken(stored.id, newStored?.id || null);
  await redis.del(`rt:${jti}`);

  return { user: toUserDto(user), ...newPair };
};

const logout = async ({ refreshToken, userId }) => {
  if (refreshToken) {
    try {
      const decoded = verifyRefreshToken(refreshToken);
      const stored = await authRepo.findRefreshTokenByJti(decoded.jti);
      if (stored && !stored.isRevoked) {
        await authRepo.revokeRefreshToken(stored.id);
        await redis.del(`rt:${decoded.jti}`);
      }
    } catch (_e) {
      // ignore invalid refresh on logout — best-effort
    }
  } else if (userId) {
    await authRepo.revokeAllUserRefreshTokens(userId);
  }
};

const me = async (userId) => {
  const user = await authRepo.findUserById(userId);
  if (!user) throw new NotFoundError('User not found');
  return toUserDto(user);
};

const changePassword = async ({ userId, currentPassword, newPassword }) => {
  if (currentPassword === newPassword) {
    throw new BadRequestError('New password must be different from current password');
  }
  const user = await authRepo.findUserById(userId);
  if (!user) throw new NotFoundError('User not found');
  const ok = await comparePassword(currentPassword, user.passwordHash);
  if (!ok) throw new UnauthorizedError('Current password is incorrect');

  const passwordHash = await hashPassword(newPassword);
  await authRepo.updateUserPassword(userId, passwordHash);
  // revoke all sessions for safety
  await authRepo.revokeAllUserRefreshTokens(userId);
  await invalidateUserAuthCache(userId);
};

const IMPERSONATION_TTL_SECONDS = 15 * 60;

const auditRequestData = (req) => ({
  ipAddress: (req?.headers?.['x-forwarded-for'] || req?.socket?.remoteAddress || '').toString().slice(0, 50),
  userAgent: (req?.headers?.['user-agent'] || '').toString().slice(0, 500),
});

const startImpersonation = async ({ actorId, companyId, targetUserId, reason, req }) => {
  const actor = await prisma.user.findUnique({
    where: { id: actorId },
    include: { role: true },
  });
  if (!actor || actor.isDeleted || actor.status !== 'ACTIVE' || !actor.role.isSuperAdmin) {
    throw new ForbiddenError('An active superadmin account is required');
  }

  const target = await prisma.user.findFirst({
    where: {
      id: targetUserId,
      companyId,
      clientId: null,
      isDeleted: false,
      status: 'ACTIVE',
      role: { isCompanyAdmin: true, isSuperAdmin: false, isClientUser: false },
      company: { isDeleted: false, status: 'ACTIVE' },
    },
    include: {
      role: { include: { rolePermissions: { include: { permission: true } } } },
      company: true,
      client: true,
    },
  });
  if (!target) {
    throw new NotFoundError('Active company admin or company not found');
  }

  const now = new Date();
  const activeSession = await prisma.impersonationSession.findFirst({
    where: { actorUserId: actorId, endedAt: null, expiresAt: { gt: now } },
    select: { id: true },
  });
  if (activeSession) {
    throw new ConflictError('End your current company access session before starting another');
  }

  const expiresAt = new Date(now.getTime() + IMPERSONATION_TTL_SECONDS * 1000);
  const session = await prisma.$transaction(async (tx) => {
    const createdSession = await tx.impersonationSession.create({
      data: {
        actorUserId: actor.id,
        targetUserId: target.id,
        companyId: target.companyId,
        reason: reason.trim(),
        expiresAt,
      },
    });

    await tx.auditLog.create({
      data: {
        companyId: target.companyId,
        userId: actor.id,
        action: 'auth.impersonation.start',
        entity: 'Company',
        entityId: target.companyId,
        metadata: {
          sessionId: createdSession.id,
          actor: { id: actor.id, email: actor.email },
          target: { id: target.id, email: target.email },
          reason: reason.trim(),
          expiresAt: expiresAt.toISOString(),
        },
        ...auditRequestData(req),
      },
    });
    return createdSession;
  });

  const accessToken = signAccessToken({
    ...buildUserPayload(target),
    jti: generateJti(),
    impersonation: {
      sessionId: session.id,
      actorUserId: actor.id,
      companyId: target.companyId,
    },
  }, '15m');

  return {
    accessToken,
    expiresAt: session.expiresAt,
    sessionId: session.id,
    user: toUserDto(target),
  };
};

const stopImpersonation = async ({ impersonation, req }) => {
  if (!impersonation?.sessionId || !impersonation.actorUserId) {
    throw new ForbiddenError('This request is not an impersonation session');
  }

  await prisma.$transaction(async (tx) => {
    const ended = await tx.impersonationSession.updateMany({
      where: {
        id: impersonation.sessionId,
        actorUserId: impersonation.actorUserId,
        targetUserId: impersonation.targetUserId,
        companyId: impersonation.companyId,
        endedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { endedAt: new Date() },
    });
    if (ended.count !== 1) {
      throw new ForbiddenError('This impersonation session is no longer active');
    }

    await tx.auditLog.create({
      data: {
        companyId: impersonation.companyId,
        userId: impersonation.actorUserId,
        action: 'auth.impersonation.stop',
        entity: 'Company',
        entityId: impersonation.companyId,
        metadata: {
          sessionId: impersonation.sessionId,
          actorUserId: impersonation.actorUserId,
          targetUserId: impersonation.targetUserId,
          reason: impersonation.reason,
          startedAt: impersonation.startedAt,
          expiresAt: impersonation.expiresAt,
        },
        ...auditRequestData(req),
      },
    });
  });
};

module.exports = {
  login,
  forgotPassword,
  resetPassword,
  refresh,
  logout,
  me,
  changePassword,
  startImpersonation,
  stopImpersonation,
};
