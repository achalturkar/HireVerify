import type { PaginationMeta } from '@/src/types/user';

export type CandidateStatus = 'PENDING' | 'INVITED' | 'IN_PROGRESS' | 'VERIFICATION_IN_PROGRESS' | 'COMPLETED' | 'WITHDRAWN' | 'ON_HOLD';

export interface ClientRef {
  id: string;
  name: string;
}

export interface CandidateOption {
  id: string;
  fullName?: string;
  firstName: string;
  middleName?: string | null;
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

export interface CandidateEmploymentRecord {
  isCurrent: boolean;
  isFresher?: boolean;
  employerName: string | null;
  employeeId: string | null;
  designation: string | null;
  department: string | null;
  employmentType: string | null;
  startDate: string | null;
  endDate: string | null;
  workLocation: string | null;
  employerHrName?: string | null;
  employerHrPhone?: string | null;
}

export interface CandidateEducationRecord {
  id?: string;
  qualification: string | null;
  courseName: string | null;
  institutionName: string | null;
  universityName: string | null;
  yearOfPassing: string | number | null;
  gradeOrPercentage: string | null;
}

export interface ListCandidatesParams {
  search?: string;
  limit?: number;
  clientId?: string;
}

export interface Candidate {
  id: string;
  portalLinkExpiryDays?: number;
  companyId: string;
  clientId: string;
  subclientId?: string | null;
  client?: { id: string; name: string; clientCode?: string | null; contactEmail?: string | null; contactPhone?: string | null } | null;
  subclient?: { id: string; name: string; clientCode?: string | null; serviceRates?: { checkType: string; rate: number }[] } | null;
  candidateCode: string;
  fullName: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  email: string;
  phone: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  fatherName?: string | null;
  motherName?: string | null;
  maritalStatus?: string | null;
  spouseName?: string | null;
  childrenCount?: number | null;
  candidateNotes?: string | null;
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
  employerHrName?: string | null;
  employerHrPhone?: string | null;
  educationHistory?: CandidateEducationRecord[];
  employmentHistory?: CandidateEmploymentRecord[];
  currentAddress?: string | null;
  permanentAddress?: string | null;
  addressVerificationLocations?: ('current' | 'permanent')[];
  status: CandidateStatus;
  createdById: string | null;
  updatedById: string | null;
  createdAt: string;
  updatedAt: string;
  bgvCaseCount?: number;
  consents?: { consentGiven: boolean; consentVersion: string | null; consentedAt: string | null; revokedAt: string | null; createdAt: string }[];
  portalInvitation?: CandidatePortalSummary | null;
}


export interface CandidateFormValues {
  clientId: string;
  subclientId?: string;
  fullName: string;
  firstName: string;
  middleName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  gender: string;
  aadhaarNumber?: string;
  panNumber?: string;
  uanNumber?: string;
  passportNumber?: string;
  drivingLicenseNumber?: string;
  voterIdNumber?: string;
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