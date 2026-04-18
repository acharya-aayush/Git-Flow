import { NextResponse } from 'next/server';
import { PrismaClient, type Prisma } from '@gitflow/db';
import type { RepoActivityEvent } from '@gitflow/shared';
import {
  getWindowStart,
  isValidRepoFullName,
  parseDashboardWindow,
} from '@/lib/dashboard-window';

export const dynamic = 'force-dynamic';

const db = new PrismaClient();

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const repo = searchParams.get('repo');
    const selectedWindow = parseDashboardWindow(searchParams.get('window'));
    const limitParam = Number(searchParams.get('limit') || 200);
    const limit = Number.isFinite(limitParam)
      ? Math.min(Math.max(limitParam, 1), 500)
      : 200;

    if (repo && repo !== 'all' && !isValidRepoFullName(repo)) {
      return NextResponse.json({ events: [], error: 'Invalid repository filter format' }, { status: 400 });
    }

    const since = getWindowStart(selectedWindow, new Date());

    const prWhere: Prisma.PullRequestWhereInput = {};
    const reviewWhere: Prisma.ReviewWhereInput = {};
    const commitWhere: Prisma.CommitWhereInput = {};
    const issueWhere: Prisma.IssueWhereInput = {};

    if (repo && repo !== 'all') {
      prWhere.repository = { full_name: repo };
      reviewWhere.pull_request = { is: { repository: { full_name: repo } } };
      commitWhere.repository = { full_name: repo };
      issueWhere.repository = { full_name: repo };
    }

    if (since) {
      prWhere.OR = [
        { created_at: { gte: since } },
        { updated_at: { gte: since } },
        { closed_at: { gte: since } },
      ];
      reviewWhere.submitted_at = { gte: since };
      commitWhere.committed_at = { gte: since };
      issueWhere.OR = [
        { created_at: { gte: since } },
        { updated_at: { gte: since } },
        { closed_at: { gte: since } },
      ];
    }

    const [pullRequests, reviews, commits, issues] = await Promise.all([
      db.pullRequest.findMany({
        where: prWhere,
        include: {
          repository: { select: { full_name: true } },
          author: { select: { login: true } },
        },
        orderBy: { updated_at: 'desc' },
        take: limit,
      }),
      db.review.findMany({
        where: reviewWhere,
        include: {
          pull_request: {
            select: {
              number: true,
              title: true,
              repository: { select: { full_name: true } },
            },
          },
          reviewer: { select: { login: true } },
        },
        orderBy: { submitted_at: 'desc' },
        take: limit,
      }),
      db.commit.findMany({
        where: commitWhere,
        include: {
          repository: { select: { full_name: true } },
        },
        orderBy: { committed_at: 'desc' },
        take: limit,
      }),
      db.issue.findMany({
        where: issueWhere,
        include: {
          repository: { select: { full_name: true } },
        },
        orderBy: { updated_at: 'desc' },
        take: limit,
      }),
    ]);

    const events: RepoActivityEvent[] = [];

    for (const pr of pullRequests) {
      events.push({
        id: `pr-opened-${pr.repository.full_name}-${pr.number}-${pr.created_at.toISOString()}`,
        repo: pr.repository.full_name,
        kind: 'pull_request',
        action: 'pull_request.opened',
        timestamp: pr.created_at.toISOString(),
        actor: pr.author?.login || undefined,
        number: pr.number,
        title: pr.title,
        state: 'open',
        source: 'history',
      });

      if (pr.closed_at) {
        events.push({
          id: `pr-closed-${pr.repository.full_name}-${pr.number}-${pr.closed_at.toISOString()}`,
          repo: pr.repository.full_name,
          kind: 'pull_request',
          action: pr.merged_at ? 'pull_request.merged' : 'pull_request.closed',
          timestamp: pr.closed_at.toISOString(),
          number: pr.number,
          title: pr.title,
          state: pr.state,
          source: 'history',
        });
      }
    }

    for (const review of reviews) {
      events.push({
        id: `review-${review.id}`,
        repo: review.pull_request.repository.full_name,
        kind: 'pull_request_review',
        action: 'pull_request_review.submitted',
        timestamp: review.submitted_at.toISOString(),
        actor: review.reviewer.login,
        number: review.pull_request.number,
        title: review.pull_request.title,
        state: review.state,
        source: 'history',
      });
    }

    for (const commit of commits) {
      events.push({
        id: `commit-${commit.repo_id}-${commit.sha}`,
        repo: commit.repository.full_name,
        kind: 'push',
        action: 'push',
        timestamp: commit.committed_at.toISOString(),
        actor: commit.author_login || commit.author_name || undefined,
        sha: commit.sha,
        message: commit.message,
        source: 'history',
      });
    }

    for (const issue of issues) {
      events.push({
        id: `issue-${issue.repo_id}-${issue.number}-${issue.updated_at?.toISOString() || issue.created_at.toISOString()}`,
        repo: issue.repository.full_name,
        kind: 'issue',
        action: `issues.${issue.state}`,
        timestamp: (issue.updated_at || issue.created_at).toISOString(),
        actor: issue.author_login || undefined,
        number: issue.number,
        title: issue.title,
        state: issue.state,
        source: 'history',
      });
    }

    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return NextResponse.json({ events: events.slice(0, limit) });
  } catch (error) {
    console.error('[repo-activity] failed to load history:', error);
    return NextResponse.json({ events: [], error: 'Failed to load repository activity' }, { status: 500 });
  }
}
