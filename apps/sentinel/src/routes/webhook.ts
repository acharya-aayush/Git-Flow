import { Router } from 'express';
import { verifyGithubSignature } from '../middleware/verify-signature';
import { createWebhookQueue, WebhookJobData } from '@gitflow/queue';
import crypto from 'crypto';

export const webhookRouter = Router();

// Initialize BullMQ Queue
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const webhookQueue = createWebhookQueue(redisUrl);
const allowedWebhookEvents = new Set(
  (process.env.ALLOWED_GITHUB_EVENTS || 'pull_request,pull_request_review,push,issues')
    .split(',')
    .map((event) => event.trim())
    .filter(Boolean)
);

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

  try {
    // Generate idempotency key based on delivery ID and event type
    const idempotencyKey = crypto
      .createHash('sha256')
      .update(`${deliveryId}-${eventType}`)
      .digest('hex');

    const jobData: WebhookJobData = {
      payload: req.body,
      eventType,
      idempotencyKey,
    };

    // Add to BullMQ
    await webhookQueue.add(eventType, jobData, {
      jobId: idempotencyKey, // Ensures deduplication at the queue level
    });

    console.log(`[Sentinel] Enqueued webhook delivery ${deliveryId} (Type: ${eventType})`);

    // Must respond within 2 seconds
    res.status(202).json({ accepted: true, deliveryId });
  } catch (error) {
    console.error('Failed to enqueue webhook:', error);
    res.status(500).json({ error: 'Failed to process webhook' });
  }
});
