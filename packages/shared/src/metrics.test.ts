import { describe, expect, it } from 'vitest';
import { calculateLatencyMins, isIdlePR } from './metrics';

describe('calculateLatencyMins', () => {
  it('returns the minute difference for valid dates', () => {
    const result = calculateLatencyMins(
      '2026-04-01T00:00:00.000Z',
      '2026-04-01T00:45:30.000Z'
    );

    expect(result).toBe(45);
  });

  it('never returns negative values', () => {
    const result = calculateLatencyMins(
      '2026-04-01T01:00:00.000Z',
      '2026-04-01T00:00:00.000Z'
    );

    expect(result).toBe(0);
  });
});

describe('isIdlePR', () => {
  it('returns false when PR already has reviews', () => {
    expect(isIdlePR('2026-04-01T00:00:00.000Z', true)).toBe(false);
  });

  it('returns true when PR is older than 48 hours with no reviews', () => {
    const now = Date.now();
    const threeDaysAgo = new Date(now - 72 * 60 * 60 * 1000).toISOString();

    expect(isIdlePR(threeDaysAgo, false)).toBe(true);
  });
});
