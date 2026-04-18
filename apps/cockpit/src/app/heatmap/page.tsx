import { PrismaClient } from '@gitflow/db';
import { Card, Metric, Text, Title } from '@tremor/react';
import { getWindowStart, parseDashboardWindow, type DashboardWindow } from '@/lib/dashboard-window';

export const dynamic = 'force-dynamic';

const prisma = new PrismaClient();

type HeatmapSearchParams = {
  repo?: string;
  window?: DashboardWindow;
};

export default async function HeatmapPage({
  searchParams,
}: {
  searchParams: Promise<HeatmapSearchParams>;
}) {
  const resolvedSearchParams = await searchParams;
  const repoFilter =
    resolvedSearchParams.repo && resolvedSearchParams.repo !== 'all'
      ? resolvedSearchParams.repo
      : undefined;
  const selectedWindow = parseDashboardWindow(resolvedSearchParams.window);
  const windowStart = getWindowStart(selectedWindow, new Date());

  const commits = await prisma.commit.findMany({
    where: {
      ...(windowStart ? { committed_at: { gte: windowStart } } : {}),
      repository: repoFilter ? { full_name: repoFilter } : undefined,
    },
    include: {
      file_changes: true,
      repository: { select: { full_name: true } },
    },
    orderBy: { committed_at: 'desc' },
    take: 1200,
  });

  const fileMap = new Map<string, { touches: number; additions: number; deletions: number }>();

  for (const commit of commits) {
    for (const file of commit.file_changes) {
      const prev = fileMap.get(file.filename) || { touches: 0, additions: 0, deletions: 0 };
      fileMap.set(file.filename, {
        touches: prev.touches + 1,
        additions: prev.additions + file.additions,
        deletions: prev.deletions + file.deletions,
      });
    }
  }

  const rows = Array.from(fileMap.entries())
    .map(([filename, value]) => ({ filename, ...value }))
    .sort((a, b) => b.touches - a.touches)
    .slice(0, 60);

  const maxTouches = rows.length ? rows[0].touches : 0;

  return (
    <div className="space-y-5 py-2">
      <section className="panel">
        <div className="panel-body">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Code Churn</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-100">Git Commit Codebase Heatmap</h2>
          <p className="mt-2 text-sm text-slate-300/85">
            File touch intensity from commit-level change ingestion across scoped repositories.
          </p>
          <p className="mt-2 inline-flex rounded-md border border-border bg-[#0d1117] px-2 py-1 text-xs text-slate-300">
            Window: {selectedWindow}
          </p>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="panel border-none bg-transparent p-0">
          <div className="panel-body">
            <Text className="text-slate-400">Commits Scanned</Text>
            <Metric className="metric-mono mt-2 text-slate-100">{commits.length}</Metric>
          </div>
        </Card>
        <Card className="panel border-none bg-transparent p-0">
          <div className="panel-body">
            <Text className="text-slate-400">Unique Files</Text>
            <Metric className="metric-mono mt-2 text-cyan-100">{fileMap.size}</Metric>
          </div>
        </Card>
        <Card className="panel border-none bg-transparent p-0">
          <div className="panel-body">
            <Text className="text-slate-400">Top File Touches</Text>
            <Metric className="metric-mono mt-2 text-slate-100">{maxTouches}</Metric>
          </div>
        </Card>
      </section>

      <Card className="panel border-none bg-transparent p-0">
        <div className="panel-header">
          <Title className="text-slate-100">Most Changed Files</Title>
        </div>
        <div className="panel-body space-y-3">
          {rows.length === 0 ? (
            <div className="space-y-2">
              <Text className="text-slate-400">No commit file-change records available yet for this scope.</Text>
              <Text className="text-xs text-slate-500">
                If this repository has recent commits, confirm GitHub App push events are subscribed and the app has Contents read access.
              </Text>
            </div>
          ) : (
            rows.map((row) => (
              <div key={row.filename} className="rounded-lg border border-border/70 bg-[#0d1117] p-3">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="truncate pr-3 text-slate-200">{row.filename}</span>
                  <span className="metric-mono">{row.touches} touches</span>
                </div>
                <div className="mt-2 h-2 w-full rounded bg-slate-800">
                  <div
                    className="h-2 rounded bg-cyan-400"
                    style={{ width: `${Math.max(5, Math.round((row.touches / maxTouches) * 100))}%` }}
                  />
                </div>
                <div className="mt-2 flex gap-3 text-[11px] text-slate-400">
                  <span>+{row.additions} add</span>
                  <span>-{row.deletions} del</span>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
