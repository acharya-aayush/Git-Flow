import { HealthScoreResult, PRTimestamps } from './types';

/**
 * Calculates the health score of a Pull Request based on its review latency.
 * Latency is defined as the time from PR creation to the first review.
 * 
 * Score definitions (hours):
 * A: < 4h
 * B: < 12h
 * C: < 24h
 * F: >= 24h
 */
export function calculateHealthScore(timestamps: PRTimestamps): HealthScoreResult | null {
  if (!timestamps.createdAt) return null;

  // Use current time if no explicit review/merge/close time to calculate ongoing latency
  const targetTime = timestamps.firstReviewAt || timestamps.mergedAt || timestamps.closedAt;
  
  const end = targetTime ? targetTime.getTime() : Date.now();
  const start = timestamps.createdAt.getTime();
  
  const diffMs = end - start;
  const hours = diffMs / (1000 * 60 * 60);

  let grade: 'A' | 'B' | 'C' | 'F' = 'F';

  if (hours < 4) {
    grade = 'A';
  } else if (hours < 12) {
    grade = 'B';
  } else if (hours < 24) {
    grade = 'C';
  } else {
    grade = 'F';
  }

  return { grade, latencyHours: Number(hours.toFixed(2)) };
}
