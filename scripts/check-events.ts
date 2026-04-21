import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

async function run() {
  const events = await p.event.count();
  const prs = await p.pullRequest.count();
  const commits = await p.commit.count();

  const eventsByType = await p.event.groupBy({
    by: ['event_type'],
    _count: {
      _all: true,
    },
    orderBy: {
      event_type: 'asc',
    },
  });

  console.log(`\n======================================`);
  console.log(`TOTAL WEBHOOK EVENTS IN DB: ${events}`);
  console.log(`TOTAL PRS IN DB: ${prs}`);
  console.log(`TOTAL COMMITS IN DB: ${commits}`);
  
  const lastEvent = await p.event.findFirst({ orderBy: { processed_at: 'desc' } });
  if (lastEvent) {
    console.log(`LAST EVENT AT: ${lastEvent.processed_at}`);
    console.log(`LAST EVENT TYPE: ${lastEvent.event_type}`);
  }

  const lastPushEvent = await p.event.findFirst({
    where: { event_type: { startsWith: 'push' } },
    orderBy: { processed_at: 'desc' },
  });

  if (lastPushEvent) {
    console.log(`LAST PUSH EVENT AT: ${lastPushEvent.processed_at}`);
  } else {
    console.log(`LAST PUSH EVENT AT: none`);
  }

  const lastCommit = await p.commit.findFirst({
    orderBy: { committed_at: 'desc' },
    include: {
      repository: { select: { full_name: true } },
    },
  });

  if (lastCommit) {
    console.log(`LAST COMMIT: ${lastCommit.repository.full_name} ${lastCommit.sha.slice(0, 12)} @ ${lastCommit.committed_at}`);
  }

  console.log('EVENT BREAKDOWN:');
  if (eventsByType.length === 0) {
    console.log('  - none');
  } else {
    for (const row of eventsByType) {
      console.log(`  - ${row.event_type}: ${row._count._all}`);
    }
  }

  console.log(`======================================\n`);
  
  await p.$disconnect();
}
run();