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
  email: string;
  status?: string;
  client?: ClientRef | null;
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
  candidateCode: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  currentAddress?: string | null;
  permanentAddress?: string | null;
  status: CandidateStatus;
  createdById: string | null;
  updatedById: string | null;
  createdAt: string;
  updatedAt: string;
  bgvCaseCount?: number;
}


export interface CandidateFormValues {
  clientId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  gender: string;
  currentAddress: string;
  permanentAddress: string;
}

export type { PaginationMeta };