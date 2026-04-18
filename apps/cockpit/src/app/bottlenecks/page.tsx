import { Title, Text, Card, Metric } from '@tremor/react';
import { BottleneckTable } from '@/components/dashboard/BottleneckTable';       
import { ReviewsBarChart } from '@/components/dashboard/ReviewsBarChart';       
import { MergeFrictionHeatmap } from '@/components/dashboard/MergeFrictionHeatmap';
import { prisma } from '@/lib/prisma';
import {
  getWindowStart,
  parseDashboardWindow,
  type DashboardWindow,
} from '@/lib/dashboard-window';
import { buildMergeFrictionHeatmap } from '@/lib/merge-friction';
import { getStaleCounts, toStalePrRows } from '@/lib/bottlenecks';
import type { ReviewsBarDatum, StalePrTableRow } from '@gitflow/shared';

export const dynamic = 'force-dynamic';

type BottlenecksSearchParams = {
  repo?: string;
  window?: DashboardWindow;
};

export default async function BottlenecksPage({
  searchParams,
}: {
  searchParams: Promise<BottlenecksSearchParams>;
}) {
  const resolvedSearchParams = await searchParams;
  const repoFilter =
    resolvedSearchParams.repo && resolvedSearchParams.repo !== 'all'
      ? resolvedSearchParams.repo
      : undefined;
  const selectedWindow = parseDashboardWindow(resolvedSearchParams.window);
  const windowStart = getWindowStart(selectedWindow, new Date());

  const scopedRepo = repoFilter
    ? await prisma.repository.findFirst({ where: { full_name: repoFilter }, select: { id: true } })
    : null;
  const scopedRepoId = scopedRepo?.id;

  const twoDaysAgo = new Date();
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

  const stalePrsData = await prisma.pullRequest.findMany({
    where: { 
      state: 'open', 
      created_at: { lt: twoDaysAgo }, 
      reviews: { none: {} },
      repo_id: scopedRepoId,
    },
    include: { author: true },
    orderBy: { created_at: 'asc' },
    take: 10
  });

  const stalePrs: StalePrTableRow[] = toStalePrRows(stalePrsData);

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const reviewWindowStart = windowStart || thirtyDaysAgo;

  const recentReviewGroups = await prisma.review.groupBy({
    by: ['reviewer_id'],
    where: {
      submitted_at: { gte: reviewWindowStart },
      pull_request: scopedRepoId ? { is: { repo_id: scopedRepoId } } : undefined,
    },
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
    take: 8
  });

  const allTimeReviewGroups = recentReviewGroups.length === 0
    ? await prisma.review.groupBy({
        by: ['reviewer_id'],
        where: {
          pull_request: scopedRepoId ? { is: { repo_id: scopedRepoId } } : undefined,
        },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 8,
      })
    : recentReviewGroups;

  const reviewerIds = allTimeReviewGroups.map((group) => group.reviewer_id);
  const reviewers = reviewerIds.length
    ? await prisma.user.findMany({
        where: { id: { in: reviewerIds } },
        select: { id: true, login: true },
      })
    : [];

  const reviewerMap = new Map(reviewers.map((reviewer) => [reviewer.id, reviewer.login]));

  const chartdata: ReviewsBarDatum[] = allTimeReviewGroups
    .map((group) => {
      const login = reviewerMap.get(group.reviewer_id);
      if (!login) {
        return null;
      }

      return { name: login, Reviews: group._count.id };
    })
    .filter((item): item is ReviewsBarDatum => item !== null);

  // Merge Friction Calculation
  const mergedPrsData = await prisma.pullRequest.findMany({
    where: {
      merged_at: { not: null },
      created_at: { gte: reviewWindowStart },
      repo_id: scopedRepoId,
    },
    select: { created_at: true, merged_at: true },
  });

  const heatmapData = buildMergeFrictionHeatmap(mergedPrsData);

  const { criticalCount, warningCount } = getStaleCounts(stalePrs);

  return (
    <div className="space-y-5 py-2">
      <section className="panel">
        <div className="panel-body">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Risk Lens</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-100">Bottleneck Detection</h2>
          <p className="mt-2 text-sm text-slate-300/85">Surface stale pull requests, overloaded reviewers, and high-friction merge windows.</p>
          <p className="mt-2 inline-flex rounded-md border border-border bg-[#0d1117] px-2 py-1 text-xs text-slate-300">
            Scope: {repoFilter || 'All repositories'}
          </p>
          <p className="mt-2 ml-2 inline-flex rounded-md border border-border bg-[#0d1117] px-2 py-1 text-xs text-slate-300">
            Window: {selectedWindow}
          </p>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="panel border-none bg-transparent p-0">
          <div className="panel-body">
            <p className="text-xs uppercase tracking-wide text-slate-400">Stale PRs</p>
            <Metric className="metric-mono mt-2 text-slate-100">{stalePrs.length}</Metric>
          </div>
        </Card>
        <Card className="panel border-none bg-transparent p-0">
          <div className="panel-body">
            <p className="text-xs uppercase tracking-wide text-slate-400">Critical (&gt;5d)</p>
            <Metric className="metric-mono mt-2 text-red-100">{criticalCount}</Metric>
          </div>
        </Card>
        <Card className="panel border-none bg-transparent p-0">
          <div className="panel-body">
            <p className="text-xs uppercase tracking-wide text-slate-400">Warning Band</p>
            <Metric className="metric-mono mt-2 text-amber-100">{warningCount}</Metric>
          </div>
        </Card>
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="xl:col-span-7">
          <BottleneckTable prs={stalePrs} />
        </div>
        <div className="xl:col-span-5">
          <ReviewsBarChart chartdata={chartdata} />
        </div>
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="xl:col-span-8">
          <MergeFrictionHeatmap data={heatmapData} />
        </div>
        <Card className="panel xl:col-span-4 border-none bg-transparent p-0">
          <div className="panel-header">
            <Title className="text-slate-100">Summary</Title>
          </div>
          <div className="panel-body space-y-4">
            <div className="flex items-end justify-between border-b border-border/60 pb-3">
              <Text className="text-slate-400">No-review PRs (&gt;48h)</Text>
              <Metric className="metric-mono text-slate-100">{stalePrs.length}</Metric>
            </div>
            <div className="flex items-end justify-between border-b border-border/60 pb-3">
              <Text className="text-slate-400">Critical stale (&gt;5d)</Text>
              <Metric className="metric-mono text-red-100">{criticalCount}</Metric>
            </div>
            <div className="flex items-end justify-between">
              <Text className="text-slate-400">Active reviewers</Text>
              <Metric className="metric-mono text-cyan-100">{chartdata.length}</Metric>
            </div>
          </div>
        </Card>
      </section>
    </div>
  );
}
