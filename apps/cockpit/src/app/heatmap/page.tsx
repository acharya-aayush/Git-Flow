import { getWindowStart, parseDashboardWindow, type DashboardWindow } from '@/lib/dashboard-window';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

type HeatmapSearchParams = {
  repo?: string;
  window?: DashboardWindow;
};

function heatCellClass(touches: number, maxTouches: number): string {
  if (!maxTouches || !touches) {
    return 'border-border bg-[#0d1117] text-slate-500';
  }

  const ratio = touches / maxTouches;
  if (ratio >= 0.85) {
    return 'border-[#3fb950]/40 bg-[#3fb950]/35 text-[#f0f6fc]';
  }
  if (ratio >= 0.65) {
    return 'border-[#2ea043]/40 bg-[#2ea043]/28 text-[#f0f6fc]';
  }
  if (ratio >= 0.45) {
    return 'border-[#238636]/38 bg-[#238636]/24 text-[#e6edf3]';
  }
  if (ratio >= 0.25) {
    return 'border-[#0e4429]/40 bg-[#0e4429]/32 text-[#c9d1d9]';
  }
  return 'border-[#0e4429]/30 bg-[#0e4429]/20 text-[#8b949e]';
}

function compactFileLabel(path: string): string {
  const pieces = path.split('/');
  if (pieces.length === 1) {
    return path;
  }

  const last = pieces[pieces.length - 1] ?? path;
  const parent = pieces[pieces.length - 2] ?? '';
  return `${parent}/${last}`;
}

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
    .slice(0, 120);

  const maxTouches = rows.length ? rows[0].touches : 0;
  const hotspots = rows.slice(0, 16);
  const repoLabel = repoFilter ?? 'All repositories';

  return (
    <div className="space-y-4 py-2">
      <section className="panel">
        <div className="panel-body">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Code Churn</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-100">Commit Intensity Heatmap</h2>
          <p className="mt-2 text-sm text-slate-300/85">
            High-density view of file touch frequency from commit-level ingestion.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
            <span className="boneyard-bar px-2 py-1 text-slate-300">Window: {selectedWindow}</span>
            <span className="boneyard-bar px-2 py-1 text-slate-300">Scope: {repoLabel}</span>
            <span className="boneyard-bar px-2 py-1 text-slate-300">Cells: {rows.length}</span>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.6fr_1fr]">
        <div className="panel overflow-hidden">
          <div className="panel-header flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-100">File Heat Grid</h3>
            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              <span className="metric-mono text-slate-200">{commits.length}</span>
              commits
              <span className="text-slate-600">/</span>
              <span className="metric-mono text-slate-200">{fileMap.size}</span>
              files
            </div>
          </div>

          <div className="panel-body space-y-4">
            {rows.length === 0 ? (
              <div className="space-y-2 rounded-sm border border-border/70 bg-[#0f141b] p-4">
                <p className="text-sm text-slate-300">No commit file-change records available yet for this scope.</p>
                <p className="text-xs text-slate-500">
                  Confirm push events are subscribed and the app has Contents read access to this repository.
                </p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-6 gap-2 sm:grid-cols-8 lg:grid-cols-12">
                  {rows.map((row) => (
                    <div
                      key={row.filename}
                      title={`${row.filename} • ${row.touches} touches (+${row.additions} / -${row.deletions})`}
                      className={`relative aspect-square min-h-14 overflow-hidden rounded-sm border p-1 ${heatCellClass(row.touches, maxTouches)}`}
                    >
                      <span className="metric-mono text-[11px] font-semibold">{row.touches}</span>
                      <span className="absolute bottom-1 left-1 right-1 truncate text-[10px] opacity-90">
                        {compactFileLabel(row.filename)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.08em] text-slate-400">
                  <span className="text-slate-500">low</span>
                  <span className="h-2 w-7 rounded-sm border border-[#0e4429]/30 bg-[#0e4429]/20" />
                  <span className="h-2 w-7 rounded-sm border border-[#0e4429]/40 bg-[#0e4429]/32" />
                  <span className="h-2 w-7 rounded-sm border border-[#238636]/38 bg-[#238636]/24" />
                  <span className="h-2 w-7 rounded-sm border border-[#2ea043]/40 bg-[#2ea043]/28" />
                  <span className="h-2 w-7 rounded-sm border border-[#3fb950]/40 bg-[#3fb950]/35" />
                  <span className="text-slate-500">high</span>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="panel overflow-hidden">
          <div className="panel-header flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-100">Hotspots</h3>
            <span className="metric-mono text-xs text-slate-400">top {hotspots.length}</span>
          </div>

          <div className="divide-y divide-border/50">
            {hotspots.length === 0 ? (
              <div className="px-4 py-5 text-sm text-slate-400">No hotspots yet.</div>
            ) : (
              hotspots.map((row) => (
                <div key={row.filename} className="space-y-2 px-4 py-3">
                  <div className="flex items-start justify-between gap-3 text-xs">
                    <span className="line-clamp-2 text-slate-200">{row.filename}</span>
                    <span className="metric-mono shrink-0 text-slate-100">{row.touches}</span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-slate-400">
                    <span className="metric-mono text-emerald-300">+{row.additions}</span>
                    <span className="metric-mono text-rose-300">-{row.deletions}</span>
                    <div className="ml-auto h-1.5 w-20 overflow-hidden rounded-sm border border-border/70 bg-[#0f141b]">
                      <div
                        className="h-1.5 bg-[#2ea043]"
                        style={{ width: `${Math.max(5, Math.round((row.touches / maxTouches) * 100))}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
