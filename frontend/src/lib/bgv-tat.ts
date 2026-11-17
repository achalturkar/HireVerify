const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

export function getBGVTatDays(
  startedAt: string | null | undefined,
  completedAt: string | null | undefined,
  now = Date.now(),
): number | null {
  if (!startedAt) return null;

  const start = new Date(startedAt).getTime();
  const end = completedAt ? new Date(completedAt).getTime() : now;
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;

  let businessMilliseconds = 0;
  let dayStart = Date.UTC(
    new Date(start).getUTCFullYear(),
    new Date(start).getUTCMonth(),
    new Date(start).getUTCDate(),
  );

  while (dayStart < end) {
    const dayOfWeek = new Date(dayStart).getUTCDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      businessMilliseconds += Math.max(0, Math.min(end, dayStart + MILLISECONDS_PER_DAY) - Math.max(start, dayStart));
    }
    dayStart += MILLISECONDS_PER_DAY;
  }

  return businessMilliseconds / MILLISECONDS_PER_DAY;
}

export function formatBGVTat(
  startedAt: string | null | undefined,
  completedAt: string | null | undefined,
  now = Date.now(),
): string {
  const days = getBGVTatDays(startedAt, completedAt, now);
  return days === null ? '—' : `${days.toFixed(1)} business days`;
}
