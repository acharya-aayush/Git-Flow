import { describe, expect, it } from 'vitest';
import {
  isDashboardPrUpdateEvent,
  isPullRequestReviewWebhookPayload,
  isPullRequestWebhookPayload,
  toPRStreamEvent,
} from './guards';
import type { DashboardPrUpdateEvent } from './types';

describe('webhook payload guards', () => {
  const basePayload = {
    action: 'opened',
    repository: {
      id: 123,
      full_name: 'org/repo',
      owner: {
        login: 'org',
      },
    },
    pull_request: {
      id: 999,
      number: 77,
      title: 'Fix issue',
      state: 'open',
      created_at: '2026-04-01T00:00:00.000Z',
      updated_at: '2026-04-01T01:00:00.000Z',
    },
    sender: {
      id: 55,
      login: 'dev',
      avatar_url: 'https://example.com/a.png',
    },
  };

  it('accepts valid pull_request payload', () => {
    expect(isPullRequestWebhookPayload(basePayload)).toBe(true);
  });

  it('accepts valid pull_request_review payload', () => {
    const reviewPayload = {
      ...basePayload,
      review: {
        state: 'approved',
        submitted_at: '2026-04-01T02:00:00.000Z',
      },
    };

    expect(isPullRequestReviewWebhookPayload(reviewPayload)).toBe(true);
  });

  it('rejects malformed pull_request payload', () => {
    const badPayload = {
      ...basePayload,
      pull_request: {
        ...basePayload.pull_request,
        number: 'invalid',
      },
    };

    expect(isPullRequestWebhookPayload(badPayload)).toBe(false);
  });
});

describe('dashboard event guard', () => {
  it('validates PR update events and converts to stream event', () => {
    const event: DashboardPrUpdateEvent = {
      type: 'PR_UPDATE',
      action: 'pull_request.opened',
      payload: {
        number: 12,
        repo: 'org/repo',
        state: 'open',
      },
      timestamp: '2026-04-01T03:00:00.000Z',
    };

    expect(isDashboardPrUpdateEvent(event)).toBe(true);

    const streamEvent = toPRStreamEvent(event);
    expect(streamEvent.repo).toBe('org/repo');
    expect(streamEvent.number).toBe(12);
    expect(streamEvent.source).toBe('live');
  });
});
