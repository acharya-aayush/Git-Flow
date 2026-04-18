import { PrismaClient } from '@gitflow/db';
import type { PushWebhookPayload } from '@gitflow/shared';

function toDate(value: string | undefined, fallback = new Date()): Date {
  if (!value) return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

export async function processPushEvent(db: PrismaClient, payload: PushWebhookPayload) {
  const repoRef = payload.repository;

  const repo = await db.repository.upsert({
    where: { github_id: repoRef.id },
    update: {
      full_name: repoRef.full_name,
      owner: repoRef.owner.login,
    },
    create: {
      github_id: repoRef.id,
      full_name: repoRef.full_name,
      owner: repoRef.owner.login,
    },
  });

  const commits = Array.isArray(payload.commits) ? payload.commits : [];

  for (const commit of commits) {
    const added = Array.isArray(commit.added) ? commit.added : [];
    const removed = Array.isArray(commit.removed) ? commit.removed : [];
    const modified = Array.isArray(commit.modified) ? commit.modified : [];
    const files = [
      ...added.map((filename) => ({ filename, status: 'added' as const })),
      ...removed.map((filename) => ({ filename, status: 'removed' as const })),
      ...modified.map((filename) => ({ filename, status: 'modified' as const })),
    ];

    const commitRow = await db.commit.upsert({
      where: {
        repo_id_sha: {
          repo_id: repo.id,
          sha: commit.id,
        },
      },
      update: {
        message: commit.message,
        author_name: commit.author?.name || null,
        author_email: commit.author?.email || null,
        author_login: commit.author?.username || payload.sender?.login || payload.pusher?.name || null,
        committed_at: toDate(commit.timestamp),
        additions: added.length,
        deletions: removed.length,
        changed_files: files.length,
      },
      create: {
        repo_id: repo.id,
        sha: commit.id,
        message: commit.message,
        author_name: commit.author?.name || null,
        author_email: commit.author?.email || null,
        author_login: commit.author?.username || payload.sender?.login || payload.pusher?.name || null,
        committed_at: toDate(commit.timestamp),
        additions: added.length,
        deletions: removed.length,
        changed_files: files.length,
      },
    });

    if (files.length > 0) {
      await db.commitFileChange.deleteMany({ where: { commit_id: commitRow.id } });
      await db.commitFileChange.createMany({
        data: files.map((file) => ({
          commit_id: commitRow.id,
          filename: file.filename,
          status: file.status,
          additions: file.status === 'added' ? 1 : 0,
          deletions: file.status === 'removed' ? 1 : 0,
          changes: 1,
        })),
      });
    }
  }

  console.log(`[Processor] Push event processed: ${repoRef.full_name} (${commits.length} commits)`);
}
