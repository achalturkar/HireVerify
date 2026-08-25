'use strict';

const config = require('../../config');
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
  role: {
    id: user.role.id,
    name: user.role.name,
    isSuperAdmin: user.role.isSuperAdmin,
    isCompanyAdmin: user.role.isCompanyAdmin,
  },
  permissions: user.role.rolePermissions.map((rp) => rp.permission.key),
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

module.exports = { login, forgotPassword, resetPassword, refresh, logout, me, changePassword };
