'use strict';

const { ForbiddenError, UnauthorizedError } = require('../utils/errors');

/**
 * Permission-based authorization middleware.
 * Usage: authorize('company.create')  OR  authorize(['company.create','company.update'], { any: true })
 * - default: user must have ALL listed permissions
 * - { any: true }: user must have AT LEAST ONE
 * Super Admins bypass all permission checks (they have everything by design).
 */
const authorize = (required, options = {}) => (req, _res, next) => {
  try {
    if (!req.user) throw new UnauthorizedError('Not authenticated');
    if (req.user.role?.isSuperAdmin) return next();

    const requiredArr = Array.isArray(required) ? required : [required];
    const userPerms = req.permissions || new Set();

    const has = options.any
      ? requiredArr.some((p) => userPerms.has(p))
      : requiredArr.every((p) => userPerms.has(p));

    if (!has) throw new ForbiddenError(`Missing required permission: ${requiredArr.join(', ')}`);
    return next();
  } catch (err) {
    return next(err);
  }
};

/**
 * Role-based guard: restricts to specific role flags.
 * Usage: requireRole({ superAdmin: true })  or  requireRole({ companyAdmin: true })
 */
const requireRole = ({ superAdmin = false, companyAdmin = false } = {}) => (req, _res, next) => {
  try {
    if (!req.user) throw new UnauthorizedError('Not authenticated');
    const r = req.user.role || {};
    if (superAdmin && r.isSuperAdmin) return next();
    if (companyAdmin && r.isCompanyAdmin) return next();
    if (!superAdmin && !companyAdmin) return next();
    throw new ForbiddenError('Insufficient role');
  } catch (err) {
    return next(err);
  }
};

module.exports = { authorize, requireRole };
