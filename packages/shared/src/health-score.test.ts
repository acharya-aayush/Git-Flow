import { describe, expect, it } from 'vitest';
import { calculateHealthScore } from './health-score';

describe('calculateHealthScore', () => {
  it('returns A grade when review latency is under 4 hours', () => {
    const result = calculateHealthScore({
      createdAt: new Date('2026-04-01T00:00:00.000Z'),
      firstReviewAt: new Date('2026-04-01T03:30:00.000Z'),
    });

    expect(result).toEqual({ grade: 'A', latencyHours: 3.5 });
  });

  it('returns F grade when review latency is at least 24 hours', () => {
    const result = calculateHealthScore({
      createdAt: new Date('2026-04-01T00:00:00.000Z'),
      firstReviewAt: new Date('2026-04-02T01:00:00.000Z'),
    });

    expect(result).toEqual({ grade: 'F', latencyHours: 25 });
  });

  it('uses merge time when first review is not available', () => {
    const result = calculateHealthScore({
      createdAt: new Date('2026-04-01T00:00:00.000Z'),
      mergedAt: new Date('2026-04-01T10:00:00.000Z'),
    });

    expect(result).toEqual({ grade: 'B', latencyHours: 10 });
  });
});
