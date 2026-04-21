import { Router } from 'express';
import { verifyGithubSignature } from '../middleware/verify-signature';
import { createWebhookQueue, WebhookJobData } from '@gitflow/queue';
import crypto from 'crypto';

export const webhookRouter = Router();

// Initialize BullMQ Queue
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const webhookQueue = createWebhookQueue(redisUrl);
const baselineWebhookEvents = ['pull_request', 'pull_request_review', 'push', 'issues'];
const configuredWebhookEvents = (process.env.ALLOWED_GITHUB_EVENTS || '')
  .split(',')
  .map((event) => event.trim())
  .filter(Boolean);
const allowedWebhookEvents = new Set([...baselineWebhookEvents, ...configuredWebhookEvents]);

if (configuredWebhookEvents.length > 0 && !configuredWebhookEvents.includes('push')) {
  console.warn('[Sentinel] ALLOWED_GITHUB_EVENTS missing "push"; enabling it automatically for commit realtime updates');
}

webhookRouter.post('/', verifyGithubSignature, async (req, res) => {
  const eventType = req.headers['x-github-event'] as string;
  const deliveryId = req.headers['x-github-delivery'] as string;

  if (!eventType || !deliveryId) {
    return res.status(400).json({ error: 'Missing required GitHub headers' });
  }

  if (!req.is('application/json')) {
    return res.status(415).json({ error: 'Unsupported media type' });
  }

  if (typeof req.body !== 'object' || req.body === null) {
    return res.status(400).json({ error: 'Invalid webhook payload' });
  }

  if (!allowedWebhookEvents.has(eventType)) {
    return res.status(202).json({ accepted: true, ignored: true, reason: 'event_not_allowed' });
  }

  const idempotencyKey = crypto
    .createHash('sha256')
    .update(`${deliveryId}-${eventType}`)
    .digest('hex');

  const jobData: WebhookJobData = {
    payload: req.body,
    eventType,
    idempotencyKey,
  };

  try {
    // Add to BullMQ
    await webhookQueue.add(eventType, jobData, {
      jobId: idempotencyKey, // Ensures deduplication at the queue level
    });

    console.log(`[Sentinel] Enqueued webhook delivery ${deliveryId} (Type: ${eventType})`);

    // Must respond within 2 seconds
    res.status(202).json({ accepted: true, deliveryId });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const duplicateJobError =
      errorMessage.includes('JobIdAlreadyExists') ||
      (errorMessage.includes('Job') && errorMessage.includes('already exists'));

    if (duplicateJobError) {
      try {
        const existingJob = await webhookQueue.getJob(idempotencyKey);
        if (existingJob) {
          const state = await existingJob.getState();

          if (state === 'failed') {
            await existingJob.retry();
            console.log(`[Sentinel] Re-queued failed job for redelivery ${deliveryId} (${eventType})`);
            return res.status(202).json({ accepted: true, deliveryId, deduplicated: true, replayQueued: true });
          }

          console.log(`[Sentinel] Duplicate delivery ${deliveryId} (${eventType}) mapped to existing ${state} job`);
          return res.status(202).json({ accepted: true, deliveryId, deduplicated: true, state });
        }

        return res.status(202).json({ accepted: true, deliveryId, deduplicated: true, state: 'unknown' });
      } catch (retryError) {
        console.error(`[Sentinel] Failed to recover duplicate delivery ${deliveryId}:`, retryError);
        return res.status(500).json({ error: 'Failed to recover duplicate delivery' });
      }
    }

    console.error('Failed to enqueue webhook:', error);
    res.status(500).json({ error: 'Failed to process webhook' });
  }
});
