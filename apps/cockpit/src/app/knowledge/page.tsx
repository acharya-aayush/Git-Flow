'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';

type GraphNode = {
  id: string;
  kind: 'folder' | 'file';
  path: string;
  note: string;
  group: string;
};

type GraphEdge = {
  from: string;
  to: string;
  type: 'contains' | 'imports';
};

type GraphPayload = {
  generated_at: string;
  snapshot: string;
  repo_name: string;
  node_count: number;
  edge_count: number;
  nodes: GraphNode[];
  edges: GraphEdge[];
};

type Citation = {
  chunkId: string;
  filePath: string;
  headingPath: string;
  sourceKind: string;
  lastUpdatedAt: string;
  score: number;
  excerpt: string;
};

type AskResponse = {
  answer: string;
  confidence: number;
  citations: Citation[];
  totalChunks: number;
  snapshot: string;
};

export const dynamic = 'force-dynamic';

export default function KnowledgePage() {
  const [graph, setGraph] = useState<GraphPayload | null>(null);
  const [graphError, setGraphError] = useState<string | null>(null);
  const [question, setQuestion] = useState('Where are webhook ingestion and queue routing implemented?');
  const [isAsking, setIsAsking] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);
  const [answer, setAnswer] = useState<AskResponse | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadGraph = async () => {
      try {
        const response = await fetch('/api/knowledge/graph', {
          cache: 'no-store',
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'failed to load graph');
        }

        if (!cancelled) {
          setGraph(data.graph);
          setGraphError(null);
        }
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : 'failed to load graph';
          setGraph(null);
          setGraphError(message);
        }
      }
    };

    loadGraph();

    return () => {
      cancelled = true;
    };
  }, []);

  const topGroups = useMemo(() => {
    if (!graph) {
      return [];
    }

    const counts = new Map<string, number>();
    for (const node of graph.nodes) {
      const key = node.group || '.';
      counts.set(key, (counts.get(key) || 0) + 1);
    }

    return Array.from(counts.entries())
      .map(([group, count]) => ({ group, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [graph]);

  const handleAsk = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (question.trim().length < 3) {
      setAskError('Question must be at least 3 characters.');
      return;
    }

    setIsAsking(true);
    setAskError(null);

    try {
      const response = await fetch('/api/knowledge/ask', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          query: question,
          topK: 5,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'failed to answer');
      }

      setAnswer(payload as AskResponse);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'failed to answer';
      setAskError(message);
    } finally {
      setIsAsking(false);
    }
  };

  return (
    <div className="space-y-5 py-2">
      <section className="panel">
        <div className="panel-body">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Knowledge Assistant</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-100">Obsidian Graph + Smart Retrieval</h2>
          <p className="mt-2 text-sm text-slate-300/85">
            The project graph and retrieval index are generated from local source files so debugging can start from a map, not random file scanning.
          </p>
          <p className="mt-3 inline-flex rounded-md border border-border bg-[#0d1117] px-2 py-1 text-xs text-slate-300">
            Build graph: npm run graph:build | Live update: npm run graph:watch
          </p>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="panel">
          <div className="panel-body">
            <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Nodes</p>
            <p className="metric-mono mt-2 text-2xl text-slate-100">{graph?.node_count ?? '--'}</p>
          </div>
        </div>
        <div className="panel">
          <div className="panel-body">
            <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Edges</p>
            <p className="metric-mono mt-2 text-2xl text-slate-100">{graph?.edge_count ?? '--'}</p>
          </div>
        </div>
        <div className="panel">
          <div className="panel-body">
            <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Snapshot</p>
            <p className="metric-mono mt-2 text-sm text-slate-200">{graph?.snapshot ?? '--'}</p>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_1fr]">
        <div className="panel">
          <div className="panel-header">
            <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-100">Ask From Indexed Knowledge</h3>
          </div>
          <div className="panel-body space-y-3">
            <form onSubmit={handleAsk} className="space-y-3">
              <textarea
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                className="min-h-28 w-full rounded-md border border-border bg-[#0d1117] px-3 py-2 text-sm text-slate-100 outline-none focus:border-[#2f81f7]"
                placeholder="Ask a grounded project question..."
              />
              <button
                type="submit"
                disabled={isAsking}
                className="rounded-md border border-[#1f6feb]/60 bg-[#1f6feb]/20 px-3 py-1.5 text-sm font-medium text-[#9ecbff] transition hover:bg-[#1f6feb]/30 disabled:opacity-60"
              >
                {isAsking ? 'Searching...' : 'Ask'}
              </button>
            </form>

            {askError ? (
              <div className="rounded-md border border-[#da3633]/40 bg-[#490202]/20 px-3 py-2 text-sm text-[#ffb4b4]">
                {askError}
              </div>
            ) : null}

            {answer ? (
              <div className="space-y-3">
                <div className="rounded-md border border-border bg-[#0d1117] px-3 py-2">
                  <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Answer</p>
                  <pre className="mt-2 whitespace-pre-wrap text-sm text-slate-100">{answer.answer}</pre>
                  <p className="mt-2 text-xs text-slate-400">
                    Confidence: <span className="metric-mono text-slate-200">{answer.confidence}</span>
                    {' | '}Chunks indexed: <span className="metric-mono text-slate-200">{answer.totalChunks}</span>
                  </p>
                </div>

                <div className="space-y-2">
                  {answer.citations.map((citation) => (
                    <div key={citation.chunkId} className="rounded-md border border-border bg-[#0d1117] px-3 py-2">
                      <p className="text-xs text-slate-300">
                        <span className="metric-mono text-slate-100">{citation.filePath}</span>
                        {' • '}
                        {citation.headingPath}
                        {' • score '}
                        <span className="metric-mono">{citation.score}</span>
                      </p>
                      <p className="mt-1 text-xs text-slate-400">{citation.excerpt}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-100">Graph Domains</h3>
          </div>
          <div className="panel-body space-y-2">
            {graphError ? (
              <div className="rounded-md border border-[#da3633]/40 bg-[#490202]/20 px-3 py-2 text-sm text-[#ffb4b4]">
                {graphError}
              </div>
            ) : null}

            {topGroups.length === 0 ? (
              <p className="text-sm text-slate-400">No graph snapshot loaded.</p>
            ) : (
              topGroups.map((group) => (
                <div key={group.group} className="flex items-center justify-between rounded-md border border-border bg-[#0d1117] px-3 py-2">
                  <span className="text-sm text-slate-200">{group.group}</span>
                  <span className="metric-mono text-xs text-slate-400">{group.count}</span>
                </div>
              ))
            )}

            <div className="rounded-md border border-border/70 bg-[#0d1117] px-3 py-2 text-xs text-slate-400">
              Open Obsidian at <span className="metric-mono text-slate-300">knowledge/obsidian-vault</span> and use Graph View for the full visual map.
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
