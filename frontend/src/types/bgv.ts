export type BGVCaseStatus = 'DRAFT' | 'INITIATED' | 'CONSENT_PENDING' | 'IN_PROGRESS' | 'UNDER_REVIEW' | 'COMPLETED' | 'ON_HOLD' | 'CANCELLED';
export type BGVOverallResult = 'PENDING' | 'CLEAR' | 'MINOR_DISCREPANCY' | 'MAJOR_DISCREPANCY' | 'UNABLE_TO_VERIFY' | 'REQUIRES_REVIEW';
export type VerificationType = 'PAN' | 'UAN' | 'COURT' | 'IDENTITY' | 'ADDRESS' | 'EDUCATION' | 'EMPLOYMENT' | 'DOCUMENT' | 'DOCUMENT_FORGERY' | 'CIBIL' | 'TWENTY_SIX_AS' | 'POLICE';
export type VerificationProvider = 'SUREPASS' | 'MANUAL' | 'INTERNAL';
export type VerificationStatus = 'PENDING' | 'QUEUED' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'RETRYING' | 'CANCELLED';
export type VerificationResult = 'PENDING' | 'VERIFIED' | 'NOT_VERIFIED' | 'MATCH' | 'MISMATCH' | 'NO_RECORD_FOUND' | 'RECORD_FOUND' | 'REQUIRES_REVIEW' | 'UNABLE_TO_VERIFY';

export interface VerificationCheck {
  id: string;
  caseId: string;
  type: VerificationType;
  provider: VerificationProvider;
  status: VerificationStatus;
  result: VerificationResult;
  priority: number;
  resultData?: unknown;
  failureReason?: string | null;
  remarks?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  retryCount: number;
  isLocked?: boolean;
  lockedAt?: string | null;
  documents?: { id: string; fileName: string; fileUrl: string; documentType: string; mimeType?: string | null; uploadedAt: string }[];
}

export interface BGVCase {
  id: string;
  companyId: string;
  clientId: string;
  candidateId: string;
  caseNumber: string;
  clientReference?: string | null;
  packageName?: string | null;
  status: BGVCaseStatus;
  overallResult: BGVOverallResult;
  initiatedAt?: string | null;
  completedAt?: string | null;
  remarks?: string | null;
  createdAt: string;
  updatedAt: string;
  candidate?: { id: string; candidateCode: string; firstName: string; lastName: string; email: string; phone?: string | null; gender?: string | null; dateOfBirth?: string | null; currentAddress?: string | null; permanentAddress?: string | null };
  client?: { id: string; name: string; clientCode: string };
  checks?: VerificationCheck[];
  _count?: { checks: number };
}

export interface CreateBGVCasePayload {
  clientId: string;
  candidateId: string;
  clientReference?: string;
  packageName?: string;
  remarks?: string;
  checks?: { type: VerificationType; provider?: VerificationProvider; priority?: number }[];
}
