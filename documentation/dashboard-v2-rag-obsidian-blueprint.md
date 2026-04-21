# Dashboard V2 + RAG + Obsidian Blueprint

Last updated: 2026-04-21
Audience: Product owner, architecture lead, backend/frontend implementers
Status: Active implementation blueprint (P0/P1 foundation in progress)

## 1. Why this initiative exists

Current cockpit capabilities are useful, but the UI still feels anchored to PR-centric workflows and older information density patterns.

Target outcome:

- A cleaner, GitHub-like dashboard shell and navigation model.
- A production-capable RAG system that can answer using repository-grounded context.
- A visual knowledge graph workflow inspired by Obsidian linking and graph view.

This blueprint is intentionally implementation-ready but execution-neutral for now.

## 2. Design principles for Dashboard V2

## 2.1 UI principles

- Use low-noise, neutral surfaces and subtle borders.
- Prioritize information hierarchy over decorative styling.
- Keep controls predictable across pages (same filter placement, same behaviors).
- Preserve GitHub-like interaction expectations (labels, status colors, compact tables, readable cards).

## 2.2 Navigation and IA direction

- Keep PR Lifecycle as a first-class domain, but not the only center.
- Introduce domain-first tabs/pages:
  - Overview
  - Repo Stability
  - Heatmap
  - Issues
  - Contributors
  - Bottlenecks
  - Knowledge Assistant (future)
- Keep a single global filter state (repo, window, freshness) across all routes.

## 2.3 UX quality goals

- Page switch should preserve context and filter state.
- Each page should answer one primary question in under 10 seconds.
- Every metric card or chart should expose source freshness and drill-down path.

## 3. Smart RAG system proposal

## 3.1 Scope of knowledge sources

Primary sources for first implementation:

- Repository README files.
- Repository descriptions and metadata.
- File/folder structure snapshots.
- Selected documentation folder content.

Secondary sources (future):

- Pull request summaries and commit messages.
- Issue titles/bodies/labels.
- Architecture decision records.

## 3.2 Retrieval architecture recommendation

Recommended baseline: Hybrid RAG with a strict 2-step default and optional iterative retry.

- 2-step path for speed and predictability:
  1. Retrieve.
  2. Generate with citations.
- Hybrid improvements for harder queries:
  - Query enhancement/rewrite.
  - Retrieval sufficiency checks.
  - Answer quality checks.

Rationale:

- LangChain retrieval guidance supports 2-step, agentic, and hybrid models.
- For GitFlow, predictable latency should be the default, with iterative fallback only when confidence is low.

## 3.3 Ingestion and indexing strategy

Pipeline stages:

1. Load documents from repository snapshots and docs.
2. Normalize markdown and code metadata.
3. Chunk into retrieval units.
4. Generate embeddings.
5. Store in vector index and lexical index.
6. Persist metadata and source pointers.

Chunking approach:

- Retrieval chunk: smaller chunks for precision.
- Synthesis context: expanded windows around winning chunks.

This follows production RAG guidance that retrieval chunking and synthesis chunking should be decoupled.

## 3.4 Metadata model for retrieval filters

Required metadata for each chunk:

- repo_name
- branch_or_snapshot_id
- file_path
- file_type
- heading_path
- last_updated_at
- source_kind (readme, docs, tree, issue, pr)

Benefits:

- Structured retrieval at scale.
- Filtered search by repo/path/domain.
- Better citation quality.

## 3.5 Retrieval quality controls

- Hybrid retrieval: dense + lexical.
- Re-ranking before generation.
- Context sufficiency checks.
- "I do not know" behavior when evidence is weak.
- Mandatory source citations in every answer.

## 3.6 Evaluation plan

Create a baseline evaluation set from real project questions:

- Architecture questions.
- Setup/debug questions.
- Ownership/path questions.

Track:

- Recall@k and MRR for retrieval.
- Citation coverage.
- Answer faithfulness and groundedness.
- Latency and token cost per query class.

## 4. Obsidian-style visual tree proposal

## 4.1 What gets generated

Generate a markdown vault snapshot from repository knowledge:

- One note per repository.
- One note per top-level folder.
- Optional one note per important file.
- Summary notes for domains (ingestion, dashboard, data model, ops).

## 4.2 Linking conventions

Use Obsidian-compatible internal links:

- Note links for hierarchy and ownership.
- Heading links for section-level references.
- Block links for key assertions and traceability.

Key idea: turn relationships into explicit links so graph views become useful and queryable.

## 4.3 Graph visualization workflow

- Global graph for whole-vault architecture view.
- Local graph for note-focused exploration.
- Groups by domain (backend, frontend, data, ops, docs).
- Filters for tags, attachments, and orphan notes.

## 4.4 Why this helps AI quality

- Forces explicit relationship modeling between artifacts.
- Improves retrieval context routing for multi-hop questions.
- Helps surface missing links and undocumented areas.

## 5. Proposed implementation phases

## Phase P0: Planning and contracts (today)

- Finalize architecture and success criteria.
- Define schema for chunk metadata and citation payloads.
- Define answer format and confidence policy.

## Phase P1: Knowledge ingestion foundation

- Build repository scanner for README, descriptions, and file tree snapshots.
- Build chunking + metadata pipeline.
- Build index writer (vector + lexical).

## Phase P2: Retrieval and answer generation

- Build baseline 2-step retrieval flow.
- Add re-ranking and sufficiency checks.
- Add grounded answer formatter with citations.

## Phase P3: Obsidian export and graph validation

- Export markdown vault from indexed knowledge.
- Generate links and tags.
- Validate graph readability and orphan detection.

## Phase P4: Cockpit integration

- Add Knowledge Assistant page.
- Add source citation panel and confidence indicators.
- Add feedback capture for evaluation loop.

## 5.1 Implementation progress (2026-04-21)

Delivered in runtime code:

- Auto-generated Obsidian-compatible vault graph with folder/file notes and import-link edges.
- Live graph watcher (`npm run graph:watch`) that rebuilds on workspace changes.
- Graph snapshot output and project topology note (`knowledge/obsidian-vault/Project Graph.md`).
- Foundational chunk index generation for repository-grounded retrieval (`knowledge/rag/chunks.json`).
- Cockpit Knowledge Assistant route and APIs:
  - `GET /api/knowledge/graph`
  - `POST /api/knowledge/ask`

Still open (next execution slices):

- Hybrid retrieval upgrade (dense + lexical + rerank) behind current lexical baseline.
- Citation quality scoring and automated evaluation dataset runner.
- Retrieval sufficiency fallback flow and feedback loop capture in cockpit.

## 6. Open decisions

- Vector store choice and hosting model.
- Embedding model selection (quality vs cost).
- Snapshot cadence (hourly vs daily vs event-driven).
- Access control for private knowledge in assistant answers.

## 7. Planning-level acceptance criteria

- Dashboard V2 direction is documented with explicit UI principles.
- RAG architecture is documented with ingestion, retrieval, and evaluation strategy.
- Obsidian-style graph workflow is documented with concrete linking rules.
- Phased implementation plan exists with clear P0-P4 boundaries.
