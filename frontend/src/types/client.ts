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
export type CandidateFormSectionKey = 'family' | 'education' | 'employment' | 'policeVerification' | 'address';
export type CandidateCustomFormCategory = 'BGV' | 'IDENTITY' | 'EDUCATION' | 'EMPLOYMENT' | 'POLICE_VERIFICATION' | 'CIBIL' | 'OTHER_CHECKS' | 'OTHER';
export const CANDIDATE_FORM_REQUIRED_FIELD_GROUPS = [
  {
    key: 'details',
    label: 'Personal details',
    fields: [
      { key: 'phone', label: 'Mobile number', defaultRequired: true },
      { key: 'dateOfBirth', label: 'Date of birth', defaultRequired: true },
      { key: 'gender', label: 'Gender', defaultRequired: false },
      { key: 'candidateNotes', label: 'Notes for the verification team', defaultRequired: false },
    ],
  },
  {
    key: 'family',
    label: 'Family details',
    fields: [
      { key: 'fatherName', label: "Father's name", defaultRequired: false },
      { key: 'motherName', label: "Mother's name", defaultRequired: false },
      { key: 'maritalStatus', label: 'Marital status', defaultRequired: false },
      { key: 'spouseName', label: 'Husband / spouse name (when married)', defaultRequired: false },
      { key: 'childrenCount', label: 'Number of children', defaultRequired: false },
    ],
  },
  {
    key: 'education',
    label: 'Education record',
    fields: [
      { key: 'qualification', label: 'Qualification', defaultRequired: false },
      { key: 'courseName', label: 'Course or degree', defaultRequired: false },
      { key: 'institutionName', label: 'College or school', defaultRequired: false },
      { key: 'universityName', label: 'University or board', defaultRequired: false },
      { key: 'yearOfPassing', label: 'Year of passing', defaultRequired: false },
      { key: 'gradeOrPercentage', label: 'Percentage or CGPA', defaultRequired: false },
    ],
  },
  {
    key: 'employment',
    label: 'Current and past employment records',
    fields: [
      { key: 'employerName', label: 'Employer name', defaultRequired: false },
      { key: 'employeeId', label: 'Employee ID', defaultRequired: false },
      { key: 'designation', label: 'Designation', defaultRequired: false },
      { key: 'department', label: 'Department', defaultRequired: false },
      { key: 'employmentType', label: 'Employment type', defaultRequired: false },
      { key: 'startDate', label: 'Start or joining date', defaultRequired: false },
      { key: 'endDate', label: 'End date (past employment)', defaultRequired: false },
      { key: 'workLocation', label: 'Work location', defaultRequired: false },
      { key: 'employerHrName', label: 'Employer HR contact name', defaultRequired: false },
      { key: 'employerHrPhone', label: 'Employer HR contact number', defaultRequired: false },
    ],
  },
] as const;
export type CandidateFormRequiredFieldKey = typeof CANDIDATE_FORM_REQUIRED_FIELD_GROUPS[number]['fields'][number]['key'];
export const CANDIDATE_ADDRESS_DOCUMENT_TYPES = [
  { type: 'ADDRESS_PROOF', label: 'Address proof' },
  { type: 'AADHAAR', label: 'Aadhaar card (address proof)' },
  { type: 'PASSPORT', label: 'Passport' },
  { type: 'DRIVING_LICENSE', label: 'Driving licence' },
  { type: 'VOTER_ID', label: 'Voter ID' },
  { type: 'BANK_STATEMENT', label: 'Bank statement with address' },
  { type: 'ELECTRICITY_BILL', label: 'Electricity bill' },
  { type: 'UTILITY_BILL', label: 'Water or other utility bill' },
  { type: 'RENT_AGREEMENT', label: 'Rent agreement' },
  { type: 'GPS_ADDRESS_PHOTO', label: 'GPS address photo' },
] as const;
export type CandidateAddressDocumentType = typeof CANDIDATE_ADDRESS_DOCUMENT_TYPES[number]['type'];
export const CANDIDATE_EMPLOYMENT_DOCUMENT_TYPES = [
  { type: 'SALARY_SLIP', label: 'Salary slip' },
  { type: 'FORM_16', label: 'Form 16' },
  { type: 'EXPERIENCE_LETTER', label: 'Experience letter' },
  { type: 'RELIEVING_LETTER', label: 'Relieving letter' },
  { type: 'OFFER_LETTER', label: 'Offer letter' },
  { type: 'APPOINTMENT_LETTER', label: 'Appointment letter' },
  { type: 'INCREMENT_LETTER', label: 'Increment letter' },
  { type: 'PROMOTION_LETTER', label: 'Promotion letter' },
  { type: 'BANK_STATEMENT', label: 'Bank statement' },
  { type: 'PF_STATEMENT', label: 'PF statement' },
  { type: 'EMPLOYMENT_CONTRACT', label: 'Employment contract' },
  { type: 'OTHER', label: 'Other employment document' },
] as const;
export type CandidateEmploymentDocumentType = typeof CANDIDATE_EMPLOYMENT_DOCUMENT_TYPES[number]['type'];
export type CandidateEmploymentDocumentConfig = {
  type: CandidateEmploymentDocumentType;
  enabled: boolean;
  required: boolean;
};
export type CandidateCustomForm = {
  id: string;
  name: string;
  category: CandidateCustomFormCategory;
  enabled: boolean;
  required: boolean;
  fileName: string;
};
export type CandidateFormConfig = Record<CandidateIdentityFieldKey, {
  enabled: boolean;
  required: boolean;
  documentRequired: boolean;
}> & {
  invitationExpiryDays: number;
  fields: Record<CandidateFormRequiredFieldKey, { required: boolean }>;
  sections: Record<CandidateFormSectionKey, { enabled: boolean }>;
  address: {
    currentAddressEnabled: boolean;
    currentAddressRequired: boolean;
    permanentAddressEnabled: boolean;
    permanentAddressRequired: boolean;
    documents: { type: CandidateAddressDocumentType; enabled: boolean; required: boolean }[];
  };
  customForms: CandidateCustomForm[];
  employmentDocuments: CandidateEmploymentDocumentConfig[];
};

export const DEFAULT_CANDIDATE_FORM_CONFIG: CandidateFormConfig = {
  invitationExpiryDays: 2,
  fields: Object.fromEntries(CANDIDATE_FORM_REQUIRED_FIELD_GROUPS.flatMap((group) =>
    group.fields.map((field) => [field.key, { required: field.defaultRequired }]),
  )) as CandidateFormConfig['fields'],
  aadhaarNumber: { enabled: true, required: false, documentRequired: false },
  panNumber: { enabled: true, required: false, documentRequired: false },
  uanNumber: { enabled: true, required: false, documentRequired: false },
  passportNumber: { enabled: true, required: false, documentRequired: false },
  drivingLicenseNumber: { enabled: true, required: false, documentRequired: false },
  voterIdNumber: { enabled: true, required: false, documentRequired: false },
  sections: {
    family: { enabled: true },
    education: { enabled: true },
    employment: { enabled: true },
    policeVerification: { enabled: false },
    address: { enabled: true },
  },
  address: {
    currentAddressEnabled: true,
    currentAddressRequired: true,
    permanentAddressEnabled: true,
    permanentAddressRequired: false,
    documents: CANDIDATE_ADDRESS_DOCUMENT_TYPES.map(({ type }) => ({ type, enabled: true, required: false })),
  },
  customForms: [],
  employmentDocuments: CANDIDATE_EMPLOYMENT_DOCUMENT_TYPES.map(({ type }) => ({ type, enabled: true, required: false })),
};

export interface CompanyRef {
  id: string;
  name: string;
}

export interface Client {
  id: string;
  companyId: string;
  parentClientId?: string | null;
  clientCode: string;
  name: string;
  logoUrl: string | null;
  reportShowCompanyBranding: boolean;
  reportShowClientBranding: boolean;
  candidateFormConfig: CandidateFormConfig;
  serviceRates?: { checkType: string; rate: number }[];
  packageRate?: number | null;
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
  | 'clientportal.invoices.view'
  | 'clientportal.reports.view'
  | 'clientportal.reports.download'
  | 'clientportal.candidates.view'
  | 'clientportal.candidates.pdf.download'
  | 'clientportal.candidates.create'
  | 'clientportal.candidates.update'
  | 'clientportal.candidates.invite'
  | 'clientportal.candidates.portal.manage'
  | 'clientportal.subclients.view'
  | 'clientportal.subclients.manage';

export type ClientPortalAccountMethod = 'INVITATION' | 'PASSWORD';

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