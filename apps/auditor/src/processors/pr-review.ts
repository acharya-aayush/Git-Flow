import { PrismaClient } from '@gitflow/db';
import {
  calculateHealthScore,
  calculateLatencyMins,
  type PullRequestReviewWebhookPayload,
} from '@gitflow/shared';

export async function processPullRequestReview(db: PrismaClient, payload: PullRequestReviewWebhookPayload) {
  const { pull_request, review, repository, sender } = payload;

  const repo = await db.repository.findUnique({ where: { github_id: repository.id } });
  if (!repo) {
    console.warn(`Repository missing for review on ${repository.full_name}`);
    return;
  }

  const existingPr = await db.pullRequest.findUnique({
    where: { repo_id_number: { repo_id: repo.id, number: pull_request.number } }
  });

  if (!existingPr) {
    console.warn(`PR ${pull_request.number} not found, can't attach review.`);
    return;
  }

  // Upsert reviewer
  const reviewer = await db.user.upsert({
    where: { github_id: sender.id },
    update: { login: sender.login, avatar_url: sender.avatar_url },
    create: { github_id: sender.id, login: sender.login, avatar_url: sender.avatar_url },
  });

  // Calculate Health Score if this is the first review
  let healthGrade = existingPr.health_grade;
  let reviewLatencyMins = existingPr.review_latency_mins;
  let firstReviewAt = existingPr.first_review_at;

  const submittedAt = new Date(review.submitted_at);

  if (!firstReviewAt) {
    firstReviewAt = submittedAt;
    reviewLatencyMins = calculateLatencyMins(existingPr.created_at, submittedAt);
    const healthResult = calculateHealthScore({
      createdAt: existingPr.created_at,
      firstReviewAt: submittedAt,
    });
    healthGrade = healthResult?.grade || healthGrade;
  } else if (submittedAt < firstReviewAt) {
    // If we process out of order and this review is older
    firstReviewAt = submittedAt;
    reviewLatencyMins = calculateLatencyMins(existingPr.created_at, submittedAt);
    const healthResult = calculateHealthScore({
      createdAt: existingPr.created_at,
      firstReviewAt: submittedAt,
    });
    healthGrade = healthResult?.grade || healthGrade;
  }

  // Update PR with metrics
  await db.pullRequest.update({
    where: { id: existingPr.id },
    data: {
      first_review_at: firstReviewAt,
      review_latency_mins: reviewLatencyMins,
      health_grade: healthGrade,
      is_idle: false, // Got a review, no longer idle
    },
  });

  // Insert the review
  await db.review.create({
    data: {
      pr_id: existingPr.id,
      reviewer_id: reviewer.id,
      state: review.state,
      submitted_at: submittedAt,
    },
  });

  console.log(`[Processor] PR Review processed: ${repository.full_name}#${pull_request.number} by ${sender.login}`);
}
