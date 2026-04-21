# Appendix A: Repository Structure and Runtime Interaction Map

Last updated: 2026-04-12
Scope: near-complete tree excluding vendor/build outputs (`node_modules`, `dist`)

## 1. Near-complete repository tree

```text
GitFlow/
|-- README.md
|-- tasks.md
|-- start.bat
|-- docker-compose.yml
|-- package.json
|-- package-lock.json
|-- tsconfig.json
|-- turbo.json
|-- gfp.png
|-- .env.example
|
|-- apps/
|   |-- sentinel/
|   |   |-- package.json
|   |   |-- tsconfig.json
|   |   `-- src/
|   |       |-- index.ts
|   |       |-- middleware/
|   |       |   `-- verify-signature.ts
|   |       `-- routes/
|   |           |-- health.ts
|   |           `-- webhook.ts
|   |
|   |-- auditor/
|   |   |-- package.json
|   |   |-- tsconfig.json
|   |   `-- src/
|   |       |-- worker.ts
|   |       |-- processors/
|   |       |   |-- pr-opened.ts
|   |       |   |-- pr-closed.ts
|   |       |   `-- pr-review.ts
|   |       `-- services/
|   |           |-- github-auth.ts
|   |           |-- enrichment.ts
|   |           `-- idempotency.ts
|   |
|   `-- cockpit/
|       |-- package.json
|       |-- tsconfig.json
|       |-- next.config.mjs
|       |-- postcss.config.mjs
|       |-- tailwind.config.ts
|       |-- components.json
|       |-- next-env.d.ts
|       |-- README.md
|       |-- public/
|       |   |-- gfp.png
|       |   |-- next.svg
|       |   `-- vercel.svg
|       `-- src/
|           |-- app/
|           |   |-- globals.css
|           |   |-- layout.tsx
|           |   |-- page.tsx
|           |   |-- prs/page.tsx
|           |   |-- bottlenecks/page.tsx
|           |   `-- api/
|           |       |-- repositories/route.ts
|           |       `-- live-events/route.ts
|           |-- components/
|           |   |-- layout/
|           |   |   |-- Sidebar.tsx
|           |   |   `-- Topbar.tsx
|           |   |-- dashboard/
|           |   |   |-- BottleneckTable.tsx
|           |   |   |-- DoraMetricsGrid.tsx
|           |   |   |-- MergeFrictionHeatmap.tsx
|           |   |   |-- PRLifecycleChart.tsx
|           |   |   |-- PRLiveCard.tsx
|           |   |   `-- ReviewsBarChart.tsx
|           |   `-- ui/
|           |       `-- FloPanda.tsx
|           `-- lib/
|               |-- store.ts
|               |-- utils.ts
|               `-- websocket.ts
|
|-- packages/
|   |-- db/
|   |   |-- package.json
|   |   |-- tsconfig.json
|   |   |-- index.ts
|   |   `-- prisma/
|   |       `-- schema.prisma
|   |
|   |-- queue/
|   |   |-- package.json
|   |   |-- tsconfig.json
|   |   |-- index.ts
|   |   `-- src/
|   |       |-- jobs.ts
|   |       `-- queues.ts
|   |
|   `-- shared/
|       |-- package.json
|       |-- tsconfig.json
|       |-- index.ts
|       `-- src/
|           |-- health-score.ts
|           |-- metrics.ts
|           `-- types.ts
|
`-- scripts/
    |-- check-events.ts
    `-- sync.ts
```

## 2. Ownership by subsystem

| Subsystem | Primary responsibility | Runtime role |
|---|---|---|
| `apps/sentinel` | Ingress and stream broker | Accept webhooks, verify signature, enqueue jobs, relay Redis pub/sub to WebSocket clients |
| `apps/auditor` | Event processing and writes | Consume queue jobs, route by event action, update DB, mark idempotency, publish dashboard updates |
| `apps/cockpit` | Product UI and read APIs | Render dashboards, expose read routes, connect WebSocket client |
| `packages/db` | Data schema and client export | Prisma schema and typed DB access |
| `packages/queue` | Queue contract and connection helpers | Shared queue names, job payload contracts, Redis config for BullMQ |
| `packages/shared` | Shared domain logic | Metrics and health scoring logic used by processors |
| `scripts` | Operational scripts | Historical sync and event count diagnostics |
| Infra (`docker-compose`, `.env`) | Runtime dependencies and configuration | Local PostgreSQL + Redis and app credentials |

## 3. API interaction map

## 3.1 External ingress APIs

### `POST /webhook` (Sentinel)

- Input:
  - GitHub webhook payload
  - Headers: `x-github-event`, `x-github-delivery`, `x-hub-signature-256`
- Processing:
  - Verify signature
  - Build idempotency hash
  - Enqueue BullMQ job
- Output:
  - `202 Accepted` with delivery id or error
- Downstream consumers:
  - Auditor worker via `gitflow-webhooks` queue

### `GET /health` (Sentinel)

- Input: none
- Output: service health payload
- Downstream consumers:
  - Cockpit live page diagnostics poller

## 3.2 Cockpit read APIs

### `GET /api/repositories`

- Input: none
- Query behavior:
  - Select repository full names (max 500)
  - Sorted ascending
- Output:
  - repository list for filter controls
- Downstream consumers:
  - Topbar repository selector

### `GET /api/live-events`

- Input:
  - query params: `repo`, `window`, `limit`
- Query behavior:
  - Fetch PRs and related reviews with time filtering
  - Materialize synthetic historical event objects
  - Sort descending by timestamp
- Output:
  - event list used to backfill event wall
- Downstream consumers:
  - PR stream page history loader

## 3.3 Real-time stream interface

### `ws://<sentinel-host>/ws`

- Message source:
  - Redis `gitflow:dashboard-updates` publications from Auditor
- Current payload type:
  - `PR_UPDATE` messages with action, repo, PR number, state, timestamp
- Downstream consumers:
  - Cockpit Zustand store and PR live cards

## 4. Processing map: state transitions and storage touchpoints

## 4.1 PR opened / reopened

1. Receive webhook.
2. Enqueue queue job.
3. Auditor routes `pull_request.opened` or `pull_request.reopened`.
4. Upsert `repositories`.
5. Upsert author `users`.
6. Upsert `pull_requests` with baseline fields and default health grade.
7. Insert idempotency record in `events`.
8. Publish stream update.

Storage touched:

- `repositories`
- `users`
- `pull_requests`
- `events`

## 4.2 PR closed / merged

1. Auditor routes `pull_request.closed`.
2. Resolve repository and PR row.
3. Calculate merge/lifecycle latencies.
4. Update `pull_requests` state and timestamps.
5. Insert idempotency record.
6. Publish stream update.

Storage touched:

- `pull_requests`
- `events`

## 4.3 PR review submitted

1. Auditor routes `pull_request_review.submitted`.
2. Resolve repository and PR row.
3. Upsert reviewer in `users`.
4. Calculate first review timestamp/latency and health grade if needed.
5. Update PR metrics fields.
6. Insert review record.
7. Insert idempotency record.
8. Publish stream update.

Storage touched:

- `users`
- `pull_requests`
- `reviews`
- `events`

## 5. Data-to-UI traceability (what is shown and where it comes from)

| UI surface | Source data | API/query path | Display component/page |
|---|---|---|---|
| Overview cards (merged, avg times, reviews, open PRs) | `pull_requests`, `reviews`, `repositories` | Server-side Prisma queries | `src/app/page.tsx` + `DoraMetricsGrid` |
| Lifecycle trend chart | `pull_requests.lifecycle_mins` grouped by merge date | Server-side Prisma queries | `src/app/page.tsx` + `PRLifecycleChart` |
| Recent merges list | merged PR rows with repo names | Server-side Prisma queries | `src/app/page.tsx` |
| Bottleneck stale table | open PRs older than threshold with no reviews | Server-side Prisma queries | `src/app/bottlenecks/page.tsx` + `BottleneckTable` |
| Reviewer load bar chart | review group-by reviewer_id | Server-side Prisma queries | `src/app/bottlenecks/page.tsx` + `ReviewsBarChart` |
| Merge friction heatmap | created_at to merged_at delays bucketed by day/time | Server-side Prisma queries | `src/app/bottlenecks/page.tsx` + `MergeFrictionHeatmap` |
| Repository filter options | repository names | `GET /api/repositories` | `Topbar` |
| PR event history | synthetic events from PR/review records | `GET /api/live-events` | `src/app/prs/page.tsx` |
| PR live stream cards | Redis->WS `PR_UPDATE` payload | WebSocket client hook | `src/app/prs/page.tsx` + `PRLiveCard` |
| Stream diagnostics | WS state + health polling + logs | client store + sentinel health API | `src/app/prs/page.tsx` |

## 6. Architecture observations that matter for redesign

- Current UI and API contracts are PR-first, not repo-health-first.
- Backfill and live-stream event schemas are synthetic and PR-specific.
- Existing repository + window filters are reusable as the base global filter system.
- WebSocket transport is useful for live badges/alerts, while heavier analytics should remain API + aggregate-table driven.
