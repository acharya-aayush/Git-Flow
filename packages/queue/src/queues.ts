import { Queue, ConnectionOptions } from 'bullmq';

export const QUEUE_NAME_WEBHOOKS = 'gitflow-webhooks';

export function getRedisConnectionOptions(redisUrl: string): ConnectionOptions {
  // Parsing is handled by ioredis directly when passed as a string connection,
  // but for bullmq it's often better to pass a pre-configured ioredis instance
  // or simple connection options to ensure `maxRetriesPerRequest: null`.
  const url = new URL(redisUrl);
  return {
    host: url.hostname,
    port: parseInt(url.port || '6379'),
    username: url.username || undefined,
    password: url.password || undefined,
    tls: url.protocol === 'rediss:' ? {} : undefined,
    maxRetriesPerRequest: null,
  };
}

export function createWebhookQueue(redisUrl: string) {
  const connection = getRedisConnectionOptions(redisUrl);
  return new Queue(QUEUE_NAME_WEBHOOKS, {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
      removeOnComplete: 1000, // Keep last 1000 successful jobs
      removeOnFail: 5000,     // Keep last 5000 failed jobs
    },
  });
}
