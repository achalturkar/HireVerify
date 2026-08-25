'use strict';

/**
 * Master list of all permissions.
 * Format:
 * module.action
 */

const PERMISSIONS = [

  // ==========================
  // Dashboard
  // ==========================
  { key: 'dashboard.view', module: 'dashboard', action: 'view', description: 'View dashboard' },

  // ==========================
  // Company
  // ==========================
  { key: 'company.create', module: 'company', action: 'create', description: 'Create companies' },
  { key: 'company.view', module: 'company', action: 'view', description: 'View companies' },
  { key: 'company.update', module: 'company', action: 'update', description: 'Update companies' },
  { key: 'company.delete', module: 'company', action: 'delete', description: 'Delete companies' },
  { key: 'company.activate', module: 'company', action: 'activate', description: 'Activate companies' },
  { key: 'company.inactivate', module: 'company', action: 'inactivate', description: 'Inactivate companies' },

  // ==========================
  // Client
  // ==========================
  { key: 'client.create', module: 'client', action: 'create', description: 'Create clients' },
  { key: 'client.view', module: 'client', action: 'view', description: 'View clients' },
  { key: 'client.update', module: 'client', action: 'update', description: 'Update clients' },
  { key: 'client.delete', module: 'client', action: 'delete', description: 'Delete clients' },
  { key: 'client.activate', module: 'client', action: 'activate', description: 'Activate clients' },
  { key: 'client.inactivate', module: 'client', action: 'inactivate', description: 'Inactivate clients' },

  // ==========================
  // BGV Cases
  // ==========================
  { key: 'bgv.case.create', module: 'bgv.case', action: 'create', description: 'Create BGV cases' },
  { key: 'bgv.case.view', module: 'bgv.case', action: 'view', description: 'View BGV cases' },
  { key: 'bgv.case.update', module: 'bgv.case', action: 'update', description: 'Update BGV cases' },
  { key: 'bgv.case.cancel', module: 'bgv.case', action: 'cancel', description: 'Cancel BGV cases' },
  { key: 'bgv.case.assign', module: 'bgv.case', action: 'assign', description: 'Assign BGV cases' },

  // ==========================
  // Candidate
  // ==========================
  { key: 'candidate.create', module: 'candidate', action: 'create', description: 'Create candidates' },
  { key: 'candidate.view', module: 'candidate', action: 'view', description: 'View candidates' },
  { key: 'candidate.update', module: 'candidate', action: 'update', description: 'Update candidates' },
  { key: 'candidate.delete', module: 'candidate', action: 'delete', description: 'Delete candidates' },
  { key: 'candidate.import', module: 'candidate', action: 'import', description: 'Import candidates' },
  { key: 'candidate.export', module: 'candidate', action: 'export', description: 'Export candidates' },



  // ==========================
  // BGV Processing
  // ==========================
  { key: 'bgv.verification.view', module: 'bgv.verification', action: 'view', description: 'View verification checks' },
  { key: 'bgv.verification.create', module: 'bgv.verification', action: 'create', description: 'Create verification checks' },
  { key: 'bgv.verification.retry', module: 'bgv.verification', action: 'retry', description: 'Retry verification checks' },
  { key: 'bgv.verification.review', module: 'bgv.verification', action: 'review', description: 'Review verification results' },
  { key: 'bgv.verification.override', module: 'bgv.verification', action: 'override', description: 'Override verification results' },
  { key: 'bgv.document.view', module: 'bgv.document', action: 'view', description: 'View candidate documents' },
  { key: 'bgv.document.upload', module: 'bgv.document', action: 'upload', description: 'Upload candidate documents' },
  { key: 'bgv.document.delete', module: 'bgv.document', action: 'delete', description: 'Delete candidate documents' },
  { key: 'bgv.consent.view', module: 'bgv.consent', action: 'view', description: 'View candidate consent' },
  { key: 'bgv.consent.manage', module: 'bgv.consent', action: 'manage', description: 'Manage candidate consent' },
  { key: 'bgv.report.view', module: 'bgv.report', action: 'view', description: 'View BGV reports' },
  { key: 'bgv.report.generate', module: 'bgv.report', action: 'generate', description: 'Generate BGV reports' },
  { key: 'bgv.report.approve', module: 'bgv.report', action: 'approve', description: 'Approve BGV reports' },
  { key: 'bgv.report.send', module: 'bgv.report', action: 'send', description: 'Make BGV reports available to clients' },
  { key: 'bgv.report.download', module: 'bgv.report', action: 'download', description: 'Download BGV reports' },


  

  // ==========================
  // Users
  // ==========================
  { key: 'users.create', module: 'users', action: 'create', description: 'Create users' },
  { key: 'users.view', module: 'users', action: 'view', description: 'View users' },
  { key: 'users.update', module: 'users', action: 'update', description: 'Update users' },
  { key: 'users.delete', module: 'users', action: 'delete', description: 'Delete users' },
  { key: 'users.activate', module: 'users', action: 'activate', description: 'Activate users' },
  { key: 'users.inactivate', module: 'users', action: 'inactivate', description: 'Inactivate users' },

  // ==========================
  // Roles
  // ==========================
  { key: 'roles.create', module: 'roles', action: 'create', description: 'Create roles' },
  { key: 'roles.view', module: 'roles', action: 'view', description: 'View roles' },
  { key: 'roles.update', module: 'roles', action: 'update', description: 'Update roles' },
  { key: 'roles.delete', module: 'roles', action: 'delete', description: 'Delete roles' },

  // ==========================
  // Permissions
  // ==========================
  { key: 'permissions.view', module: 'permissions', action: 'view', description: 'View permissions' },
  { key: 'permissions.assign', module: 'permissions', action: 'assign', description: 'Assign permissions' },

  // ==========================
  // Profile
  // ==========================
  { key: 'profile.view', module: 'profile', action: 'view', description: 'View profile' },
  { key: 'profile.update', module: 'profile', action: 'update', description: 'Update profile' },
  { key: 'profile.changePassword', module: 'profile', action: 'changePassword', description: 'Change password' },

  // ==========================
  // Audit
  // ==========================
  { key: 'audit.view', module: 'audit', action: 'view', description: 'View audit logs' },
];

const PERMISSION_KEYS = PERMISSIONS.reduce((acc, permission) => {
  const constantName = permission.key.toUpperCase().replace(/\./g, '_');
  acc[constantName] = permission.key;
  return acc;
}, {});

const SYSTEM_ROLES = {
  SUPER_ADMIN: 'Super Admin',
  COMPANY_ADMIN: 'Company Admin',
  HR: 'HR',
  RECRUITER: 'Recruiter',
  VIEWER: 'Viewer',
};

module.exports = {
  PERMISSIONS,
  PERMISSION_KEYS,
  SYSTEM_ROLES,
};