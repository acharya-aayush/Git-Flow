import { Worker, Job } from 'bullmq';
import {
  QUEUE_NAME_WEBHOOKS,
  getRedisConnectionOptions,
  type WebhookJobData,
  type WebhookJobResult,
} from '@gitflow/queue';
import { PrismaClient } from '@gitflow/db';
import {
  isIssueWebhookPayload,
  isPullRequestReviewWebhookPayload,
  isPullRequestWebhookPayload,
  isPushWebhookPayload,
  type IssueWebhookPayload,
  type PushWebhookPayload,
  type PullRequestReviewWebhookPayload,
  type PullRequestWebhookPayload,
} from '@gitflow/shared';
import { checkIdempotency, markProcessed } from './services/idempotency';
import { processIssueEvent } from './processors/issue';
import { processPullRequestOpened } from './processors/pr-opened';
import { processPullRequestClosed } from './processors/pr-closed';
import { processPullRequestReview } from './processors/pr-review';
import { processPushEvent } from './processors/push';
import { Redis } from 'ioredis';
import dotenv from 'dotenv';
dotenv.config({ path: '../../.env' }); // Only for dev

const db = new PrismaClient();
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const connection = getRedisConnectionOptions(redisUrl);
const publisher = new Redis(redisUrl);

console.log('🚀 Starting Auditor Worker...');

type RepoActivityPayload = {
  repo: string;
  kind: 'push' | 'pull_request' | 'pull_request_review' | 'issue';
  action: string;
  actor?: string;
  number?: number;
  title?: string;
  sha?: string;
  message?: string;
  state?: string;
};

async function publishPrUpdate(
  fullAction: string,
  payload: PullRequestWebhookPayload | PullRequestReviewWebhookPayload
) {
  const repoName = payload.repository.full_name;
  const prNumber = payload.pull_request.number;

  if (!repoName || typeof prNumber !== 'number') {
    return;
  }

  const message = JSON.stringify({
    type: 'PR_UPDATE',
    action: fullAction,
    payload: {
      number: prNumber,
      repo: repoName,
      state: payload.pull_request.state,
    },
    timestamp: new Date().toISOString(),
  });

  await publisher.publish('gitflow:dashboard-updates', message);
}

async function publishRepoActivity(payload: RepoActivityPayload) {
  const message = JSON.stringify({
    type: 'REPO_ACTIVITY',
    payload,
    timestamp: new Date().toISOString(),
  });

  await publisher.publish('gitflow:dashboard-updates', message);
}

const worker = new Worker<WebhookJobData, WebhookJobResult, string>(
  QUEUE_NAME_WEBHOOKS,
  async (job: Job<WebhookJobData>) => {
    const { payload, eventType, idempotencyKey } = job.data;

    let fullAction = eventType;
    if (payload?.action) {
      fullAction = `${eventType}.${payload.action}`;
    } else if (eventType.includes('.')) {
      fullAction = eventType;
    }

    console.log(`[Auditor] Processing job ${job.id} -> ${fullAction}`);

    const isProcessed = await checkIdempotency(idempotencyKey);
    if (isProcessed) {
      console.log(`[Auditor] Job ${job.id} skipped (Idempotent)`);
      return { success: true, ignored: true, reason: 'idempotent' };
    }

    try {
      let routablePayload: PullRequestWebhookPayload | PullRequestReviewWebhookPayload | null = null;
      let activityPayload: RepoActivityPayload | null = null;

      // Basic Routing Matrix
      if (fullAction === 'pull_request.opened' || fullAction === 'pull_request.reopened') {
        if (!isPullRequestWebhookPayload(payload)) {
          console.warn(`[Auditor] Invalid pull_request payload for ${job.id}`);
          return { success: false, reason: 'invalid_pull_request_payload' };
        }
        routablePayload = payload;
        await processPullRequestOpened(db, payload);
        activityPayload = {
          repo: payload.repository.full_name,
          kind: 'pull_request',
          action: fullAction,
          actor: payload.sender.login,
          number: payload.pull_request.number,
          title: payload.pull_request.title,
          state: payload.pull_request.state,
        };
      } else if (fullAction === 'pull_request.closed') {
        if (!isPullRequestWebhookPayload(payload)) {
          console.warn(`[Auditor] Invalid pull_request payload for ${job.id}`);
          return { success: false, reason: 'invalid_pull_request_payload' };
        }
        routablePayload = payload;
        await processPullRequestClosed(db, payload);
        activityPayload = {
          repo: payload.repository.full_name,
          kind: 'pull_request',
          action: fullAction,
          actor: payload.sender.login,
          number: payload.pull_request.number,
          title: payload.pull_request.title,
          state: payload.pull_request.merged ? 'merged' : payload.pull_request.state,
        };
      } else if (fullAction === 'pull_request_review.submitted') {
        if (!isPullRequestReviewWebhookPayload(payload)) {
          console.warn(`[Auditor] Invalid pull_request_review payload for ${job.id}`);
          return { success: false, reason: 'invalid_pull_request_review_payload' };
        }
        routablePayload = payload;
        await processPullRequestReview(db, payload);
        activityPayload = {
          repo: payload.repository.full_name,
          kind: 'pull_request_review',
          action: fullAction,
          actor: payload.sender.login,
          number: payload.pull_request.number,
          title: payload.pull_request.title,
          state: payload.review.state,
        };
      } else if (eventType === 'push') {
        if (!isPushWebhookPayload(payload)) {
          console.warn(`[Auditor] Invalid push payload for ${job.id}`);
          return { success: false, reason: 'invalid_push_payload' };
        }

        await processPushEvent(db, payload);
        const headCommit = payload.commits[payload.commits.length - 1];
        activityPayload = {
          repo: payload.repository.full_name,
          kind: 'push',
          action: 'push',
          actor: payload.sender?.login || payload.pusher?.name,
          sha: headCommit?.id,
          message:
            payload.commits.length > 1
              ? `${payload.commits.length} commits pushed`
              : headCommit?.message || '1 commit pushed',
        };
      } else if (eventType === 'issues') {
        if (!isIssueWebhookPayload(payload)) {
          console.warn(`[Auditor] Invalid issues payload for ${job.id}`);
          return { success: false, reason: 'invalid_issue_payload' };
        }

        await processIssueEvent(db, payload);
        activityPayload = {
          repo: payload.repository.full_name,
          kind: 'issue',
          action: `issues.${payload.action}`,
          actor: payload.sender.login,
          number: payload.issue.number,
          title: payload.issue.title,
          state: payload.issue.state,
        };
      } else {
        console.log(`[Auditor] Unknown or ignored event: ${fullAction}`);
        return { success: true, ignored: true, reason: 'ignored_event' };
      }

      // Mark as processed
      await markProcessed(idempotencyKey, fullAction, payload);
      
      // Publish event to Redis for WS broadcast.
      try {
        if (routablePayload) {
          await publishPrUpdate(fullAction, routablePayload);
        }

        if (activityPayload) {
          await publishRepoActivity(activityPayload);
        }
      } catch (publishError) {
        console.error(`[Auditor] Failed to publish dashboard update for ${job.id}:`, publishError);
      }

      return { success: true, processedEventId: idempotencyKey };
    } catch (error) {
      console.error(`[Auditor] Failed processing ${job.id}:`, error);
      throw error;
    }
  },
  {
    connection,
    concurrency: 5,
  }
);

worker.on('failed', (job, err) => {
  console.error(`Job [${job?.id}] failed!`, err.message);
});

worker.on('error', err => {
  console.error(err);
});
