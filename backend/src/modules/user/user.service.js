'use strict';

const { hashPassword, generateRandomPassword, comparePassword } = require('../../utils/password');
const { sendMail, buildCompanyAdminWelcomeEmail } = require('../../utils/mailer');
const config = require('../../config');
const logger = require('../../common/logger');
const {
  NotFoundError,
  BadRequestError,
  ConflictError,
  ForbiddenError,
} = require('../../utils/errors');
const { invalidateUserAuthCache } = require('../../middleware/auth.middleware');
const repo = require('./user.repository');
const roleRepo = require('../role/role.repository');
const companyRepo = require('../company/company.repository');

const toDto = (u) => ({
  id: u.id,
  firstName: u.firstName,
  lastName: u.lastName,
  email: u.email,
  phone: u.phone,
  status: u.status,
  isDeleted: u.isDeleted,
  deletedAt: u.deletedAt,
  companyId: u.companyId,
  company: u.company ? { id: u.company.id, name: u.company.name } : null,
  clientId: u.clientId,
  client: u.client ? { id: u.client.id, name: u.client.name } : null,
  role: u.role ? { id: u.role.id, name: u.role.name, isCompanyAdmin: u.role.isCompanyAdmin, isSuperAdmin: u.role.isSuperAdmin } : null,
  mustChangePassword: u.mustChangePassword,
  lastLoginAt: u.lastLoginAt,
  createdAt: u.createdAt,
  updatedAt: u.updatedAt,
});

const resolveScopeCompanyId = (currentUser, requested) => {
  if (currentUser.role.isSuperAdmin) return requested !== undefined ? requested : undefined;
  return currentUser.companyId;
};

const create = async ({ currentUser, payload }) => {
  const { firstName, lastName, email, phone, roleId, password } = payload;
  const companyId = resolveScopeCompanyId(currentUser, payload.companyId);
  if (!companyId) throw new BadRequestError('companyId is required');

  const company = await companyRepo.findById(companyId);
  if (!company) throw new NotFoundError('Company not found');

  const role = await roleRepo.findById(roleId);
  if (!role) throw new NotFoundError('Role not found');
  if (role.isSuperAdmin) throw new ForbiddenError('Cannot assign the Super Admin role');
  if (role.companyId && role.companyId !== companyId) {
    throw new BadRequestError('Role does not belong to this company');
  }

  const existing = await repo.findByEmail(email);
  if (existing) throw new ConflictError('User with this email already exists');

  const plainPassword = password || generateRandomPassword(12);
  const passwordHash = await hashPassword(plainPassword);

  const user = await repo.create({
    companyId,
    roleId,
    firstName,
    lastName,
    email: email.toLowerCase(),
    phone: phone || null,
    passwordHash,
    mustChangePassword: !password,
    status: 'ACTIVE',
  });

  // Send welcome email
  try {
    const loginUrl = `${config.frontendUrl}/login`;
    const mail = buildCompanyAdminWelcomeEmail({
      companyName: company.name,
      adminName: `${user.firstName} ${user.lastName}`.trim(),
      email: user.email,
      password: plainPassword,
      loginUrl,
    });
    await sendMail({ to: user.email, ...mail });
  } catch (err) {
    logger.error(`Failed to send user welcome email: ${err.message}`);
  }

  return { ...toDto(user), ...(password ? {} : { generatedPassword: plainPassword }) };
};

const getById = async ({ currentUser, id }) => {
  const user = await repo.findById(id);
  if (!user) throw new NotFoundError('User not found');
  if (!currentUser.role.isSuperAdmin && user.companyId !== currentUser.companyId) {
    throw new ForbiddenError('Access denied to this user');
  }
  return toDto(user);
};

const list = async ({ currentUser, query }) => {
  const companyId = currentUser.role.isSuperAdmin
    ? (query.companyId || undefined)
    : currentUser.companyId;
  const res = await repo.list({
    companyId,
    skip: query.skip,
    limit: query.limit,
    search: query.search,
    status: query.status,
    sortBy: ['firstName', 'lastName', 'email', 'createdAt'].includes(query.sortBy) ? query.sortBy : 'createdAt',
    sortOrder: query.sortOrder,
  });
  return { items: res.items.map(toDto), total: res.total };
};

const listDeleted = async ({ currentUser, query }) => {
  if (!currentUser.role?.isSuperAdmin) {
    throw new ForbiddenError('Only a Super Admin can view deleted users.');
  }
  const res = await repo.listDeleted({
    companyId: query.companyId || undefined,
    skip: query.skip,
    limit: query.limit,
    search: query.search,
    sortBy: ['firstName', 'lastName', 'email', 'createdAt'].includes(query.sortBy) ? query.sortBy : 'createdAt',
    sortOrder: query.sortOrder,
  });
  return { items: res.items.map(toDto), total: res.total };
};

const update = async ({ currentUser, id, payload }) => {
  const user = await repo.findById(id);
  if (!user) throw new NotFoundError('User not found');
  if (!currentUser.role.isSuperAdmin && user.companyId !== currentUser.companyId) {
    throw new ForbiddenError('Access denied to this user');
  }
  const data = {};
  ['firstName', 'lastName', 'phone', 'status'].forEach((k) => {
    if (payload[k] !== undefined) data[k] = payload[k];
  });
  if (payload.roleId && payload.roleId !== user.roleId) {
    const role = await roleRepo.findById(payload.roleId);
    if (!role) throw new NotFoundError('Role not found');
    if (role.isSuperAdmin) throw new ForbiddenError('Cannot assign the Super Admin role');
    if (role.companyId && role.companyId !== user.companyId) {
      throw new BadRequestError('Role does not belong to this user\'s company');
    }
    data.roleId = payload.roleId;
  }
  const updated = await repo.update(id, data);
  await invalidateUserAuthCache(id);
  return toDto(updated);
};

const updateCompanyAdminEmail = async ({ currentUser, id, email }) => {
  if (!currentUser.role?.isSuperAdmin) {
    throw new ForbiddenError('Only a Super Admin can change a Company Admin login email');
  }

  const user = await repo.findById(id);
  if (!user) throw new NotFoundError('User not found');
  if (!user.role?.isCompanyAdmin || user.role?.isSuperAdmin || !user.companyId) {
    throw new BadRequestError('Email can only be changed for a Company Admin account');
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (normalizedEmail === user.email.toLowerCase()) {
    throw new BadRequestError('The new email is the same as the current email');
  }

  const existing = await repo.findByEmail(normalizedEmail);
  if (existing && existing.id !== user.id) {
    throw new ConflictError('A user with this email already exists');
  }

  const updated = await repo.update(id, { email: normalizedEmail });
  await invalidateUserAuthCache(id);
  return toDto(updated);
};

const remove = async ({ currentUser, id }) => {
  const user = await repo.findById(id);
  if (!user) throw new NotFoundError('User not found');
  if (!currentUser.role.isSuperAdmin && user.companyId !== currentUser.companyId) {
    throw new ForbiddenError('Access denied to this user');
  }
  if (user.id === currentUser.id) throw new BadRequestError('You cannot delete yourself');
  if (user.role?.isSuperAdmin) throw new ForbiddenError('Cannot delete Super Admin');
  await repo.softDelete(id);
  await invalidateUserAuthCache(id);
};

const permanentlyRemove = async ({ currentUser, id }) => {
  if (!currentUser.role?.isSuperAdmin) {
    throw new ForbiddenError('Only a Super Admin can permanently delete users.');
  }
  const user = await repo.findDeletedById(id);
  if (!user) throw new NotFoundError('Deleted user not found.');
  if (user.id === currentUser.id) throw new BadRequestError('You cannot permanently delete yourself.');
  if (user.role?.isSuperAdmin) throw new ForbiddenError('Cannot permanently delete a Super Admin.');
  await repo.permanentlyDelete(id);
  await invalidateUserAuthCache(id);
};

/* ------------------------------------------------------------------
   Self-service: profile + password.
   Unlike `update`/`remove` above, these are NEVER passed an `id` from
   the request — they always operate on `currentUser.id`. That's what
   makes them safe to expose without the `users.*` admin permissions:
   there is no id param to tamper with, so a user can only ever act on
   themselves.
------------------------------------------------------------------- */

const getMyProfile = async ({ currentUser }) => {
  const user = await repo.findById(currentUser.id);
  if (!user) throw new NotFoundError('User not found');
  return toDto(user);
};

// Deliberately whitelisted to firstName/lastName/phone — same reasoning
// as the comment on `update()`: roleId/status are admin-only fields and
// must never be settable through a self-service endpoint.
const updateProfile = async ({ currentUser, payload }) => {
  const data = {};
  ['firstName', 'lastName', 'phone'].forEach((k) => {
    if (payload[k] !== undefined) data[k] = payload[k];
  });
  if (Object.keys(data).length === 0) {
    throw new BadRequestError('No fields to update');
  }

  const updated = await repo.update(currentUser.id, data);
  await invalidateUserAuthCache(currentUser.id);
  return toDto(updated);
};

const changePassword = async ({ currentUser, payload }) => {
  const { currentPassword, newPassword, confirmPassword } = payload;

  if (newPassword !== confirmPassword) {
    throw new BadRequestError('New password and confirmation do not match');
  }
  if (newPassword === currentPassword) {
    throw new BadRequestError('New password must be different from your current password');
  }

  // repo.findById includes the full row (no `select`), so passwordHash
  // is present here even though toDto() never returns it to clients.
  const user = await repo.findById(currentUser.id);
  if (!user) throw new NotFoundError('User not found');

  const matches = await comparePassword(currentPassword, user.passwordHash);
  if (!matches) throw new BadRequestError('Current password is incorrect');

  const passwordHash = await hashPassword(newPassword);
  await repo.update(currentUser.id, { passwordHash, mustChangePassword: false });
  await invalidateUserAuthCache(currentUser.id);
};

module.exports = {
  create,
  getById,
  list,
  listDeleted,
  update,
  updateCompanyAdminEmail,
  remove,
  permanentlyRemove,
  getMyProfile,
  updateProfile,
  changePassword,
};