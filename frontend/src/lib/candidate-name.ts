export interface CandidateName {
  fullName?: string | null;
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
}

export function splitCandidateName(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return null;

  return {
    fullName: parts.join(' '),
    firstName: parts[0],
    middleName: parts.length > 2 ? parts.slice(1, -1).join(' ') : '',
    lastName: parts[parts.length - 1],
  };
}

export function formatCandidateName(candidate: CandidateName) {
  return candidate.fullName?.trim()
    || [candidate.firstName, candidate.middleName, candidate.lastName].filter(Boolean).join(' ');
}
