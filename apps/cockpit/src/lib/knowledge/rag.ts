import { resolveWorkspacePath, readJsonFile } from './workspace-path';

export type KnowledgeChunk = {
  id: string;
  repo_name: string;
  branch_or_snapshot_id: string;
  file_path: string;
  file_type: string;
  heading_path: string;
  last_updated_at: string;
  source_kind: string;
  content: string;
};

export type KnowledgeCitation = {
  chunkId: string;
  filePath: string;
  headingPath: string;
  sourceKind: string;
  lastUpdatedAt: string;
  score: number;
  excerpt: string;
};

export type KnowledgeAnswer = {
  answer: string;
  confidence: number;
  citations: KnowledgeCitation[];
  totalChunks: number;
  snapshot: string;
};

type KnowledgeManifest = {
  snapshot?: string;
};

const chunksPath = resolveWorkspacePath('knowledge', 'rag', 'chunks.json');
const manifestPath = resolveWorkspacePath('knowledge', 'rag', 'manifest.json');

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9_./-]+/g, ' ')
    .split(/\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 2);
}

function getChunkScore(chunk: KnowledgeChunk, queryTerms: string[]): number {
  const searchable = `${chunk.file_path} ${chunk.heading_path} ${chunk.content}`.toLowerCase();

  let score = 0;
  for (const term of queryTerms) {
    if (!searchable.includes(term)) {
      continue;
    }

    // Reward direct hits in metadata more than body hits.
    if (chunk.file_path.toLowerCase().includes(term)) {
      score += 4;
    }
    if (chunk.heading_path.toLowerCase().includes(term)) {
      score += 3;
    }

    const occurrences = searchable.split(term).length - 1;
    score += Math.min(occurrences, 8);
  }

  if (chunk.source_kind === 'readme' || chunk.source_kind === 'docs') {
    score += 0.5;
  }

  return score;
}

function buildExcerpt(text: string): string {
  const compact = text.replace(/\s+/g, ' ').trim();
  if (compact.length <= 220) {
    return compact;
  }
  return `${compact.slice(0, 220)}...`;
}

function confidenceFromScores(scores: number[]): number {
  if (scores.length === 0) {
    return 0;
  }

  const peak = Math.max(...scores);
  const normalized = Math.min(1, peak / 20);
  return Number(normalized.toFixed(2));
}

function loadChunks(): KnowledgeChunk[] {
  return readJsonFile<KnowledgeChunk[]>(chunksPath, []);
}

function loadSnapshot(): string {
  const manifest = readJsonFile<KnowledgeManifest>(manifestPath, {});
  return manifest.snapshot || 'unknown';
}

export function answerKnowledgeQuery(query: string, topK = 5): KnowledgeAnswer {
  const trimmed = query.trim();
  const chunks = loadChunks();
  const snapshot = loadSnapshot();

  if (!trimmed) {
    return {
      answer: 'A question is required before retrieval can run.',
      confidence: 0,
      citations: [],
      totalChunks: chunks.length,
      snapshot,
    };
  }

  if (chunks.length === 0) {
    return {
      answer: 'Knowledge index is empty. Run `npm run graph:build` to generate chunks first.',
      confidence: 0,
      citations: [],
      totalChunks: 0,
      snapshot,
    };
  }

  const queryTerms = tokenize(trimmed);
  const ranked = chunks
    .map((chunk) => ({
      chunk,
      score: getChunkScore(chunk, queryTerms),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, Math.min(12, topK * 2)));

  if (ranked.length === 0) {
    return {
      answer: 'No grounded evidence was found for this query in the current index. Try adding repository names, file paths, or exact symbols.',
      confidence: 0.05,
      citations: [],
      totalChunks: chunks.length,
      snapshot,
    };
  }

  const citations: KnowledgeCitation[] = ranked.slice(0, Math.max(1, Math.min(8, topK))).map((item) => ({
    chunkId: item.chunk.id,
    filePath: item.chunk.file_path,
    headingPath: item.chunk.heading_path,
    sourceKind: item.chunk.source_kind,
    lastUpdatedAt: item.chunk.last_updated_at,
    score: Number(item.score.toFixed(2)),
    excerpt: buildExcerpt(item.chunk.content),
  }));

  const grouped = new Map<string, { heading: string; hits: number }>();
  for (const citation of citations) {
    const key = citation.filePath;
    const existing = grouped.get(key);
    if (existing) {
      existing.hits += 1;
      continue;
    }
    grouped.set(key, {
      heading: citation.headingPath,
      hits: 1,
    });
  }

  const bullets = Array.from(grouped.entries())
    .slice(0, 4)
    .map(([filePath, info]) => `- ${filePath} (${info.heading}, evidence hits: ${info.hits})`)
    .join('\n');

  const answer = [
    'Most relevant grounded sources for this query:',
    bullets,
    '',
    'Use the citations below to inspect exact excerpts before taking action.',
  ].join('\n');

  return {
    answer,
    confidence: confidenceFromScores(citations.map((item) => item.score)),
    citations,
    totalChunks: chunks.length,
    snapshot,
  };
}
