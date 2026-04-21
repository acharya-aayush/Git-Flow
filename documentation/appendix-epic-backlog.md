# Appendix B: Epic Backlog, Milestones, and Acceptance Criteria

Last updated: 2026-04-12
Purpose: implementation-ready backlog for stabilization and expansion to projects 1/4/6/9

## 1. Milestone ordering with blocker relationships

```text
M0 Foundation Stabilization
  blocks -> M1 Data Domain Expansion
M1 Data Domain Expansion
  blocks -> M2 Aggregation and Scheduling
M2 Aggregation and Scheduling
  blocks -> M3 API Expansion
M3 API Expansion
  blocks -> M4 Frontend Domain Rollout
M4 Frontend Domain Rollout
  blocks -> M5 Hardening and Production Readiness
M5 Hardening and Production Readiness
```

Projects mapped to milestones:

- Project 1: M1 -> M2 -> M3 -> M4
- Project 4: M1 -> M2 -> M3 -> M4
- Project 6: M1 -> M2 -> M3 -> M4
- Project 9: M1 -> M2 -> M3 -> M4 (plus extra hardening in M5)

## 2. Epic backlog

## Epic E0: Stabilize current PR platform

Objective:

- Reduce regression and data-quality risk before adding new domains.

Scope:

- Add processor and API tests for current PR flow.
- Standardize database client usage across apps.
- Add observability baseline (queue lag, job success/failure, processing latency).
- Resolve setup/config drift and improve runbook fidelity.

Dependencies:

- None.

Key risks:

- Discovering hidden assumptions in existing event handling.

Acceptance criteria:

- Existing PR metrics and stream behavior unchanged and validated.
- Test suite covers PR opened/closed/review processors and key read APIs.
- Instrumentation available for queue and worker health.

Workstream split:

- Backend: tests, worker instrumentation, client standardization.
- Data: idempotency audit checks.
- Ops: local/prod runbook and health checklist.
- Frontend: none beyond regression verification.

## Epic E1: Expand schema to commit and issue domains

Objective:

- Introduce first-class entities needed for projects 1/4/6/9.

Scope:

- Add schema for commits, commit file changes, issues, issue labels.
- Add indexes for repo/time-window query patterns.
- Define normalized identities for contributors across domains.

Dependencies:

- E0 complete.

Key risks:

- Schema bloat and expensive queries without indexing strategy.

Acceptance criteria:

- Schema supports ingestion and aggregation use cases for all four new projects.
- Query plans for top read patterns are index-backed.
- Migration plan is reversible/safe in non-production and production environments.

Workstream split:

- Data: schema design, indexes, migration scripts.
- Backend: model access wrappers and repository-layer contracts.
- Ops: migration rollout checklist.
- Frontend: none.

## Epic E2: Commit ingestion and file diff extraction (Projects 1 and 4)

Objective:

- Capture commit activity and file-level change facts.

Scope:

- Build ingestion pipeline for commit history by repository.
- Extract and persist per-file change metrics.
- Implement backfill strategy with pagination and rate-limit handling.

Dependencies:

- E1 complete.

Key risks:

- API rate limits and large-repo backfill time.
- Data duplication if idempotency keys are weak.

Acceptance criteria:

- Commit and file-change records are complete for configured repositories/windows.
- Re-runs are idempotent.
- Backfill job resumes safely after interruption.

Workstream split:

- Backend: ingestion workers and idempotent upserts.
- Data: commit/file-change table quality checks.
- Ops: quota guardrails and retry policies.
- Frontend: none.

## Epic E3: Issue ingestion and resolution fact generation (Project 6)

Objective:

- Capture issue lifecycle and label metadata for resolution analytics.

Scope:

- Ingest issue create/close data and labels per repository.
- Persist issue lifecycle facts and label associations.
- Normalize issue type groupings for reporting.

Dependencies:

- E1 complete.

Key risks:

- Label taxonomy inconsistency across repositories.

Acceptance criteria:

- For target repos, issue lifecycle and labels are queryable by time window.
- Resolution-time facts are reproducible across reruns.
- Label aggregation remains stable under taxonomy drift rules.

Workstream split:

- Backend: issue ingestion jobs and lifecycle calculators.
- Data: label normalization logic and audit checks.
- Ops: ingestion scheduling and error alerting.
- Frontend: none.

## Epic E4: Aggregation engine and scheduling layer (Projects 1/4/6/9)

Objective:

- Produce deterministic daily aggregates for analytics APIs and dashboards.

Scope:

- Build daily aggregation jobs:
  - repo activity health
  - file churn and heatmap ranks
  - issue resolution by label/repo
  - contributor collaboration edges
- Introduce scheduler/orchestrator:
  - Airflow DAGs for production
  - local fallback repeatable jobs for development

Dependencies:

- E2 and E3 complete.

Key risks:

- Inconsistent windows/timezones across jobs.
- Long-running jobs without clear partitioning.

Acceptance criteria:

- Daily aggregates are available with explicit `as_of` timestamp.
- Backfill and daily runs produce consistent results.
- Scheduler retries, failure visibility, and run metadata are operational.

Workstream split:

- Data: aggregate models and job logic.
- Backend: job runners and orchestration integration.
- Ops: Airflow deployment, DAG monitoring, incident runbooks.
- Frontend: freshness label requirements defined.

## Epic E5: API expansion for new analytics domains

Objective:

- Expose stable read APIs for all new domains.

Scope:

- Add API routes:
  - repo health
  - file heatmap
  - issue resolution
  - contributor network
- Standardize filtering and pagination contracts.
- Add API-level validation and error envelopes.

Dependencies:

- E4 complete.

Key risks:

- Inconsistent response contracts causing frontend complexity.

Acceptance criteria:

- New endpoints return stable, documented schemas.
- API responses include freshness metadata (`as_of`, `source`).
- Query latency meets dashboard target thresholds.

Workstream split:

- Backend: route handlers, query optimization, contract tests.
- Data: aggregate-read query tuning.
- Frontend: contract agreement and mocking.
- Ops: API monitoring dashboards.

## Epic E6: Frontend domain rollout and UX redesign

Objective:

- Turn cockpit into a multi-domain engineering intelligence workspace.

Scope:

- Add pages/views for:
  - Repo Activity Stability
  - Codebase Heatmap
  - Issue Resolution
  - Contributor Network
- Implement shared global filter state across domains.
- Add freshness indicators and drill-down interactions.

Dependencies:

- E5 complete.

Key risks:

- UX fragmentation if each page invents new filter semantics.

Acceptance criteria:

- All new pages consume shared filter model.
- Cross-domain navigation preserves scope and window.
- Users can answer key questions from each target project.

Workstream split:

- Frontend: page builds, components, filter state, interactions.
- Backend: API adaptation based on UI feedback.
- Data: validate rendered metrics against aggregates.
- Ops: dashboard availability and client error telemetry.

## Epic E7: Contributor network analytics hardening (Project 9 focus)

Objective:

- Ensure contributor graph accuracy and usability at scale.

Scope:

- Refine edge weighting and clustering thresholds.
- Add controls for noise filtering (minimum shared files/weight).
- Add graph quality checks and regression datasets.

Dependencies:

- E4, E5, E6 complete.

Key risks:

- Graph noise overwhelms insights in high-volume repositories.

Acceptance criteria:

- Graph view is interpretable for small and large repos.
- Cluster outputs remain stable across adjacent daily runs.
- Performance acceptable for target repository sizes.

Workstream split:

- Data: graph algorithm tuning and validation.
- Backend: query shaping and caching strategy.
- Frontend: graph rendering and interaction performance.
- Ops: compute-resource profiling and alerting.

## Epic E8: Production readiness and governance

Objective:

- Secure, monitor, and operationalize expanded analytics platform.

Scope:

- Secrets hardening and key handling policy.
- SLOs and alerts for ingestion, aggregation, and API read health.
- Data retention and reprocessing policy.
- Cost and quota governance for GitHub API usage.

Dependencies:

- E0 through E7 complete or in stable beta.

Key risks:

- Unbounded ingestion/aggregation cost.
- Hidden data drift without governance.

Acceptance criteria:

- SLO dashboards and alert channels active.
- Incident response docs validated via drills.
- API quota and run-cost budgets tracked and enforced.

Workstream split:

- Ops: monitoring, alerting, governance.
- Backend/Data: resilience and retention hooks.
- Frontend: error states and degraded-mode UX.

## 3. Cross-project coverage matrix by epic

| Epic | Project 1 | Project 4 | Project 6 | Project 9 |
|---|---|---|---|---|
| E0 Stabilization | Required | Required | Required | Required |
| E1 Schema expansion | Required | Required | Required | Required |
| E2 Commit + file ingestion | Required | Required | Optional | Required |
| E3 Issue ingestion | Optional | Optional | Required | Optional |
| E4 Aggregations + scheduler | Required | Required | Required | Required |
| E5 API expansion | Required | Required | Required | Required |
| E6 Frontend rollout | Required | Required | Required | Required |
| E7 Network hardening | Optional | Optional | Optional | Required |
| E8 Production governance | Required | Required | Required | Required |

## 4. Release slicing recommendation

Release slice R1:

- E0 + E1 + E2 + E4 (repo activity basic) + E5 (repo health endpoints) + minimal E6 view

Release slice R2:

- E2 (full file churn) + E4 churn aggregates + E5 heatmap endpoint + E6 heatmap UI

Release slice R3:

- E3 + E4 issue resolution + E5 issue endpoints + E6 issue UI

Release slice R4:

- E4 contributor edges + E5 network endpoints + E6 network UI + E7 hardening

Release slice R5:

- E8 production readiness closure across all domains

## 5. Exit criteria for full program completion

- All four project capabilities are live with documented freshness semantics.
- Data pipelines run on daily schedule with monitored success rates.
- Dashboard users can answer:
  - Is this repo active or degrading?
  - Which files/modules are highest churn risk?
  - How long issues take by type/label?
  - How contributors collaborate and cluster?
- Regression suite protects existing PR intelligence while supporting expanded domains.

## 6. Forward initiative: Dashboard V2 and RAG knowledge system

This section captures a future initiative planned after core stabilization.

Reference blueprint:

- `documentation/dashboard-v2-rag-obsidian-blueprint.md`

## Epic E9: Dashboard V2 modernization

Objective:

- Deliver a cleaner, more consistent, GitHub-like dashboard experience across all domains.

Implementation status (2026-04-21):

- In progress (baseline shipped: Knowledge Assistant route, shared shell integration).

Scope:

- Information architecture refresh for domain-first navigation.
- Shared filter and freshness patterns across every analytics page.
- Visual simplification and consistency pass for cards, charts, tables, and states.

Dependencies:

- E6 and E8 must be stable.

Key risks:

- UX churn without measurable usability gains.

Acceptance criteria:

- Cross-page filter persistence is consistent and test-covered.
- Users can navigate between domains without losing context.
- Dashboard visual language is consistent and documented.

Workstream split:

- Frontend: IA, components, interaction standards.
- Backend: support contracts for consistent filters/freshness.
- Data: metric-to-source traceability.
- Ops: client telemetry and UX error monitoring.

## Epic E10: Repository-grounded RAG assistant

Objective:

- Build a smart, efficient assistant that answers from repository-grounded evidence.

Implementation status (2026-04-21):

- In progress (baseline shipped: local chunk index generation, lexical retrieval API, citation payload response contract).

Scope:

- Ingestion from readmes, repository metadata, and file tree snapshots.
- Hybrid retrieval pipeline (dense + lexical + rerank).
- Grounded generation with citations and confidence gating.
- Evaluation dataset and retrieval/answer quality scoring.

Dependencies:

- E8 stability baseline and observability readiness.

Key risks:

- Weak retrieval quality causes confident but inaccurate answers.
- Cost growth if indexing/retrieval is not bounded.

Acceptance criteria:

- Assistant responses include source citations.
- Retrieval and answer quality metrics are tracked over time.
- P95 query latency and cost budgets are defined and enforced.

Workstream split:

- Backend: ingestion, indexing, retrieval orchestration.
- Data: metadata model, evaluation corpora, quality scoring.
- Frontend: assistant UX and citation viewer.
- Ops: index refresh jobs, cost guards, model/runtime observability.

## Epic E11: Obsidian visual knowledge graph export

Objective:

- Generate an Obsidian-compatible markdown knowledge vault that mirrors project structure and relationships.

Implementation status (2026-04-21):

- In progress (baseline shipped: vault note generation, internal link graph, auto-update watcher on file changes).

Scope:

- Note generation for repositories, folders, and selected files.
- Internal-link generation (note, heading, and block references where applicable).
- Graph grouping conventions for architecture domains.

Dependencies:

- E10 ingestion metadata pipeline.

Key risks:

- Graph noise from over-linking and low-value notes.

Acceptance criteria:

- Vault export runs deterministically for the same snapshot.
- Local and global graph views remain navigable.
- Orphan and stale-note reports are generated.

Workstream split:

- Backend: vault export pipeline and link generation.
- Data: note/link quality heuristics.
- Frontend/UX: graph semantics and navigation conventions.
- Ops: snapshot schedule and storage lifecycle.

