/**
 * Calculates latency in minutes between two dates.
 */
export function calculateLatencyMins(start: Date | string, end: Date | string): number {
  const diffMs = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60)));
}

/**
 * Checks if a PR should be flagged as "Idle".
 * A PR is idle if it has been open for > 48 hours without any reviews.
 */
export function isIdlePR(createdAt: Date | string, hasReviews: boolean): boolean {
  if (hasReviews) return false;
  
  const diffMs = Date.now() - new Date(createdAt).getTime();
  const hours = diffMs / (1000 * 60 * 60);
  
  return hours > 48;
}
