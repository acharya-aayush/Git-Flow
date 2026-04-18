import { PrismaClient } from '@gitflow/db';
import { Card, Metric, Text, Title } from '@tremor/react';
import { getWindowStart, parseDashboardWindow, type DashboardWindow } from '@/lib/dashboard-window';

export const dynamic = 'force-dynamic';

const prisma = new PrismaClient();

type IssuesSearchParams = {
  repo?: string;
  window?: DashboardWindow;
};

export default async function IssuesPage({
  searchParams,
}: {
  searchParams: Promise<IssuesSearchParams>;
}) {
  const resolvedSearchParams = await searchParams;
  const repoFilter =
    resolvedSearchParams.repo && resolvedSearchParams.repo !== 'all'
      ? resolvedSearchParams.repo
      : undefined;
  const selectedWindow = parseDashboardWindow(resolvedSearchParams.window);
  const windowStart = getWindowStart(selectedWindow, new Date());

  const issues = await prisma.issue.findMany({
    where: {
      ...(windowStart ? { created_at: { gte: windowStart } } : {}),
      repository: repoFilter ? { full_name: repoFilter } : undefined,
    },
    include: {
      repository: { select: { full_name: true } },
    },
    orderBy: { updated_at: 'desc' },
    take: 500,
  });

  const openCount = issues.filter((issue) => issue.state === 'open').length;
  const closed = issues.filter((issue) => issue.state === 'closed' && typeof issue.resolution_mins === 'number');
  const avgResolutionHours = closed.length
    ? (closed.reduce((sum, issue) => sum + (issue.resolution_mins || 0), 0) / closed.length / 60).toFixed(1)
    : '--';

  const labelCounts = new Map<string, number>();
  for (const issue of issues) {
    const labels = Array.isArray(issue.labels) ? issue.labels : [];
    for (const label of labels) {
      if (typeof label !== 'string') continue;
      labelCounts.set(label, (labelCounts.get(label) || 0) + 1);
    }
  }

  const topLabels = Array.from(labelCounts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return (
    <div className="space-y-5 py-2">
      <section className="panel">
        <div className="panel-body">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Issue Ops</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-100">Issue Resolution Analyzer</h2>
          <p className="mt-2 text-sm text-slate-300/85">
            Resolution latency, backlog pressure, and label concentration across repository scope.
          </p>
          <p className="mt-2 inline-flex rounded-md border border-border bg-[#0d1117] px-2 py-1 text-xs text-slate-300">
            Window: {selectedWindow}
          </p>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="panel border-none bg-transparent p-0">
          <div className="panel-body">
            <Text className="text-slate-400">Issues In Scope</Text>
            <Metric className="metric-mono mt-2 text-slate-100">{issues.length}</Metric>
          </div>
        </Card>
        <Card className="panel border-none bg-transparent p-0">
          <div className="panel-body">
            <Text className="text-slate-400">Open Backlog</Text>
            <Metric className="metric-mono mt-2 text-amber-100">{openCount}</Metric>
          </div>
        </Card>
        <Card className="panel border-none bg-transparent p-0">
          <div className="panel-body">
            <Text className="text-slate-400">Avg Resolution Time</Text>
            <Metric className="metric-mono mt-2 text-cyan-100">{avgResolutionHours} hrs</Metric>
          </div>
        </Card>
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <Card className="panel xl:col-span-4 border-none bg-transparent p-0">
          <div className="panel-header">
            <Title className="text-slate-100">Top Labels</Title>
          </div>
          <div className="panel-body space-y-2">
            {topLabels.length === 0 ? (
              <Text className="text-slate-400">No labels in this scope.</Text>
            ) : (
              topLabels.map((item) => (
                <div key={item.label} className="flex items-center justify-between rounded border border-border/60 px-2 py-1 text-xs">
                  <span className="text-slate-200">{item.label}</span>
                  <span className="metric-mono text-slate-400">{item.count}</span>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card className="panel xl:col-span-8 border-none bg-transparent p-0">
          <div className="panel-header">
            <Title className="text-slate-100">Latest Issues</Title>
          </div>
          <div className="panel-body overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-border/70 text-left text-xs uppercase tracking-wider text-slate-400">
                  <th className="px-4 py-2">Repo</th>
                  <th className="px-4 py-2">Issue</th>
                  <th className="px-4 py-2">State</th>
                  <th className="px-4 py-2">Author</th>
                  <th className="px-4 py-2">Resolution</th>
                </tr>
              </thead>
              <tbody>
                {issues.map((issue) => (
                  <tr key={`${issue.repo_id}-${issue.number}`} className="border-b border-border/40 last:border-0">
                    <td className="px-4 py-2 text-slate-300">{issue.repository.full_name}</td>
                    <td className="px-4 py-2 text-slate-100">#{issue.number} · {issue.title}</td>
                    <td className="px-4 py-2">
                      <span className={`rounded-full px-2 py-1 text-xs ${issue.state === 'open' ? 'bg-amber-500/20 text-amber-200' : 'bg-emerald-500/20 text-emerald-200'}`}>
                        {issue.state}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-slate-300">{issue.author_login || 'unknown'}</td>
                    <td className="px-4 py-2 metric-mono text-slate-300">
                      {typeof issue.resolution_mins === 'number' ? `${(issue.resolution_mins / 60).toFixed(1)}h` : '--'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </section>
    </div>
  );
}
