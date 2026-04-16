import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
async function run() {
  const events = await p.event.count();
  const prs = await p.pullRequest.count();
  console.log(`\n======================================`);
  console.log(`TOTAL WEBHOOK EVENTS IN DB: ${events}`);
  console.log(`TOTAL PRS IN DB: ${prs}`);
  
  const lastEvent = await p.event.findFirst({ orderBy: { processed_at: 'desc' } });
  if (lastEvent) {
    console.log(`LAST EVENT AT: ${lastEvent.processed_at}`);
    console.log(`LAST EVENT TYPE: ${lastEvent.event_type}`);
  }
  console.log(`======================================\n`);
  
  await p.$disconnect();
}
run();