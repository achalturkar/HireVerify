export type ClientStatus = 'ACTIVE' | 'INACTIVE';

export interface CompanyRef {
  id: string;
  name: string;
}

export interface Client {
  id: string;
  companyId: string;
  clientCode: string;
  name: string;
  logoUrl: string | null;
  website: string | null;
  industry: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  gstNumber: string | null;
  panNumber: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postalCode: string | null;
  status: ClientStatus;
  candidateCount?: number;
  bgvCaseCount?: number;
  createdById: string | null;
  updatedById: string | null;
  createdAt: string;
  updatedAt: string;
  company?: CompanyRef | null;
}

// Controlled-input string values used by ClientFormModal. companyId is only
// relevant for Super Admins creating a client on behalf of a company.
export interface ClientFormValues {
  companyId: string;
  clientCode: string;
  name: string;
  logoUrl: string;
  website: string;
  industry: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  gstNumber: string;
  panNumber: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
}

export interface CreateClientPayload {
  companyId?: string;
  clientCode: string;
  name: string;
  logoUrl?: string;
  website?: string;
  industry?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  gstNumber?: string;
  panNumber?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
}

export interface UpdateClientPayload {
  clientCode?: string;
  name?: string;
  logoUrl?: string;
  website?: string;
  industry?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  gstNumber?: string;
  panNumber?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  status?: ClientStatus;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ListClientsParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: ClientStatus | '';
  companyId?: string;
  includeDeleted?: boolean;
  sortBy?: 'name' | 'clientCode' | 'createdAt' | 'updatedAt' | 'status';
  sortOrder?: 'asc' | 'desc';
}