import type { CandidateStatus } from '@/src/types/candidate';

export const candidateStatusOptions: CandidateStatus[] = [
  'PENDING',
  'INVITED',
  'IN_PROGRESS',
  'DETAILS_SUBMITTED',
  'VERIFICATION_IN_PROGRESS',
  'COMPLETED',
  'WITHDRAWN',
  'CANCELLED',
  'ON_HOLD',
];

const labels: Record<CandidateStatus, string> = {
  PENDING: 'Pending',
  INVITED: 'Mail sent',
  IN_PROGRESS: 'Details in progress',
  DETAILS_SUBMITTED: 'Details submitted',
  VERIFICATION_IN_PROGRESS: 'Verification in progress',
  COMPLETED: 'Verification completed',
  WITHDRAWN: 'Withdrawn',
  CANCELLED: 'Cancelled',
  ON_HOLD: 'On hold',
};

export const candidateStatusLabel = (status: string) =>
  labels[status as CandidateStatus] ?? status.replaceAll('_', ' ');
