// This extends what's already in '@/src/types/bgv' — add isLocked and
// documents to the VerificationCheck interface there:
//
//   export interface VerificationCheck {
//     ...
//     isLocked: boolean;                          // NEW
//     documents?: CandidateDocumentRef[];          // NEW
//   }
//
// The shapes below describe what goes inside VerificationCheck.resultData
// for each check type — this is the JSON contract both the manual tabs and
// (later) automatic Surepass calls write into, so the report generator only
// ever has to read one shape per type regardless of how it was filled.

export type CheckOutcome = 'CLEAR' | 'MINOR_DISCREPANCY' | 'MAJOR_DISCREPANCY' | 'UNABLE_TO_VERIFY' | 'REQUIRES_REVIEW';

export const CHECK_OUTCOMES: CheckOutcome[] = [
  'CLEAR',
  'MINOR_DISCREPANCY',
  'MAJOR_DISCREPANCY',
  'UNABLE_TO_VERIFY',
  'REQUIRES_REVIEW',
];

export interface CandidateDocumentRef {
  id: string;
  fileName: string;
  fileUrl: string;
  documentType: string;
  mimeType?: string | null;
  uploadedAt: string;
}

export interface IdentityResultData {
  aadhaarNumber: string;
  verifiedBy: string;
  modeOfVerification: string;
  remarks: string;
  status: CheckOutcome;
}

export interface AddressResultData {
  currentAddress: string;
  permanentAddress: string;
  verifiedBy: string;
  modeOfVerification: string;
  remarks: string;
  status: CheckOutcome;
}

export interface EmploymentEntry {
  id: string;
  companyName: string;
  designation: string;
  department: string;
  employeeId: string;
  periodFrom: string;
  periodTo: string;
  currentlyWorking: boolean;
  jobDescription: string;
  remuneration: string;
  reportingManager: string;
  reasonForLeaving: string;
  integrityIssues: string;
  exitFormalitiesCompleted: string;
  registeredInMCA: string;
  listedOnline: string;
  domainName: string;
  familyOwnedBusiness: string;
  verifiedBy: string;
  modeOfVerification: string;
  status: CheckOutcome;
}

export interface EmploymentResultData {
  entries: EmploymentEntry[];
}

export interface EducationEntry {
  id: string;
  educationType: string;
  qualification: string;
  institute: string;
  yearOfPassing: string;
  specialization: string;
  boardOrUniversity: string;
  percentage: string;
  verifiedBy: string;
  modeOfVerification: string;
  remarks: string;
  status: CheckOutcome;
}

export interface EducationResultData {
  entries: EducationEntry[];
}

export interface CourtResultData {
  verifiedBy: string;
  modeOfVerification: string;
  remarks: string;
  civilProceedings: string;
  criminalProceedings: string;
  status: CheckOutcome;
}

export function emptyEmploymentEntry(): EmploymentEntry {
  return {
    id: crypto.randomUUID(),
    companyName: '', designation: '', department: '', employeeId: '',
    periodFrom: '', periodTo: '', currentlyWorking: false,
    jobDescription: '', remuneration: '', reportingManager: '',
    reasonForLeaving: '', integrityIssues: '', exitFormalitiesCompleted: '',
    registeredInMCA: '', listedOnline: '', domainName: '', familyOwnedBusiness: '',
    verifiedBy: '', modeOfVerification: '', status: 'CLEAR',
  };
}

export function emptyEducationEntry(): EducationEntry {
  return {
    id: crypto.randomUUID(),
    educationType: 'Graduation', qualification: '', institute: '', yearOfPassing: '',
    specialization: '', boardOrUniversity: '', percentage: '',
    verifiedBy: '', modeOfVerification: '', remarks: '', status: 'CLEAR',
  };
}