import { PrismaClient } from '@gitflow/db';
import type { PullRequestWebhookPayload } from '@gitflow/shared';
// import { getAuthorTeam } from '../services/enrichment'; // if needed later

export async function processPullRequestOpened(db: PrismaClient, payload: PullRequestWebhookPayload) {
  const { pull_request, repository, sender } = payload;
  
  // 1. Upsert Repository
  await db.repository.upsert({
    where: { github_id: repository.id },
    update: { full_name: repository.full_name, owner: repository.owner.login },
    create: {
      github_id: repository.id,
      full_name: repository.full_name,
      owner: repository.owner.login,
    },
  });

  // 2. Upsert User (Author)
  const author = await db.user.upsert({
    where: { github_id: sender.id },
    update: { login: sender.login, avatar_url: sender.avatar_url },
    create: {
      github_id: sender.id,
      login: sender.login,
      avatar_url: sender.avatar_url,
    },
  });

  const repo = await db.repository.findUnique({ where: { github_id: repository.id } });
  if (!repo) throw new Error('Repository upsert failed');

  const createdAt = new Date(pull_request.created_at);

  // 3. Upsert Pull Request
  await db.pullRequest.upsert({
    where: {
      repo_id_number: {
        repo_id: repo.id,
        number: pull_request.number,
      },
    },
    update: {
      title: pull_request.title,
      state: pull_request.state,
      draft: pull_request.draft,
      updated_at: new Date(pull_request.updated_at),
    },
    create: {
      github_id: pull_request.id,
      repo_id: repo.id,
      author_id: author.id,
      number: pull_request.number,
      title: pull_request.title,
      state: pull_request.state,
      draft: pull_request.draft,
      created_at: createdAt,
      updated_at: new Date(pull_request.updated_at),
      // At this stage, it's just opened, so no metrics are complete yet.
      health_grade: 'F', // Default to F, will update on review
    },
  });

  console.log(`[Processor] PR Opened processed: ${repository.full_name}#${pull_request.number}`);
}
