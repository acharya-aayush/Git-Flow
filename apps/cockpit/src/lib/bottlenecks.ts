import type { StalePrTableRow } from '@gitflow/shared';

interface StalePrInput {
  number: number;
  created_at: Date;
  author: {
    login: string;
  } | null;
}

export function toStalePrRows(prs: StalePrInput[], now = new Date()): StalePrTableRow[] {
  return prs.map((pr) => {
    const daysOpen = Math.floor((now.getTime() - pr.created_at.getTime()) / (1000 * 3600 * 24));

    return {
      prm: `#${pr.number}`,
      author: pr.author?.login || 'Unknown',
      daysOpen,
      status: daysOpen > 5 ? 'Critical' : 'Warning',
    };
  });
}

export function getStaleCounts(stalePrs: StalePrTableRow[]): {
  criticalCount: number;
  warningCount: number;
} {
  const criticalCount = stalePrs.filter((pr) => pr.daysOpen > 5).length;
  const warningCount = stalePrs.length - criticalCount;

  return { criticalCount, warningCount };
}
