import type { PaginationMeta } from '@/src/types/user';

export type CandidateStatus = 'PENDING' | 'INVITED' | 'IN_PROGRESS' | 'VERIFICATION_IN_PROGRESS' | 'COMPLETED' | 'WITHDRAWN' | 'ON_HOLD';

export interface ClientRef {
  id: string;
  name: string;
}

export interface CandidateOption {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  status?: string;
  client?: ClientRef | null;
}

export interface CandidatePortalSummary {
  activatedAt: string;
  lastSentAt: string | null;
  expiresAt: string;
  revokedAt: string | null;
  reminderCount: number;
  lastRemindedAt: string | null;
}

export interface ListCandidatesParams {
  search?: string;
  limit?: number;
  clientId?: string;
}

export interface Candidate {
  id: string;
  companyId: string;
  clientId: string;
  client?: { id: string; name: string; clientCode?: string | null; contactEmail?: string | null; contactPhone?: string | null } | null;
  candidateCode: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  aadhaarNumber?: string | null;
  panNumber?: string | null;
  uanNumber?: string | null;
  passportNumber?: string | null;
  drivingLicenseNumber?: string | null;
  voterIdNumber?: string | null;
  highestQualification?: string | null;
  courseName?: string | null;
  institutionName?: string | null;
  universityName?: string | null;
  yearOfPassing?: string | null;
  gradeOrPercentage?: string | null;
  employeeId?: string | null;
  employeeDesignation?: string | null;
  employeeDepartment?: string | null;
  employmentType?: string | null;
  joiningDate?: string | null;
  workLocation?: string | null;
  currentEmployer?: string | null;
  currentAddress?: string | null;
  permanentAddress?: string | null;
  status: CandidateStatus;
  createdById: string | null;
  updatedById: string | null;
  createdAt: string;
  updatedAt: string;
  bgvCaseCount?: number;
  portalInvitation?: CandidatePortalSummary | null;
}


export interface CandidateFormValues {
  clientId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  gender: string;
  employeeId: string;
  employeeDesignation: string;
  employeeDepartment: string;
  employmentType: string;
  joiningDate: string;
  workLocation: string;
  currentEmployer: string;
  currentAddress: string;
  permanentAddress: string;
}

export type { PaginationMeta };