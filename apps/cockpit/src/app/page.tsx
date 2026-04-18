import { DoraMetricsGrid } from '@/components/dashboard/DoraMetricsGrid';
import { PRLifecycleChart } from '@/components/dashboard/PRLifecycleChart';
import { Card } from '@tremor/react';
import { prisma } from '@/lib/prisma';
import {
  buildLifecycleChartData,
  buildOverviewMetrics,
} from '@/lib/overview-metrics';
import {
  getWindowStart,
  parseDashboardWindow,
  type DashboardWindow,
} from '@/lib/dashboard-window';

export const dynamic = 'force-dynamic';

type OverviewSearchParams = {
  repo?: string;
  window?: DashboardWindow;
};

export default async function ExecutiveOverview({
  searchParams,
}: {
  searchParams: Promise<OverviewSearchParams>;
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

  const [mergedPrs, openCount, repoCount, reviewCount] = await Promise.all([
    prisma.pullRequest.findMany({
      where: {
        merged_at: { not: null },
        ...(windowStart ? { merged_at: { gte: windowStart } } : {}),
        repo_id: scopedRepoId,
      },
      select: {
        number: true,
        title: true,
        merged_at: true,
        merge_time_mins: true,
        lifecycle_mins: true,
        review_latency_mins: true,
        repository: { select: { full_name: true } },
      },
      orderBy: { merged_at: 'desc' },
      take: 120,
    }),
    prisma.pullRequest.count({
      where: {
        state: 'open',
        ...(windowStart ? { created_at: { gte: windowStart } } : {}),
        repo_id: scopedRepoId,
      },
    }),
    scopedRepoId
      ? Promise.resolve(1)
      : prisma.repository.count(),
    prisma.review.count({
      where: {
        ...(windowStart ? { submitted_at: { gte: windowStart } } : {}),
        pull_request: scopedRepoId ? { is: { repo_id: scopedRepoId } } : undefined,
      },
    }),
  ]);

  const totalMerged = mergedPrs.length;
  const chartdata = buildLifecycleChartData(mergedPrs);

  const recentMerges = mergedPrs.slice(0, 10);
  const metrics = buildOverviewMetrics(mergedPrs);

  return (
    <div className="space-y-5 py-2">
      <section className="panel overflow-hidden">
        <div className="panel-body flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Signal Board</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-100">Delivery Performance Overview</h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-300/85">Live operational view of merge velocity, review response time, and pull request throughput.</p>
            <p className="mt-2 inline-flex rounded-md border border-border bg-[#0d1117] px-2 py-1 text-xs text-slate-300">
              Scope: {repoFilter || 'All repositories'}
            </p>
            <p className="ml-2 mt-2 inline-flex rounded-md border border-border bg-[#0d1117] px-2 py-1 text-xs text-slate-300">
              Window: {selectedWindow}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-md border border-border bg-[#0d1117] px-3 py-2">
              <p className="text-[11px] text-slate-400">Repos</p>
              <p className="metric-mono mt-1 text-lg font-semibold text-slate-100">{repoCount}</p>
            </div>
            <div className="rounded-md border border-border bg-[#0d1117] px-3 py-2">
              <p className="text-[11px] text-slate-400">Open PRs</p>
              <p className="metric-mono mt-1 text-lg font-semibold text-slate-100">{openCount}</p>
            </div>
            <div className="rounded-md border border-border bg-[#0d1117] px-3 py-2">
              <p className="text-[11px] text-slate-400">Reviews</p>
              <p className="metric-mono mt-1 text-lg font-semibold text-slate-100">{reviewCount}</p>
            </div>
            <div className="rounded-md border border-border bg-[#0d1117] px-3 py-2">
              <p className="text-[11px] text-slate-400">Merged</p>
              <p className="metric-mono mt-1 text-lg font-semibold text-slate-100">{totalMerged}</p>
            </div>
          </div>
        </div>
      </section>

      <DoraMetricsGrid metrics={metrics} />

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="xl:col-span-8">
          <PRLifecycleChart chartdata={chartdata} />
        </div>

        <Card className="panel xl:col-span-4 border-none bg-transparent p-0">
          <div className="panel-header">
            <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-100">Recent Merges</h3>
            <p className="mt-1 text-xs text-slate-400">Latest merged pull requests in descending order</p>
          </div>

          <div className="panel-body max-h-[360px] overflow-y-auto">
            <ul className="space-y-2">
              {recentMerges.length === 0 ? (
                <li className="rounded-md border border-border bg-[#0d1117] px-4 py-5 text-center text-sm text-slate-400">
                  No merged pull request records found.
                </li>
              ) : (
                recentMerges.map((pr) => (
                  <li key={`${pr.repository.full_name}-${pr.number}`} className="rounded-md border border-border bg-[#0d1117] px-3 py-2">
                    <p className="truncate text-sm font-semibold text-slate-100">
                      {pr.repository.full_name} #{pr.number}
                    </p>
                    <p className="mt-1 metric-mono text-xs text-slate-300/80">
                      merged {pr.merged_at ? new Date(pr.merged_at).toLocaleDateString() : '-'}
                    </p>
                  </li>
                ))
              )}
            </ul>
          </div>
        </Card>
      </section>
    </div>
  );
}
