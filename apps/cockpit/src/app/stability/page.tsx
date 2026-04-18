import { PrismaClient } from '@gitflow/db';
import { Card, Metric, Text, Title } from '@tremor/react';
import { getWindowStart, parseDashboardWindow, type DashboardWindow } from '@/lib/dashboard-window';

export const dynamic = 'force-dynamic';

const prisma = new PrismaClient();

type StabilitySearchParams = {
  repo?: string;
  window?: DashboardWindow;
};

export default async function StabilityPage({
  searchParams,
}: {
  searchParams: Promise<StabilitySearchParams>;
}) {
  const resolvedSearchParams = await searchParams;
  const repoFilter =
    resolvedSearchParams.repo && resolvedSearchParams.repo !== 'all'
      ? resolvedSearchParams.repo
      : undefined;
  const selectedWindow = parseDashboardWindow(resolvedSearchParams.window);
  const windowStart = getWindowStart(selectedWindow, new Date());

  const repositories = await prisma.repository.findMany({
    where: repoFilter ? { full_name: repoFilter } : undefined,
    select: {
      id: true,
      full_name: true,
    },
    orderBy: { full_name: 'asc' },
  });

  const rows = await Promise.all(
    repositories.map(async (repo) => {
      const [commitCount, openPrCount, openIssueCount, activeContributors] = await Promise.all([
        prisma.commit.count({
          where: {
            repo_id: repo.id,
            ...(windowStart ? { committed_at: { gte: windowStart } } : {}),
          },
        }),
        prisma.pullRequest.count({
          where: {
            repo_id: repo.id,
            state: 'open',
            ...(windowStart ? { created_at: { gte: windowStart } } : {}),
          },
        }),
        prisma.issue.count({
          where: {
            repo_id: repo.id,
            state: 'open',
            ...(windowStart ? { created_at: { gte: windowStart } } : {}),
          },
        }),
        prisma.commit.findMany({
          where: {
            repo_id: repo.id,
            ...(windowStart ? { committed_at: { gte: windowStart } } : {}),
            author_login: { not: null },
          },
          select: { author_login: true },
          distinct: ['author_login'],
        }).then((items) => items.length),
      ]);

      const stabilityScore = Math.max(
        0,
        Math.min(100, Math.round(commitCount * 1.3 + activeContributors * 4 - openPrCount * 1.5 - openIssueCount * 1.2))
      );

      return {
        repo: repo.full_name,
        commitCount,
        openPrCount,
        openIssueCount,
        activeContributors,
        stabilityScore,
      };
    })
  );

  const avgScore = rows.length
    ? Math.round(rows.reduce((sum, row) => sum + row.stabilityScore, 0) / rows.length)
    : 0;

  return (
    <div className="space-y-5 py-2">
      <section className="panel">
        <div className="panel-body">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Repo Health</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-100">Repository Stability Tracker</h2>
          <p className="mt-2 text-sm text-slate-300/85">
            Cross-repo activity score using commit velocity, contributor spread, and open backlog pressure.
          </p>
          <p className="mt-2 inline-flex rounded-md border border-border bg-[#0d1117] px-2 py-1 text-xs text-slate-300">
            Window: {selectedWindow}
          </p>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="panel border-none bg-transparent p-0">
          <div className="panel-body">
            <Text className="text-slate-400">Repositories Scoped</Text>
            <Metric className="metric-mono mt-2 text-slate-100">{rows.length}</Metric>
          </div>
        </Card>
        <Card className="panel border-none bg-transparent p-0">
          <div className="panel-body">
            <Text className="text-slate-400">Average Stability Score</Text>
            <Metric className="metric-mono mt-2 text-cyan-100">{avgScore}</Metric>
          </div>
        </Card>
        <Card className="panel border-none bg-transparent p-0">
          <div className="panel-body">
            <Text className="text-slate-400">Total Commits In Window</Text>
            <Metric className="metric-mono mt-2 text-slate-100">
              {rows.reduce((sum, row) => sum + row.commitCount, 0)}
            </Metric>
          </div>
        </Card>
      </section>

      <Card className="panel border-none bg-transparent p-0">
        <div className="panel-header">
          <Title className="text-slate-100">Repository Stability Breakdown</Title>
        </div>
        <div className="panel-body overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-border/70 text-left text-xs uppercase tracking-wider text-slate-400">
                <th className="px-4 py-2">Repository</th>
                <th className="px-4 py-2">Score</th>
                <th className="px-4 py-2">Commits</th>
                <th className="px-4 py-2">Active Contributors</th>
                <th className="px-4 py-2">Open PRs</th>
                <th className="px-4 py-2">Open Issues</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.repo} className="border-b border-border/40 last:border-0">
                  <td className="px-4 py-2 text-slate-100">{row.repo}</td>
                  <td className="px-4 py-2">
                    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${row.stabilityScore >= 70 ? 'bg-emerald-500/20 text-emerald-200' : row.stabilityScore >= 40 ? 'bg-amber-500/20 text-amber-200' : 'bg-rose-500/20 text-rose-200'}`}>
                      {row.stabilityScore}
                    </span>
                  </td>
                  <td className="px-4 py-2 metric-mono text-slate-100">{row.commitCount}</td>
                  <td className="px-4 py-2 metric-mono text-slate-100">{row.activeContributors}</td>
                  <td className="px-4 py-2 metric-mono text-slate-100">{row.openPrCount}</td>
                  <td className="px-4 py-2 metric-mono text-slate-100">{row.openIssueCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
