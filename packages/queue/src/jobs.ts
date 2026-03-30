import type { GitHubWebhookPayload } from '@gitflow/shared';

export interface WebhookJobData {
  payload: GitHubWebhookPayload;
  eventType: string; // e.g. "pull_request", "pull_request_review"
  idempotencyKey: string;
}

export type WebhookJobResult = {
  success: boolean;
  ignored?: boolean;
  reason?: string;
  processedEventId?: string;
};
