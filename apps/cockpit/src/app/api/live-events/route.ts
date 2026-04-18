import { NextResponse } from 'next/server';
import type { Prisma } from '@gitflow/db';
import type { PRStreamEvent } from '@gitflow/shared';
import { prisma } from '@/lib/prisma';
import {
  getWindowStart,
  isValidRepoFullName,
  parseDashboardWindow,
} from '@/lib/dashboard-window';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const repo = searchParams.get('repo');
    const selectedWindow = parseDashboardWindow(searchParams.get('window'));
    const limitParam = Number(searchParams.get('limit') || 120);
    const limit = Number.isFinite(limitParam)
      ? Math.min(Math.max(limitParam, 1), 300)
      : 120;

    if (repo && repo !== 'all' && !isValidRepoFullName(repo)) {
      return NextResponse.json({ events: [], error: 'Invalid repository filter format' }, { status: 400 });
    }

    const since = getWindowStart(selectedWindow, new Date());

    const where: Prisma.PullRequestWhereInput = {};

    if (repo && repo !== 'all') {
      where.repository = { full_name: repo };
    }

    if (since) {
      where.OR = [
        { created_at: { gte: since } },
        { closed_at: { gte: since } },
        { reviews: { some: { submitted_at: { gte: since } } } },
      ];
    }

    const prs = await prisma.pullRequest.findMany({
      where,
      include: {
        repository: {
          select: {
            full_name: true,
          },
        },
        reviews: {
          where: since ? { submitted_at: { gte: since } } : undefined,
          orderBy: {
            submitted_at: 'desc',
          },
          take: 20,
        },
      },
      orderBy: {
        created_at: 'desc',
      },
      take: Math.min(limit, 200),
    });

    const events: PRStreamEvent[] = [];

    for (const pr of prs) {
      const repoName = pr.repository.full_name;

      events.push({
        id: `opened-${repoName}-${pr.number}-${pr.created_at.toISOString()}`,
        action: 'pull_request.opened',
        number: pr.number,
        repo: repoName,
        state: 'open',
        timestamp: pr.created_at.toISOString(),
        source: 'history',
      });

      if (pr.closed_at) {
        events.push({
          id: `closed-${repoName}-${pr.number}-${pr.closed_at.toISOString()}`,
          action: 'pull_request.closed',
          number: pr.number,
          repo: repoName,
          state: pr.state,
          timestamp: pr.closed_at.toISOString(),
          source: 'history',
        });
      }

      for (const review of pr.reviews) {
        events.push({
          id: `review-${repoName}-${pr.number}-${review.submitted_at.toISOString()}-${review.id}`,
          action: 'pull_request_review.submitted',
          number: pr.number,
          repo: repoName,
          state: review.state,
          timestamp: review.submitted_at.toISOString(),
          source: 'history',
        });
      }
    }

    events.sort((a, b) => {
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });

    return NextResponse.json({ events: events.slice(0, limit) });
  } catch (error) {
    console.error('[live-events] failed to load history:', error);
    return NextResponse.json({ events: [], error: 'Failed to load event history' }, { status: 500 });
  }
}
