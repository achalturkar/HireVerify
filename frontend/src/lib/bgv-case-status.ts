import type { BGVCaseStatus } from '@/src/types/bgv';

const statusClasses: Record<BGVCaseStatus, string> = {
  DRAFT: 'border-slate-500/20 bg-slate-500/10 text-slate-600',
  INITIATED: 'border-blue-500/20 bg-blue-500/10 text-blue-700',
  CONSENT_PENDING: 'border-amber-500/20 bg-amber-500/10 text-amber-700',
  IN_PROGRESS: 'border-sky-500/20 bg-sky-500/10 text-sky-700',
  UNDER_REVIEW: 'border-violet-500/20 bg-violet-500/10 text-violet-700',
  COMPLETED: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700',
  ON_HOLD: 'border-orange-500/20 bg-orange-500/10 text-orange-700',
  CANCELLED: 'border-rose-500/20 bg-rose-500/10 text-rose-700',
};

export function bgvCaseStatusClass(status: string) {
  return statusClasses[status as BGVCaseStatus] ?? 'border-[var(--border)] bg-[var(--surface-muted)] text-[var(--muted)]';
}

export function bgvCaseStatusLabel(status: string) {
  return status.replaceAll('_', ' ');
}
