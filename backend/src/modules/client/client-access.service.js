'use strict';

const crypto = require('crypto');
const { prisma } = require('../../common/prisma');
const config = require('../../config');
const { hashPassword } = require('../../utils/password');
const { signResetToken } = require('../../utils/jwt');
const { sendMail, buildClientPortalInviteEmail } = require('../../utils/mailer');
const { invalidateUserAuthCache } = require('../../middleware/auth.middleware');
const { NotFoundError, BadRequestError, ConflictError } = require('../../utils/errors');

const CLIENT_PERMISSIONS = [
  'clientportal.cases.view',
  'clientportal.reports.view',
  'clientportal.reports.download',
  'clientportal.candidates.view',
  'clientportal.candidates.create',
  'clientportal.candidates.update',
  'clientportal.candidates.invite',
  'clientportal.candidates.portal.manage',
];

const userDto = (user) => ({
  id: user.id,
  firstName: user.firstName,
  lastName: user.lastName,
  email: user.email,
  status: user.status,
  permissions: user.clientPermissions || [],
  mustChangePassword: user.mustChangePassword,
  lastLoginAt: user.lastLoginAt,
  createdAt: user.createdAt,
});

const assertClient = async (clientId, companyId, requireActive = false) => {
  const client = await prisma.client.findFirst({
    where: { id: clientId, companyId, isDeleted: false },
    include: { company: { select: { name: true, status: true, isDeleted: true } } },
  });
  if (!client) throw new NotFoundError('Client not found');
  if (requireActive && (client.status !== 'ACTIVE' || client.company.status !== 'ACTIVE' || client.company.isDeleted)) {
    throw new BadRequestError('Activate the client and company before inviting client users.');
  }
  return client;
};

const validatePermissions = (permissions, { allowEmpty = false } = {}) => {
  if (!Array.isArray(permissions) || (!allowEmpty && permissions.length === 0)) {
    throw new BadRequestError('Select at least one client portal permission.');
  }
  const invalid = permissions.find((permission) => !CLIENT_PERMISSIONS.includes(permission));
  if (invalid) throw new BadRequestError(`Unsupported client portal permission: ${invalid}`);
  const uniquePermissions = [...new Set(permissions)];
  if (
    (uniquePermissions.includes('clientportal.candidates.create') || uniquePermissions.includes('clientportal.candidates.update') || uniquePermissions.includes('clientportal.candidates.invite') || uniquePermissions.includes('clientportal.candidates.portal.manage')) &&
    !uniquePermissions.includes('clientportal.candidates.view')
  ) {
    throw new BadRequestError('Candidate create/update/invite/portal management access also requires view candidates permission.');
  }
  if (
    uniquePermissions.includes('clientportal.reports.download') &&
    !uniquePermissions.includes('clientportal.reports.view')
  ) {
    throw new BadRequestError('Report download access also requires view completed reports permission.');
  }
  return uniquePermissions;
};

const list = async ({ clientId, companyId }) => {
  await assertClient(clientId, companyId);
  const users = await prisma.user.findMany({
    where: { clientId, companyId, isDeleted: false, role: { isClientUser: true } },
    orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
  });
  return users.map(userDto);
};

const invite = async ({ clientId, companyId, payload }) => {
  const client = await assertClient(clientId, companyId, true);
  const email = payload.email.trim().toLowerCase();
  const permissions = validatePermissions(payload.permissions);
  if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) {
    throw new ConflictError('An account with this email already exists.');
  }

  const role = await prisma.role.findFirst({ where: { companyId: null, isClientUser: true } });
  if (!role) throw new BadRequestError('Client portal access is not configured yet. Restart the backend after applying migrations.');

  const initialPassword = crypto.randomBytes(48).toString('base64url');
  const passwordHash = await hashPassword(initialPassword);
  const user = await prisma.user.create({
    data: {
      companyId,
      clientId,
      roleId: role.id,
      clientPermissions: permissions,
      firstName: payload.firstName.trim(),
      lastName: payload.lastName.trim(),
      email,
      passwordHash,
      mustChangePassword: true,
      status: 'ACTIVE',
    },
  });

  const token = signResetToken({ sub: user.id, email: user.email });
  const resetUrl = `${config.frontendUrl.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(token)}`;
  try {
    const mail = buildClientPortalInviteEmail({
      name: `${user.firstName} ${user.lastName}`.trim(),
      clientName: client.name,
      resetUrl,
      expiresIn: config.jwt.resetExpiresIn,
    });
    await sendMail({ to: user.email, ...mail });
  } catch (error) {
    await prisma.user.delete({ where: { id: user.id } });
    throw error;
  }

  return userDto(user);
};

const update = async ({ clientId, companyId, userId, payload }) => {
  await assertClient(clientId, companyId);
  const existing = await prisma.user.findFirst({
    where: { id: userId, companyId, clientId, isDeleted: false, role: { isClientUser: true } },
  });
  if (!existing) throw new NotFoundError('Client portal user not found');

  const data = {};
  if (payload.permissions !== undefined) {
    data.clientPermissions = validatePermissions(payload.permissions, { allowEmpty: true });
  }
  if (payload.status !== undefined) data.status = payload.status;
  if (Object.keys(data).length === 0) throw new BadRequestError('No client portal user fields to update.');

  const user = await prisma.user.update({ where: { id: userId }, data });
  await invalidateUserAuthCache(userId);
  return userDto(user);
};

const remove = async ({ clientId, companyId, userId }) => {
  await assertClient(clientId, companyId);
  const user = await prisma.user.findFirst({
    where: { id: userId, companyId, clientId, isDeleted: false, role: { isClientUser: true } },
    select: { id: true },
  });
  if (!user) throw new NotFoundError('Client portal user not found');
  await prisma.user.update({
    where: { id: userId },
    data: { isDeleted: true, deletedAt: new Date(), status: 'INACTIVE' },
  });
  await invalidateUserAuthCache(userId);
};

module.exports = { CLIENT_PERMISSIONS, list, invite, update, remove };
