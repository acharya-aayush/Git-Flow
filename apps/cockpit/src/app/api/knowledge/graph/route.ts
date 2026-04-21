import { NextResponse } from 'next/server';
import { resolveWorkspacePath, readJsonFile } from '@/lib/knowledge/workspace-path';

export const dynamic = 'force-dynamic';

type KnowledgeGraphData = {
  generated_at: string;
  snapshot: string;
  repo_name: string;
  node_count: number;
  edge_count: number;
  nodes: Array<{
    id: string;
    kind: 'folder' | 'file';
    path: string;
    note: string;
    group: string;
  }>;
  edges: Array<{
    from: string;
    to: string;
    type: 'contains' | 'imports';
  }>;
};

export async function GET() {
  const graphPath = resolveWorkspacePath('knowledge', 'obsidian-vault', 'graph-data.json');
  const graph = readJsonFile<KnowledgeGraphData | null>(graphPath, null);

  if (!graph) {
    return NextResponse.json({
      error: 'Graph data not found. Run `npm run graph:build` first.',
      graph: null,
    }, { status: 404 });
  }

  return NextResponse.json({ graph });
}
