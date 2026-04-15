import { NextResponse } from 'next/server';
import { PrismaClient } from '@gitflow/db';

const prisma = new PrismaClient();

export const dynamic = 'force-dynamic';

function isAuthorizedRead(req: Request): boolean {
  const expected = process.env.COCKPIT_READ_API_TOKEN;

  if (!expected || process.env.NODE_ENV !== 'production') {
    return true;
  }

  return req.headers.get('x-gitflow-read-token') === expected;
}

export async function GET(req: Request) {
  if (!isAuthorizedRead(req)) {
    return NextResponse.json({ repositories: [] }, { status: 401 });
  }

  try {
    const repos = await prisma.repository.findMany({
      select: { full_name: true },
      orderBy: { full_name: 'asc' },
      take: 500,
    });

    return NextResponse.json({ repositories: repos.map((repo) => repo.full_name) });
  } catch {
    return NextResponse.json({ repositories: [] }, { status: 200 });
  }
}
