'use strict';

const asyncHandler = require('../../utils/asyncHandler');
const { success, created } = require('../../utils/response');
const { writeAudit } = require('../../utils/audit');
const authService = require('./auth.service');

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const result = await authService.login({ email, password, req });
  await writeAudit({ req: { ...req, user: { id: result.user.id, companyId: result.user.companyId } }, action: 'auth.login', entity: 'User', entityId: result.user.id });
  return success(res, {
    message: 'Login successful',
    data: result,
  });
});

const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  await authService.forgotPassword({ email, req });
  return success(res, {
    message: 'If an account with that email exists, a password reset link has been sent.',
  });
});

const resetPassword = asyncHandler(async (req, res) => {
  const { token, newPassword } = req.body;
  await authService.resetPassword({ token, newPassword });
  return success(res, {
    message: 'Password changed successfully. Please log in with your new password.',
  });
});

const refresh = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  const result = await authService.refresh({ refreshToken, req });
  return success(res, { message: 'Token refreshed', data: result });
});

const logout = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body || {};
  await authService.logout({ refreshToken, userId: req.user?.id });
  if (req.user) {
    await writeAudit({ req, action: 'auth.logout', entity: 'User', entityId: req.user.id });
  }
  return success(res, { message: 'Logged out' });
});

const me = asyncHandler(async (req, res) => {
  const data = await authService.me(req.user.id);
  return success(res, { message: 'Current user', data });
});

const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  await authService.changePassword({
    userId: req.user.id,
    currentPassword,
    newPassword,
  });
  await writeAudit({ req, action: 'auth.change_password', entity: 'User', entityId: req.user.id });
  return created(res, { message: 'Password changed successfully. Please log in again.' });
});

const startImpersonation = asyncHandler(async (req, res) => {
  const { companyId, targetUserId, reason } = req.body;
  const data = await authService.startImpersonation({
    actorId: req.user.id,
    companyId,
    targetUserId,
    reason,
    req,
  });
  return success(res, { message: 'Company access started', data });
});

const stopImpersonation = asyncHandler(async (req, res) => {
  await authService.stopImpersonation({ impersonation: req.impersonation, req });
  return success(res, { message: 'Company access ended' });
});

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
