export interface HealthScoreResult {
  grade: 'A' | 'B' | 'C' | 'F';
  latencyHours: number;
}

export interface PRTimestamps {
  createdAt: Date;
  firstReviewAt?: Date;
  mergedAt?: Date;
  closedAt?: Date;
}

export interface GitHubOwnerRef {
  login: string;
}

export interface GitHubRepositoryRef {
  id: number;
  full_name: string;
  owner: GitHubOwnerRef;
}

export interface GitHubUserRef {
  id: number;
  login: string;
  avatar_url?: string | null;
}

export interface GitHubPullRequestRef {
  id: number;
  number: number;
  title: string;
  state: string;
  draft?: boolean;
  created_at: string;
  updated_at: string;
  closed_at?: string | null;
  merged_at?: string | null;
  merged?: boolean;
}

export interface GitHubReviewRef {
  state: string;
  submitted_at: string;
}

export interface GitHubPushCommitRef {
  id: string;
  message: string;
  timestamp: string;
  added?: string[];
  removed?: string[];
  modified?: string[];
  author?: {
    name?: string;
    email?: string;
    username?: string;
  };
}

export interface GitHubIssueRef {
  id: number;
  number: number;
  title: string;
  state: string;
  created_at: string;
  updated_at: string;
  closed_at?: string | null;
  user?: {
    login: string;
  };
  assignee?: {
    login: string;
  } | null;
  labels?: Array<{
    name: string;
    color?: string;
  }>;
}

export interface PullRequestWebhookPayload {
  action: string;
  pull_request: GitHubPullRequestRef;
  repository: GitHubRepositoryRef;
  sender: GitHubUserRef;
  [key: string]: unknown;
}

export interface PullRequestReviewWebhookPayload {
  action: string;
  pull_request: GitHubPullRequestRef;
  review: GitHubReviewRef;
  repository: GitHubRepositoryRef;
  sender: GitHubUserRef;
  [key: string]: unknown;
}

export interface PushWebhookPayload {
  ref: string;
  repository: GitHubRepositoryRef;
  pusher?: {
    name?: string;
    email?: string;
  };
  sender?: GitHubUserRef;
  commits: GitHubPushCommitRef[];
  [key: string]: unknown;
}

export interface IssueWebhookPayload {
  action: string;
  issue: GitHubIssueRef;
  repository: GitHubRepositoryRef;
  sender: GitHubUserRef;
  [key: string]: unknown;
}

export type GitHubWebhookPayload =
  | PullRequestWebhookPayload
  | PullRequestReviewWebhookPayload
  | PushWebhookPayload
  | IssueWebhookPayload
  | Record<string, unknown>;

export interface DashboardPrUpdatePayload {
  number: number;
  repo: string;
  state?: string;
}

export interface DashboardPrUpdateEvent {
  type: 'PR_UPDATE';
  action: string;
  payload: DashboardPrUpdatePayload;
  timestamp: string;
}

export type RepoActivityKind = 'push' | 'pull_request' | 'pull_request_review' | 'issue';

export interface DashboardRepoActivityPayload {
  repo: string;
  kind: RepoActivityKind;
  action: string;
  actor?: string;
  number?: number;
  title?: string;
  sha?: string;
  message?: string;
  state?: string;
}

export interface DashboardRepoActivityEvent {
  type: 'REPO_ACTIVITY';
  payload: DashboardRepoActivityPayload;
  timestamp: string;
}

export interface PRStreamEvent {
  id: string;
  action: string;
  number: number;
  repo: string;
  state?: string;
  timestamp: string;
  source?: 'live' | 'history';
}

export interface RepoActivityEvent {
  id: string;
  repo: string;
  kind: RepoActivityKind;
  action: string;
  timestamp: string;
  actor?: string;
  number?: number;
  title?: string;
  sha?: string;
  message?: string;
  state?: string;
  source?: 'live' | 'history';
}

export interface DoraMetricCard {
  title: string;
  metric: string;
  delta: string;
}

export interface StalePrTableRow {
  prm: string;
  author: string;
  daysOpen: number;
  status: 'Critical' | 'Warning';
}

export interface ReviewsBarDatum {
  name: string;
  Reviews: number;
}

export interface LifecycleChartDatum {
  date: string;
  'Avg Lifecycle': number;
}

export type MergeFrictionGrid = number[][];
