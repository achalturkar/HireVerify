export interface VerificationStatusSummary {
  label: string;
  className: string;
}

export function getVerificationStatus(statuses: readonly string[] | undefined): VerificationStatusSummary {
  if (!statuses?.length) {
    return { label: 'NOT STARTED', className: 'bg-[var(--surface-muted)] text-[var(--muted)]' };
  }

  const total = statuses.length;
  const completed = statuses.filter((status) => status === 'COMPLETED').length;
  const failed = statuses.filter((status) => status === 'FAILED').length;
  const active = statuses.some((status) => status === 'IN_PROGRESS' || status === 'RETRYING');
  const queued = statuses.some((status) => status === 'QUEUED');
  const pending = statuses.some((status) => status === 'PENDING');
  const allCancelled = statuses.every((status) => status === 'CANCELLED');

  if (failed > 0) {
    return {
      label: `FAILED · ${completed}/${total} COMPLETED`,
      className: 'bg-rose-500/10 text-rose-700',
    };
  }
  if (completed === total) {
    return { label: `COMPLETED · ${completed}/${total}`, className: 'bg-emerald-500/10 text-emerald-700' };
  }
  if (active) {
    return { label: `IN PROGRESS · ${completed}/${total}`, className: 'bg-amber-500/10 text-amber-700' };
  }
  if (queued) {
    return { label: `QUEUED · ${completed}/${total}`, className: 'bg-sky-500/10 text-sky-700' };
  }
  if (allCancelled) {
    return { label: 'CANCELLED', className: 'bg-[var(--surface-muted)] text-[var(--muted)]' };
  }
  if (pending) {
    return { label: `PENDING · ${completed}/${total}`, className: 'bg-amber-500/10 text-amber-700' };
  }
  return { label: `${completed}/${total} COMPLETED`, className: 'bg-[var(--surface-muted)] text-[var(--muted)]' };
}

export function getReportVerificationStatus(status: string | undefined): VerificationStatusSummary {
  const label = status?.replaceAll('_', ' ') || 'PENDING';
  switch (label) {
    case 'CLEAR':
      return { label, className: 'bg-emerald-500/10 text-emerald-700' };
    case 'MAJOR DISCREPANCY':
      return { label, className: 'bg-rose-500/10 text-rose-700' };
    case 'MINOR DISCREPANCY':
      return { label, className: 'bg-amber-500/10 text-amber-700' };
    case 'UNABLE TO VERIFY':
      return { label, className: 'bg-slate-500/10 text-slate-700' };
    case 'REQUIRES REVIEW':
      return { label, className: 'bg-orange-500/10 text-orange-700' };
    default:
      return { label, className: 'bg-[var(--surface-muted)] text-[var(--muted)]' };
  }
}
