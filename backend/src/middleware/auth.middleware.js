'use strict';

const { verifyAccessToken } = require('../utils/jwt');
const { redis } = require('../common/redis');
const { prisma } = require('../common/prisma');
const { UnauthorizedError, ForbiddenError } = require('../utils/errors');

/**
 * Authentication middleware: verifies JWT access token, loads user + role + permissions.
 * Populates req.user, req.permissions.
 */
const authenticate = async (req, _res, next) => {
  try {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Missing or malformed Authorization header');
    }
    const token = authHeader.slice(7).trim();
    if (!token) throw new UnauthorizedError('Missing token');

    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch (err) {
      if (err.name === 'TokenExpiredError') throw new UnauthorizedError('Access token expired');
      throw new UnauthorizedError('Invalid access token');
    }

    // Check if user session was invalidated (logout-all etc.)
    const blacklisted = await redis.get(`bl:access:${decoded.jti || ''}`);
    if (blacklisted) throw new UnauthorizedError('Token has been revoked');

    // Load user with role and permissions (with short Redis cache)
    const cacheKey = `user:auth:${decoded.sub}`;
    let userAuth = await redis.get(cacheKey);
    if (userAuth) {
      userAuth = JSON.parse(userAuth);
    } else {
      const user = await prisma.user.findUnique({
        where: { id: decoded.sub },
        include: {
          role: {
            include: {
              rolePermissions: { include: { permission: true } },
            },
          },
          company: true,
          client: true,
        },
      });
      if (!user || user.isDeleted) throw new UnauthorizedError('User not found');
      if (user.status !== 'ACTIVE') throw new ForbiddenError('User account is not active');
      if (user.company && (user.company.isDeleted || user.company.status !== 'ACTIVE') && !user.role.isSuperAdmin) {
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

      userAuth = {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        companyId: user.companyId,
        clientId: user.clientId,
        client: user.client ? { id: user.client.id, name: user.client.name, logoUrl: user.client.logoUrl, parentClientId: user.client.parentClientId || null } : null,
        clientPermissions: user.clientPermissions || [],
        mustChangePassword: user.mustChangePassword,
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
      };
      // cache for 60s to keep permissions fresh but reduce DB hits
      await redis.set(cacheKey, JSON.stringify(userAuth), 'EX', 60);
    }
console.log("=================================");
console.log("User:", userAuth.email);
console.log("Role:", userAuth.role.name);
console.log("Permissions Count:", userAuth.permissions.length);
console.log(userAuth.permissions);
console.log("=================================");
    req.user = userAuth;
    req.permissions = new Set(userAuth.permissions);
    req.authTokenJti = decoded.jti || null;

    if (decoded.impersonation) {
      const claim = decoded.impersonation;
      const session = await prisma.impersonationSession.findUnique({
        where: { id: claim.sessionId },
        include: {
          actor: { include: { role: true } },
          target: { include: { role: true, company: true } },
        },
      });
      const now = new Date();
      if (
        !session ||
        session.endedAt ||
        session.expiresAt <= now ||
        session.actorUserId !== claim.actorUserId ||
        session.companyId !== claim.companyId ||
        session.targetUserId !== decoded.sub
      ) {
        throw new UnauthorizedError('Impersonation session has expired or been revoked');
      }

      const actor = session.actor;
      const target = session.target;
      if (
        !actor ||
        actor.isDeleted ||
        actor.status !== 'ACTIVE' ||
        !actor.role.isSuperAdmin ||
        !target ||
        target.isDeleted ||
        target.status !== 'ACTIVE' ||
        !target.role.isCompanyAdmin ||
        target.role.isSuperAdmin ||
        target.role.isClientUser ||
        target.companyId !== session.companyId ||
        !target.company ||
        target.company.isDeleted ||
        target.company.status !== 'ACTIVE' ||
        userAuth.companyId !== session.companyId
      ) {
        throw new UnauthorizedError('Impersonation access is no longer authorized');
      }

      req.impersonation = {
        sessionId: session.id,
        actorUserId: session.actorUserId,
        targetUserId: session.targetUserId,
        companyId: session.companyId,
        reason: session.reason,
        startedAt: session.startedAt.toISOString(),
        expiresAt: session.expiresAt.toISOString(),
      };
    }
    return next();
  } catch (err) {
    return next(err);
  }
};

/**
 * Invalidate the cached user auth (call after role/permission changes).
 */
const invalidateUserAuthCache = async (userId) => {
  await redis.del(`user:auth:${userId}`);
};

const invalidateRoleAuthCache = async (roleId) => {
  const users = await prisma.user.findMany({ where: { roleId }, select: { id: true } });
  await Promise.all(users.map((user) => invalidateUserAuthCache(user.id)));
};

module.exports = { authenticate, invalidateUserAuthCache, invalidateRoleAuthCache };