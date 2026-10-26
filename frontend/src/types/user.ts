export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'INACTIVE';

export interface RoleRef {
  id: string;
  name: string;
  isCompanyAdmin: boolean;
  isSuperAdmin: boolean;
}

export interface CompanyRef {
  id: string;
  name: string;
}

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  status: UserStatus;
  companyId: string | null;
  company: CompanyRef | null;
  clientId?: string | null;
  client?: { id: string; name: string } | null;
  isDeleted?: boolean;
  deletedAt?: string | null;
  role: RoleRef | null;
  permissions: string[];
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  generatedPassword?: string;
}

export interface CreateUserPayload {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  roleId: string;
  companyId?: string;
  password?: string;
}

export interface UpdateUserPayload {
  firstName?: string;
  lastName?: string;
  phone?: string;
  roleId?: string;
  status?: UserStatus;
}

// Self-service only — deliberately excludes roleId/status.
// Matches the backend's updateProfile whitelist (firstName/lastName/phone).
export interface UpdateProfilePayload {
  firstName?: string;
  lastName?: string;
  phone?: string | null;
}

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ListUsersParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: UserStatus | '';
  companyId?: string;
  sortBy?: 'firstName' | 'lastName' | 'email' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}