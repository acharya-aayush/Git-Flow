# GitFlow System Master Audit and Integration Blueprint

Last updated: 2026-04-21
Audience: Product owner, architecture lead, backend/frontend implementers
Status: Architecture audit plus live extension tracking

## 1. Executive summary

GitFlow is currently a pull-request lifecycle intelligence platform with a real-time event stream, PR lifecycle metrics, and bottleneck monitoring. The platform architecture is solid for webhook ingestion, queue processing, idempotent persistence, and dashboard rendering, but it is constrained to PR and PR review telemetry.

The four requested project capabilities can be integrated on top of the current stack with different effort levels:

- Project 1 (Repository Activity Stability Tracker): high fit
- Project 4 (Git Commit Codebase Heatmap Generator): medium-high fit
- Project 6 (GitHub Issue Resolution Time Analyzer): high fit
- Project 9 (GitHub Contributor Network Analyzer): medium fit

The core architectural blocker is a data-domain mismatch: the current schema and workers are PR-centric. Commit, issue, and contributor-graph data models do not exist yet, and there is no scheduler/orchestrator for daily aggregation workloads.

This document provides:

- Current state architecture from frontend to backend
- What works, what is partial, what is missing
- Core fundamental issues with severity and impact
- Integration matrix for projects 1/4/6/9
- Proposed public interfaces (API + types + service boundaries)
- Frontend redesign direction based on backend expansion
- Phased implementation roadmap linked to epic backlog

## 2. Project purpose and current scope

### 2.1 Current purpose

Current product goal: monitor PR lifecycle health and bottlenecks across connected repositories in near-real time using GitHub App webhooks and historical sync.

### 2.2 Current production-like scope

- In scope now:
  - PR opened/closed/reopened events
  - PR review submitted events
  - PR lifecycle metrics (review latency, merge time, lifecycle time, health grade)
  - Stale PR detection and reviewer load patterns
  - WebSocket-based event stream to dashboard
- Out of scope now:
  - Commit-level analytics
  - Issue lifecycle analytics
  - Contributor network graph analytics
  - Scheduled aggregation platform (Airflow or equivalent)

## 3. End-to-end runtime architecture (frontend to backend)

## 3.1 High-level system topology

```text
GitHub App Webhook
  -> Sentinel (Express ingress + signature verify)
    -> BullMQ queue (Redis)
      -> Auditor worker (event router + processors)
        -> PostgreSQL (Prisma models)
        -> Redis pub/sub channel (dashboard updates)
          -> Sentinel WebSocket broadcast
            -> Cockpit (Next.js + Zustand) live UI

Cockpit server-side pages and API routes
  -> PostgreSQL read queries
  -> Render overview, bottlenecks, and PR event wall
```

## 3.2 Backend ingestion path

1. GitHub sends webhook to `POST /webhook`.
2. Sentinel verifies `X-Hub-Signature-256` using raw request body.
3. Sentinel builds idempotency key from delivery id + event type and enqueues BullMQ job.
4. Auditor worker consumes queue, checks idempotency table, routes by `eventType.action`.
5. Processor writes or updates repository/user/PR/review records.
6. Worker writes processed event record (`events` table) and publishes compact message to Redis channel `gitflow:dashboard-updates`.
7. Sentinel subscribes and broadcasts message to all connected WebSocket clients.

## 3.3 Backend persistence model

Current database domains:

- `users`
- `teams`
- `repositories`
- `pull_requests`
- `reviews`
- `events` (idempotency/processed event log)

Current computed metric fields live inside `pull_requests`:

- `review_latency_mins`
- `merge_time_mins`
- `lifecycle_mins`
- `health_grade`
- `is_idle`

## 3.4 Read/query layer

Current read paths:

- Next.js API `/api/repositories`
  - Returns repository names for global filter dropdown.
- Next.js API `/api/live-events`
  - Builds historical event feed from stored PR and review records.
  - Applies repository and window filtering.
- Next.js server pages query Prisma directly:
  - `/` overview: merged counts, average times, trend chart, recent merges.
  - `/bottlenecks`: stale PRs, reviewer counts, merge friction heatmap.
  - `/prs`: live stream + history + diagnostics.

## 3.5 Frontend rendering and interactions

Current cockpit UI model:

- Topbar:
  - Repository filter
  - Window filter (`7d`, `30d`, `90d`, `all`)
  - Stream status and diagnostics status
- Sidebar:
  - Overview
  - Bottlenecks
  - Pull Requests
- PR live page:
  - WebSocket logs
  - Sentinel health checks
  - History fetch + de-duplication with live stream

## 3.6 Historical data path

- `scripts/sync.ts` performs historical ingestion:
  - GitHub App installations
  - Accessible repositories
  - Pull requests (currently limited per call)
  - Reviews
- Writes to the same PR-centric schema used by webhook processing.

## 4. Current state inventory: working, partial, missing

### 4.1 Working well

- Signed webhook ingestion and queue decoupling.
- Idempotent processing via unique event key.
- Real-time WebSocket broadcast to UI.
- PR lifecycle metric calculation and visualization.
- Repository + window filters wired through pages and APIs.
- Historical event feed backfill route for PR stream.

### 4.2 Partial/fragile areas

- Team enrichment service is stubbed (`Engineering` placeholder).
- Historical sync has scalability gaps:
  - limited paging behavior
  - simplistic error handling
  - partial metric derivation
- API/database client usage is mixed (`@prisma/client` and `@gitflow/db` patterns).
- No robust observability package (queue lag, failure rates, API quotas, processing latency).
- No formal automated test suite for processors and APIs.

### 4.3 Missing capabilities

- Commit ingestion + file-level change extraction.
- Issue ingestion + label-wise resolution analytics.
- Contributor collaboration graph generation and querying.
- Daily aggregation orchestration framework and operational schedule.
- Domain-level data contracts for non-PR analytics.

## 5. Core fundamental issues in the current system

## 5.1 Severity-impact matrix

| Issue | Severity | Current impact | Future impact |
|---|---|---|---|
| PR-centric schema only | Critical | Blocks direct implementation of projects 1/4/6/9 | Forces rework if delayed |
| Worker routes only PR + review events | High | No ingest path for issues/commits | Limits product expansion |
| No scheduler/orchestrator for daily aggregations | High | Aggregations must be ad hoc/manual | Unreliable analytics freshness |
| Enrichment service is stubbed | Medium | Team/contributor context is weak | Affects org-level insights |
| Historical sync limitations and rate-limit strategy gaps | High | Data completeness risk | Bad baseline quality for analytics |
| Testing coverage near zero | High | Regression risk on each change | Slows scaling and onboarding |
| Env/documentation drift risks | Medium | Setup confusion and inconsistent local runs | Operational friction |

## 5.2 Fundamental architecture mismatch

The product direction is moving from PR lifecycle analytics to repository health intelligence. Current system contracts are centered around PR entities and PR event semantics. Without introducing new first-class domains (commit, issue, file change, contributor relationship, daily aggregates), every new feature will become a bolt-on and increase complexity debt.

## 6. Integration feasibility matrix for projects 1, 4, 6, 9

Scoring legend:

- Reuse score: 0-10 (how much current platform can be reused)
- Complexity: Low / Medium / High / Very High
- Risk: Low / Medium / High

| Project | Reuse score | Complexity | Risk | Integration summary |
|---|---:|---|---|---|
| 1. Repo Activity Stability Tracker | 8/10 | Medium | Medium | Strong fit. Reuse ingestion/auth/queue/db/api/ui patterns. Add commit domain + daily activity aggregates. |
| 4. Git Commit Codebase Heatmap | 7/10 | Medium-High | Medium-High | Needs file-level diff extraction and churn aggregations. Backend-heavy but architecture-compatible. |
| 6. Issue Resolution Time Analyzer | 8/10 | Medium | Medium | High fit. Add issue/label schema + issue ingestion/aggregation + dashboard cards/charts. |
| 9. Contributor Network Analyzer | 6/10 | High | High | Feasible but graph construction/query design and visualization add complexity. |

## 6.1 Project-by-project gap details

### Project 1: Repository Activity Stability Tracker

Reuse:

- GitHub App auth and installation access
- Queue and worker pattern
- Postgres + Prisma
- Dashboard filtering model

Gaps:

- Commit ingestion tables and processors
- Daily commit aggregation by repo
- Inactive streak calculation
- Contributor concentration metrics
- Repo health API endpoints and UI cards

### Project 4: Git Commit Codebase Heatmap

Reuse:

- Existing ingestion pipeline scaffolding
- Aggregation and dashboard patterns

Gaps:

- File-level diff ingestion model
- Churn and modification-frequency aggregations
- Ranking API for unstable files
- Heatmap/ranked-list UI views

### Project 6: Issue Resolution Time Analyzer

Reuse:

- Event processing model
- Query and chart components

Gaps:

- Issue + label schema
- Issue open/close lifecycle ingestion
- Label-type resolution-time aggregations
- Issue SLA and breakdown UI

### Project 9: Contributor Network Analyzer

Reuse:

- Contributor identity via user records
- Existing repository filtering

Gaps:

- Collaboration edge model (co-edit frequency)
- Graph build job and update semantics
- Graph query API and clustering logic
- Interactive graph visualization

## 7. Proposed public interfaces, types, and service boundaries (design only)

This section defines the target contracts for implementation. No code is introduced in this artifact.

## 7.1 New persistence domains (proposed)

- `commits`
  - per repo commit metadata: sha, author, committed_at
- `commit_file_changes`
  - per commit file deltas: file_path, additions, deletions, changes
- `issues`
  - per repo issue lifecycle: number, state, created_at, closed_at, author
- `issue_labels`
  - issue-label mapping snapshots
- `repo_daily_activity`
  - commits_per_day, active_contributors, inactivity_streak_days, concentration_ratio
- `file_daily_churn`
  - modification_count, churn_score per file/day
- `issue_resolution_daily`
  - avg_resolution_hours by label and repo/day
- `contributor_edges`
  - contributor_a, contributor_b, shared_files_count, collaboration_weight

## 7.2 New API surface (proposed read endpoints)

- `GET /api/repo-health`
  - params: `repo`, `window`
  - output: active/inactive flags, inactivity streak, concentration warnings
- `GET /api/repo-health/list`
  - output: ranked repos by stability score
- `GET /api/file-heatmap`
  - params: `repo`, `window`, `limit`
  - output: top unstable files, churn metrics
- `GET /api/issues/resolution`
  - params: `repo`, `window`, `label`
  - output: avg/median resolution times and label comparison
- `GET /api/contributors/network`
  - params: `repo`, `window`, `minEdgeWeight`
  - output: nodes, edges, contributor clusters

## 7.3 Proposed queue/event job contracts

- Ingestion jobs:
  - `commit.ingest.repo`
  - `issue.ingest.repo`
  - `contributor.ingest.repo`
- Aggregation jobs:
  - `aggregate.repo-health.daily`
  - `aggregate.file-churn.daily`
  - `aggregate.issue-resolution.daily`
  - `aggregate.contributor-network.daily`

## 7.4 Service boundary redesign

- Sentinel remains webhook ingress + WebSocket broker.
- Auditor splits logically into:
  - ingestion processors
  - aggregation workers
  - publication adapter
- Scheduler layer introduced:
  - Airflow DAGs for production daily pipelines
  - optional local fallback with repeatable BullMQ jobs
- Cockpit expands to domain dashboards and richer drill-down APIs.

## 8. Frontend redesign direction tied to backend expansion

## 8.1 UX architecture direction

Evolve cockpit from PR-centric control room to multi-domain engineering intelligence workspace.

Target navigation:

- Overview (cross-domain summary)
- PR Lifecycle (existing, retained)
- Repo Activity Stability (new)
- Codebase Heatmap (new)
- Issue Resolution (new)
- Contributor Network (new)

## 8.2 Shared filter model

Global filters (single source of truth):

- Repository
- Time window
- Data freshness mode (live, near-real-time, daily aggregate)
- Domain-specific optional filter (label, file path prefix, contributor group)

All pages read and preserve these filters through URL query state.

## 8.3 Data freshness and history semantics

- PR stream: real-time and history blend (existing pattern retained).
- Commit/issue/contributor analytics: daily aggregated baseline with explicit `last_aggregated_at`.
- UI must always disclose freshness:
  - data timestamp
  - data source (live event vs aggregate table)
  - delay expectations

## 8.4 Interaction patterns

- Click-through consistency:
  - repo card -> repo detail
  - hot file -> file history pane
  - slow issue label -> label drill-down
  - contributor node -> collaboration detail drawer
- Unified status system:
  - healthy, warning, critical semantics across domains

## 9. Phased roadmap (with dependency and blocker logic)

## 9.1 Phase 0: stabilization and architecture readiness

Goals:

- Harden current PR pipeline as foundation.
- Standardize data/client patterns.
- Add baseline observability and test scaffolding.

Deliverables:

- Shared Prisma access pattern in all apps
- Processor/API unit tests for existing PR flows
- Queue and worker health telemetry baseline
- Setup/config drift fixes

Blockers removed for Phase 1:

- predictable behavior under load
- confidence in regression detection

## 9.2 Phase 1: data model and ingestion expansion

Goals:

- Introduce commit and issue domains.
- Define ingestion contracts and storage strategy.

Deliverables:

- Schema additions for commits/issues/file changes
- Ingestion jobs and processors for commit/issue data
- Historical backfill jobs with pagination/rate-limit controls

Dependencies:

- Phase 0 quality and observability baseline

## 9.3 Phase 2: analytics aggregation and API layer

Goals:

- Build stable daily aggregates for repo health, churn, issue resolution, contributor graph.

Deliverables:

- Daily aggregation jobs and idempotent rerun model
- Airflow DAG orchestration for production schedule
- New domain APIs for health/churn/issues/network

Dependencies:

- Phase 1 data completeness and historical backfill maturity

## 9.4 Phase 3: cockpit UI integration and graph hardening

Goals:

- Deliver cross-domain analytics experience.

Deliverables:

- New pages and dashboards for projects 1/4/6/9
- Shared filter system across domains
- Contributor network graph interactions and cluster views
- UI freshness indicators and drill-down flows

Dependencies:

- Phase 2 APIs and aggregate quality thresholds

## 10. Quality gates and validation checklist

## 10.1 Completeness checks

- Sentinel, Auditor, Cockpit, DB, Queue, and scripts documented.
- Projects 1/4/6/9 each include fit, gaps, and integration strategy.

## 10.2 Cross-reference checks

- Every identified issue maps to current implementation behavior.
- Every redesign proposal maps to a specific current limitation.

## 10.3 Consistency checks

- Shared terminology:
  - repo activity
  - churn
  - resolution time
  - contributor network
- No conflicting interface or sequencing guidance between docs.

## 10.4 Decision-completeness checks

- Implementers can execute without redefining architecture direction.
- Open assumptions are explicit and bounded.

## 11. Explicit assumptions and defaults

- `documentation/` remains local-only and is git-ignored by request.
- This package is planning-only and does not mutate runtime behavior.
- Near-complete structure excludes `node_modules` and generated build outputs.
- Airflow is the target production scheduler for daily aggregations; local fallback scheduling may use existing queue tooling.
- Existing PR dashboard remains a first-class domain during expansion (not replaced immediately).

## 12. Forward-looking architecture extension: Dashboard V2 + RAG + visual knowledge graph

This section introduces a future extension path that complements the current analytics architecture without replacing the existing roadmap.

Primary reference:

- `documentation/dashboard-v2-rag-obsidian-blueprint.md`

### 12.1 Why this extension matters

- The dashboard UX still carries PR-centric interaction assumptions.
- Repository intelligence is expanding and requires cleaner cross-domain navigation.
- AI assistance quality depends on reliable retrieval over repository-grounded knowledge.

### 12.2 Proposed capability additions

- Dashboard V2 modernization:
  - cleaner IA and consistent interaction language
  - stronger filter/freshness consistency
- Smart RAG system:
  - ingestion from readmes, repo metadata, and file tree snapshots
  - hybrid retrieval with citation-first responses
  - evaluation and confidence gating
- Obsidian-style graph export:
  - markdown vault generation with internal links
  - architecture-visible graph exploration

### 12.3 Alignment with existing system boundaries

- Sentinel remains ingress and stream broker.
- Auditor and future workers extend ingestion/indexing responsibilities.
- Cockpit expands with a knowledge-assistant surface and source-trace UX.
- Scheduler and ops layer handle index refresh and quality/cost monitoring.

### 12.4 Implementation stance

- Planning first, implementation second.
- Runtime baseline for this extension is now active.

### 12.5 Runtime baseline delivered (2026-04-21)

- Obsidian-compatible project vault generation implemented in `scripts/generate-obsidian-graph.cjs`.
- Continuous graph regeneration implemented in `scripts/watch-obsidian-graph.cjs`.
- Graph and retrieval entry scripts added at root package level:
  - `npm run graph:build`
  - `npm run graph:watch`
- Cockpit integration started with a new Knowledge Assistant route (`/knowledge`) and supporting APIs.
- Repository-grounded chunk index generation enabled as part of graph build output.
