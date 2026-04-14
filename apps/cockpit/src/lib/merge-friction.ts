import type { MergeFrictionGrid } from '@gitflow/shared';

interface MergeFrictionPr {
  created_at: Date;
  merged_at: Date | null;
}

export function buildMergeFrictionHeatmap(prs: MergeFrictionPr[]): MergeFrictionGrid {
  const frictionData = Array.from({ length: 7 }, () => Array.from({ length: 3 }, () => 0));
  const frictionCounts = Array.from({ length: 7 }, () => Array.from({ length: 3 }, () => 0));

  for (const pr of prs) {
    if (!pr.merged_at) continue;

    const dayOfWeek = (pr.created_at.getDay() + 6) % 7; // Monday=0, Sunday=6
    const hour = pr.created_at.getHours();

    let timeOfDay = 0; // Morning
    if (hour >= 12 && hour < 17) {
      timeOfDay = 1; // Afternoon
    } else if (hour >= 17) {
      timeOfDay = 2; // Evening
    }

    const delayHours = (pr.merged_at.getTime() - pr.created_at.getTime()) / (1000 * 3600);

    frictionData[dayOfWeek][timeOfDay] += delayHours;
    frictionCounts[dayOfWeek][timeOfDay] += 1;
  }

  return frictionData.map((row, dayIndex) =>
    row.map((totalHours, timeIndex) => {
      const count = frictionCounts[dayIndex][timeIndex];
      return count > 0 ? Math.round(totalHours / count) : 0;
    })
  );
}
