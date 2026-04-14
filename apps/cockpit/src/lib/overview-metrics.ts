import type { DoraMetricCard, LifecycleChartDatum } from '@gitflow/shared';

export interface MergedPrSummary {
  number: number;
  title: string;
  merged_at: Date | null;
  merge_time_mins: number | null;
  lifecycle_mins: number | null;
  review_latency_mins: number | null;
  repository: {
    full_name: string;
  };
}

function isPositiveNumber(value: number | null): value is number {
  return typeof value === 'number' && value > 0;
}

function isNonNegativeNumber(value: number | null): value is number {
  return typeof value === 'number' && value >= 0;
}

function toAverageHours(values: number[]): number | null {
  if (!values.length) {
    return null;
  }

  const total = values.reduce((acc, value) => acc + value, 0);
  return total / values.length / 60;
}

export function buildLifecycleChartData(mergedPrs: MergedPrSummary[]): LifecycleChartDatum[] {
  const buckets: Record<string, { totalHours: number; count: number }> = {};

  for (const pr of mergedPrs) {
    if (!pr.merged_at || !isPositiveNumber(pr.lifecycle_mins)) {
      continue;
    }

    const dateStr = pr.merged_at.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });

    if (!buckets[dateStr]) {
      buckets[dateStr] = { totalHours: 0, count: 0 };
    }

    buckets[dateStr].totalHours += pr.lifecycle_mins / 60;
    buckets[dateStr].count += 1;
  }

  return Object.keys(buckets)
    .map((date) => ({
      date,
      'Avg Lifecycle': Number((buckets[date].totalHours / buckets[date].count).toFixed(1)),
    }))
    .reverse();
}

export function buildOverviewMetrics(mergedPrs: MergedPrSummary[]): DoraMetricCard[] {
  const totalMerged = mergedPrs.length;

  const mergeTimes = mergedPrs
    .map((pr) => pr.merge_time_mins)
    .filter(isPositiveNumber);

  const lifecycleTimes = mergedPrs
    .map((pr) => pr.lifecycle_mins)
    .filter(isPositiveNumber);

  const firstReviewTimes = mergedPrs
    .map((pr) => pr.review_latency_mins)
    .filter(isNonNegativeNumber);

  const avgMergeHours = toAverageHours(mergeTimes);
  const avgLifecycleHours = toAverageHours(lifecycleTimes);
  const avgFirstReviewHours = toAverageHours(firstReviewTimes);

  return [
    {
      title: 'Merged Pull Requests',
      metric: totalMerged ? `${totalMerged}` : '--',
      delta: 'Most recent synced and live events',
    },
    {
      title: 'Avg Merge Time',
      metric: avgMergeHours !== null ? `${avgMergeHours.toFixed(1)} hrs` : '--',
      delta: 'From open to merge',
    },
    {
      title: 'Avg Lifecycle Time',
      metric: avgLifecycleHours !== null ? `${avgLifecycleHours.toFixed(1)} hrs` : '--',
      delta: 'From open to close/merge',
    },
    {
      title: 'Avg First Review',
      metric: avgFirstReviewHours !== null ? `${avgFirstReviewHours.toFixed(1)} hrs` : '--',
      delta: 'Time until first review',
    },
  ];
}
