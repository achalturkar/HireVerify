import { describe, expect, it } from 'vitest';
import { formatBGVTat, getBGVTatDays } from './bgv-tat';

describe('BGV turnaround time', () => {
  const startedAt = '2026-11-02T00:00:00.000Z';

  it('measures active cases in business days until now', () => {
    expect(getBGVTatDays(startedAt, null, Date.parse('2026-11-04T12:00:00.000Z'))).toBe(2.5);
  });

  it('stops completed cases at their completion time', () => {
    expect(formatBGVTat(startedAt, '2026-11-03T00:00:00.000Z', Date.parse('2026-11-05T00:00:00.000Z'))).toBe('1.0 business days');
  });

  it('does not count weekends', () => {
    expect(getBGVTatDays(startedAt, '2026-11-09T00:00:00.000Z')).toBe(5);
  });

  it('returns a placeholder for missing or invalid dates', () => {
    expect(formatBGVTat(null, null)).toBe('—');
    expect(getBGVTatDays('not-a-date', null)).toBeNull();
  });
});
