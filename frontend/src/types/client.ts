export type ClientStatus = 'ACTIVE' | 'INACTIVE';

export const CANDIDATE_IDENTITY_FIELDS = [
  { key: 'aadhaarNumber', documentType: 'AADHAAR', label: 'Aadhaar number', example: '1234 5678 9012' },
  { key: 'panNumber', documentType: 'PAN', label: 'PAN', example: 'ABCDE1234F' },
  { key: 'uanNumber', documentType: 'UAN', label: 'UAN (EPFO)', example: '100123456789' },
  { key: 'passportNumber', documentType: 'PASSPORT', label: 'Passport number', example: 'A1234567' },
  { key: 'drivingLicenseNumber', documentType: 'DRIVING_LICENSE', label: 'Driving licence number', example: 'MH12 20110012345' },
  { key: 'voterIdNumber', documentType: 'VOTER_ID', label: 'Voter ID number', example: 'ABC1234567' },
] as const;

export type CandidateIdentityFieldKey = typeof CANDIDATE_IDENTITY_FIELDS[number]['key'];
export type CandidateFormConfig = Record<CandidateIdentityFieldKey, {
  enabled: boolean;
  required: boolean;
  documentRequired: boolean;
}>;

export const DEFAULT_CANDIDATE_FORM_CONFIG: CandidateFormConfig = {
  aadhaarNumber: { enabled: true, required: false, documentRequired: false },
  panNumber: { enabled: true, required: false, documentRequired: false },
  uanNumber: { enabled: true, required: false, documentRequired: false },
  passportNumber: { enabled: true, required: false, documentRequired: false },
  drivingLicenseNumber: { enabled: true, required: false, documentRequired: false },
  voterIdNumber: { enabled: true, required: false, documentRequired: false },
};

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
  reportShowCompanyBranding: boolean;
  reportShowClientBranding: boolean;
  candidateFormConfig: CandidateFormConfig;
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
  isDeleted?: boolean;
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
  reportShowCompanyBranding?: boolean;
  reportShowClientBranding?: boolean;
  candidateFormConfig?: CandidateFormConfig;
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

export type ClientPortalPermission =
  | 'clientportal.cases.view'
  | 'clientportal.reports.view'
  | 'clientportal.reports.download'
  | 'clientportal.candidates.view'
  | 'clientportal.candidates.create'
  | 'clientportal.candidates.update'
  | 'clientportal.candidates.invite'
  | 'clientportal.candidates.portal.manage';

export interface ClientPortalUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: ClientStatus;
  permissions: ClientPortalPermission[];
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
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
  deletedOnly?: boolean;
  sortBy?: 'name' | 'clientCode' | 'createdAt' | 'updatedAt' | 'status';
  sortOrder?: 'asc' | 'desc';
}