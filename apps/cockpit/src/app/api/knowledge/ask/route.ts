import { NextResponse } from 'next/server';
import { answerKnowledgeQuery } from '@/lib/knowledge/rag';

export const dynamic = 'force-dynamic';

type AskPayload = {
  query?: string;
  topK?: number;
};

export async function POST(req: Request) {
  let body: AskPayload;

  try {
    body = await req.json() as AskPayload;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const query = (body.query || '').trim();
  if (query.length < 3) {
    return NextResponse.json({ error: 'Query must be at least 3 characters.' }, { status: 400 });
  }

  if (query.length > 500) {
    return NextResponse.json({ error: 'Query is too long.' }, { status: 400 });
  }

  const topK = Number.isFinite(body.topK)
    ? Math.max(1, Math.min(8, Number(body.topK)))
    : 5;

  const result = answerKnowledgeQuery(query, topK);
  return NextResponse.json(result);
}
