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
        },
      });
      if (!user || user.isDeleted) throw new UnauthorizedError('User not found');
      if (user.status !== 'ACTIVE') throw new ForbiddenError('User account is not active');
      if (user.company && (user.company.isDeleted || user.company.status !== 'ACTIVE') && !user.role.isSuperAdmin) {
        throw new ForbiddenError('Company is not active');
      }

      userAuth = {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        companyId: user.companyId,
        mustChangePassword: user.mustChangePassword,
        role: {
          id: user.role.id,
          name: user.role.name,
          isSuperAdmin: user.role.isSuperAdmin,
          isCompanyAdmin: user.role.isCompanyAdmin,
        },
        permissions: user.role.rolePermissions.map((rp) => rp.permission.key),
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