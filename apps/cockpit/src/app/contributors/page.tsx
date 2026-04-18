import { PrismaClient } from '@gitflow/db';
import { Card, Metric, Text, Title } from '@tremor/react';
import { getWindowStart, parseDashboardWindow, type DashboardWindow } from '@/lib/dashboard-window';

export const dynamic = 'force-dynamic';

const prisma = new PrismaClient();

type ContributorsSearchParams = {
  repo?: string;
  window?: DashboardWindow;
};

type ContributorStats = {
  login: string;
  commits: number;
  prs: number;
  reviews: number;
};

export default async function ContributorsPage({
  searchParams,
}: {
  searchParams: Promise<ContributorsSearchParams>;
}) {
  const resolvedSearchParams = await searchParams;
  const repoFilter =
    resolvedSearchParams.repo && resolvedSearchParams.repo !== 'all'
      ? resolvedSearchParams.repo
      : undefined;
  const selectedWindow = parseDashboardWindow(resolvedSearchParams.window);
  const windowStart = getWindowStart(selectedWindow, new Date());

  const [commits, prs] = await Promise.all([
    prisma.commit.findMany({
      where: {
        ...(windowStart ? { committed_at: { gte: windowStart } } : {}),
        repository: repoFilter ? { full_name: repoFilter } : undefined,
      },
      select: {
        author_login: true,
      },
      take: 4000,
      orderBy: { committed_at: 'desc' },
    }),
    prisma.pullRequest.findMany({
      where: {
        ...(windowStart ? { created_at: { gte: windowStart } } : {}),
        repository: repoFilter ? { full_name: repoFilter } : undefined,
      },
      include: {
        author: { select: { login: true } },
        reviews: {
          include: {
            reviewer: { select: { login: true } },
          },
        },
      },
      take: 2000,
      orderBy: { created_at: 'desc' },
    }),
  ]);

  const contributors = new Map<string, ContributorStats>();

  const ensure = (login: string) => {
    if (!contributors.has(login)) {
      contributors.set(login, { login, commits: 0, prs: 0, reviews: 0 });
    }
    return contributors.get(login)!;
  };

  for (const commit of commits) {
    if (!commit.author_login) continue;
    ensure(commit.author_login).commits += 1;
  }

  const edgeMap = new Map<string, number>();

  for (const pr of prs) {
    const author = pr.author?.login;
    if (author) {
      ensure(author).prs += 1;
    }

    for (const review of pr.reviews) {
      const reviewer = review.reviewer.login;
      ensure(reviewer).reviews += 1;

      if (author && author !== reviewer) {
        const edge = `${author}=>${reviewer}`;
        edgeMap.set(edge, (edgeMap.get(edge) || 0) + 1);
      }
    }
  }

  const topContributors = Array.from(contributors.values())
    .sort((a, b) => (b.commits + b.prs + b.reviews) - (a.commits + a.prs + a.reviews))
    .slice(0, 25);

  const topEdges = Array.from(edgeMap.entries())
    .map(([key, count]) => {
      const [from, to] = key.split('=>');
      return { from, to, count };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  return (
    <div className="space-y-5 py-2">
      <section className="panel">
        <div className="panel-body">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Collaboration</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-100">Contributor Network Analyzer</h2>
          <p className="mt-2 text-sm text-slate-300/85">
            Tracks who commits, who opens PRs, and who reviews whose work across repositories.
          </p>
          <p className="mt-2 inline-flex rounded-md border border-border bg-[#0d1117] px-2 py-1 text-xs text-slate-300">
            Window: {selectedWindow}
          </p>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="panel border-none bg-transparent p-0">
          <div className="panel-body">
            <Text className="text-slate-400">Contributors</Text>
            <Metric className="metric-mono mt-2 text-slate-100">{contributors.size}</Metric>
          </div>
        </Card>
        <Card className="panel border-none bg-transparent p-0">
          <div className="panel-body">
            <Text className="text-slate-400">PR Relationships</Text>
            <Metric className="metric-mono mt-2 text-cyan-100">{edgeMap.size}</Metric>
          </div>
        </Card>
        <Card className="panel border-none bg-transparent p-0">
          <div className="panel-body">
            <Text className="text-slate-400">Commits Scanned</Text>
            <Metric className="metric-mono mt-2 text-slate-100">{commits.length}</Metric>
          </div>
        </Card>
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <Card className="panel xl:col-span-7 border-none bg-transparent p-0">
          <div className="panel-header">
            <Title className="text-slate-100">Top Contributors</Title>
          </div>
          <div className="panel-body overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-border/70 text-left text-xs uppercase tracking-wider text-slate-400">
                  <th className="px-4 py-2">Login</th>
                  <th className="px-4 py-2">Commits</th>
                  <th className="px-4 py-2">PRs</th>
                  <th className="px-4 py-2">Reviews</th>
                </tr>
              </thead>
              <tbody>
                {topContributors.map((row) => (
                  <tr key={row.login} className="border-b border-border/40 last:border-0">
                    <td className="px-4 py-2 text-slate-100">{row.login}</td>
                    <td className="px-4 py-2 metric-mono text-slate-300">{row.commits}</td>
                    <td className="px-4 py-2 metric-mono text-slate-300">{row.prs}</td>
                    <td className="px-4 py-2 metric-mono text-slate-300">{row.reviews}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="panel xl:col-span-5 border-none bg-transparent p-0">
          <div className="panel-header">
            <Title className="text-slate-100">Collaboration Edges</Title>
          </div>
          <div className="panel-body space-y-2">
            {topEdges.length === 0 ? (
              <Text className="text-slate-400">No review collaboration edges found in this scope.</Text>
            ) : (
              topEdges.map((edge) => (
                <div key={`${edge.from}-${edge.to}`} className="rounded border border-border/60 px-2 py-1 text-xs">
                  <div className="text-slate-200">
                    {edge.from}
                    {' -> '}
                    {edge.to}
                  </div>
                  <div className="metric-mono text-slate-400">{edge.count} review links</div>
                </div>
              ))
            )}
          </div>
        </Card>
      </section>
    </div>
  );
}
