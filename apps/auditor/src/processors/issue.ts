import { PrismaClient } from '@gitflow/db';
import type { IssueWebhookPayload } from '@gitflow/shared';

function toDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function processIssueEvent(db: PrismaClient, payload: IssueWebhookPayload) {
  const { issue, repository, sender } = payload;

  const repo = await db.repository.upsert({
    where: { github_id: repository.id },
    update: { full_name: repository.full_name, owner: repository.owner.login },
    create: {
      github_id: repository.id,
      full_name: repository.full_name,
      owner: repository.owner.login,
    },
  });

  const createdAt = toDate(issue.created_at) || new Date();
  const updatedAt = toDate(issue.updated_at);
  const closedAt = toDate(issue.closed_at);
  const resolutionMins = closedAt
    ? Math.max(0, Math.floor((closedAt.getTime() - createdAt.getTime()) / (1000 * 60)))
    : null;

  const labels = Array.isArray(issue.labels)
    ? issue.labels.map((label) => label.name)
    : [];

  await db.issue.upsert({
    where: { github_id: issue.id },
    update: {
      repo_id: repo.id,
      number: issue.number,
      title: issue.title,
      state: issue.state,
      author_login: issue.user?.login || sender.login,
      assignee_login: issue.assignee?.login || null,
      labels,
      updated_at: updatedAt,
      closed_at: closedAt,
      resolution_mins: resolutionMins,
    },
    create: {
      github_id: issue.id,
      repo_id: repo.id,
      number: issue.number,
      title: issue.title,
      state: issue.state,
      author_login: issue.user?.login || sender.login,
      assignee_login: issue.assignee?.login || null,
      labels,
      created_at: createdAt,
      updated_at: updatedAt,
      closed_at: closedAt,
      resolution_mins: resolutionMins,
    },
  });

  console.log(`[Processor] Issue event processed: ${repository.full_name}#${issue.number} (${payload.action})`);
}
