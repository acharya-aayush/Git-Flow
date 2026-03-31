import { PrismaClient } from '@gitflow/db';
import { calculateLatencyMins, type PullRequestWebhookPayload } from '@gitflow/shared';

export async function processPullRequestClosed(db: PrismaClient, payload: PullRequestWebhookPayload) {
  const { pull_request, repository } = payload;

  const repo = await db.repository.findUnique({ where: { github_id: repository.id } });
  if (!repo) {
    console.warn('Repository not found for close event, ignoring');
    return;
  }

  const existingPr = await db.pullRequest.findUnique({
    where: { repo_id_number: { repo_id: repo.id, number: pull_request.number } }
  });

  if (!existingPr) {
    console.warn(`PR ${pull_request.number} not found in DB. Might have missed open event.`);
    return;
  }

  if (!pull_request.closed_at) {
    console.warn(`PR ${pull_request.number} missing closed_at timestamp, ignoring close event.`);
    return;
  }

  const mergedAt = pull_request.merged_at ? new Date(pull_request.merged_at) : null;
  const closedAt = new Date(pull_request.closed_at);
  const state = pull_request.merged ? 'merged' : 'closed';

  let mergeTimeMins = null;
  let lifecycleMins = null;

  if (mergedAt) {
    mergeTimeMins = calculateLatencyMins(existingPr.created_at, mergedAt);
  }
  lifecycleMins = calculateLatencyMins(existingPr.created_at, closedAt);

  await db.pullRequest.update({
    where: { id: existingPr.id },
    data: {
      state,
      merged_at: mergedAt,
      closed_at: closedAt,
      updated_at: new Date(pull_request.updated_at),
      merge_time_mins: mergeTimeMins,
      lifecycle_mins: lifecycleMins,
    },
  });

  console.log(`[Processor] PR Closed/Merged processed: ${repository.full_name}#${pull_request.number}`);
}
