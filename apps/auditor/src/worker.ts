import { Worker, Job } from 'bullmq';
import {
  QUEUE_NAME_WEBHOOKS,
  getRedisConnectionOptions,
  type WebhookJobData,
  type WebhookJobResult,
} from '@gitflow/queue';
import { PrismaClient } from '@gitflow/db';
import {
  isPullRequestReviewWebhookPayload,
  isPullRequestWebhookPayload,
  type PullRequestReviewWebhookPayload,
  type PullRequestWebhookPayload,
} from '@gitflow/shared';
import { checkIdempotency, markProcessed } from './services/idempotency';
import { processPullRequestOpened } from './processors/pr-opened';
import { processPullRequestClosed } from './processors/pr-closed';
import { processPullRequestReview } from './processors/pr-review';
import { Redis } from 'ioredis';
import dotenv from 'dotenv';
dotenv.config({ path: '../../.env' }); // Only for dev

const db = new PrismaClient();
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const connection = getRedisConnectionOptions(redisUrl);
const publisher = new Redis(redisUrl);

console.log('🚀 Starting Auditor Worker...');

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

      // Basic Routing Matrix
      if (fullAction === 'pull_request.opened' || fullAction === 'pull_request.reopened') {
        if (!isPullRequestWebhookPayload(payload)) {
          console.warn(`[Auditor] Invalid pull_request payload for ${job.id}`);
          return { success: false, reason: 'invalid_pull_request_payload' };
        }
        routablePayload = payload;
        await processPullRequestOpened(db, payload);
      } else if (fullAction === 'pull_request.closed') {
        if (!isPullRequestWebhookPayload(payload)) {
          console.warn(`[Auditor] Invalid pull_request payload for ${job.id}`);
          return { success: false, reason: 'invalid_pull_request_payload' };
        }
        routablePayload = payload;
        await processPullRequestClosed(db, payload);
      } else if (fullAction === 'pull_request_review.submitted') {
        if (!isPullRequestReviewWebhookPayload(payload)) {
          console.warn(`[Auditor] Invalid pull_request_review payload for ${job.id}`);
          return { success: false, reason: 'invalid_pull_request_review_payload' };
        }
        routablePayload = payload;
        await processPullRequestReview(db, payload);
      } else {
        console.log(`[Auditor] Unknown or ignored event: ${fullAction}`);
        return { success: true, ignored: true, reason: 'ignored_event' };
      }

      // Mark as processed
      await markProcessed(idempotencyKey, fullAction, payload);
      
      // Publish event to Redis for WS broadcast.
      if (
        routablePayload &&
        ['pull_request.opened', 'pull_request.closed', 'pull_request_review.submitted'].includes(fullAction)
      ) {
        const repoName = routablePayload.repository.full_name;
        const prNumber = routablePayload.pull_request.number;

        if (!repoName || typeof prNumber !== 'number') {
          console.warn(`[Auditor] Skipping broadcast for ${job.id}: missing repo or PR number`);
        } else {
          const message = JSON.stringify({
            type: 'PR_UPDATE',
            action: fullAction,
            payload: {
              number: prNumber,
              repo: repoName,
              state: routablePayload.pull_request.state,
            },
            timestamp: new Date().toISOString(),
          });

          try {
            await publisher.publish('gitflow:dashboard-updates', message);
            console.log(`[Auditor] Broadcasted dashboard update for ${job.id} -> ${repoName}#${prNumber}`);
          } catch (publishError) {
            console.error(`[Auditor] Failed to publish dashboard update for ${job.id}:`, publishError);
          }
        }
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
