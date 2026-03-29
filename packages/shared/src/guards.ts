import type {
  DashboardPrUpdateEvent,
  PRStreamEvent,
  PullRequestReviewWebhookPayload,
  PullRequestWebhookPayload,
} from './types';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function isPullRequestWebhookPayload(payload: unknown): payload is PullRequestWebhookPayload {
  if (!isObject(payload)) return false;

  const repository = payload.repository;
  const pullRequest = payload.pull_request;
  const sender = payload.sender;

  if (!isObject(repository) || !isObject(pullRequest) || !isObject(sender)) return false;

  return (
    isString(payload.action) &&
    isNumber(repository.id) &&
    isString(repository.full_name) &&
    isObject(repository.owner) &&
    isString((repository.owner as Record<string, unknown>).login) &&
    isNumber(pullRequest.id) &&
    isNumber(pullRequest.number) &&
    isString(pullRequest.state) &&
    isString(pullRequest.created_at) &&
    isString(pullRequest.updated_at) &&
    isNumber(sender.id) &&
    isString(sender.login)
  );
}

export function isPullRequestReviewWebhookPayload(payload: unknown): payload is PullRequestReviewWebhookPayload {
  if (!isPullRequestWebhookPayload(payload)) return false;

  const review = payload.review;
  if (!isObject(review)) return false;

  return isString(review.state) && isString(review.submitted_at);
}

export function isDashboardPrUpdateEvent(value: unknown): value is DashboardPrUpdateEvent {
  if (!isObject(value)) return false;
  if (value.type !== 'PR_UPDATE') return false;
  if (!isString(value.action) || !isString(value.timestamp)) return false;

  const payload = value.payload;
  if (!isObject(payload)) return false;

  return isNumber(payload.number) && isString(payload.repo);
}

export function toPRStreamEvent(event: DashboardPrUpdateEvent): PRStreamEvent {
  return {
    id: `live-${event.payload.repo}-${event.payload.number}-${event.timestamp}-${event.action}`,
    action: event.action,
    number: event.payload.number,
    repo: event.payload.repo,
    state: event.payload.state,
    timestamp: event.timestamp,
    source: 'live',
  };
}

export function isPRStreamEvent(value: unknown): value is PRStreamEvent {
  if (!isObject(value)) return false;

  return (
    isString(value.id) &&
    isString(value.action) &&
    isNumber(value.number) &&
    isString(value.repo) &&
    isString(value.timestamp)
  );
}
